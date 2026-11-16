/** These images are already compressed static files; do not spend image-transform quota. */
export function isDestinationPhoto(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\/images\/destinations\/[a-z0-9-]+\.webp$/.test(value);
}
export function destinationPhotoCredit(value: string | null | undefined): string | undefined {
  return isDestinationPhoto(value) ? `/image-credits?photo=${encodeURIComponent(value.split("/").pop()!)}` : undefined;
}
/** Fill only empty entries and the exact illustration installed by our starter import. */
export function canFillDestinationPhoto(current: string | null | undefined, next: string): boolean {
  return isDestinationPhoto(next) && (!current || current === "/images/destination-illustration.svg");
}
