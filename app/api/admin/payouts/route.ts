import { NextResponse } from "next/server";
import { getAdminReviewKey, getAdminKeyFromRequest, isValidAdminReviewKey } from "@/lib/adminReview";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type PayoutActionPayload =
  | {
      action: "create_batch";
      periodStart: string;
      periodEnd: string;
    }
  | {
      action: "mark_paid";
      payoutId: string;
      paymentReference: string;
    };

type LedgerRow = {
  id: string;
  seller_email: string;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
};

function requireAdminKey(request: Request): string | null {
  const provided = getAdminKeyFromRequest(request);
  const expected = getAdminReviewKey();
  return isValidAdminReviewKey(provided, expected) ? null : "Unauthorized";
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function GET(request: Request) {
  const authError = requireAdminKey(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const payouts = await supabaseAdmin
    .from("seller_payouts")
    .select(
      "id, seller_email, period_start, period_end, total_gross, total_fee, total_net, status, payment_reference, paid_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (payouts.error) {
    return NextResponse.json({ error: payouts.error.message }, { status: 500 });
  }

  return NextResponse.json({ payouts: payouts.data ?? [] });
}

export async function POST(request: Request) {
  const authError = requireAdminKey(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as PayoutActionPayload | null;
  if (!payload?.action) {
    return NextResponse.json({ error: "action is required." }, { status: 400 });
  }

  if (payload.action === "create_batch") {
    const periodStart = new Date(payload.periodStart);
    const periodEnd = new Date(payload.periodEnd);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodStart > periodEnd) {
      return NextResponse.json({ error: "Invalid payout period." }, { status: 400 });
    }

    const accruedRows = await supabaseAdmin
      .from("seller_ledger")
      .select("id, seller_email, gross_amount, commission_amount, net_amount")
      .eq("status", "accrued")
      .gte("created_at", periodStart.toISOString())
      .lte("created_at", periodEnd.toISOString())
      .order("created_at", { ascending: true });

    if (accruedRows.error) {
      return NextResponse.json({ error: accruedRows.error.message }, { status: 500 });
    }

    const ledgerRows = (accruedRows.data ?? []) as LedgerRow[];
    if (ledgerRows.length === 0) {
      return NextResponse.json({ ok: true, created: 0, message: "No accrued entries found for selected period." });
    }

    const groupedBySeller = new Map<string, LedgerRow[]>();
    for (const row of ledgerRows) {
      const email = row.seller_email?.trim().toLowerCase();
      if (!email) continue;
      const bucket = groupedBySeller.get(email) ?? [];
      bucket.push(row);
      groupedBySeller.set(email, bucket);
    }

    const createdPayoutIds: string[] = [];
    for (const [sellerEmail, entries] of groupedBySeller.entries()) {
      const totalGross = roundCurrency(entries.reduce((acc, row) => acc + Number(row.gross_amount || 0), 0));
      const totalFee = roundCurrency(entries.reduce((acc, row) => acc + Number(row.commission_amount || 0), 0));
      const totalNet = roundCurrency(entries.reduce((acc, row) => acc + Number(row.net_amount || 0), 0));

      const payoutInsert = await supabaseAdmin
        .from("seller_payouts")
        .insert({
          seller_email: sellerEmail,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          total_gross: totalGross,
          total_fee: totalFee,
          total_net: totalNet,
          status: "ready",
          created_by: request.headers.get("x-admin-user")?.trim() || "admin",
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();

      if (payoutInsert.error || !payoutInsert.data?.id) {
        return NextResponse.json({ error: payoutInsert.error?.message ?? "Failed to create payout batch." }, { status: 500 });
      }

      const payoutId = payoutInsert.data.id;
      createdPayoutIds.push(payoutId);

      const itemsInsert = await supabaseAdmin.from("seller_payout_items").insert(
        entries.map((row) => ({
          payout_id: payoutId,
          ledger_entry_id: row.id,
          gross_amount: Number(row.gross_amount || 0),
          fee_amount: Number(row.commission_amount || 0),
          net_amount: Number(row.net_amount || 0),
        })),
      );

      if (itemsInsert.error) {
        return NextResponse.json({ error: itemsInsert.error.message }, { status: 500 });
      }

      const ledgerUpdate = await supabaseAdmin
        .from("seller_ledger")
        .update({ status: "ready_for_payout" })
        .in(
          "id",
          entries.map((row) => row.id),
        );

      if (ledgerUpdate.error) {
        return NextResponse.json({ error: ledgerUpdate.error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, created: createdPayoutIds.length, payoutIds: createdPayoutIds });
  }

  if (payload.action === "mark_paid") {
    const payoutId = payload.payoutId?.trim();
    const paymentReference = payload.paymentReference?.trim();
    if (!payoutId || !paymentReference) {
      return NextResponse.json({ error: "payoutId and paymentReference are required." }, { status: 400 });
    }

    const payout = await supabaseAdmin
      .from("seller_payouts")
      .select("id, status")
      .eq("id", payoutId)
      .maybeSingle();

    if (payout.error || !payout.data?.id) {
      return NextResponse.json({ error: "Payout not found." }, { status: 404 });
    }

    const paidAt = new Date().toISOString();
    const payoutUpdate = await supabaseAdmin
      .from("seller_payouts")
      .update({
        status: "paid",
        payment_reference: paymentReference,
        paid_at: paidAt,
        updated_at: paidAt,
      })
      .eq("id", payoutId);

    if (payoutUpdate.error) {
      return NextResponse.json({ error: payoutUpdate.error.message }, { status: 500 });
    }

    const items = await supabaseAdmin
      .from("seller_payout_items")
      .select("ledger_entry_id")
      .eq("payout_id", payoutId);

    if (items.error) {
      return NextResponse.json({ error: items.error.message }, { status: 500 });
    }

    const ledgerIds = (items.data ?? []).map((row) => row.ledger_entry_id).filter(Boolean);
    if (ledgerIds.length > 0) {
      const ledgerUpdate = await supabaseAdmin
        .from("seller_ledger")
        .update({ status: "paid_out" })
        .in("id", ledgerIds);

      if (ledgerUpdate.error) {
        return NextResponse.json({ error: ledgerUpdate.error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, payoutId });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
