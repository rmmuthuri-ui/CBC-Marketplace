import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  console.log("M-PESA callback payload:", JSON.stringify(body, null, 2));

  return NextResponse.json({
    ResultCode: 0,
    ResultDesc: "Accepted",
  });
}
