import { NextResponse } from "next/server";
import { generatePassword, getTimestamp, normalizePhone } from "@/lib/mpesa";
import { ensureSellerLedgerEntryForPayment } from "@/lib/sellerLedger";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type StkPushQueryPayload = {
  checkoutRequestId?: string;
  phone?: string;
  resourceId?: string;
};

type StkPushQueryResponse = {
  ResponseCode?: string;
  ResponseDescription?: string;
  ResultCode?: string;
  ResultDesc?: string;
  CheckoutRequestID?: string;
  errorMessage?: string;
};

const MPESA_PRODUCTION_BASE_URL = "https://api.safaricom.co.ke";
const MPESA_OAUTH_URL = "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
const MPESA_STK_PUSH_QUERY_URL = "https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query";

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
  try {
    const body = (await request.json().catch(() => null)) as StkPushQueryPayload | null;
    let checkoutRequestId = body?.checkoutRequestId?.trim() || "";
    const fallbackPhone = body?.phone?.trim() ? normalizePhone(body.phone) : null;
    const fallbackResourceId = body?.resourceId?.trim() || null;

    if (!checkoutRequestId && fallbackPhone && fallbackResourceId) {
      const latestIntent = await supabaseAdmin
        .from("payment_intents")
        .select("checkout_request_id")
        .eq("phone", fallbackPhone)
        .eq("resource_id", fallbackResourceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      checkoutRequestId = latestIntent.data?.checkout_request_id?.trim() || "";
    }

    if (!checkoutRequestId) {
      return NextResponse.json(
        { error: "No checkoutRequestId available yet for this payment. Start payment again." },
        { status: 400 },
      );
    }

    const consumerKey = getRequiredEnv("MPESA_CONSUMER_KEY");
    const consumerSecret = getRequiredEnv("MPESA_CONSUMER_SECRET");
    const shortcode = getRequiredEnv("MPESA_SHORTCODE");
    const passkey = getRequiredEnv("MPESA_PASSKEY");
    const configuredBaseUrl = process.env.MPESA_BASE_URL?.trim();

    if (configuredBaseUrl && configuredBaseUrl !== MPESA_PRODUCTION_BASE_URL) {
      console.warn("Ignoring non-production MPESA_BASE_URL. Using production Safaricom URL.");
    }

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
    const tokenData = parseJsonSafe<{ access_token?: string; errorMessage?: string }>(tokenRaw);
    console.log("Safaricom STK Query token response:", {
      status: tokenResponse.status,
      ok: tokenResponse.ok,
      body: tokenData ?? tokenRaw ?? null,
    });

    if (!tokenResponse.ok || !tokenData?.access_token) {
      return NextResponse.json(
        {
          error: tokenData?.errorMessage ?? "Failed to get M-PESA access token.",
          status: tokenResponse.status,
          details: tokenRaw || "Empty token response from M-PESA.",
        },
        { status: 502 },
      );
    }

    const timestamp = getTimestamp();
    const password = generatePassword(shortcode, passkey, timestamp);
    const queryPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    console.log("Safaricom STK query payload:", queryPayload);

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
    const queryData = parseJsonSafe<StkPushQueryResponse>(queryRaw);
    console.log("Safaricom STK query response:", {
      status: queryResponse.status,
      ok: queryResponse.ok,
      body: queryData ?? queryRaw ?? null,
    });

    if (!queryResponse.ok || !queryData) {
      return NextResponse.json(
        {
          error: "Failed to query STK push status.",
          status: queryResponse.status,
          details: queryData ?? queryRaw ?? "Empty/invalid STK query response.",
        },
        { status: 502 },
      );
    }

    const resultCode = String(queryData.ResultCode ?? "");
    if (resultCode === "0") {
      const intentLookup = await supabaseAdmin
        .from("payment_intents")
        .select("checkout_request_id, phone, amount, resource_id")
        .eq("checkout_request_id", checkoutRequestId)
        .maybeSingle();

      const paidAt = new Date().toISOString();
      const effectivePhone = intentLookup.data?.phone ?? fallbackPhone;
      const effectiveResourceId = intentLookup.data?.resource_id ?? fallbackResourceId;
      let effectiveAmount = Number(intentLookup.data?.amount ?? 0);

      if ((!effectiveAmount || effectiveAmount <= 0) && effectiveResourceId) {
        const productLookup = await supabaseAdmin
          .from("products")
          .select("price")
          .eq("id", effectiveResourceId)
          .maybeSingle();
        effectiveAmount = Number(productLookup.data?.price ?? 0);
      }

      if (intentLookup.data && !intentLookup.error) {
        await supabaseAdmin
          .from("payment_intents")
          .update({ status: "paid", paid_at: paidAt, updated_at: paidAt })
          .eq("checkout_request_id", checkoutRequestId);
      } else if (effectivePhone && effectiveResourceId) {
        await supabaseAdmin.from("payment_intents").upsert(
          {
            checkout_request_id: checkoutRequestId,
            phone: effectivePhone,
            resource_id: effectiveResourceId,
            amount: Number(effectiveAmount || 0),
            status: "paid",
            paid_at: paidAt,
            updated_at: paidAt,
          },
          { onConflict: "checkout_request_id" },
        );
      } else if (intentLookup.error) {
        console.error("Failed to lookup payment intent for STK query fallback:", intentLookup.error);
      }

      if (effectivePhone && effectiveResourceId) {
        const paymentUpsert = await supabaseAdmin.from("payments").upsert(
          {
            checkout_request_id: checkoutRequestId,
            phone: effectivePhone,
            amount: Number(effectiveAmount || 0),
            resource_id: effectiveResourceId,
            status: "paid",
          },
          { onConflict: "checkout_request_id" },
        )
        .select("id")
        .maybeSingle();

        if (paymentUpsert.error) {
          console.error("Failed to upsert payment from STK query fallback:", paymentUpsert.error);
        } else if (paymentUpsert.data?.id) {
          await ensureSellerLedgerEntryForPayment(paymentUpsert.data.id);
        }
      }
    }

    return NextResponse.json(queryData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    console.error("STK query fatal error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
