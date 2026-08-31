/** Tiny shared bits for the admin CRUD tables. */

export function ErrorNote({ message }: { message: string }) {
  return <p className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{message}</p>;
}

export function EmptyRow({ show, cols, label }: { show: boolean; cols: number; label: string }) {
  if (!show) return null;
  return (
    <tr>
      <td colSpan={cols} className="px-5 py-10 text-center text-faint">
        {label}
      </td>
    </tr>
  );
}

export function LoadingRow({ show, cols }: { show: boolean; cols: number }) {
  if (!show) return null;
  return (
    <tr>
      <td colSpan={cols} className="px-5 py-10 text-center text-faint">
        Loading…
      </td>
    </tr>
  );
}
