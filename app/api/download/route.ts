import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/mpesa";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type DownloadPayload = {
  phone: string;
  resourceId: string;
};

type StorageTarget = {
  bucket: string;
  path: string;
};

function parseStorageTarget(fileUrl: string): StorageTarget {
  const raw = fileUrl.trim();
  const withoutQuery = raw.split("?")[0];
  const decoded = decodeURIComponent(withoutQuery);

  const objectPathMatch = decoded.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
  if (objectPathMatch) {
    return {
      bucket: objectPathMatch[1],
      path: objectPathMatch[2],
    };
  }

  if (decoded.startsWith("Resources/")) {
    return { bucket: "Resources", path: decoded.slice("Resources/".length) };
  }
  if (decoded.startsWith("resources/")) {
    return { bucket: "resources", path: decoded.slice("resources/".length) };
  }

  return { bucket: "Resources", path: decoded.replace(/^\/+/, "") };
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as DownloadPayload | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { phone, resourceId } = payload;

  if (!phone || !resourceId?.trim()) {
    return NextResponse.json({ error: "Phone and resourceId are required." }, { status: 400 });
  }

  try {
    const normalizedPhone = normalizePhone(phone);
    const normalizedResourceId = resourceId.trim();

    const payment = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("phone", normalizedPhone)
      .eq("resource_id", normalizedResourceId)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (payment.error) {
      return NextResponse.json({ error: "Failed to verify payment." }, { status: 500 });
    }

    if (!payment.data?.id) {
      return NextResponse.json({ error: "Not paid" }, { status: 403 });
    }

    const resourceRecord = await supabaseAdmin
      .from("products")
      .select("file_url")
      .eq("id", normalizedResourceId)
      .maybeSingle();

    if (resourceRecord.error || !resourceRecord.data?.file_url) {
      return NextResponse.json({ error: "Resource file not found." }, { status: 404 });
    }

    const primaryTarget = parseStorageTarget(resourceRecord.data.file_url);
    const fallbackPath = primaryTarget.path.replace(/^resources\//i, "");
    const candidateTargets: StorageTarget[] = [
      primaryTarget,
      { bucket: "Resources", path: fallbackPath },
      { bucket: "resources", path: fallbackPath },
    ].filter((target, index, self) => {
      return (
        target.path.length > 0 &&
        self.findIndex((item) => item.bucket === target.bucket && item.path === target.path) === index
      );
    });

    let signed:
      | {
          data: { signedUrl?: string } | null;
          error: { message: string } | null;
        }
      | undefined;

    for (const target of candidateTargets) {
      const attempt = await supabaseAdmin.storage.from(target.bucket).createSignedUrl(target.path, 60);
      if (!attempt.error && attempt.data?.signedUrl) {
        signed = { data: attempt.data, error: null };
        break;
      }
      signed = { data: attempt.data ?? null, error: attempt.error ? { message: attempt.error.message } : null };
    }

    if (!signed?.data?.signedUrl) {
      return NextResponse.json({ error: "Failed to generate secure download URL." }, { status: 500 });
    }

    return NextResponse.json({ url: signed.data.signedUrl });
  } catch {
    return NextResponse.json({ error: "Download request failed." }, { status: 500 });
  }
}
