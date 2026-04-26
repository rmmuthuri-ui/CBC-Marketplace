import { NextResponse } from "next/server";
import { emailsMatch, extractBearerToken, normalizeEmail } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

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

  const { searchParams } = new URL(request.url);
  const email = normalizeEmail(searchParams.get("email"));

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  if (!emailsMatch(email, authEmail)) {
    return NextResponse.json({ error: "You can only view your own seller status." }, { status: 403 });
  }

  const profileLookup = await supabaseAdmin
    .from("seller_profiles")
    .select("status")
    .eq("email", email)
    .maybeSingle();

  if (profileLookup.error) {
    return NextResponse.json({ error: profileLookup.error.message }, { status: 500 });
  }

  if (profileLookup.data?.status === "active") {
    const approvedApplication = await supabaseAdmin
      .from("seller_applications")
      .select("notes, updated_at")
      .eq("email", email)
      .maybeSingle();

    if (approvedApplication.error) {
      return NextResponse.json({ error: approvedApplication.error.message }, { status: 500 });
    }

    return NextResponse.json({
      status: "approved",
      notes: approvedApplication.data?.notes ?? null,
      reviewedAt: approvedApplication.data?.updated_at ?? null,
    });
  }

  const applicationLookup = await supabaseAdmin
    .from("seller_applications")
    .select("status, notes, updated_at")
    .eq("email", email)
    .maybeSingle();

  if (applicationLookup.error) {
    return NextResponse.json({ error: applicationLookup.error.message }, { status: 500 });
  }

  return NextResponse.json({
    status: applicationLookup.data?.status ?? "not_applied",
    notes: applicationLookup.data?.notes ?? null,
    reviewedAt: applicationLookup.data?.updated_at ?? null,
  });
}
