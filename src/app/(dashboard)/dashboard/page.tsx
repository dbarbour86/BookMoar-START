"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Inbox,
  Calendar,
  DollarSign,
  TrendingUp,
  Phone,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Loader2,
  CalendarCheck2,
  CalendarPlus,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import BookAppointmentModal, { BookAppointmentModalProps } from "@/components/BookAppointmentModal";

interface TodayAppointmentItem {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  serviceName?: string | null;
  scheduledAt: string;
  durationMinutes: number;
  valueCents?: number | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
  notes?: string | null;
  leadId?: string | null;
}

interface RecentLeadItem {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  service?: {
    name: string;
    defaultPriceCents?: number | null;
  } | null;
  source: string;
  createdAt: string;
  message?: string | null;
}

interface DashboardData {
  newLeadsCount: number;
  todaysAppointmentsCount: number;
  bookedValueTodayCents: number;
  bookedValueWeekCents: number;
  todaysAppointments: TodayAppointmentItem[];
  recentNewLeads: RecentLeadItem[];
  businessTimezone: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Booking modal state
  const [bookingModalState, setBookingModalState] = useState<{
    isOpen: boolean;
    initialData?: BookAppointmentModalProps["initialData"];
  }>({ isOpen: false });

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  async function handleAppointmentOutcome(
    appointmentId: string,
    nextStatus: "COMPLETED" | "NO_SHOW",
    e: React.MouseEvent
  ) {
    e.preventDefault();
    e.stopPropagation();

    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        fetchDashboard();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update appointment");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating appointment");
    }
  }

  function formatTime(isoString: string, timeZone: string) {
    return new Date(isoString).toLocaleTimeString("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatRelativeTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return "Earlier";
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
        <p className="text-sm">Loading daily dashboard...</p>
      </div>
    );
  }

  const newLeads = data?.newLeadsCount ?? 0;
  const todaysAppointmentsCount = data?.todaysAppointmentsCount ?? 0;
  const bookedTodayDollars = ((data?.bookedValueTodayCents ?? 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const bookedWeekDollars = ((data?.bookedValueWeekCents ?? 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Daily Operations Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            What needs your attention today ({data?.businessTimezone})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchDashboard()}
            title="Refresh Dashboard"
            className="p-2.5 rounded-xl border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setBookingModalState({ isOpen: true })}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-blue-600/20 transition active:scale-95"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>Add Appointment</span>
          </button>
        </div>
      </div>

      {/* Top 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: New Leads */}
        <Link
          href="/leads?status=new"
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm hover:border-blue-400 hover:ring-2 hover:ring-blue-500/10 transition group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              New Leads
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-105 transition">
              <Inbox className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {newLeads}
              </span>
              {newLeads > 0 && (
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                  Action needed
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-slate-400 mt-1 block">
              Uncontacted opportunities
            </span>
          </div>
        </Link>

        {/* Card 2: Today's Appointments */}
        <Link
          href="/appointments"
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm hover:border-blue-400 hover:ring-2 hover:ring-blue-500/10 transition group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Today&apos;s Schedule
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-105 transition">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {todaysAppointmentsCount}
              </span>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                remaining
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-400 mt-1 block">
              Scheduled work today
            </span>
          </div>
        </Link>

        {/* Card 3: Booked Value — Today */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Booked Value
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-black text-indigo-950 tracking-tight">
                {bookedTodayDollars}
              </span>
              <span className="text-xs font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md">
                Today
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-400 mt-1 block">
              Scheduled &amp; completed work
            </span>
          </div>
        </div>

        {/* Card 4: Booked This Week */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Booked This Week
            </span>
            <div className="p-2 rounded-xl bg-violet-50 text-violet-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-black text-violet-950 tracking-tight">
                {bookedWeekDollars}
              </span>
              <span className="text-xs font-bold text-violet-800 bg-violet-50 px-2 py-0.5 rounded-md">
                Week
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-400 mt-1 block">
              Active jobs this week
            </span>
          </div>
        </div>
      </div>

      {/* Section 1: Today's Appointments Operational List */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Today&apos;s Appointments
            </h2>
          </div>
          <Link
            href="/appointments"
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 p-1"
          >
            <span>All Appointments</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {data?.todaysAppointments.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-400 text-sm bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            No appointments scheduled for today.
          </div>
        ) : (
          <div className="space-y-3">
            {(() => {
              const firstScheduledId = data?.todaysAppointments.find(
                (a) => a.status === "SCHEDULED"
              )?.id;

              return data?.todaysAppointments.map((appt) => {
                const isCompleted = appt.status === "COMPLETED";
                const isNoShow = appt.status === "NO_SHOW";
                const isScheduled = appt.status === "SCHEDULED";
                const isUpNext = appt.id === firstScheduledId;

                return (
                  <div
                    key={appt.id}
                    className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${
                      isUpNext
                        ? "bg-blue-50/40 border-blue-400 ring-2 ring-blue-500/20 shadow-sm"
                        : isCompleted
                        ? "bg-slate-50/60 border-slate-200 text-slate-600"
                        : isNoShow
                        ? "bg-rose-50/40 border-rose-200 text-rose-800"
                        : "bg-white border-slate-200/90 shadow-sm"
                    }`}
                  >
                    {/* Left info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-blue-50 text-blue-900 border border-blue-100 min-w-[68px] shrink-0">
                        <Clock className="w-3.5 h-3.5 text-blue-600 mb-0.5" />
                        <span className="text-xs font-black">
                          {formatTime(appt.scheduledAt, data.businessTimezone)}
                        </span>
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-bold text-slate-900 truncate">
                            {appt.customerName}
                          </span>

                          {/* Up Next Badge */}
                          {isUpNext && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600 text-white">
                              Up Next
                            </span>
                          )}

                          {/* Status Badge */}
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              isCompleted
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : isNoShow
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : !isUpNext
                                ? "bg-slate-100 text-slate-700 border border-slate-200"
                                : "hidden"
                            }`}
                          >
                            {appt.status}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">
                            {appt.customerPhone}
                          </span>
                          {appt.serviceName && (
                            <span className="text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                              {appt.serviceName}
                            </span>
                          )}
                          {appt.valueCents !== null && appt.valueCents !== undefined && (
                            <span className="font-bold text-slate-900">
                              ${appt.valueCents / 100}
                            </span>
                          )}
                        </div>

                        {appt.notes && (
                          <p className="text-xs text-slate-500 italic mt-0.5 line-clamp-2">
                            &quot;{appt.notes}&quot;
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 justify-end shrink-0">
                      {/* SCHEDULED actions: Call | Text | Complete | No Show */}
                      {isScheduled && (
                        <>
                          <a
                            href={`tel:${appt.customerPhone}`}
                            aria-label={`Call ${appt.customerName}`}
                            title="Call Customer"
                            className="flex items-center justify-center h-10 w-10 sm:h-9 sm:w-9 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition shadow-sm border border-emerald-200"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                          <a
                            href={`sms:${appt.customerPhone}`}
                            aria-label={`Text ${appt.customerName}`}
                            title="Text Customer"
                            className="flex items-center justify-center h-10 w-10 sm:h-9 sm:w-9 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition shadow-sm border border-blue-200"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </a>
                          <button
                            onClick={(e) => handleAppointmentOutcome(appt.id, "COMPLETED", e)}
                            title="Mark Completed"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Complete</span>
                          </button>
                          <button
                            onClick={(e) => handleAppointmentOutcome(appt.id, "NO_SHOW", e)}
                            title="Mark No Show"
                            className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>No Show</span>
                          </button>
                        </>
                      )}

                      {/* NO_SHOW actions: Call | Text */}
                      {isNoShow && (
                        <>
                          <span className="text-xs text-rose-700 font-medium mr-1">
                            Follow up:
                          </span>
                          <a
                            href={`tel:${appt.customerPhone}`}
                            aria-label={`Call ${appt.customerName}`}
                            title="Call Customer"
                            className="flex items-center justify-center h-10 w-10 sm:h-9 sm:w-9 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition shadow-sm border border-emerald-200"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                          <a
                            href={`sms:${appt.customerPhone}`}
                            aria-label={`Text ${appt.customerName}`}
                            title="Text Customer"
                            className="flex items-center justify-center h-10 w-10 sm:h-9 sm:w-9 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition shadow-sm border border-blue-200"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </a>
                        </>
                      )}

                      {/* COMPLETED: visually settled */}
                      {isCompleted && (
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 py-1 px-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Finished</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Section 2: Recent NEW Leads */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Recent New Leads
            </h2>
            {newLeads > 0 && (
              <span className="text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                {newLeads}
              </span>
            )}
          </div>
          <Link
            href="/leads"
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 p-1"
          >
            <span>View All Leads</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {data?.recentNewLeads.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-400 text-sm bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            You&apos;re caught up — no new leads need attention.
          </div>
        ) : (
          <div className="space-y-3">
            {data?.recentNewLeads.map((lead) => (
              <div
                key={lead.id}
                className="p-4 rounded-xl border border-blue-200/80 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600 text-white">
                      NEW
                    </span>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="text-base font-bold text-slate-900 hover:text-blue-600 transition truncate"
                    >
                      {lead.name}
                    </Link>
                    <span className="text-xs text-slate-400 font-medium ml-1 shrink-0">
                      {formatRelativeTime(lead.createdAt)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">{lead.phone}</span>
                    {lead.service && (
                      <span className="text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                        {lead.service.name}
                        {lead.service.defaultPriceCents !== null && lead.service.defaultPriceCents !== undefined && (
                          <span className="ml-1 text-blue-900 font-bold">
                            (${lead.service.defaultPriceCents / 100})
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  {lead.message && (
                    <p className="text-xs text-slate-500 line-clamp-1 italic mt-0.5">
                      &quot;{lead.message}&quot;
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                  <a
                    href={`tel:${lead.phone}`}
                    aria-label={`Call ${lead.name}`}
                    title="Call Customer"
                    className="flex items-center justify-center h-10 w-10 sm:h-9 sm:w-9 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition shadow-sm border border-emerald-200"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                  <a
                    href={`sms:${lead.phone}`}
                    aria-label={`Text ${lead.name}`}
                    title="Text Customer"
                    className="flex items-center justify-center h-10 w-10 sm:h-9 sm:w-9 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition shadow-sm border border-blue-200"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() =>
                      setBookingModalState({
                        isOpen: true,
                        initialData: {
                          leadId: lead.id,
                          customerName: lead.name,
                          customerPhone: lead.phone,
                          customerEmail: lead.email,
                          defaultPriceCents: lead.service?.defaultPriceCents,
                          notes: lead.message,
                        },
                      })
                    }
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-md shadow-blue-600/20 active:scale-95"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    <span>Book Appointment</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Book Appointment Modal */}
      <BookAppointmentModal
        isOpen={bookingModalState.isOpen}
        onClose={() => setBookingModalState({ isOpen: false })}
        onSuccess={() => fetchDashboard()}
        initialData={bookingModalState.initialData}
      />
    </div>
  );
}
