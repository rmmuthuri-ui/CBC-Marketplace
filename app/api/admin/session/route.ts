import { NextResponse } from "next/server";
import { getAdminReviewKey, getAdminKeyFromRequest, isValidAdminReviewKey } from "@/lib/adminReview";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const expected = getAdminReviewKey();
    const candidate = getAdminKeyFromRequest(request);
    if (!isValidAdminReviewKey(candidate, expected)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set("admin_review_key", expected, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin_review_key", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
