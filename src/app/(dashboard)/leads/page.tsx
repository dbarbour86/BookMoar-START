"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Phone,
  MessageSquare,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  UserCheck,
  PhoneMissed,
  Filter,
  RefreshCw,
  X,
  CalendarPlus,
  CalendarCheck2,
} from "lucide-react";
import BookAppointmentModal, { BookAppointmentModalProps } from "@/components/BookAppointmentModal";

interface ServiceInfo {
  id: string;
  name: string;
  defaultPriceCents?: number | null;
}

interface LeadItem {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  message?: string | null;
  source: "WEBSITE" | "MANUAL" | "MISSED_CALL";
  status: "NEW" | "CONTACTED" | "CLOSED";
  createdAt: string;
  contactedAt?: string | null;
  closedAt?: string | null;
  service?: ServiceInfo | null;
  appointments?: Array<{
    id: string;
    scheduledAt: string;
    status: "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
    serviceName?: string | null;
  }>;
}

export default function LeadsInboxPage() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "contacted" | "closed">("all");
  const [loading, setLoading] = useState(true);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: "",
    phone: "",
    email: "",
    serviceId: "",
    message: "",
  });

  const [bookingModalState, setBookingModalState] = useState<{
    isOpen: boolean;
    initialData?: BookAppointmentModalProps["initialData"];
  }>({ isOpen: false });

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads?status=${statusFilter}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchServices = async () => {
    try {
      const res = await fetch("/api/services");
      if (res.ok) {
        const data = await res.json();
        setServices(data.services || []);
      }
    } catch (err) {
      console.error("Failed to load services:", err);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    fetchServices();
  }, []);

  async function handleStatusTransition(leadId: string, nextStatus: "CONTACTED" | "CLOSED", e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        fetchLeads();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update lead status");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating status");
    }
  }

  async function handleCreateManualLead(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingManual(true);

    try {
      const res = await fetch("/api/leads/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: manualForm.name,
          phone: manualForm.phone,
          email: manualForm.email || undefined,
          serviceId: manualForm.serviceId || undefined,
          message: manualForm.message || undefined,
        }),
      });

      if (res.ok) {
        setIsManualModalOpen(false);
        setManualForm({ name: "", phone: "", email: "", serviceId: "", message: "" });
        fetchLeads();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create manual lead");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit manual lead");
    } finally {
      setSubmittingManual(false);
    }
  }

  function formatRelativeTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays}d ago`;
  }

  const newLeadCount = leads.filter((l) => l.status === "NEW").length;

  return (
    <div className="space-y-5">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <span>Lead Inbox</span>
            {newLeadCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white animate-pulse">
                {newLeadCount} New
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Incoming inquiries and calls needing fast response
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLeads()}
            title="Refresh Leads"
            className="p-2.5 rounded-xl border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-600/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Manual Lead</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-1 p-1 bg-slate-200/80 rounded-xl overflow-x-auto text-xs sm:text-sm font-medium">
        {(["all", "new", "contacted", "closed"] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`flex-1 min-w-[70px] py-2 px-3 rounded-lg capitalize transition font-semibold text-center ${
              statusFilter === filter
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Leads List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
          <p className="text-sm">Loading lead inbox...</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-slate-300">
          <Filter className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">
            {statusFilter === "new"
              ? "You're caught up — no new leads need attention."
              : statusFilter === "all"
              ? "No leads received yet."
              : `No leads currently in the "${statusFilter}" status.`}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            {statusFilter === "new"
              ? "Incoming website forms, manual entries, and missed calls will appear here."
              : "Check another filter or create a lead manually."}
          </p>
          <div className="mt-4">
            <Link
              href="/test-lead"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
            >
              Submit a Test Lead
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => {
            const isNew = lead.status === "NEW";
            const isContacted = lead.status === "CONTACTED";
            const isClosed = lead.status === "CLOSED";
            const activeAppt = lead.appointments?.find((a) => a.status === "SCHEDULED");

            return (
              <div
                key={lead.id}
                className={`relative rounded-2xl p-4 sm:p-5 transition shadow-sm border ${
                  isNew
                    ? "bg-white border-blue-400 ring-2 ring-blue-500/20 shadow-blue-500/5"
                    : isClosed
                    ? "bg-slate-50/75 border-slate-200 text-slate-600 opacity-80 hover:opacity-100"
                    : "bg-white border-slate-200/90 hover:border-slate-300"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3.5">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    {/* Badges line */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[11px] ${
                          isNew
                            ? "bg-blue-600 text-white"
                            : isContacted
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-slate-200 text-slate-700 border border-slate-300"
                        }`}
                      >
                        {lead.status}
                      </span>

                      {/* Source Badge */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200">
                        {lead.source === "WEBSITE" && <Globe className="w-3 h-3 text-blue-500" />}
                        {lead.source === "MANUAL" && <UserCheck className="w-3 h-3 text-purple-500" />}
                        {lead.source === "MISSED_CALL" && <PhoneMissed className="w-3 h-3 text-rose-500" />}
                        <span>{lead.source.replace("_", " ")}</span>
                      </span>

                      {/* Time Age */}
                      <span className="inline-flex items-center gap-1 text-slate-400 text-xs ml-auto sm:ml-0 font-medium">
                        <Clock className="w-3 h-3" />
                        <span>{formatRelativeTime(lead.createdAt)}</span>
                      </span>
                    </div>

                    {/* Customer Name & Phone */}
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <Link
                        href={`/leads/${lead.id}`}
                        className={`text-lg font-bold transition truncate ${
                          isClosed
                            ? "text-slate-700 hover:text-blue-600"
                            : "text-slate-900 hover:text-blue-600"
                        }`}
                      >
                        {lead.name}
                      </Link>
                      <span className="text-sm font-semibold text-slate-600 tracking-tight">
                        {lead.phone}
                      </span>
                    </div>

                    {/* Requested Service */}
                    {lead.service && (
                      <div className="text-xs font-semibold text-blue-700 bg-blue-50/80 inline-block px-2.5 py-1 rounded-lg border border-blue-100">
                        Service: {lead.service.name}
                        {lead.service.defaultPriceCents !== null && lead.service.defaultPriceCents !== undefined && (
                          <span className="text-blue-900 ml-1 font-bold">
                            (${lead.service.defaultPriceCents / 100})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Message Preview */}
                    {lead.message && (
                      <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 mt-1">
                        &quot;{lead.message}&quot;
                      </p>
                    )}
                  </div>

                  {/* Actions Column: Strict 3-Tier Hierarchy */}
                  <div className="flex flex-wrap sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2.5 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                    {/* CLOSED leads: recedes with clean Reopen and View Details */}
                    {isClosed ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleStatusTransition(lead.id, "CONTACTED", e)}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition shadow-sm"
                        >
                          Reopen Lead
                        </button>
                        <Link
                          href={`/leads/${lead.id}`}
                          className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                        >
                          Details
                        </Link>
                      </div>
                    ) : (
                      <>
                        {/* Primary Action Row: Call | Text | Book Appt / Appt Scheduled */}
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${lead.phone}`}
                            aria-label={`Call ${lead.name}`}
                            title="Call Customer"
                            className="flex items-center justify-center h-10 w-10 sm:h-9 sm:w-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition shadow-sm"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                          <a
                            href={`sms:${lead.phone}`}
                            aria-label={`Text ${lead.name}`}
                            title="Text Customer"
                            className="flex items-center justify-center h-10 w-10 sm:h-9 sm:w-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white transition shadow-sm"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </a>

                          {/* Primary Conversion CTA */}
                          {activeAppt ? (
                            <Link
                              href="/appointments"
                              className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition shadow-sm"
                            >
                              <CalendarCheck2 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Appt Scheduled</span>
                            </Link>
                          ) : (
                            <button
                              onClick={() =>
                                setBookingModalState({
                                  isOpen: true,
                                  initialData: {
                                    leadId: lead.id,
                                    customerName: lead.name,
                                    customerPhone: lead.phone,
                                    customerEmail: lead.email,
                                    serviceId: lead.service?.id,
                                    defaultPriceCents: lead.service?.defaultPriceCents,
                                    notes: lead.message,
                                  },
                                })
                              }
                              className="flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition active:scale-95"
                            >
                              <CalendarPlus className="w-3.5 h-3.5" />
                              <span>Book Appt</span>
                            </button>
                          )}
                        </div>

                        {/* Secondary Actions: quiet textual links */}
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          {isNew && (
                            <>
                              <button
                                onClick={(e) => handleStatusTransition(lead.id, "CONTACTED", e)}
                                className="hover:text-amber-700 hover:underline transition"
                              >
                                Mark Contacted
                              </button>
                              <span className="text-slate-300">•</span>
                            </>
                          )}
                          <button
                            onClick={(e) => handleStatusTransition(lead.id, "CLOSED", e)}
                            className="hover:text-slate-800 hover:underline transition"
                          >
                            Close Lead
                          </button>
                          <span className="text-slate-300">•</span>
                          <Link
                            href={`/leads/${lead.id}`}
                            className="text-slate-600 hover:text-blue-600 hover:underline transition font-semibold"
                          >
                            Details
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Lead Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsManualModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900">Add Manual Lead</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter details for a walk-in, direct phone call, or referral
            </p>

            <form onSubmit={handleCreateManualLead} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={manualForm.name}
                  onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                  placeholder="e.g. John Smith"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={manualForm.phone}
                  onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                  placeholder="(919) 555-0123"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={manualForm.email}
                  onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                  placeholder="customer@example.com"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Requested Service (Optional)
                </label>
                <select
                  value={manualForm.serviceId}
                  onChange={(e) => setManualForm({ ...manualForm, serviceId: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- No specific service --</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.defaultPriceCents ? `($${s.defaultPriceCents / 100})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes / Inbound Message
                </label>
                <textarea
                  rows={3}
                  value={manualForm.message}
                  onChange={(e) => setManualForm({ ...manualForm, message: e.target.value })}
                  placeholder="Details about customer's inquiry..."
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingManual}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  {submittingManual ? "Saving..." : "Save Manual Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Book Appointment Modal */}
      <BookAppointmentModal
        isOpen={bookingModalState.isOpen}
        onClose={() => setBookingModalState({ isOpen: false })}
        onSuccess={() => fetchLeads()}
        initialData={bookingModalState.initialData}
      />
    </div>
  );
}
