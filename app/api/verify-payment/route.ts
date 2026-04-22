import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/mpesa";
import { supabase } from "@/lib/supabase";

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

    const paymentQuery = await supabase
      .from("payments")
      .select("id")
      .eq("phone", normalizedPhone)
      .eq("resource_id", normalizedResourceId)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const paid = Boolean(paymentQuery.data?.id);
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
