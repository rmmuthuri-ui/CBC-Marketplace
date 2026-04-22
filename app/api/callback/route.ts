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
  const body = (await request.json()) as StkCallbackBody;
  console.log("M-PESA callback payload:", JSON.stringify(body, null, 2));

  const callback = body.Body?.stkCallback;

  if (callback?.ResultCode === 0) {
    const items = callback.CallbackMetadata?.Item;
    const rawPhone = getCallbackItem(items, "PhoneNumber");
    const amountString = getCallbackItem(items, "Amount");
    let resourceId = getCallbackItem(items, "AccountReference");

    if (rawPhone && amountString) {
      try {
        const phone = normalizePhone(rawPhone);
        const amount = Number(amountString);

        if (!Number.isNaN(amount)) {
          if (!resourceId) {
            const pendingLookup = await supabase
              .from("payments")
              .select("id, resource_id")
              .eq("phone", phone)
              .eq("amount", amount)
              .eq("status", "pending")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!pendingLookup.error) {
              resourceId = pendingLookup.data?.resource_id ?? null;
            }
          }

          if (resourceId) {
            const markPaid = await supabase.from("payments").insert({
              phone,
              amount,
              resource_id: resourceId,
              status: "paid",
            });

            if (markPaid.error) {
              console.error("Failed to insert paid payment:", markPaid.error.message);
            } else {
              console.log("Payment confirmed:", { phone, amount, resourceId });
            }
          }
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
