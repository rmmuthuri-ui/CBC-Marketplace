import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAdminReviewKey, isValidAdminReviewKey } from "@/lib/adminReview";

export const runtime = "nodejs";

type ReviewApplicationPayload = {
  applicationId: string;
  action: "approve" | "reject";
  notes?: string;
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

    const payload = (await request.json().catch(() => null)) as ReviewApplicationPayload | null;
    if (!payload?.applicationId || !payload?.action) {
      return NextResponse.json({ error: "applicationId and action are required." }, { status: 400 });
    }

    const applicationId = payload.applicationId.trim();
    const notes = payload.notes?.trim() || null;
    const status = payload.action === "approve" ? "approved" : "rejected";

    const application = await supabaseAdmin
      .from("seller_applications")
      .select("id, full_name, email, phone")
      .eq("id", applicationId)
      .maybeSingle();

    if (application.error || !application.data) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    const updateResult = await supabaseAdmin
      .from("seller_applications")
      .update({
        status,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    if (updateResult.error) {
      return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
    }

    if (payload.action === "approve") {
      const profileUpsert = await supabaseAdmin.from("seller_profiles").upsert(
        {
          application_id: application.data.id,
          display_name: application.data.full_name,
          email: application.data.email,
          phone: application.data.phone,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      );

      if (profileUpsert.error) {
        return NextResponse.json({ error: profileUpsert.error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
