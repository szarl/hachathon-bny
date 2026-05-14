import { Activity, CheckCircle2, Clock, TrendingUp } from "lucide-react";

const stats = [
  {
    label: "Total Batches",
    value: "142",
    footer: "Lifetime",
    icon: Clock,
    accent: false,
  },
  {
    label: "Active Conversions",
    value: "3",
    footer: "Processing now",
    icon: Activity,
    accent: true,
  },
  {
    label: "Files Processed Today",
    value: "8,405",
    footer: "+12% vs yesterday",
    icon: TrendingUp,
    accent: false,
  },
  {
    label: "Success Rate",
    value: "99.2%",
    footer: "Last 30 days",
    icon: CheckCircle2,
    accent: false,
  },
] as const;

export function Dashboard() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          High-level statistics and recent activity overview.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, footer, icon: Icon, accent }) => (
          <div
            key={label}
            className={`flex flex-col rounded-lg border border-zinc-200 bg-white p-5 shadow-sm ${
              accent ? "border-l-4 border-l-[#185FA5]" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-600">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">
                  {value}
                </p>
              </div>
              <Icon
                className="size-8 shrink-0 text-[#0C2340]/70"
                strokeWidth={1.5}
                aria-hidden
              />
            </div>
            <p className="mt-4 text-xs text-zinc-500">{footer}</p>
          </div>
        ))}
      </div>

      <section
        className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
        aria-labelledby="recent-activity-heading"
      >
        <h2
          id="recent-activity-heading"
          className="text-base font-semibold text-zinc-900"
        >
          Recent Activity Summary
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-zinc-600">
          The system is operating normally. Recent batches have completed with a
          99.2% success rate. There are currently 3 active conversions
          processing.
        </p>
      </section>
    </div>
  );
}
