import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/mpesa";
import { supabase } from "@/lib/supabase";

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
  const body = (await request.json()) as StkCallbackBody;
  try {
    console.log("M-PESA callback payload:", JSON.stringify(body, null, 2));
  } catch {
    console.log("M-PESA callback payload: [unserializable payload]");
  }

  const callback = body.Body?.stkCallback;
  const items = callback?.CallbackMetadata?.Item;
  const rawPhone = getCallbackItem(items, "PhoneNumber");
  const amount = getCallbackItem(items, "Amount");
  const resultCode = callback?.ResultCode ?? null;
  const checkoutRequestID = callback?.CheckoutRequestID ?? null;

  console.log("Callback parsed values:", {
    checkoutRequestID,
    phoneNumber: rawPhone,
    amount,
    resultCode,
  });

  if (resultCode === 0) {
    try {
      const phone = rawPhone ? normalizePhone(rawPhone) : "unknown";
      const resourceId = checkoutRequestID?.trim();
      const parsedAmount = Number(amount);
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
      };

      console.log("Payment insert payload:", {
        phone: paymentPayload.phone,
        amount: paymentPayload.amount,
        resourceId: paymentPayload.resource_id,
        status: paymentPayload.status,
      });

      const insertResult = await supabase.from("payments").insert(paymentPayload);

      if (insertResult.error) {
        console.error("Failed to insert paid payment:", insertResult.error.message);
        console.log("Supabase insert response:", {
          success: false,
          error: insertResult.error,
        });
      } else {
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
