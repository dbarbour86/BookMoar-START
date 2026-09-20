"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, DollarSign, Clock, User, Phone, Mail, FileText, Loader2 } from "lucide-react";

interface ServiceOption {
  id: string;
  name: string;
  defaultPriceCents?: number | null;
}

export interface BookAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    leadId?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string | null;
    serviceId?: string | null;
    serviceName?: string | null;
    defaultPriceCents?: number | null;
    notes?: string | null;
  };
}

export default function BookAppointmentModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: BookAppointmentModalProps) {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [customerName, setCustomerName] = useState(initialData?.customerName || "");
  const [customerPhone, setCustomerPhone] = useState(initialData?.customerPhone || "");
  const [customerEmail, setCustomerEmail] = useState(initialData?.customerEmail || "");
  const [serviceId, setServiceId] = useState(initialData?.serviceId || "");
  
  // Format current datetime + 2 hours rounded to next hour as default
  const defaultDateTime = () => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    d.setMinutes(0, 0, 0);
    // Format to YYYY-MM-DDTHH:MM for input datetime-local
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [scheduledAt, setScheduledAt] = useState(defaultDateTime());
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [valueDollars, setValueDollars] = useState<string>(
    initialData?.defaultPriceCents ? (initialData.defaultPriceCents / 100).toString() : ""
  );
  const [notes, setNotes] = useState(initialData?.notes || "");

  useEffect(() => {
    async function loadServices() {
      try {
        const res = await fetch("/api/services");
        if (res.ok) {
          const data = await res.json();
          setServices(data.services || []);
        }
      } catch (err) {
        console.error("Failed to load services:", err);
      } finally {
        setLoadingServices(false);
      }
    }
    if (isOpen) {
      loadServices();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      if (initialData.customerName) setCustomerName(initialData.customerName);
      if (initialData.customerPhone) setCustomerPhone(initialData.customerPhone);
      if (initialData.customerEmail !== undefined) setCustomerEmail(initialData.customerEmail || "");
      if (initialData.serviceId) setServiceId(initialData.serviceId);
      if (initialData.defaultPriceCents !== undefined && initialData.defaultPriceCents !== null) {
        setValueDollars((initialData.defaultPriceCents / 100).toString());
      }
      if (initialData.notes) setNotes(initialData.notes);
    }
  }, [initialData]);

  function handleServiceChange(selectedServiceId: string) {
    setServiceId(selectedServiceId);
    const s = services.find((srv) => srv.id === selectedServiceId);
    if (s && s.defaultPriceCents !== null && s.defaultPriceCents !== undefined) {
      setValueDollars((s.defaultPriceCents / 100).toString());
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const priceCents = valueDollars ? Math.round(parseFloat(valueDollars) * 100) : null;

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: initialData?.leadId || undefined,
          customerName,
          customerPhone,
          customerEmail: customerEmail || undefined,
          serviceId: serviceId || undefined,
          scheduledAt: new Date(scheduledAt).toISOString(),
          durationMinutes: Number(durationMinutes) || 60,
          valueCents: priceCents,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to book appointment");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error booking appointment");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative my-8 animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {initialData?.leadId ? "Book Lead as Appointment" : "Schedule New Appointment"}
            </h2>
            <p className="text-xs text-slate-500">
              Record scheduled work and track booked value
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Name *
              </label>
              <div className="relative rounded-xl">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full text-sm pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Phone *
              </label>
              <div className="relative rounded-xl">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Phone className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(919) 555-0123"
                  className="w-full text-sm pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer Email (Optional)
            </label>
            <div className="relative rounded-xl">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Mail className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full text-sm pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Service (Optional)
              </label>
              <select
                value={serviceId}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Select Service --</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.defaultPriceCents ? `($${s.defaultPriceCents / 100})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Job Value ($ USD)
              </label>
              <div className="relative rounded-xl">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <DollarSign className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valueDollars}
                  onChange={(e) => setValueDollars(e.target.value)}
                  placeholder="300.00"
                  className="w-full text-sm pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-blue-900"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date & Time *
              </label>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Duration (min)
              </label>
              <div className="relative rounded-xl">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full text-sm pl-8 pr-2 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Job Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 2022 Honda CR-V, gray paint. Needs pet hair removal."
              className="w-full text-sm px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 disabled:opacity-50 transition active:scale-95"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Booking...</span>
                </>
              ) : (
                <span>Confirm Appointment</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
