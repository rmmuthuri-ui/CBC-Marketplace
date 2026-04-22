import { NextResponse } from "next/server";
import { hasPaidForResource } from "@/lib/paymentStore";
import { formatPhoneNumber } from "@/lib/mpesa";

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
    const normalizedPhone = formatPhoneNumber(phone);
    const paid = hasPaidForResource(normalizedPhone, resourceId.trim());
    return NextResponse.json({ paid });
  } catch {
    return NextResponse.json({ paid: false }, { status: 400 });
  }
}
