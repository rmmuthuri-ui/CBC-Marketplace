import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/mpesa";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type VerifyPayload = {
  phone: string;
  resourceId: string;
  checkoutRequestId?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as VerifyPayload | null;
  if (!payload) {
    return NextResponse.json({ paid: false }, { status: 400 });
  }

  const { phone, resourceId, checkoutRequestId } = payload;

  if (!phone || !resourceId?.trim()) {
    return NextResponse.json({ paid: false }, { status: 400 });
  }

  try {
    const normalizedPhone = normalizePhone(phone);
    const normalizedResourceId = resourceId.trim();
    console.log("Verify-payment input:", {
      phone: normalizedPhone,
      resourceId: normalizedResourceId,
      checkoutRequestId: checkoutRequestId?.trim() || null,
    });

    let paymentQuery:
      | {
          data: { id: string } | null;
          error: { message: string } | null;
        }
      | undefined;

    const normalizedCheckoutRequestId = checkoutRequestId?.trim() || "";
    if (normalizedCheckoutRequestId) {
      const byCheckout = await supabaseAdmin
        .from("payments")
        .select("id")
        .eq("phone", normalizedPhone)
        .eq("resource_id", normalizedResourceId)
        .eq("checkout_request_id", normalizedCheckoutRequestId)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      paymentQuery = {
        data: byCheckout.data as { id: string } | null,
        error: byCheckout.error ? { message: byCheckout.error.message } : null,
      };
    } else {
      const byResource = await supabaseAdmin
        .from("payments")
        .select("id")
        .eq("phone", normalizedPhone)
        .eq("resource_id", normalizedResourceId)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      paymentQuery = {
        data: byResource.data as { id: string } | null,
        error: byResource.error ? { message: byResource.error.message } : null,
      };
    }

    let paid = Boolean(paymentQuery.data?.id);

    // Fallback: if callback marked intent as paid but payments row is missing, repair it.
    if (!paid && normalizedCheckoutRequestId) {
      const paidIntent = await supabaseAdmin
        .from("payment_intents")
        .select("checkout_request_id, phone, resource_id, amount, status")
        .eq("checkout_request_id", normalizedCheckoutRequestId)
        .eq("phone", normalizedPhone)
        .eq("resource_id", normalizedResourceId)
        .eq("status", "paid")
        .maybeSingle();

      if (paidIntent.data && !paidIntent.error) {
        const repairInsert = await supabaseAdmin.from("payments").upsert(
          {
            phone: paidIntent.data.phone,
            amount: Number(paidIntent.data.amount),
            resource_id: paidIntent.data.resource_id,
            status: "paid",
            checkout_request_id: paidIntent.data.checkout_request_id,
          },
          { onConflict: "checkout_request_id" },
        );

        if (!repairInsert.error) {
          paid = true;
        }
      }
    }

    console.log("Verify-payment query result:", {
      paid,
      payment: paymentQuery.data ?? null,
      error: paymentQuery.error?.message ?? null,
    });

    return NextResponse.json({ paid });
  } catch {
    return NextResponse.json({ paid: false }, { status: 400 });
  }
}
