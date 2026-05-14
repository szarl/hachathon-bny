import { Bell, Settings, UserRound } from "lucide-react";

export function Header() {
  return (
    <header
      className="border-b border-bny-teal bg-bny-navy text-white shadow-sm"
      role="banner"
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
          DITA Converter
        </h1>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="rounded-lg p-2.5 text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Settings"
          >
            <Settings className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            className="rounded-lg p-2.5 text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Notifications"
          >
            <Bell className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            className="rounded-lg p-2.5 text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Account"
          >
            <UserRound className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}
