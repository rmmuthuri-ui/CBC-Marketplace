import { NextResponse } from "next/server";
import { generatePassword, getTimestamp, normalizePhone } from "@/lib/mpesa";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type StkPushPayload = {
  phone: string;
  resourceId: string;
};

const MPESA_PRODUCTION_BASE_URL = "https://api.safaricom.co.ke";

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

type StkApiResponse = {
  ResponseCode?: string;
  ResponseDescription?: string;
  CustomerMessage?: string;
  CheckoutRequestID?: string;
  errorMessage?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as StkPushPayload | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    console.log("STK PUSH incoming request body:", body);

    const { phone, resourceId } = body;

    if (!phone || !resourceId?.trim()) {
      return NextResponse.json(
        { error: "Phone number and resource ID are required." },
        { status: 400 },
      );
    }

    const consumerKey = getRequiredEnv("MPESA_CONSUMER_KEY");
    const consumerSecret = getRequiredEnv("MPESA_CONSUMER_SECRET");
    const shortcode = getRequiredEnv("MPESA_SHORTCODE");
    const passkey = getRequiredEnv("MPESA_PASSKEY");
    const callbackUrl = getRequiredEnv("MPESA_CALLBACK_URL");
    const configuredBaseUrl = process.env.MPESA_BASE_URL?.trim();
    if (configuredBaseUrl && configuredBaseUrl !== MPESA_PRODUCTION_BASE_URL) {
      console.warn("Ignoring non-production MPESA_BASE_URL. Using production Safaricom URL.");
    }

    const mpesaBaseUrl = MPESA_PRODUCTION_BASE_URL;
    console.log("M-PESA env validation:", {
      hasConsumerKey: Boolean(consumerKey),
      hasConsumerSecret: Boolean(consumerSecret),
      hasPasskey: Boolean(passkey),
      hasShortcode: Boolean(shortcode),
      callbackUrl,
      mpesaBaseUrl,
    });

    const phoneNumber = normalizePhone(phone);
    const normalizedResourceId = resourceId.trim();
    console.log("Formatted phone for STK:", {
      inputPhone: phone,
      formattedPhone: phoneNumber,
    });

    const productResult = await supabaseAdmin
      .from("products")
      .select("id, price")
      .eq("id", normalizedResourceId)
      .maybeSingle();

    if (productResult.error || !productResult.data?.id) {
      return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    }

    const parsedProductAmount = Number(productResult.data.price);
    if (!Number.isFinite(parsedProductAmount) || parsedProductAmount <= 0) {
      return NextResponse.json({ error: "Resource price is invalid." }, { status: 400 });
    }

    const amount = Math.round(parsedProductAmount);

    console.log("STK normalized fields:", {
      phoneNumber,
      amount,
      resourceId: normalizedResourceId,
    });

    const timestamp = getTimestamp();
    const password = generatePassword(shortcode, passkey, timestamp);

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

    const tokenResponse = await fetch(
      `${mpesaBaseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    const tokenRaw = await tokenResponse.text();
    const tokenData = parseJsonSafe<{
      access_token?: string;
      errorMessage?: string;
    }>(tokenRaw);
    console.log("Safaricom token response:", {
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

    const stkBody = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerBuyGoodsOnline",
      Amount: Number(amount),
      PartyA: phoneNumber,
      PartyB: shortcode,
      PhoneNumber: phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: normalizedResourceId,
      TransactionDesc: "Payment for CBC resources",
    };
    console.log("Safaricom STK request payload:", stkBody);

    const stkResponse = await fetch(`${mpesaBaseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(stkBody),
      cache: "no-store",
    });

    const stkRaw = await stkResponse.text();
    const stkData = parseJsonSafe<StkApiResponse>(stkRaw);
    console.log("Safaricom STK API response:", {
      status: stkResponse.status,
      ok: stkResponse.ok,
      body: stkData ?? stkRaw ?? null,
    });

    if (!stkResponse.ok || !stkData) {
      return NextResponse.json(
        {
          error: "Failed to initiate STK push.",
          details: stkData ?? "Empty/invalid STK response from M-PESA.",
          status: stkResponse.status,
        },
        { status: 502 },
      );
    }

    const responseCode = String(stkData.ResponseCode ?? "");
    const checkoutRequestId = stkData.CheckoutRequestID?.trim() || null;

    if (responseCode !== "0" || !checkoutRequestId) {
      return NextResponse.json(
        {
          error:
            stkData.errorMessage ||
            stkData.CustomerMessage ||
            stkData.ResponseDescription ||
            "M-PESA did not accept the STK request. Please confirm your phone number and try again.",
          details: stkData,
          status: stkResponse.status,
        },
        { status: 502 },
      );
    }

    const intentInsert = await supabaseAdmin.from("payment_intents").upsert(
      {
        checkout_request_id: checkoutRequestId,
        phone: phoneNumber,
        resource_id: normalizedResourceId,
        amount,
        status: "initiated",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "checkout_request_id" },
    );

    if (intentInsert.error) {
      console.error("Failed to persist payment intent:", intentInsert.error.message);
    }

    return NextResponse.json(stkData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    console.error("STK PUSH fatal error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
