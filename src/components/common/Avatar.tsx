import Image from "next/image";

export interface AvatarProps {
  name: string;
  src?: string;
  className?: string;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Renders a remote avatar image when `src` is given, otherwise a gradient
 * circle with the person's initials — so we never make a request for a
 * missing image and never show a broken/blank avatar.
 */
export default function Avatar({ name, src, className = "" }: AvatarProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={48}
        height={48}
        className={`h-12 w-12 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary-700 to-primary-900 text-sm font-bold text-white ${className}`}
    >
      {initials(name)}
    </div>
  );
}
