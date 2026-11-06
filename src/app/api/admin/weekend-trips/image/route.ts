import { requireRole } from "@/lib/server/auth-guard";
import { matchesRequestOrigin } from "@/lib/server/request-origin";
import { uploadImage, ImageError } from "@/lib/server/cloudinary";
import { MAX_IMAGE_BYTES } from "@/lib/image-upload";
import { TripError } from "@/lib/weekend-trips";
import { tripResponse, tripFailure } from "@/lib/server/weekend-http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const auth = await requireRole("admin"); if (!auth.ok) return auth.response;
  try {
    if (!matchesRequestOrigin(request)) throw new TripError("Invalid origin.", 403);
    const limit = MAX_IMAGE_BYTES + 65536, reader = request.body?.getReader();
    if (!reader || Number(request.headers.get("content-length")) > limit) throw new TripError("Choose an image up to 3 MB.", 413);
    const chunks: ArrayBuffer[] = []; let size = 0;
    try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); throw new TripError("Choose an image up to 3 MB.", 413); } chunks.push(new Uint8Array(value).buffer); } } finally { reader.releaseLock(); }
    let form: FormData;
    try { form = await new Response(new Blob(chunks), { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData(); } catch { throw new TripError("Invalid image form."); }
    const file = form.get("file"); if (!file || typeof file === "string") throw new TripError("Choose a photo.");
    // Uploads are retained when a draft is discarded; never delete a URL that may
    // have been reused elsewhere. The editor explicitly saves the returned URL.
    return tripResponse(await uploadImage(file));
  } catch (error) { if (error instanceof ImageError) return tripResponse({ error: error.message }, error.status); return tripFailure(error); }
}
