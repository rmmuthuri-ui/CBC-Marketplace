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
    return NextResponse.json({ status: "approved" });
  }

  const applicationLookup = await supabaseAdmin
    .from("seller_applications")
    .select("status")
    .eq("email", email)
    .maybeSingle();

  if (applicationLookup.error) {
    return NextResponse.json({ error: applicationLookup.error.message }, { status: 500 });
  }

  return NextResponse.json({ status: applicationLookup.data?.status ?? "not_applied" });
}
