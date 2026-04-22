import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/mpesa";
import { markPaymentPaid } from "@/lib/paymentStore";

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
  console.log("🔥 MPESA CALLBACK HIT");
  const body = (await request.json()) as StkCallbackBody;
  try {
    console.log("M-PESA callback payload:", JSON.stringify(body, null, 2));
  } catch {
    console.log("M-PESA callback payload: [unserializable payload]");
  }

  const callback = body.Body?.stkCallback;

  if (callback?.ResultCode === 0) {
    const items = callback.CallbackMetadata?.Item;
    const rawPhone = getCallbackItem(items, "PhoneNumber");
    const amount = getCallbackItem(items, "Amount");
    const resourceId = getCallbackItem(items, "AccountReference");

    if (rawPhone && resourceId) {
      try {
        const phone = normalizePhone(rawPhone);
        markPaymentPaid(phone, resourceId);
        console.log("Payment confirmed from callback:", {
          phone,
          amount,
          resourceId,
        });
      } catch {
        // Ignore malformed callback metadata and still acknowledge callback.
      }
    }
  }

  return NextResponse.json({
    ResultCode: 0,
    ResultDesc: "Accepted",
  });
}
