"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Zap, Send, CheckCircle2, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";

interface ServiceItem {
  id: string;
  name: string;
  defaultPriceCents?: number | null;
}

export default function TestLeadPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successLead, setSuccessLead] = useState<{ id: string; name: string; status: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "Alex Johnson",
    phone: "(919) 555-8833",
    email: "alex.j@example.com",
    serviceId: "",
    message: "Hi, I need service this Friday afternoon if possible. Please call or text me!",
    website_hp: "", // honeypot
  });

  useEffect(() => {
    async function loadServices() {
      try {
        const res = await fetch("/api/services");
        if (res.ok) {
          const data = await res.json();
          setServices(data.services || []);
          if (data.services && data.services.length > 0) {
            setFormData((prev) => ({ ...prev, serviceId: data.services[0].id }));
          }
        }
      } catch (err) {
        console.error("Failed to load services:", err);
      } finally {
        setLoadingServices(false);
      }
    }
    loadServices();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessLead(null);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          email: formData.email || undefined,
          serviceId: formData.serviceId || undefined,
          message: formData.message || undefined,
          website_hp: formData.website_hp,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit lead");
      }

      setSuccessLead(data.lead);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error submitting lead");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-md shadow-blue-500/20">
            <Zap className="h-6 w-6 text-white fill-white" />
          </div>
        </div>
        <h1 className="mt-4 text-center text-2xl font-black tracking-tight text-slate-900">
          Public Website Lead Test Form
        </h1>
        <p className="mt-1 text-center text-xs text-slate-500">
          Exercises the public <code className="text-blue-600 font-bold">POST /api/leads</code> intake endpoint
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-200 space-y-5">
          {successLead ? (
            <div className="space-y-4 text-center py-4 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Lead Created Successfully!
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Assigned Status: <span className="font-bold text-blue-600">{successLead.status}</span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  ID: <code className="text-slate-600">{successLead.id}</code>
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Link
                  href={`/leads/${successLead.id}`}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/20 transition"
                >
                  <span>View in Lead Inbox</span>
                </Link>
                <button
                  onClick={() => setSuccessLead(null)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 py-2"
                >
                  Submit Another Lead
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Honeypot hidden field */}
              <input
                type="text"
                name="website_hp"
                value={formData.website_hp}
                onChange={(e) => setFormData({ ...formData, website_hp: e.target.value })}
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Interested In
                </label>
                {loadingServices ? (
                  <div className="text-xs text-slate-400 py-2">Loading active services...</div>
                ) : (
                  <select
                    value={formData.serviceId}
                    onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="">-- No specific service --</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.defaultPriceCents ? `($${s.defaultPriceCents / 100})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Message / Notes
                </label>
                <textarea
                  rows={3}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 disabled:opacity-50 transition active:scale-95"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Lead...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Lead to Business</span>
                  </>
                )}
              </button>
            </form>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <Link href="/leads" className="flex items-center gap-1 hover:text-slate-800">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Inbox</span>
            </Link>
            <Link href="/login" className="hover:text-slate-800">
              Owner Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
