import { format } from "date-fns";
import { Card, CardEyebrow, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import type { PaymentWithCharity } from "@/services/billing-queries";

export function PaymentHistory({ payments }: { payments: PaymentWithCharity[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="p-6 pb-4">
        <CardEyebrow>Payments</CardEyebrow>
        <CardTitle>Where your money went</CardTitle>
      </div>
      {payments.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-ink-muted">No payments yet. Your first one appears here after checkout.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-y border-line bg-canvas-sunken text-xs uppercase tracking-wider text-ink-subtle">
              <tr>
                <th scope="col" className="px-6 py-3 font-medium">Date</th>
                <th scope="col" className="px-6 py-3 font-medium">Paid</th>
                <th scope="col" className="px-6 py-3 font-medium">To charity</th>
                <th scope="col" className="px-6 py-3 font-medium">To prize pool</th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-line">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-6 py-3.5 text-ink-muted">{payment.paid_at ? format(new Date(payment.paid_at), "d MMM yyyy") : "—"}</td>
                  <td className="px-6 py-3.5 font-medium text-ink">{formatCents(payment.amount_cents, payment.currency)}</td>
                  <td className="px-6 py-3.5 text-moss">
                    {formatCents(payment.charity_amount_cents, payment.currency)}
                    <span className="ml-1.5 text-xs text-ink-subtle">
                      {payment.charity_percent_snapshot}%{payment.charityName ? ` · ${payment.charityName}` : ""}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-ink">{formatCents(payment.prize_pool_amount_cents, payment.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
