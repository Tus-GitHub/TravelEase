"use client";

import Image from "next/image";
import { useState } from "react";
import { isDestinationPhoto } from "@/lib/destination-photo";

export default function DestinationPhoto({ imageUrl, alt, sizes, className = "object-cover", decorative = false }: {
  imageUrl: string; alt: string; sizes: string; className?: string; decorative?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const fallback = !imageUrl || failedUrl === imageUrl;
  return <Image src={fallback ? "/images/destination-illustration.svg" : imageUrl}
    alt={decorative ? "" : fallback ? "Travel illustration - photograph unavailable" : alt}
    fill sizes={sizes} unoptimized={fallback || isDestinationPhoto(imageUrl)}
    className={className} onError={() => setFailedUrl(imageUrl)} />;
}
