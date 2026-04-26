import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAdminReviewKey, isValidAdminReviewKey } from "@/lib/adminReview";

export const runtime = "nodejs";

function requireAdminKey(request: Request): string | null {
  const provided = request.headers.get("x-admin-key");
  const expected = getAdminReviewKey();
  return isValidAdminReviewKey(provided, expected) ? null : "Unauthorized";
}

export async function GET(request: Request) {
  try {
    const authError = requireAdminKey(request);
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const [applications, resources] = await Promise.all([
      supabaseAdmin
        .from("seller_applications")
        .select("id, full_name, email, phone, bio, subjects, status, notes, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("seller_resources")
        .select(
          "id, seller_name, seller_email, title, description, subject, grade, price, file_url, review_status, rejection_reason, created_at",
        )
        .eq("review_status", "pending")
        .order("created_at", { ascending: true }),
    ]);

    if (applications.error || resources.error) {
      return NextResponse.json(
        {
          error: applications.error?.message || resources.error?.message || "Failed to fetch review queue.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      applications: applications.data ?? [],
      resources: resources.data ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
