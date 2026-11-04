import { createHash, randomUUID } from "node:crypto";
import { imageFormat, MAX_IMAGE_BYTES } from "../image-upload";

export class ImageError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

function config() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret || !/^[a-zA-Z0-9_-]+$/.test(cloud)) {
    throw new ImageError("Image uploads are not configured yet. Ask the site administrator to connect Cloudinary.", 503);
  }
  return { cloud, key, secret };
}

export function imageStorageReady() {
  try { config(); return true; } catch { return false; }
}

export function signCloudinary(params: Record<string, string>, secret: string) {
  return createHash("sha256").update(Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&") + secret).digest("hex");
}

export async function uploadImage(file: File) {
  const { cloud, key, secret } = config();
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new ImageError("Choose an image up to 3 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = imageFormat(bytes);
  const mime = format === "jpg" ? "image/jpeg" : `image/${format}`;
  if (!format || file.type !== mime) throw new ImageError("Choose a valid JPEG, PNG or WebP image.");
  const publicId = `jagdamba/${process.env.VERCEL_ENV === "production" ? "production" : "development"}/${randomUUID()}`;
  const params = {
    timestamp: String(Math.floor(Date.now() / 1000)), public_id: publicId,
    overwrite: "false", allowed_formats: "jpg,png,webp",
    transformation: "c_limit,w_2000,h_2000/f_webp,q_auto",
  };
  const body = new FormData();
  for (const [k, v] of Object.entries(params)) body.set(k, v);
  body.set("api_key", key);
  body.set("signature", signCloudinary(params, secret));
  body.set("file", new Blob([bytes], { type: mime }), `image.${format}`);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: "POST", body, signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new ImageError("Image storage rejected the upload. Check the image or storage configuration and try again.", 502);
  const result = await response.json();
  const url = typeof result.secure_url === "string" ? result.secure_url : "";
  if (result.public_id !== publicId || !url.startsWith(`https://res.cloudinary.com/${cloud}/image/upload/`) || url.length > 500) {
    throw new ImageError("Image storage returned an invalid response.", 502);
  }
  return { url, publicId };
}

/** Used only to clean up a new upload when saving its DB reference fails. */
export async function discardUpload(publicId: string) {
  const { cloud, key, secret } = config();
  const params = { public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)) };
  const body = new URLSearchParams({ ...params, api_key: key, signature: signCloudinary(params, secret) });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, {
    method: "POST", body, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Upload cleanup failed");
}
