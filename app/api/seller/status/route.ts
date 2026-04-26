import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = String(searchParams.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
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
