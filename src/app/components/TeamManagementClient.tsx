"use client";

import { useMemo, useState } from "react";

import {
  CheckCircle2,
  Clock3,
  MailPlus,
  MoreHorizontal,
  Search,
  Shield,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Compliance" | "Converter" | "Viewer";
  group: string;
  status: "Active" | "Pending" | "Suspended";
  lastActive: string;
  conversions: number;
};

const teamMembers: TeamMember[] = [
  {
    id: "tm_001",
    name: "Aisha Patel",
    email: "aisha.patel@bny.example",
    role: "Admin",
    group: "Platform Operations",
    status: "Active",
    lastActive: "4 min ago",
    conversions: 318,
  },
  {
    id: "tm_002",
    name: "Daniel Reese",
    email: "daniel.reese@bny.example",
    role: "Compliance",
    group: "Risk Review",
    status: "Active",
    lastActive: "18 min ago",
    conversions: 96,
  },
  {
    id: "tm_003",
    name: "Marta Kowalski",
    email: "marta.kowalski@bny.example",
    role: "Converter",
    group: "Documentation",
    status: "Active",
    lastActive: "1 hr ago",
    conversions: 244,
  },
  {
    id: "tm_004",
    name: "Noah Simmons",
    email: "noah.simmons@bny.example",
    role: "Converter",
    group: "Documentation",
    status: "Pending",
    lastActive: "Invite sent",
    conversions: 0,
  },
  {
    id: "tm_005",
    name: "Elena Fischer",
    email: "elena.fischer@bny.example",
    role: "Viewer",
    group: "Audit",
    status: "Active",
    lastActive: "Yesterday",
    conversions: 41,
  },
  {
    id: "tm_006",
    name: "External Reviewer",
    email: "reviewer.vendor@example.com",
    role: "Viewer",
    group: "Third Party",
    status: "Suspended",
    lastActive: "7 days ago",
    conversions: 12,
  },
];

const roleTabs = ["All", "Admin", "Compliance", "Converter", "Viewer"] as const;

const permissionGroups = [
  {
    title: "Administrators",
    detail: "Manage settings, team access, exports, and all conversion jobs.",
    members: 1,
  },
  {
    title: "Compliance reviewers",
    detail: "Review validation results and approve elevated audit events.",
    members: 1,
  },
  {
    title: "Conversion operators",
    detail: "Upload PDFs, launch batches, preview DITA output, and download ZIPs.",
    members: 2,
  },
] as const;

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function statusClasses(status: TeamMember["status"]) {
  if (status === "Suspended") {
    return "border-red-200 bg-red-50 text-red-900";
  }
  if (status === "Pending") {
    return "border-amber-200 bg-amber-50 text-amber-950";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

function roleClasses(role: TeamMember["role"]) {
  if (role === "Admin") {
    return "bg-bny-navy text-white";
  }
  if (role === "Compliance") {
    return "bg-bny-teal text-white";
  }
  return "bg-black/8 text-black/75";
}

export function TeamManagementClient() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<(typeof roleTabs)[number]>("All");

  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return teamMembers.filter((member) => {
      const matchesRole = role === "All" || member.role === role;
      const matchesQuery =
        normalized.length === 0 ||
        [member.name, member.email, member.group, member.status]
          .join(" ")
          .toLowerCase()
          .includes(normalized);

      return matchesRole && matchesQuery;
    });
  }, [query, role]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black">
            Team Management
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-black/70">
            Mock access workspace for hackathon reviewers, conversion operators,
            and compliance approvers.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex w-fit items-center gap-2 rounded-md bg-bny-navy px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-bny-navy/90 focus:outline-none focus:ring-2 focus:ring-bny-teal focus:ring-offset-2"
        >
          <MailPlus className="size-4" aria-hidden />
          Invite member
        </button>
      </header>

      <section
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3"
        aria-label="Team metrics"
      >
        <div className="rounded-lg border border-black/15 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-black/65">Active members</p>
            <UsersRound className="size-5 text-bny-teal" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-black">4</p>
          <p className="mt-3 text-xs text-black/55">6 total seats assigned</p>
        </div>
        <div className="rounded-lg border border-black/15 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-black/65">Pending invites</p>
            <Clock3 className="size-5 text-bny-teal" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-black">1</p>
          <p className="mt-3 text-xs text-black/55">Expires in 5 days</p>
        </div>
        <div className="rounded-lg border border-black/15 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-black/65">MFA coverage</p>
            <Shield className="size-5 text-bny-teal" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-black">100%</p>
          <p className="mt-3 text-xs text-black/55">Required for all roles</p>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="rounded-lg border border-black/15 bg-white shadow-sm">
          <div className="border-b border-black/10 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative max-w-md flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black/45"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onInput={(event) => setQuery(event.currentTarget.value)}
                  placeholder="Search members, groups, or status"
                  className="h-10 w-full rounded-md border border-black/15 bg-white pl-9 pr-3 text-sm text-black outline-none transition placeholder:text-black/40 focus:border-bny-teal focus:ring-2 focus:ring-bny-teal/20"
                />
              </div>
              <div className="flex flex-wrap gap-1 rounded-md border border-black/10 bg-black/[0.02] p-1">
                {roleTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setRole(tab)}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                      role === tab
                        ? "bg-white text-black shadow-sm"
                        : "text-black/60 hover:text-black"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-black/10 bg-black/[0.02] text-xs uppercase text-black/60">
                <tr>
                  <th className="px-4 py-3 font-semibold">Member</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Group</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Last active</th>
                  <th className="px-4 py-3 font-semibold">Jobs</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-black/55">
                      No members match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-black/[0.015]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-bny-navy text-xs font-semibold text-white">
                            {initials(member.name)}
                          </div>
                          <div>
                            <p className="font-medium text-black">{member.name}</p>
                            <p className="mt-0.5 text-xs text-black/55">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${roleClasses(
                            member.role,
                          )}`}
                        >
                          {member.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-black/70">{member.group}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClasses(
                            member.status,
                          )}`}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-black/65">{member.lastActive}</td>
                      <td className="px-4 py-3 tabular-nums text-black/75">
                        {member.conversions}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="rounded-md p-2 text-black/55 transition hover:bg-black/5 hover:text-black"
                          aria-label={`Open actions for ${member.name}`}
                        >
                          <MoreHorizontal className="size-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-black/15 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-bny-teal/10 p-2 text-bny-navy">
                <UserRoundCheck className="size-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-base font-semibold text-black">
                  Access model
                </h2>
                <p className="mt-2 text-sm leading-6 text-black/65">
                  Mock roles mirror the conversion workflow: platform setup,
                  compliance review, conversion operations, and read-only audit.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-black/15 bg-white shadow-sm">
            <div className="border-b border-black/10 px-4 py-3">
              <h2 className="text-base font-semibold text-black">
                Permission groups
              </h2>
            </div>
            <ul className="divide-y divide-black/10">
              {permissionGroups.map((group) => (
                <li key={group.title} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-black">{group.title}</p>
                      <p className="mt-1 text-sm leading-5 text-black/60">
                        {group.detail}
                      </p>
                    </div>
                    <span className="rounded-full bg-black/8 px-2 py-1 text-xs font-semibold tabular-nums text-black/70">
                      {group.members}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden />
              <div>
                <h2 className="text-base font-semibold text-emerald-950">
                  Review ready
                </h2>
                <p className="mt-2 text-sm leading-6 text-emerald-950/75">
                  All mock active members have MFA coverage and a named role for
                  the demo environment.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
