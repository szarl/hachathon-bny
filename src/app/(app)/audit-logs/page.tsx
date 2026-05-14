import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  ShieldCheck,
} from "lucide-react";

const auditStats = [
  { label: "Events today", value: "1,284", detail: "+18% vs yesterday" },
  { label: "Policy blocks", value: "7", detail: "2 require review" },
  { label: "Successful exports", value: "416", detail: "99.1% completion" },
  { label: "Retention window", value: "365d", detail: "Finance policy" },
] as const;

const auditEvents = [
  {
    id: "AUD-90421",
    time: "14 May 2026, 13:42",
    actor: "Marta Kowalski",
    action: "Downloaded DITA package",
    asset: "quarterly-risk-disclosures.zip",
    ip: "10.18.42.91",
    status: "Approved",
    severity: "Low",
  },
  {
    id: "AUD-90420",
    time: "14 May 2026, 13:36",
    actor: "Daniel Reese",
    action: "Changed Gemini output limit",
    asset: "Configuration",
    ip: "10.18.40.12",
    status: "Reviewed",
    severity: "Medium",
  },
  {
    id: "AUD-90419",
    time: "14 May 2026, 13:18",
    actor: "Service Role",
    action: "Completed validation agent",
    asset: "fund-performance-brief.pdf",
    ip: "system",
    status: "Approved",
    severity: "Low",
  },
  {
    id: "AUD-90418",
    time: "14 May 2026, 12:54",
    actor: "Aisha Patel",
    action: "Invited team member",
    asset: "Team Management",
    ip: "10.18.41.77",
    status: "Approved",
    severity: "Low",
  },
  {
    id: "AUD-90417",
    time: "14 May 2026, 12:31",
    actor: "External Reviewer",
    action: "Attempted restricted export",
    asset: "stress-test-findings.zip",
    ip: "172.16.9.24",
    status: "Blocked",
    severity: "High",
  },
  {
    id: "AUD-90416",
    time: "14 May 2026, 11:58",
    actor: "Noah Simmons",
    action: "Uploaded source PDF",
    asset: "liquidity-rule-update.pdf",
    ip: "10.18.39.203",
    status: "Approved",
    severity: "Low",
  },
] as const;

function statusClasses(status: string) {
  if (status === "Blocked") {
    return "border-red-200 bg-red-50 text-red-900";
  }
  if (status === "Reviewed") {
    return "border-amber-200 bg-amber-50 text-amber-950";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

function severityClasses(severity: string) {
  if (severity === "High") {
    return "bg-red-600 text-white";
  }
  if (severity === "Medium") {
    return "bg-amber-500 text-black";
  }
  return "bg-black/8 text-black/70";
}

export default function AuditLogsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black">
            Audit Logs
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-black/70">
            Cmpliance trail for uploads, conversions, validation runs,
            exports, and team access changes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-black/15 bg-white px-3 py-2 text-sm font-medium text-black shadow-sm transition hover:bg-black/[0.03]"
          >
            <Filter className="size-4" aria-hidden />
            Filters
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-bny-navy px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-bny-navy/90"
          >
            <Download className="size-4" aria-hidden />
            Export CSV
          </button>
        </div>
      </header>

      <section
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Audit log metrics"
      >
        {auditStats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-black/15 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-black/65">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-black">
              {stat.value}
            </p>
            <p className="mt-3 text-xs text-black/55">{stat.detail}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-lg border border-black/15 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-black/10 px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-black">
                Recent events
              </h2>
              <p className="mt-0.5 text-xs text-black/60">
                Sample front-end data for the hackathon demo.
              </p>
            </div>
            <ShieldCheck className="size-5 shrink-0 text-bny-teal" aria-hidden />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-black/10 bg-black/[0.02] text-xs uppercase text-black/60">
                <tr>
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Asset</th>
                  <th className="px-4 py-3 font-semibold">IP</th>
                  <th className="px-4 py-3 font-semibold">Severity</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {auditEvents.map((event) => (
                  <tr key={event.id} className="align-top hover:bg-black/[0.015]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-black">{event.action}</p>
                      <p className="mt-1 text-xs text-black/55">
                        {event.id} | {event.time}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-black/75">{event.actor}</td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-black/75">
                      {event.asset}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-black/65">
                      {event.ip}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${severityClasses(
                          event.severity,
                        )}`}
                      >
                        {event.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClasses(
                          event.status,
                        )}`}
                      >
                        {event.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-black/15 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-bny-teal/10 p-2 text-bny-navy">
                <CheckCircle2 className="size-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-base font-semibold text-black">
                  Control status
                </h2>
                <p className="mt-2 text-sm leading-6 text-black/65">
                  Conversion audit capture is active across upload, classify,
                  generation, validation, and export checkpoints.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
              <div>
                <h2 className="text-base font-semibold text-amber-950">
                  Review queue
                </h2>
                <p className="mt-2 text-sm leading-6 text-amber-950/75">
                  Two elevated events are waiting for compliance review before
                  the final handoff.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-black/15 bg-white p-5 shadow-sm">
            <FileText className="size-5 text-bny-teal" aria-hidden />
            <h2 className="mt-3 text-base font-semibold text-black">
              Retention policy
            </h2>
            <p className="mt-2 text-sm leading-6 text-black/65">
              Logs are presented as immutable events with a finance-grade
              retention window and CSV export affordance.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
