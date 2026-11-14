export const VEHICLE_PHOTO_RATIO = 8 / 5;
export interface VehicleCrop { x: number; y: number; width: number; height: number }

/** Recognize only our versioned public uploads; cropping never accepts a new asset URL. */
export function vehicleImageSource(value: string): { original: string; crop: VehicleCrop | null } | null {
  const match = /^(https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\/)(?:c_crop,x_(\d+),y_(\d+),w_(\d+),h_(\d+)\/f_auto,q_auto\/)?(v\d+\/jagdamba\/(?:development|production)\/[a-f0-9-]+\.(?:webp|png|jpg))$/.exec(value);
  if (!match) return null;
  return { original: match[1] + match[6], crop: match[2] === undefined ? null : { x: Number(match[2]), y: Number(match[3]), width: Number(match[4]), height: Number(match[5]) } };
}

export function validVehicleCrop(value: unknown): value is VehicleCrop {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join(",") !== "height,width,x,y" || !Object.values(v).every(n => Number.isSafeInteger(n))) return false;
  const { x, y, width, height } = v as unknown as VehicleCrop;
  return x >= 0 && y >= 0 && width >= 16 && height >= 10 && x + width <= 2000 && y + height <= 2000 && Math.abs(width - height * VEHICLE_PHOTO_RATIO) <= 2;
}

export function vehicleCropUrl(current: string, crop: VehicleCrop | null): string | null {
  const source = vehicleImageSource(current);
  if (!source || (crop !== null && !validVehicleCrop(crop))) return null;
  if (!crop) return source.original;
  const { x, y, width, height } = crop;
  return source.original.replace("/image/upload/", `/image/upload/c_crop,x_${x},y_${y},w_${width},h_${height}/f_auto,q_auto/`);
}

/** Zoom/position calculations shared by pointer and keyboard controls. */
export function vehicleCropBox(width: number, height: number, zoom: number, horizontal: number, vertical: number): VehicleCrop {
  const w = Math.round(Math.min(width, height * VEHICLE_PHOTO_RATIO) / Math.max(1, zoom));
  const h = Math.round(w / VEHICLE_PHOTO_RATIO);
  return { width: w, height: h, x: Math.round((width - w) * Math.max(0, Math.min(100, horizontal)) / 100), y: Math.round((height - h) * Math.max(0, Math.min(100, vertical)) / 100) };
}
