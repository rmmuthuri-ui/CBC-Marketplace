import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAdminReviewKey, isValidAdminReviewKey } from "@/lib/adminReview";

export const runtime = "nodejs";

type ReviewResourcePayload = {
  resourceId: string;
  action: "approve" | "reject";
  rejectionReason?: string;
};

function requireAdminKey(request: Request): string | null {
  const provided = request.headers.get("x-admin-key");
  const expected = getAdminReviewKey();
  return isValidAdminReviewKey(provided, expected) ? null : "Unauthorized";
}

export async function POST(request: Request) {
  try {
    const authError = requireAdminKey(request);
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const payload = (await request.json().catch(() => null)) as ReviewResourcePayload | null;
    if (!payload?.resourceId || !payload?.action) {
      return NextResponse.json({ error: "resourceId and action are required." }, { status: 400 });
    }

    const resourceId = payload.resourceId.trim();
    const reviewedBy = request.headers.get("x-admin-user")?.trim() || "admin";
    const resource = await supabaseAdmin
      .from("seller_resources")
      .select("id, title, description, subject, grade, price, file_url")
      .eq("id", resourceId)
      .maybeSingle();

    if (resource.error || !resource.data) {
      return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    }

    if (payload.action === "reject") {
      const rejectResult = await supabaseAdmin
        .from("seller_resources")
        .update({
          review_status: "rejected",
          rejection_reason: payload.rejectionReason?.trim() || "Not approved at this time.",
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", resourceId);

      if (rejectResult.error) {
        return NextResponse.json({ error: rejectResult.error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, status: "rejected" });
    }

    const publish = await supabaseAdmin
      .from("products")
      .insert({
        title: resource.data.title,
        description: resource.data.description,
        subject: resource.data.subject,
        grade: resource.data.grade,
        price: resource.data.price,
        file_url: resource.data.file_url,
      })
      .select("id")
      .maybeSingle();

    if (publish.error || !publish.data?.id) {
      return NextResponse.json(
        { error: publish.error?.message ?? "Failed to publish resource." },
        { status: 500 },
      );
    }

    const approveResult = await supabaseAdmin
      .from("seller_resources")
      .update({
        review_status: "approved",
        rejection_reason: null,
        published_product_id: publish.data.id,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", resourceId);

    if (approveResult.error) {
      return NextResponse.json({ error: approveResult.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: "approved", productId: publish.data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
