import { NextResponse } from "next/server";
import { emailsMatch, extractBearerToken, normalizeEmail } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx", "zip"];

function sanitizeSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export async function POST(request: Request) {
  try {
    const accessToken = extractBearerToken(request.headers.get("authorization"));
    if (!accessToken) {
      return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
    }

    const userResult = await supabaseAdmin.auth.getUser(accessToken);
    const authEmail = normalizeEmail(userResult.data.user?.email);
    if (userResult.error || !authEmail) {
      return NextResponse.json({ error: "Invalid authentication session." }, { status: 401 });
    }

    const formData = await request.formData();
    const sellerEmailRaw = normalizeEmail(String(formData.get("sellerEmail") ?? ""));
    const titleRaw = String(formData.get("title") ?? "").trim();
    const file = formData.get("file");

    if (!sellerEmailRaw || !titleRaw || !(file instanceof File)) {
      return NextResponse.json(
        { error: "sellerEmail, title, and file are required." },
        { status: 400 },
      );
    }

    if (!emailsMatch(authEmail, sellerEmailRaw)) {
      return NextResponse.json({ error: "Authenticated seller email does not match upload payload." }, { status: 403 });
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File size must be between 1 byte and 25MB." },
        { status: 400 },
      );
    }

    const extension = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        {
          error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const sellerKey = sanitizeSegment(sellerEmailRaw);
    const titleKey = sanitizeSegment(titleRaw);
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const objectPath = `seller-submissions/${sellerKey}/${titleKey || "resource"}-${uniqueSuffix}.${extension}`;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploadResult = await supabaseAdmin.storage.from("Resources").upload(objectPath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadResult.error) {
      return NextResponse.json({ error: uploadResult.error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      filePath: objectPath,
      fileUrl: `Resources/${objectPath}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
