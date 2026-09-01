import type { IconName } from "@/types";

/**
 * Central SVG icon registry. Every icon in the app is rendered through this
 * component by name, so data files (categories, features, socials) can simply
 * reference an icon as a string — fully data-driven, no duplicated SVG markup.
 *
 * All paths assume a 24x24 viewBox and inherit `currentColor`.
 */
const paths: Record<IconName, React.ReactNode> = {
  bus: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 6h8M5 11h14M6 18v2m12-2v2M7 18a1 1 0 100-2 1 1 0 000 2zm10 0a1 1 0 100-2 1 1 0 000 2zM5 6a2 2 0 012-2h10a2 2 0 012 2v9a2 2 0 01-2 2H7a2 2 0 01-2-2V6z"
    />
  ),
  car: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 13l2-5a2 2 0 011.9-1.4h10.2A2 2 0 0119 8l2 5m-18 0v4a1 1 0 001 1h1a1 1 0 001-1v-1h12v1a1 1 0 001 1h1a1 1 0 001-1v-4m-18 0h18M7 16h.01M17 16h.01"
    />
  ),
  family: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 7a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4zM6 7a2 2 0 100-4 2 2 0 000 4zM3 21v-4a3 3 0 013-3h0a3 3 0 013 3v4M15 21v-4a3 3 0 013-3h0a3 3 0 013 3v4M9 21v-3a3 3 0 013-3h0a3 3 0 013 3v3"
    />
  ),
  users: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a3 3 0 00-3-3M5 8a3 3 0 013-3"
    />
  ),
  plane: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.5 19l1.5-5 7-4.5a1.5 1.5 0 00-1.5-2.6L11 9 6 7.5 4.5 8.5 8 11l-2 2-2-.5L3 13.5 6 15l1.5 3 1-1 .5-2 1.5 4z"
    />
  ),
  "shield-check": (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3zm-3 8.5l2 2 4-4"
    />
  ),
  sofa: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 11V8a2 2 0 012-2h10a2 2 0 012 2v3m-14 0a2 2 0 00-2 2v3h18v-3a2 2 0 00-2-2m-14 0h14M5 16v2m14-2v2M8 11V9m8 2V9"
    />
  ),
  tag: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7 7h.01M3 11V5a2 2 0 012-2h6l9 9a2 2 0 010 2.8l-5.4 5.4a2 2 0 01-2.8 0L3 11z"
    />
  ),
  headset: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 13a8 8 0 0116 0m-16 0v3a2 2 0 002 2h1v-5H6a2 2 0 00-2 2zm16 0v3a2 2 0 01-2 2h-1v-5h1a2 2 0 012 2zm-3 7a4 4 0 01-4 2"
    />
  ),
  star: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 4l2.5 5 5.5.8-4 3.9.9 5.4L12 16.5 7.1 19l.9-5.4-4-3.9 5.5-.8L12 4z"
    />
  ),
  seat: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7 4h6a2 2 0 012 2v7H7a2 2 0 01-2-2V6a2 2 0 012-2zm8 9h2a2 2 0 012 2v3m-12-5v7M5 20h12"
    />
  ),
  "map-pin": (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11zm0-8a3 3 0 100-6 3 3 0 000 6z"
    />
  ),
  calendar: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 3v3m8-3v3M4 8h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z"
    />
  ),
  search: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z"
    />
  ),
  "arrow-right": (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 12h14m0 0l-6-6m6 6l-6 6"
    />
  ),
  menu: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
  ),
  close: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
  ),
  phone: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 5a2 2 0 012-2h2.3a1 1 0 011 .8l1 4a1 1 0 01-.3 1L7.6 10.6a14 14 0 005.8 5.8l1.8-1.7a1 1 0 011-.3l4 1a1 1 0 01.8 1V19a2 2 0 01-2 2A16 16 0 013 5z"
    />
  ),
  mail: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm0 2l8 6 8-6"
    />
  ),
  location: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11zm0-8a3 3 0 100-6 3 3 0 000 6z"
    />
  ),
  check: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  ),
  snowflake: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3v18M5 7l14 10M19 7L5 17M12 6l-2-2m2 2l2-2m-2 14l-2 2m2-2l2 2"
    />
  ),
  wifi: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 12a10 10 0 0114 0M8.5 15.5a5 5 0 017 0M12 19h.01"
    />
  ),
  music: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 18V5l10-2v13M9 18a2 2 0 11-4 0 2 2 0 014 0zm10-2a2 2 0 11-4 0 2 2 0 014 0z"
    />
  ),
  user: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zM6 21v-1a6 6 0 0112 0v1"
    />
  ),
  lock: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zM8 11V7a4 4 0 118 0v4"
    />
  ),
  eye: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  ),
  "eye-off": (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
    />
  ),
  grid: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"
    />
  ),
  sun: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36 6.36l-1.42-1.42M7.05 7.05L5.64 5.64m12.72 0l-1.42 1.42M7.05 16.95l-1.41 1.41M16 12a4 4 0 11-8 0 4 4 0 018 0z"
    />
  ),
  moon: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
    />
  ),
  "chevron-down": (
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
  ),
  logout: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M9 12h11m0 0l-3.5-3.5M20 12l-3.5 3.5"
    />
  ),
  quote: (
    <path
      fill="currentColor"
      stroke="none"
      d="M7.5 8A4.5 4.5 0 003 12.5V18h5.5v-5.5H6A1.5 1.5 0 017.5 11V8zm9 0A4.5 4.5 0 0012 12.5V18h5.5v-5.5H15a1.5 1.5 0 011.5-1.5V8z"
    />
  ),
  facebook: (
    <path
      fill="currentColor"
      stroke="none"
      d="M13 22v-8h2.7l.4-3H13V9c0-.9.3-1.5 1.6-1.5H16V4.8c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.4-3.8 4V11H7.5v3H10v8h3z"
    />
  ),
  twitter: (
    <path
      fill="currentColor"
      stroke="none"
      d="M4 4l6.7 9-6.9 7h2.1l5.7-6 4.5 6H22l-7.1-9.5L21.4 4h-2.1l-5.3 5.6L9.8 4H4zm3 1.5h2.1l9.9 13H17L7 5.5z"
    />
  ),
  instagram: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zm5 5.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM17 6.5h.01"
    />
  ),
  linkedin: (
    <path
      fill="currentColor"
      stroke="none"
      d="M6.5 8.5A2 2 0 106.5 4.5a2 2 0 000 4zM4.8 20h3.4v-9.5H4.8V20zm6 0h3.3v-5c0-1.4.3-2.7 2-2.7s1.7 1.6 1.7 2.8V20H21v-5.6c0-3-0.6-5.2-4.1-5.2-1.7 0-2.8.9-3.3 1.8h0V9.5h-3.3c.1 1 0 10.5 0 10.5z"
    />
  ),
  trash: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 002 2h8a2 2 0 002-2l1-13M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
    />
  ),
};

export interface IconProps {
  name: IconName;
  className?: string;
  /** Stroke width for line icons (ignored by filled icons). */
  strokeWidth?: number;
}

export default function Icon({ name, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
