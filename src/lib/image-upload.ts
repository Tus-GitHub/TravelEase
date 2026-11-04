export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const IMAGE_KINDS = ["drivers", "vehicles", "packages", "regions", "tourist-spots"] as const;
export type ImageKind = typeof IMAGE_KINDS[number];
export interface AdminImage { id: number; url: string; primary: boolean }

export function isImageKind(value: string): value is ImageKind {
  return IMAGE_KINDS.some((kind) => kind === value);
}

/** Check the content as well as the declared MIME type; SVG/HTML are never accepted. */
export function imageFormat(bytes: Uint8Array): "jpg" | "png" | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return "png";
  if (bytes.length >= 12 && String.fromCharCode(...Array.from(bytes.slice(0, 4))) === "RIFF" &&
    String.fromCharCode(...Array.from(bytes.slice(8, 12))) === "WEBP") return "webp";
  return null;
}
