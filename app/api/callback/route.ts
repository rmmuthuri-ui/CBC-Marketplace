import { NextResponse } from "next/server";
import { markPaymentPaid, resolveResourceFromCheckout } from "@/lib/paymentStore";
import { formatPhoneNumber } from "@/lib/mpesa";

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
  const body = (await request.json()) as StkCallbackBody;
  console.log("M-PESA callback payload:", JSON.stringify(body, null, 2));

  const callback = body.Body?.stkCallback;

  if (callback?.ResultCode === 0) {
    const items = callback.CallbackMetadata?.Item;
    const rawPhone = getCallbackItem(items, "PhoneNumber");
    const amountString = getCallbackItem(items, "Amount");
    const checkoutRequestId = callback.CheckoutRequestID ?? "";
    const resourceId =
      resolveResourceFromCheckout(checkoutRequestId) ??
      getCallbackItem(items, "AccountReference");

    if (rawPhone && amountString && resourceId) {
      try {
        const phone = formatPhoneNumber(rawPhone);
        const amount = Number(amountString);

        if (!Number.isNaN(amount)) {
          markPaymentPaid({
            phone,
            amount,
            resourceId,
            status: "paid",
            checkoutRequestId,
          });
        }
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
