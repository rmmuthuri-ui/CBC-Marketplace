import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/mpesa";
import { getPayment } from "@/lib/paymentStore";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type VerifyPayload = {
  phone: string;
  resourceId: string;
};

export async function POST(request: Request) {
  const { phone, resourceId } = (await request.json()) as VerifyPayload;

  if (!phone || !resourceId?.trim()) {
    return NextResponse.json({ paid: false }, { status: 400 });
  }

  try {
    const normalizedPhone = normalizePhone(phone);
    const normalizedResourceId = resourceId.trim();
    console.log("Verify-payment input:", {
      phone: normalizedPhone,
      resourceId: normalizedResourceId,
    });

    const payment = getPayment(normalizedPhone, normalizedResourceId);
    const paid = payment?.status === "paid";
    console.log("Verify-payment query result:", {
      paid,
      payment: payment ?? null,
    });

    if (!paid) {
      return NextResponse.json({ paid: false });
    }

    const resourceRecord = await supabaseAdmin
      .from("products")
      .select("file_url")
      .eq("id", normalizedResourceId)
      .maybeSingle();

    if (resourceRecord.error || !resourceRecord.data?.file_url) {
      return NextResponse.json({ paid: false });
    }

    const resourcePath = resourceRecord.data.file_url;
    const signed = await supabaseAdmin
      .storage
      .from("Resources")
      .createSignedUrl(resourcePath, 60);

    if (signed.error || !signed.data?.signedUrl) {
      console.error("Failed to generate signed URL:", signed.error?.message ?? "unknown");
      return NextResponse.json({ paid: false });
    }

    return NextResponse.json({
      paid: true,
      url: signed.data.signedUrl,
    });
  } catch {
    return NextResponse.json({ paid: false }, { status: 400 });
  }
}
