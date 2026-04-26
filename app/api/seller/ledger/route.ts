import { NextResponse } from "next/server";
import { emailsMatch, extractBearerToken, normalizeEmail } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type LedgerRow = {
  id: string;
  created_at: string;
  entry_type: string;
  status: string;
  resource_id: string | null;
  source_payment_id: string | null;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
};

function sumAmounts(rows: LedgerRow[], predicate?: (row: LedgerRow) => boolean): number {
  const filtered = predicate ? rows.filter(predicate) : rows;
  const total = filtered.reduce((acc, row) => acc + Number(row.net_amount || 0), 0);
  return Math.round(total * 100) / 100;
}

export async function GET(request: Request) {
  const accessToken = extractBearerToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  const userResult = await supabaseAdmin.auth.getUser(accessToken);
  const authEmail = normalizeEmail(userResult.data.user?.email);
  if (userResult.error || !authEmail) {
    return NextResponse.json({ error: "Invalid authentication session." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = normalizeEmail(searchParams.get("email"));

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  if (!emailsMatch(email, authEmail)) {
    return NextResponse.json({ error: "You can only view your own seller earnings." }, { status: 403 });
  }

  const profileLookup = await supabaseAdmin
    .from("seller_profiles")
    .select("id, status, display_name")
    .eq("email", email)
    .maybeSingle();

  if (profileLookup.error) {
    return NextResponse.json({ error: profileLookup.error.message }, { status: 500 });
  }

  if (!profileLookup.data?.id) {
    return NextResponse.json({ error: "Seller profile not found for this email." }, { status: 404 });
  }

  const ledgerLookup = await supabaseAdmin
    .from("seller_ledger")
    .select(
      "id, created_at, entry_type, status, resource_id, source_payment_id, gross_amount, commission_amount, net_amount",
    )
    .eq("seller_email", email)
    .order("created_at", { ascending: false });

  if (ledgerLookup.error) {
    return NextResponse.json({ error: ledgerLookup.error.message }, { status: 500 });
  }

  const rows = (ledgerLookup.data ?? []) as LedgerRow[];
  const accruedTotal = sumAmounts(rows, (row) => row.status === "accrued");
  const paidOutTotal = sumAmounts(rows, (row) => row.status === "paid_out");
  const lifetimeNetTotal = sumAmounts(rows);

  return NextResponse.json({
    seller: {
      email,
      displayName: profileLookup.data.display_name ?? null,
      status: profileLookup.data.status ?? null,
    },
    totals: {
      accrued: accruedTotal,
      paidOut: paidOutTotal,
      lifetimeNet: lifetimeNetTotal,
      entries: rows.length,
    },
    entries: rows,
  });
}
