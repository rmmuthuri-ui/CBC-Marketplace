import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const adminKey = process.env.ADMIN_REVIEW_KEY?.trim();
  const cookieKey = request.cookies.get("admin_review_key")?.value?.trim();

  if (!adminKey || !cookieKey || cookieKey !== adminKey) {
    const redirectUrl = new URL("/admin/login", request.url);
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/review"],
};
