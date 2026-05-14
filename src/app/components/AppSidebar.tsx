"use client";

import {
  BookOpen,
  LayoutDashboard,
  LifeBuoy,
  LucideIcon,
  ScrollText,
  Settings,
  Upload,
  Users,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload-source", label: "Upload Source", icon: Upload },
  { href: "/batch-jobs", label: "Batch Jobs", icon: Waypoints },
  { href: "/configuration", label: "Configuration", icon: Settings },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollText },
  { href: "/team-management", label: "Team Management", icon: Users },
] as const;

const secondaryNav = [
  { href: "/documentation", label: "Documentation", icon: BookOpen },
  { href: "/support", label: "Technical Support", icon: LifeBuoy },
] as const;

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-bny-teal text-white"
          : "text-white/85 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon className="size-5 shrink-0 opacity-90" aria-hidden />
      {label}
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex w-60 shrink-0 flex-col border-r border-bny-teal bg-bny-navy text-white"
      aria-label="Application navigation"
    >
      <nav className="flex flex-1 flex-col gap-1 px-2 py-4">
        {primaryNav.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`)
            }
          />
        ))}
      </nav>
      <div className="border-t border-bny-teal px-2 py-4">
        <nav className="flex flex-col gap-1">
          {secondaryNav.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}
