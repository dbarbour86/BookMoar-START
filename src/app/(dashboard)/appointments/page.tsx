"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  CalendarPlus,
  Clock,
  Phone,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit2,
  Loader2,
  RefreshCw,
  Filter,
  DollarSign,
  X,
  Save
} from "lucide-react";
import BookAppointmentModal from "@/components/BookAppointmentModal";

interface AppointmentItem {
  id: string;
  leadId?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  scheduledAt: string;
  durationMinutes: number;
  valueCents?: number | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
  notes?: string | null;
  service?: {
    id: string;
    name: string;
    defaultPriceCents?: number | null;
  } | null;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [filter, setFilter] = useState<"upcoming" | "completed" | "canceled" | "no_show" | "all">("upcoming");
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Edit modal state
  const [editingAppointment, setEditingAppointment] = useState<AppointmentItem | null>(null);
  const [editForm, setEditForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    scheduledAt: "",
    durationMinutes: 60,
    valueDollars: "",
    notes: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/appointments?filter=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments || []);
      }
    } catch (err) {
      console.error("Failed to load appointments:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  async function handleStatusChange(id: string, nextStatus: "COMPLETED" | "CANCELED" | "NO_SHOW") {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        fetchAppointments();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update appointment status");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating appointment status");
    }
  }

  function openEditModal(appt: AppointmentItem) {
    setEditingAppointment(appt);
    const d = new Date(appt.scheduledAt);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const formattedDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    setEditForm({
      customerName: appt.customerName,
      customerPhone: appt.customerPhone,
      customerEmail: appt.customerEmail || "",
      scheduledAt: formattedDate,
      durationMinutes: appt.durationMinutes || 60,
      valueDollars: appt.valueCents ? (appt.valueCents / 100).toString() : "",
      notes: appt.notes || "",
    });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAppointment) return;

    setSavingEdit(true);
    const priceCents = editForm.valueDollars ? Math.round(parseFloat(editForm.valueDollars) * 100) : null;

    try {
      const res = await fetch(`/api/appointments/${editingAppointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: editForm.customerName,
          customerPhone: editForm.customerPhone,
          customerEmail: editForm.customerEmail || null,
          scheduledAt: new Date(editForm.scheduledAt).toISOString(),
          durationMinutes: Number(editForm.durationMinutes) || 60,
          valueCents: priceCents,
          notes: editForm.notes || null,
        }),
      });

      if (res.ok) {
        setEditingAppointment(null);
        fetchAppointments();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update appointment");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving edit");
    } finally {
      setSavingEdit(false);
    }
  }

  function formatDateTime(isoString: string) {
    const d = new Date(isoString);
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Appointments
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage booked jobs and track scheduled work
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAppointments()}
            title="Refresh Appointments"
            className="p-2.5 rounded-xl border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-600/20 transition active:scale-95"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>Add Appointment</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-1 p-1 bg-slate-200/80 rounded-xl overflow-x-auto text-xs sm:text-sm font-medium">
        {(["upcoming", "completed", "canceled", "no_show", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg capitalize transition font-semibold text-center whitespace-nowrap ${
              filter === f
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {f.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Appointment List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
          <p className="text-sm">Loading appointments...</p>
        </div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-slate-300">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">
            {filter === "upcoming"
              ? "No upcoming appointments scheduled."
              : filter === "all"
              ? "No appointments yet."
              : `No appointments currently under "${filter.replace("_", " ")}".`}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            {filter === "upcoming"
              ? "Book a lead from the Leads inbox or click 'Add Appointment' above."
              : "Check another filter or schedule a new appointment."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const isCompleted = appt.status === "COMPLETED";
            const isCanceled = appt.status === "CANCELED";
            const isNoShow = appt.status === "NO_SHOW";
            const isScheduled = appt.status === "SCHEDULED";

            return (
              <div
                key={appt.id}
                className={`p-5 rounded-2xl border transition shadow-sm bg-white ${
                  isScheduled
                    ? "border-blue-300 shadow-blue-500/5 hover:border-blue-400"
                    : isCompleted
                    ? "border-slate-200 bg-slate-50/50"
                    : isCanceled
                    ? "border-slate-200 opacity-70 bg-slate-50/70"
                    : "border-rose-200 bg-rose-50/20"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left Column */}
                  <div className="space-y-2 flex-1">
                    {/* Header line with badge & datetime */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                          isScheduled
                            ? "bg-blue-600 text-white"
                            : isCompleted
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : isCanceled
                            ? "bg-slate-200 text-slate-600 line-through"
                            : "bg-rose-100 text-rose-800 border border-rose-300"
                        }`}
                      >
                        {appt.status}
                      </span>

                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        <span>{formatDateTime(appt.scheduledAt)}</span>
                        <span className="text-slate-400 font-normal">({appt.durationMinutes} min)</span>
                      </span>
                    </div>

                    {/* Customer Info */}
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <h3 className="text-lg font-bold text-slate-900">
                        {appt.customerName}
                      </h3>
                      <span className="text-sm font-semibold text-slate-600">
                        {appt.customerPhone}
                      </span>
                      {appt.customerEmail && (
                        <span className="text-xs text-slate-400">
                          {appt.customerEmail}
                        </span>
                      )}
                    </div>

                    {/* Service & Booked Value */}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {appt.serviceName && (
                        <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                          {appt.serviceName}
                        </span>
                      )}

                      {appt.valueCents !== null && appt.valueCents !== undefined && (
                        <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                          Booked: ${appt.valueCents / 100}
                        </span>
                      )}
                    </div>

                    {/* Notes */}
                    {appt.notes && (
                      <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-xl border border-slate-100">
                        &quot;{appt.notes}&quot;
                      </p>
                    )}
                  </div>

                  {/* Actions Right: Exact User-Specified State-Dependent Action Matrix */}
                  <div className="flex flex-wrap sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                    {/* SCHEDULED: Call | Text | Edit | Complete | No Show | Cancel */}
                    {isScheduled && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${appt.customerPhone}`}
                            aria-label={`Call ${appt.customerName}`}
                            title="Call Customer"
                            className="flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition shadow-sm border border-emerald-200"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                          <a
                            href={`sms:${appt.customerPhone}`}
                            aria-label={`Text ${appt.customerName}`}
                            title="Text Customer"
                            className="flex items-center justify-center h-9 w-9 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition shadow-sm border border-blue-200"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => openEditModal(appt)}
                            title="Edit Appointment"
                            aria-label={`Edit appointment for ${appt.customerName}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition border border-slate-200 text-xs font-semibold"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            onClick={() => handleStatusChange(appt.id, "COMPLETED")}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Complete</span>
                          </button>
                          <button
                            onClick={() => handleStatusChange(appt.id, "NO_SHOW")}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>No Show</span>
                          </button>
                          <button
                            onClick={() => handleStatusChange(appt.id, "CANCELED")}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-500 transition"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      </>
                    )}

                    {/* COMPLETED: View / Edit only */}
                    {isCompleted && (
                      <button
                        onClick={() => openEditModal(appt)}
                        aria-label={`View or edit completed appointment for ${appt.customerName}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition border border-slate-200"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>View / Edit</span>
                      </button>
                    )}

                    {/* CANCELED: View / Edit only */}
                    {isCanceled && (
                      <button
                        onClick={() => openEditModal(appt)}
                        aria-label={`View or edit canceled appointment for ${appt.customerName}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition border border-slate-200"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>View / Edit</span>
                      </button>
                    )}

                    {/* NO_SHOW: Call | Text | View / Edit */}
                    {isNoShow && (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${appt.customerPhone}`}
                          aria-label={`Call ${appt.customerName}`}
                          title="Call Customer"
                          className="flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition shadow-sm border border-emerald-200"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                        <a
                          href={`sms:${appt.customerPhone}`}
                          aria-label={`Text ${appt.customerName}`}
                          title="Text Customer"
                          className="flex items-center justify-center h-9 w-9 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition shadow-sm border border-blue-200"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => openEditModal(appt)}
                          aria-label={`View or edit no-show appointment for ${appt.customerName}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition border border-slate-200"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>View / Edit</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Appointment Modal */}
      <BookAppointmentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => fetchAppointments()}
      />

      {/* Edit Appointment Modal */}
      {editingAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative my-8 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setEditingAppointment(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900">
              Edit Appointment
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Update scheduled time, value, or details
            </p>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.customerName}
                  onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Phone *
                </label>
                <input
                  type="tel"
                  required
                  value={editForm.customerPhone}
                  onChange={(e) => setEditForm({ ...editForm, customerPhone: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Email
                </label>
                <input
                  type="email"
                  value={editForm.customerEmail}
                  onChange={(e) => setEditForm({ ...editForm, customerEmail: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Job Value ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.valueDollars}
                    onChange={(e) => setEditForm({ ...editForm, valueDollars: e.target.value })}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={editForm.durationMinutes}
                    onChange={(e) => setEditForm({ ...editForm, durationMinutes: Number(e.target.value) })}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Scheduled Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={editForm.scheduledAt}
                  onChange={(e) => setEditForm({ ...editForm, scheduledAt: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full text-sm px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAppointment(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
