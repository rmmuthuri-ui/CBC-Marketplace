import { NextResponse } from "next/server";
import { generatePassword, getTimestamp, normalizePhone } from "@/lib/mpesa";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const MPESA_OAUTH_URL = "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
const MPESA_STK_PUSH_QUERY_URL = "https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query";

type VerifyPayload = {
  phone: string;
  resourceId: string;
  checkoutRequestId?: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseJsonSafe<T>(raw: string): T | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

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

    // Deep fallback: query Safaricom status directly from verify-payment when still not paid.
    if (!paid) {
      const latestIntent = await supabaseAdmin
        .from("payment_intents")
        .select("checkout_request_id, phone, resource_id, amount, status")
        .eq("phone", normalizedPhone)
        .eq("resource_id", normalizedResourceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const latestCheckoutRequestId =
        latestIntent.data?.checkout_request_id?.trim() || normalizedCheckoutRequestId;

      if (latestCheckoutRequestId) {
        const consumerKey = getRequiredEnv("MPESA_CONSUMER_KEY");
        const consumerSecret = getRequiredEnv("MPESA_CONSUMER_SECRET");
        const shortcode = getRequiredEnv("MPESA_SHORTCODE");
        const passkey = getRequiredEnv("MPESA_PASSKEY");

        const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
        const tokenResponse = await fetch(MPESA_OAUTH_URL, {
          method: "GET",
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        const tokenRaw = await tokenResponse.text();
        const tokenData = parseJsonSafe<{ access_token?: string }>(tokenRaw);

        if (tokenResponse.ok && tokenData?.access_token) {
          const timestamp = getTimestamp();
          const password = generatePassword(shortcode, passkey, timestamp);
          const queryPayload = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            CheckoutRequestID: latestCheckoutRequestId,
          };

          const queryResponse = await fetch(MPESA_STK_PUSH_QUERY_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(queryPayload),
            cache: "no-store",
          });

          const queryRaw = await queryResponse.text();
          const queryData = parseJsonSafe<{ ResultCode?: string | number }>(queryRaw);
          const resultCode = String(queryData?.ResultCode ?? "");

          if (queryResponse.ok && resultCode === "0") {
            const amount = Number(latestIntent.data?.amount ?? 0);
            const repairedAmount = Number.isFinite(amount) && amount > 0 ? amount : 1;
            const paidAt = new Date().toISOString();

            await supabaseAdmin
              .from("payment_intents")
              .upsert(
                {
                  checkout_request_id: latestCheckoutRequestId,
                  phone: normalizedPhone,
                  resource_id: normalizedResourceId,
                  amount: repairedAmount,
                  status: "paid",
                  paid_at: paidAt,
                  updated_at: paidAt,
                },
                { onConflict: "checkout_request_id" },
              );

            const paymentRepair = await supabaseAdmin.from("payments").upsert(
              {
                phone: normalizedPhone,
                amount: repairedAmount,
                resource_id: normalizedResourceId,
                status: "paid",
                checkout_request_id: latestCheckoutRequestId,
              },
              { onConflict: "checkout_request_id" },
            );

            if (!paymentRepair.error) {
              paid = true;
            }
          }
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
