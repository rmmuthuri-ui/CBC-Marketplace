import { NextResponse } from "next/server";
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
      const phone = rawPhone ?? "unknown";
      const resourceId = getCallbackItem(items, "AccountReference") ?? checkoutRequestID ?? "unknown";
      const parsedAmount = Number(amount);
      const numericAmount = Number.isNaN(parsedAmount) ? 0 : parsedAmount;

      const insertResult = await supabase.from("payments").insert({
        phone,
        amount: numericAmount,
        resource_id: resourceId,
        status: "paid",
      });

      if (insertResult.error) {
        console.error("Failed to insert paid payment:", insertResult.error.message);
      } else {
        console.log("Payment confirmed from callback:", {
          phone,
          amount,
          resourceId,
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
