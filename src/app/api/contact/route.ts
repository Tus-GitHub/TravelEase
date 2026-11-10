import { createContactHandler } from "@/lib/server/contact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createContactHandler();
