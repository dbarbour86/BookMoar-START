"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Inbox, CalendarCheck2 } from "lucide-react";

export function DesktopNav() {
  const pathname = usePathname();

  const links = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      isActive: pathname.startsWith("/dashboard"),
    },
    {
      href: "/leads",
      label: "Leads",
      icon: Inbox,
      isActive: pathname.startsWith("/leads"),
    },
    {
      href: "/appointments",
      label: "Appointments",
      icon: CalendarCheck2,
      isActive: pathname.startsWith("/appointments"),
    },
  ];

  return (
    <nav className="hidden md:flex items-center space-x-1.5 text-sm font-medium" aria-label="Main Navigation">
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={link.isActive ? "page" : undefined}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 ${
              link.isActive
                ? "bg-blue-600/25 text-white font-semibold shadow-sm border border-blue-500/30"
                : "text-slate-300 hover:text-white hover:bg-slate-800/80"
            }`}
          >
            <Icon className={`w-4 h-4 ${link.isActive ? "text-blue-400" : "text-slate-400"}`} />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  const links = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      isActive: pathname.startsWith("/dashboard"),
    },
    {
      href: "/leads",
      label: "Leads",
      icon: Inbox,
      isActive: pathname.startsWith("/leads"),
    },
    {
      href: "/appointments",
      label: "Appointments",
      icon: CalendarCheck2,
      isActive: pathname.startsWith("/appointments"),
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-3 py-1.5 flex justify-around items-center shadow-xl"
      aria-label="Mobile Bottom Navigation"
    >
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={link.isActive ? "page" : undefined}
            className={`flex flex-col items-center justify-center min-w-[72px] min-h-[48px] py-1 px-3 rounded-xl transition ${
              link.isActive
                ? "text-white font-bold bg-white/10"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Icon className={`w-5 h-5 mb-0.5 ${link.isActive ? "text-blue-400" : "text-slate-400"}`} />
            <span className="text-[11px] leading-tight">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
