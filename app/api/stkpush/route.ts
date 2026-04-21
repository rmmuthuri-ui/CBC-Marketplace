import { NextResponse } from "next/server";
import { formatPhoneNumber, generatePassword, getTimestamp } from "@/lib/mpesa";

export const runtime = "nodejs";

type StkPushPayload = {
  phone: string;
  amount: number;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const { phone, amount } = (await request.json()) as StkPushPayload;

    if (!phone || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "Phone number and a valid amount are required." },
        { status: 400 },
      );
    }

    const consumerKey = getRequiredEnv("MPESA_CONSUMER_KEY");
    const consumerSecret = getRequiredEnv("MPESA_CONSUMER_SECRET");
    const shortcode = getRequiredEnv("MPESA_SHORTCODE");
    const passkey = getRequiredEnv("MPESA_PASSKEY");
    const callbackUrl = getRequiredEnv("MPESA_CALLBACK_URL");

    const phoneNumber = formatPhoneNumber(phone);
    const timestamp = getTimestamp();
    const password = generatePassword(shortcode, passkey, timestamp);

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

    const tokenResponse = await fetch(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
        },
        cache: "no-store",
      },
    );

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      errorMessage?: string;
    };

    if (!tokenResponse.ok || !tokenData.access_token) {
      return NextResponse.json(
        { error: tokenData.errorMessage ?? "Failed to get M-PESA access token." },
        { status: 502 },
      );
    }

    const stkBody = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Number(amount),
      PartyA: phoneNumber,
      PartyB: shortcode,
      PhoneNumber: phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: "CBC Marketplace",
      TransactionDesc: "Payment for CBC resources",
    };

    const stkResponse = await fetch(
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(stkBody),
        cache: "no-store",
      },
    );

    const stkData = (await stkResponse.json()) as Record<string, unknown>;

    if (!stkResponse.ok) {
      return NextResponse.json(
        {
          error: "Failed to initiate STK push.",
          details: stkData,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(stkData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
