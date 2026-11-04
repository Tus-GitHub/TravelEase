"use client";
import Card from "@/components/common/Card";
import AdminEditor from "@/components/admin/AdminEditor";
import RowActions from "@/components/admin/RowActions";
import DriverLoginControl from "@/components/driver/DriverLoginControl";
import Button from "@/components/common/Button";
import FormField, { fieldBase } from "@/components/forms/FormField";
import { useAdminSectionGuard } from "@/lib/admin/useAdminSectionGuard";
import { useAdminResource } from "@/lib/admin/useAdminResource";
import { useCrudForm } from "@/lib/admin/useCrudForm";

interface Driver {
  loginEmail: string | null; id: number; name: string; phone: string;
  licenceNumber: string; note: string; isActive: boolean; activeBookings: number;
}
const BLANK = { name: "", phone: "", licenceNumber: "", note: "" };
export default function AdminDriversPage() {
  const { isLoading, allowed } = useAdminSectionGuard("drivers");
  const r = useAdminResource<Driver>("/api/admin/drivers");
  const form = useCrudForm({ empty: BLANK, onCreate: r.create, onUpdate: r.update });
  if (isLoading || !allowed) return <p className="text-sm text-muted">Loading...</p>;
  return <div>
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-fg">Drivers</h1><p className="mt-1 text-sm text-muted">{r.items.length} on the roster. Edit a profile to update details and the driver photo.</p></div>
      <Button type="button" variant="accent" size="sm" iconLeft="user" onClick={form.startCreate}>Add driver</Button>
    </header>
    {form.open && <AdminEditor title={form.editingId == null ? "Add driver" : `Edit ${form.draft.name}`} onClose={form.cancel} busy={form.saving} image={form.editingId == null ? undefined : { kind: "drivers", id: form.editingId, name: form.draft.name }}>
      <form onSubmit={(e) => { e.preventDefault(); void form.submit(); }} className="grid gap-5 sm:grid-cols-2">
        <FormField label="Driver name" icon="user"><input className={fieldBase} value={form.draft.name} onChange={(e) => form.patch({ name: e.target.value })} placeholder="Full name" required minLength={2} maxLength={150} /></FormField>
        <FormField label="Phone number" icon="phone"><input className={fieldBase} value={form.draft.phone} onChange={(e) => form.patch({ phone: e.target.value })} placeholder="+91" required minLength={6} maxLength={30} /></FormField>
        <FormField label="Licence number" icon="shield-check"><input className={fieldBase} value={form.draft.licenceNumber} onChange={(e) => form.patch({ licenceNumber: e.target.value })} placeholder="Optional" maxLength={60} /></FormField>
        <FormField label="Internal note" icon="chat"><input className={fieldBase} value={form.draft.note} onChange={(e) => form.patch({ note: e.target.value })} placeholder="Optional" maxLength={300} /></FormField>
        {form.editingId == null && <p className="text-xs text-muted sm:col-span-2">Save the driver first, then open Edit to add a profile photo.</p>}
        {form.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300 sm:col-span-2">{form.error}</p>}
        <div className="mt-2 flex justify-end gap-3 border-t border-line pt-5 sm:col-span-2"><Button type="button" variant="outline" disabled={form.saving} onClick={form.cancel}>Cancel</Button><Button type="submit" variant="primary" loading={form.saving} iconLeft="check">{form.editingId == null ? "Create driver" : "Save changes"}</Button></div>
      </form>
    </AdminEditor>}
    {r.error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{r.error}</p>}
    <Card hover={false} className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead className="border-b border-line-subtle bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted"><tr>{["Name", "Phone", "Licence", "Note", "On trips", "Active", "Login", "Actions"].map((label) => <th key={label} className={`px-4 py-3 ${label === "Actions" ? "text-right" : ""}`}>{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-line-subtle">
        {r.items.map((d) => <tr key={d.id} className="hover:bg-surface-hover/60">
          <td className="px-4 py-4 font-semibold text-fg">{d.name}</td><td className="px-4 py-4 text-muted">{d.phone}</td><td className="px-4 py-4 text-muted">{d.licenceNumber || "-"}</td><td className="px-4 py-4 text-muted">{d.note || "-"}</td><td className="px-4 py-4 text-muted">{d.activeBookings}</td>
          <td className="px-4 py-4"><button type="button" onClick={() => r.update(d.id, { isActive: !d.isActive })} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${d.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-surface-hover text-muted"}`}>{d.isActive ? "Active" : "Off"}</button></td>
          <td className="px-4 py-4"><DriverLoginControl id={d.id} email={d.loginEmail} reload={r.refetch} /></td>
          <td className="px-4 py-4"><RowActions name={d.name} onEdit={() => form.startEdit(d.id, { name: d.name, phone: d.phone, licenceNumber: d.licenceNumber, note: d.note })} onDelete={() => r.remove(d.id)} /></td>
        </tr>)}
        {(r.loading || r.items.length === 0) && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">{r.loading ? "Loading drivers..." : "No drivers yet. Add your first driver to get started."}</td></tr>}
      </tbody>
    </table></div></Card>
  </div>;
}
