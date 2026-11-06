import { notFound } from "next/navigation";
import { requireRole } from "@/lib/server/auth-guard";
import WeekendAdmin from "@/components/weekend/WeekendAdmin";
export const dynamic = "force-dynamic";
export default async function Page() { const auth = await requireRole("admin"); if (!auth.ok) notFound(); return <WeekendAdmin />; }
