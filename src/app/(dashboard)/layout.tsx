import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessProfile } from "@/modules/business";
import Link from "next/link";
import { LogOut, Zap } from "lucide-react";
import { DesktopNav, MobileBottomNav } from "@/components/AppNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") {
    redirect("/login");
  }

  const business = await getBusinessProfile();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link href="/dashboard" className="flex items-center space-x-3 hover:opacity-90 transition">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-md shadow-blue-500/20">
              <Zap className="h-5 w-5 text-white fill-white" />
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg tracking-tight block leading-tight">
                {business.name}
              </span>
              <span className="text-[11px] text-slate-400 font-medium tracking-wide uppercase">
                Book Moar START
              </span>
            </div>
          </Link>

          {/* Desktop Nav - Operational Focus: Dashboard, Leads, Appointments */}
          <DesktopNav />

          {/* Sign Out */}
          <div className="flex items-center space-x-2">
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                title="Sign Out"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-12">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav />
    </div>
  );
}
