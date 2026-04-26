import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/mpesa";
import { ensureSellerLedgerEntryForPayment } from "@/lib/sellerLedger";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type CallbackItem = {
  Name: string;
  Value?: string | number;
};

type StkCallbackBody = {
  Body?: {
    stkCallback?: {
      ResultCode?: number;
      CheckoutRequestID?: string;
      CallbackMetadata?: {
        Item?: CallbackItem[];
      };
    };
  };
};

function getCallbackItem(items: CallbackItem[] | undefined, key: string): string | null {
  const value = items?.find((item) => item.Name === key)?.Value;
  if (value === undefined || value === null) {
    return null;
  }
  return String(value);
}

export async function POST(request: Request) {
  console.log("🔥 CALLBACK HIT");
  const expectedToken = process.env.MPESA_CALLBACK_TOKEN?.trim();
  if (expectedToken) {
    const callbackToken = new URL(request.url).searchParams.get("token")?.trim() ?? "";
    if (!callbackToken) {
      console.warn("MPESA_CALLBACK_TOKEN is set, but callback arrived without token query parameter.");
    } else if (callbackToken !== expectedToken) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Unauthorized callback" }, { status: 401 });
    }
  }

  const body = (await request.json().catch(() => null)) as StkCallbackBody | null;
  if (!body) {
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: "Accepted",
    });
  }

  try {
    console.log("M-PESA callback payload:", JSON.stringify(body, null, 2));
  } catch {
    console.log("M-PESA callback payload: [unserializable payload]");
  }

  const callback = body.Body?.stkCallback;
  const items = callback?.CallbackMetadata?.Item;
  const rawPhone = getCallbackItem(items, "PhoneNumber");
  const amount = getCallbackItem(items, "Amount");
  const receiptNumber = getCallbackItem(items, "MpesaReceiptNumber");
  const resultCode = callback?.ResultCode ?? null;
  const checkoutRequestID = callback?.CheckoutRequestID ?? null;

  console.log("Callback parsed values:", {
    checkoutRequestID,
    phoneNumber: rawPhone,
    amount,
    receiptNumber,
    resultCode,
  });

  if (checkoutRequestID) {
    await supabaseAdmin
      .from("payment_intents")
      .update({
        status: resultCode === 0 ? "paid" : "failed",
        paid_at: resultCode === 0 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("checkout_request_id", checkoutRequestID);
  }

  if (resultCode === 0 && checkoutRequestID) {
    try {
      const intentResult = await supabaseAdmin
        .from("payment_intents")
        .select("resource_id, phone, amount")
        .eq("checkout_request_id", checkoutRequestID)
        .maybeSingle();

      if (intentResult.error || !intentResult.data?.resource_id) {
        console.error("Unable to link callback to resource: payment intent not found.", {
          checkoutRequestID,
          error: intentResult.error?.message ?? null,
        });
        return NextResponse.json({
          ResultCode: 0,
          ResultDesc: "Accepted",
        });
      }

      const phone = rawPhone ? normalizePhone(rawPhone) : intentResult.data.phone;
      const resourceId = intentResult.data.resource_id.trim();
      const parsedAmount = Number(amount ?? intentResult.data.amount);
      const numericAmount = Number.isNaN(parsedAmount) ? 0 : parsedAmount;

      if (!resourceId) {
        console.error(
          "Unable to resolve resourceId: missing CheckoutRequestID in callback. Payment will not be linked to a resource.",
          {
            phone,
            amount: numericAmount,
            resultCode,
          },
        );
        return NextResponse.json({
          ResultCode: 0,
          ResultDesc: "Accepted",
        });
      }

      const paymentPayload = {
        phone,
        amount: numericAmount,
        resource_id: resourceId,
        status: "paid",
        checkout_request_id: checkoutRequestID,
        mpesa_receipt: receiptNumber,
      };

      console.log("Payment insert payload:", {
        phone: paymentPayload.phone,
        amount: paymentPayload.amount,
        resourceId: paymentPayload.resource_id,
        status: paymentPayload.status,
      });

      const insertResult = await supabaseAdmin
        .from("payments")
        .upsert(paymentPayload, { onConflict: "checkout_request_id" })
        .select("id")
        .maybeSingle();

      if (insertResult.error) {
        console.error("Failed to insert paid payment:", insertResult.error.message);
        console.log("Supabase insert response:", {
          success: false,
          error: insertResult.error,
        });
      } else {
        if (insertResult.data?.id) {
          await ensureSellerLedgerEntryForPayment(insertResult.data.id);
        }
        console.log("Payment confirmed from callback:", {
          phone,
          amount,
          resourceId,
        });
        console.log("Supabase insert response:", {
          success: true,
          data: insertResult.data ?? null,
        });
      }
    } catch {
      // Ignore malformed callback metadata and still acknowledge callback.
    }
  }

  return NextResponse.json({
    ResultCode: 0,
    ResultDesc: "Accepted",
  });
}
