import { NextResponse } from "next/server";
import { emailsMatch, extractBearerToken, normalizeEmail } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type SellerApplyPayload = {
  fullName: string;
  email: string;
  phone?: string;
  bio?: string;
  subjects: string[];
};

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

  const payload = (await request.json().catch(() => null)) as SellerApplyPayload | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const fullName = payload.fullName?.trim();
  const email = normalizeEmail(payload.email);
  const phone = payload.phone?.trim() || null;
  const bio = payload.bio?.trim() || null;
  const subjects = Array.isArray(payload.subjects)
    ? payload.subjects.map((item) => item.trim()).filter(Boolean)
    : [];

  if (!fullName || !email || subjects.length === 0) {
    return NextResponse.json(
      { error: "Full name, email, and at least one subject are required." },
      { status: 400 },
    );
  }

  if (!emailsMatch(authEmail, email)) {
    return NextResponse.json({ error: "Authenticated seller email does not match payload email." }, { status: 403 });
  }

  const existing = await supabaseAdmin
    .from("seller_applications")
    .select("id, status")
    .eq("email", email)
    .maybeSingle();

  if (existing.error) {
    return NextResponse.json({ error: existing.error.message }, { status: 500 });
  }

  const nextStatus = existing.data?.status === "approved" ? "approved" : "pending";

  const upsertResult = await supabaseAdmin
    .from("seller_applications")
    .upsert(
      {
        full_name: fullName,
        email,
        phone,
        bio,
        subjects,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    )
    .select("id, status")
    .maybeSingle();

  if (upsertResult.error) {
    return NextResponse.json({ error: upsertResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    applicationId: upsertResult.data?.id ?? null,
    status: upsertResult.data?.status ?? "pending",
  });
}
