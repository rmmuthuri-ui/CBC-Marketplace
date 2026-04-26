import { NextResponse } from "next/server";
import { emailsMatch, extractBearerToken, normalizeEmail } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type SellerResourcePayload = {
  sellerName: string;
  sellerEmail: string;
  title: string;
  description: string;
  subject: string;
  grade: string;
  price: number;
  fileUrl?: string;
};

export async function GET(request: Request) {
  const accessToken = extractBearerToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  const userResult = await supabaseAdmin.auth.getUser(accessToken);
  const authEmail = normalizeEmail(userResult.data.user?.email);
  if (userResult.error || !authEmail) {
    return NextResponse.json({ error: "Invalid authentication session." }, { status: 401 });
  }

  const resourcesLookup = await supabaseAdmin
    .from("seller_resources")
    .select(
      "id, title, subject, grade, price, review_status, rejection_reason, published_product_id, created_at, reviewed_at",
    )
    .eq("seller_email", authEmail)
    .order("created_at", { ascending: false });

  if (resourcesLookup.error) {
    return NextResponse.json({ error: resourcesLookup.error.message }, { status: 500 });
  }

  return NextResponse.json({
    sellerEmail: authEmail,
    entries: resourcesLookup.data ?? [],
  });
}

export async function POST(request: Request) {
  const accessToken = extractBearerToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  const userResult = await supabaseAdmin.auth.getUser(accessToken);
  const authEmail = normalizeEmail(userResult.data.user?.email);
  if (userResult.error || !authEmail) {
    return NextResponse.json({ error: "Invalid authentication session." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as SellerResourcePayload | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const sellerName = payload.sellerName?.trim();
  const sellerEmail = normalizeEmail(payload.sellerEmail);
  const title = payload.title?.trim();
  const description = payload.description?.trim();
  const subject = payload.subject?.trim();
  const grade = payload.grade?.trim();
  const fileUrl = payload.fileUrl?.trim() || null;
  const price = Number(payload.price);

  if (!sellerName || !sellerEmail || !title || !description || !subject || !grade || price <= 0) {
    return NextResponse.json(
      { error: "Seller info, resource details, and valid price are required." },
      { status: 400 },
    );
  }

  if (!emailsMatch(authEmail, sellerEmail)) {
    return NextResponse.json({ error: "Authenticated seller email does not match payload email." }, { status: 403 });
  }

  const sellerProfile = await supabaseAdmin
    .from("seller_profiles")
    .select("id, status")
    .eq("email", sellerEmail)
    .maybeSingle();

  if (sellerProfile.error) {
    return NextResponse.json({ error: sellerProfile.error.message }, { status: 500 });
  }

  if (!sellerProfile.data?.id || sellerProfile.data.status !== "active") {
    return NextResponse.json(
      {
        error: "Seller account is not approved yet. Please wait for admin approval before submitting resources.",
      },
      { status: 403 },
    );
  }

  const insertResult = await supabaseAdmin
    .from("seller_resources")
    .insert({
      seller_name: sellerName,
      seller_email: sellerEmail,
      title,
      description,
      subject,
      grade,
      price,
      file_url: fileUrl,
      review_status: "pending",
    })
    .select("id, review_status")
    .maybeSingle();

  if (insertResult.error) {
    return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    resourceId: insertResult.data?.id ?? null,
    status: insertResult.data?.review_status ?? "pending",
  });
}
