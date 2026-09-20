"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Mail,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  Globe,
  UserCheck,
  PhoneMissed,
  Loader2,
  Calendar,
  AlertCircle,
  CalendarPlus,
  CalendarCheck2,
} from "lucide-react";
import BookAppointmentModal from "@/components/BookAppointmentModal";
import { formatDuration } from "@/lib/duration";

interface LeadDetailData {
  id: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  email?: string | null;
  message?: string | null;
  source: "WEBSITE" | "MANUAL" | "MISSED_CALL";
  status: "NEW" | "CONTACTED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  contactedAt?: string | null;
  closedAt?: string | null;
  service?: {
    id: string;
    name: string;
    description?: string | null;
    defaultPriceCents?: number | null;
  } | null;
  appointments?: Array<{
    id: string;
    scheduledAt: string;
    durationMinutes: number;
    valueCents?: number | null;
    status: "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
    serviceName?: string | null;
    notes?: string | null;
  }>;
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  const [lead, setLead] = useState<LeadDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  const fetchLead = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/leads/${leadId}`);
      if (!res.ok) {
        throw new Error("Lead not found");
      }
      const data = await res.json();
      setLead(data.lead);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load lead");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (leadId) {
      fetchLead();
    }
  }, [leadId, fetchLead]);

  async function handleStatusTransition(nextStatus: "CONTACTED" | "CLOSED") {
    setUpdating(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update status");
      }

      setLead(data.lead);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
        <p className="text-sm">Loading lead details...</p>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Error Loading Lead</h2>
        <p className="text-sm text-slate-500 mt-1">{error || "Lead not found"}</p>
        <Link
          href="/leads"
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Inbox</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition p-1 -ml-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Leads</span>
        </Link>

        {/* Status Pill */}
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            lead.status === "NEW"
              ? "bg-blue-600 text-white"
              : lead.status === "CONTACTED"
              ? "bg-amber-100 text-amber-800 border border-amber-300"
              : "bg-slate-100 text-slate-600 border border-slate-200"
          }`}
        >
          {lead.status}
        </span>
      </div>

      {/* Main Lead Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/90 space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span className="flex items-center gap-1">
              {lead.source === "WEBSITE" && <Globe className="w-3.5 h-3.5 text-blue-500" />}
              {lead.source === "MANUAL" && <UserCheck className="w-3.5 h-3.5 text-purple-500" />}
              {lead.source === "MISSED_CALL" && <PhoneMissed className="w-3.5 h-3.5 text-rose-500" />}
              {lead.source.replace("_", " ")}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {new Date(lead.createdAt).toLocaleString()}
            </span>
          </div>

          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {lead.name}
          </h1>

          <div className="mt-2 text-base font-semibold text-slate-700">
            {lead.phone}
          </div>
          {lead.email && (
            <div className="text-sm font-medium text-slate-500">
              {lead.email}
            </div>
          )}
        </div>

        {/* Big Tap Actions: 1-touch Call, Text, Email */}
        <div className={`grid ${lead.email ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"} gap-3`}>
          <a
            href={`tel:${lead.phone}`}
            aria-label={`Call ${lead.name}`}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-600 hover:text-white transition shadow-sm font-semibold text-sm gap-1 active:scale-95"
          >
            <Phone className="w-5 h-5" />
            <span>Call</span>
          </a>

          <a
            href={`sms:${lead.phone}`}
            aria-label={`Text ${lead.name}`}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-600 hover:text-white transition shadow-sm font-semibold text-sm gap-1 active:scale-95"
          >
            <MessageSquare className="w-5 h-5" />
            <span>Text</span>
          </a>

          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              aria-label={`Email ${lead.name}`}
              className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 hover:bg-slate-800 hover:text-white transition shadow-sm font-semibold text-sm gap-1 active:scale-95"
            >
              <Mail className="w-5 h-5" />
              <span>Email</span>
            </a>
          )}
        </div>

        {/* Scheduled Appointment Card (if already booked) */}
        {(() => {
          const activeAppt = lead.appointments?.find((a) => a.status === "SCHEDULED");
          if (!activeAppt) return null;

          return (
            <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarCheck2 className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-bold text-blue-950">
                    Appointment Scheduled
                  </span>
                </div>
                <Link
                  href="/appointments"
                  className="text-xs font-bold text-blue-700 hover:text-blue-900 underline"
                >
                  View in Appointments
                </Link>
              </div>
              <div className="text-xs text-slate-700 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>
                  When: <strong>{new Date(activeAppt.scheduledAt).toLocaleString()}</strong>
                </span>
                <span>
                  Duration: <strong>{formatDuration(activeAppt.durationMinutes)}</strong>
                </span>
                {activeAppt.valueCents !== null && activeAppt.valueCents !== undefined && (
                  <span>
                    Booked Value: <strong>${activeAppt.valueCents / 100}</strong>
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Requested Service */}
        {lead.service ? (
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Requested Service
            </span>
            <div className="flex items-baseline justify-between">
              <h3 className="text-base font-bold text-blue-950">
                {lead.service.name}
              </h3>
              {lead.service.defaultPriceCents !== null && lead.service.defaultPriceCents !== undefined && (
                <span className="text-base font-extrabold text-blue-900">
                  ${lead.service.defaultPriceCents / 100}
                </span>
              )}
            </div>
            {lead.service.description && (
              <p className="text-xs text-blue-800 leading-relaxed pt-1">
                {lead.service.description}
              </p>
            )}
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500">
            No specific service selected.
          </div>
        )}

        {/* Customer Inbound Message */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
            Inbound Message / Inquiry Details
          </label>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
            {lead.message || "No message content submitted."}
          </div>
        </div>

        {/* Lifecycle Timeline */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
            Activity Timeline
          </label>
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>Received: <strong>{new Date(lead.createdAt).toLocaleString()}</strong></span>
            </div>
            {lead.contactedAt && (
              <div className="flex items-center gap-2 text-amber-800">
                <CheckCircle2 className="w-4 h-4 text-amber-600" />
                <span>Marked Contacted: <strong>{new Date(lead.contactedAt).toLocaleString()}</strong></span>
              </div>
            )}
            {lead.closedAt && (
              <div className="flex items-center gap-2 text-slate-500">
                <XCircle className="w-4 h-4 text-slate-400" />
                <span>Closed: <strong>{new Date(lead.closedAt).toLocaleString()}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Primary Booking & Lifecycle Bar */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          {/* If NOT closed, show conversion action */}
          {lead.status !== "CLOSED" && (
            <button
              onClick={() => setIsBookingOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-extrabold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition active:scale-[0.99]"
            >
              <CalendarPlus className="w-5 h-5" />
              <span>
                {lead.appointments?.some((a) => a.status === "SCHEDULED")
                  ? "Book Another Appointment"
                  : "Book Appointment"}
              </span>
            </button>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {lead.status === "NEW" && (
              <>
                <button
                  onClick={() => handleStatusTransition("CONTACTED")}
                  disabled={updating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Contacted</span>
                </button>
                <button
                  onClick={() => handleStatusTransition("CLOSED")}
                  disabled={updating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4 text-slate-500" />
                  <span>Close Lead</span>
                </button>
              </>
            )}

            {lead.status === "CONTACTED" && (
              <button
                onClick={() => handleStatusTransition("CLOSED")}
                disabled={updating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition disabled:opacity-50"
              >
                <XCircle className="w-4 h-4 text-slate-500" />
                <span>Close Lead</span>
              </button>
            )}

            {lead.status === "CLOSED" && (
              <button
                onClick={() => handleStatusTransition("CONTACTED")}
                disabled={updating}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-900 text-white shadow-sm transition disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reopen Lead</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Book Appointment Modal */}
      <BookAppointmentModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        onSuccess={() => fetchLead()}
        initialData={{
          leadId: lead.id,
          customerName: lead.name,
          customerPhone: lead.phone,
          customerEmail: lead.email,
          serviceId: lead.service?.id,
          serviceName: lead.service?.name,
          defaultPriceCents: lead.service?.defaultPriceCents,
          notes: lead.message,
        }}
      />
    </div>
  );
}
