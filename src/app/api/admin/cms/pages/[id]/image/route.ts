import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth-guard";
import { matchesRequestOrigin } from "@/lib/server/request-origin";
import { getCmsPage, changeCmsPage } from "@/lib/server/cms";
import { CmsError, CMS_MAX_BYTES, cmsDocumentWithImage } from "@/lib/cms";
import { MAX_IMAGE_BYTES } from "@/lib/image-upload";
import { uploadImage, discardUpload, ImageError } from "@/lib/server/cloudinary";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("admin"); if (!auth.ok) return auth.response;
  try {
    if (!matchesRequestOrigin(request)) throw new CmsError("Invalid origin.", 403);
    const page = await getCmsPage(params.id);
    const limit = MAX_IMAGE_BYTES + CMS_MAX_BYTES + 64 * 1024;
    if (Number(request.headers.get("content-length")) > limit) throw new CmsError("Choose an image up to 3 MB.", 413);
    const reader = request.body?.getReader(); if (!reader) throw new CmsError("Choose an image.");
    const chunks: ArrayBuffer[] = []; let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength; if (size > limit) { await reader.cancel(); throw new CmsError("Choose an image up to 3 MB.", 413); }
        chunks.push(new Uint8Array(value).buffer);
      }
    } finally { reader.releaseLock(); }
    let form: FormData;
    try { form = await new Response(new Blob(chunks), { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData(); }
    catch { throw new CmsError("Invalid upload form."); }
    const version = Number(form.get("version"));
    if (!Number.isSafeInteger(version) || version !== page.version) throw new CmsError("This page changed. Reload the editor before uploading.", 409);
    const sectionId = form.get("sectionId"), target = form.get("target"), title = form.get("title");
    if (typeof sectionId !== "string" || typeof target !== "string" || typeof title !== "string" || !title.trim() || title.length > 200) throw new CmsError("Invalid image target.");
    let input: unknown;
    try { input = JSON.parse(String(form.get("document"))); } catch { throw new CmsError("Invalid page document."); }
    // Validate the target and complete draft before spending upload quota.
    const draft = cmsDocumentWithImage(input, sectionId, target, "https://res.cloudinary.com/cms-validation/image/upload/placeholder.webp");
    const file = form.get("file"); if (!file || typeof file === "string") throw new CmsError("Choose an image.");
    const uploaded = await uploadImage(file);
    try {
      const item = await changeCmsPage(params.id, { action: "save", version, title, draft: cmsDocumentWithImage(draft, sectionId, target, uploaded.url) }, auth.user.id);
      return NextResponse.json({ item, url: uploaded.url, publicId: uploaded.publicId }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      // A connection can fail after COMMIT reaches the database. Never delete
      // the image if its reference committed, or if that cannot be determined.
      const saved = await getCmsPage(params.id).catch(() => null);
      if (saved && !JSON.stringify(saved.draft).includes(uploaded.url)) {
        await discardUpload(uploaded.publicId).catch(() => console.error("CMS upload cleanup failed; inspect the new Cloudinary asset."));
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof CmsError || error instanceof ImageError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("CMS image upload failed"); return NextResponse.json({ error: "Unable to confirm the upload. Reload the saved page before retrying." }, { status: 500 });
  }
}
