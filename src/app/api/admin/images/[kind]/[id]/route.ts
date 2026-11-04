import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { changeImage, listImages, saveImage } from "@/lib/server/admin/images";
import { discardUpload, ImageError, imageStorageReady, uploadImage } from "@/lib/server/cloudinary";
import { isImageKind, MAX_IMAGE_BYTES } from "@/lib/image-upload";

export const runtime = "nodejs";
type Context = { params: { kind: string; id: string } };

async function handle(request: Request, { params }: Context) {
  const auth = await requireRole("admin");
  if (!auth.ok) return auth.response;
  const { kind } = params;
  const id = Number(params.id);
  if (!isImageKind(kind) || !Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid image target." }, { status: 400 });
  }
  try {
    if (request.method !== "GET") {
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(request.url).origin) throw new ImageError("Invalid request origin.", 403);
    }
    if (request.method === "POST") {
      // Check target before consuming a body or using storage quota.
      const current = await listImages(kind, id);
      if (kind === "vehicles" && current.length >= 10) throw new ImageError("A vehicle can have up to 10 images.");
      if (!imageStorageReady()) throw new ImageError("Image uploads are not configured yet. Ask the site administrator to connect Cloudinary.", 503);
      // Bound actual bytes, not just the client-supplied Content-Length.
      const limit = MAX_IMAGE_BYTES + 64 * 1024;
      if (Number(request.headers.get("content-length")) > limit) throw new ImageError("Choose an image up to 3 MB.", 413);
      const reader = request.body?.getReader();
      if (!reader) throw new ImageError("Choose an image.");
      const chunks: ArrayBuffer[] = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > limit) { await reader.cancel(); throw new ImageError("Choose an image up to 3 MB.", 413); }
          chunks.push(new Uint8Array(value).buffer);
        }
      } finally { reader.releaseLock(); }
      let form: FormData;
      try {
        form = await new Response(new Blob(chunks), { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
      } catch { throw new ImageError("Invalid upload form."); }
      const file = form.get("file");
      if (!file || typeof file === "string") throw new ImageError("Choose an image.");
      const uploaded = await uploadImage(file);
      try { await saveImage(kind, id, uploaded.url, auth.user.id); }
      catch (err) {
        await discardUpload(uploaded.publicId).catch(() => console.error("Image cleanup failed; remove the orphaned upload in Cloudinary."));
        throw err;
      }
    } else if (request.method === "PATCH") {
      let body: { imageId?: unknown; action?: unknown };
      try { body = await request.json(); } catch { throw new ImageError("Invalid request body."); }
      if (!body || !Number.isSafeInteger(body.imageId) || Number(body.imageId) <= 0 ||
        (body.action !== "remove" && body.action !== "primary")) throw new ImageError("Invalid image action.");
      await changeImage(kind, id, Number(body.imageId), body.action, auth.user.id);
    }
    return NextResponse.json({ items: await listImages(kind, id), configured: imageStorageReady() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ImageError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Admin image operation failed", err instanceof Error ? err.name : "Unknown error");
    return NextResponse.json({ error: "Unable to update images. Please try again." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
