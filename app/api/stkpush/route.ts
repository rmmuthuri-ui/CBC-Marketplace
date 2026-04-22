import { NextResponse } from "next/server";
import { generatePassword, getTimestamp, normalizePhone } from "@/lib/mpesa";
import { addPendingPayment } from "@/lib/paymentStore";

export const runtime = "nodejs";

type StkPushPayload = {
  phone: string;
  amount: number;
  resourceId: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  const raw = await response.text();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getMpesaBaseUrl(): string {
  const raw = process.env.MPESA_BASE_URL?.trim() || "https://api.safaricom.co.ke";
  return raw.replace(/\/+$/, "");
}

export async function POST(request: Request) {
  try {
    const { phone, amount, resourceId } = (await request.json()) as StkPushPayload;

    if (!phone || !amount || Number(amount) <= 0 || !resourceId?.trim()) {
      return NextResponse.json(
        { error: "Phone number, resource ID, and a valid amount are required." },
        { status: 400 },
      );
    }

    const consumerKey = getRequiredEnv("MPESA_CONSUMER_KEY");
    const consumerSecret = getRequiredEnv("MPESA_CONSUMER_SECRET");
    const shortcode = getRequiredEnv("MPESA_SHORTCODE");
    const passkey = getRequiredEnv("MPESA_PASSKEY");
    const callbackUrl = getRequiredEnv("MPESA_CALLBACK_URL");
    const mpesaBaseUrl = getMpesaBaseUrl();

    const phoneNumber = normalizePhone(phone);
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
    const tokenData = (() => {
      if (!tokenRaw) {
        return null;
      }
      try {
        return JSON.parse(tokenRaw) as {
          access_token?: string;
          errorMessage?: string;
        };
      } catch {
        return null;
      }
    })();

    if (!tokenResponse.ok || !tokenData?.access_token) {
      return NextResponse.json(
        {
          error: tokenData?.errorMessage ?? "Failed to get M-PESA access token.",
          status: tokenResponse.status,
          details: tokenRaw || "Empty token response from M-PESA.",
          hint: "If you are using test credentials, set MPESA_BASE_URL to https://sandbox.safaricom.co.ke",
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
      PartyB: "5493533",
      PhoneNumber: phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: resourceId.trim(),
      TransactionDesc: "Payment for CBC resources",
    };

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

    const stkData = await parseJsonSafe<Record<string, unknown>>(stkResponse);

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

    addPendingPayment(phoneNumber, resourceId.trim());

    return NextResponse.json(stkData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
