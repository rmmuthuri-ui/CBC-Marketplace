import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/mpesa";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type DownloadPayload = {
  phone: string;
  resourceId: string;
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as DownloadPayload | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { phone, resourceId } = payload;

  if (!phone || !resourceId?.trim()) {
    return NextResponse.json({ error: "Phone and resourceId are required." }, { status: 400 });
  }

  try {
    const normalizedPhone = normalizePhone(phone);
    const normalizedResourceId = resourceId.trim();

    const payment = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("phone", normalizedPhone)
      .eq("resource_id", normalizedResourceId)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (payment.error) {
      return NextResponse.json({ error: "Failed to verify payment." }, { status: 500 });
    }

    if (!payment.data?.id) {
      return NextResponse.json({ error: "Not paid" }, { status: 403 });
    }

    const resourceRecord = await supabaseAdmin
      .from("products")
      .select("file_url")
      .eq("id", normalizedResourceId)
      .maybeSingle();

    if (resourceRecord.error || !resourceRecord.data?.file_url) {
      return NextResponse.json({ error: "Resource file not found." }, { status: 404 });
    }

    const signed = await supabaseAdmin.storage
      .from("Resources")
      .createSignedUrl(resourceRecord.data.file_url, 60);

    if (signed.error || !signed.data?.signedUrl) {
      return NextResponse.json({ error: "Failed to generate secure download URL." }, { status: 500 });
    }

    return NextResponse.json({ url: signed.data.signedUrl });
  } catch {
    return NextResponse.json({ error: "Download request failed." }, { status: 500 });
  }
}
