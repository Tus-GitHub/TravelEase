import type { Metadata } from "next";
import Badge from "@/components/common/Badge";
import PolicyPage from "@/components/pages/PolicyPage";
import {
  cancellationIntro,
  cancellationSections,
  cancellationTiers,
  legalUpdated,
} from "@/data/pages";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy — TravelEase",
};

export default function CancellationPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Policy"
      title="Cancellation & Refund Policy"
      updated={legalUpdated}
      intro={cancellationIntro}
      sections={cancellationSections}
    >
      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 font-semibold">When the trip is cancelled</th>
              <th className="px-4 py-3 font-semibold">Refund</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cancellationTiers.map((tier) => (
              <tr key={tier.window}>
                <td className="px-4 py-3 text-slate-700">{tier.window}</td>
                <td className="px-4 py-3">
                  <Badge tone={tier.tone}>{tier.refund}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PolicyPage>
  );
}
