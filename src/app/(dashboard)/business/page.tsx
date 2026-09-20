"use client";

import React, { useState, useEffect } from "react";
import { Building2, Save, Loader2, CheckCircle2, MessageSquare, AlertCircle } from "lucide-react";

interface BusinessData {
  id: string;
  name: string;
  phone: string;
  email: string;
  timezone: string;
  websiteUrl?: string | null;
  address?: string | null;
  notificationPhone: string;
  notificationEmail?: string | null;
  missedCallTextTemplate: string;
}

export default function BusinessProfilePage() {
  const [business, setBusiness] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadBusiness() {
      try {
        const res = await fetch("/api/business");
        if (res.ok) {
          const data = await res.json();
          setBusiness(data.business);
        }
      } catch (err) {
        console.error("Failed to load business profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadBusiness();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!business) return;

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: business.name,
          phone: business.phone,
          email: business.email,
          timezone: business.timezone,
          websiteUrl: business.websiteUrl || null,
          address: business.address || null,
          notificationPhone: business.notificationPhone,
          notificationEmail: business.notificationEmail || null,
          missedCallTextTemplate: business.missedCallTextTemplate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update business configuration");
      }

      setBusiness(data.business);
      setSuccessMessage("Business profile updated successfully!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error saving profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
        <p className="text-sm">Loading business profile...</p>
      </div>
    );
  }

  if (!business) {
    return <div>Unable to load business profile.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-blue-600" />
          <span>Business Configuration</span>
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Single-client deployment settings and notifications configuration
        </p>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-sm font-semibold text-red-800">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5">
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-100">
            Business Details
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Business Name *
            </label>
            <input
              type="text"
              required
              value={business.name}
              onChange={(e) => setBusiness({ ...business, name: e.target.value })}
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Main Business Phone *
              </label>
              <input
                type="tel"
                required
                value={business.phone}
                onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Main Business Email *
              </label>
              <input
                type="email"
                required
                value={business.email}
                onChange={(e) => setBusiness({ ...business, email: e.target.value })}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Timezone *
              </label>
              <select
                value={business.timezone}
                onChange={(e) => setBusiness({ ...business, timezone: e.target.value })}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="America/New_York">Eastern (America/New_York)</option>
                <option value="America/Chicago">Central (America/Chicago)</option>
                <option value="America/Denver">Mountain (America/Denver)</option>
                <option value="America/Phoenix">Mountain / Phoenix (No DST)</option>
                <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Website URL
              </label>
              <input
                type="url"
                value={business.websiteUrl || ""}
                onChange={(e) => setBusiness({ ...business, websiteUrl: e.target.value })}
                placeholder="https://yourbusiness.com"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Business Physical Address
            </label>
            <input
              type="text"
              value={business.address || ""}
              onChange={(e) => setBusiness({ ...business, address: e.target.value })}
              placeholder="123 Main St, City, State ZIP"
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Owner Notifications Section */}
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-100">
            Owner Notifications
          </h2>
          <p className="text-xs text-slate-500">
            Where Book Moar alerts the owner when a new lead arrives.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notification SMS Phone *
              </label>
              <input
                type="tel"
                required
                value={business.notificationPhone}
                onChange={(e) => setBusiness({ ...business, notificationPhone: e.target.value })}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notification Email (Optional)
              </label>
              <input
                type="email"
                value={business.notificationEmail || ""}
                onChange={(e) => setBusiness({ ...business, notificationEmail: e.target.value })}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Missed-Call Recovery SMS Template */}
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>Missed-Call Auto Text Template</span>
            </h2>
            <span className="text-xs text-slate-400">
              {business.missedCallTextTemplate.length}/320 chars
            </span>
          </div>

          <div>
            <textarea
              rows={3}
              required
              maxLength={320}
              value={business.missedCallTextTemplate}
              onChange={(e) => setBusiness({ ...business, missedCallTextTemplate: e.target.value })}
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
            />
            <p className="text-xs text-slate-500 mt-1">
              Sent automatically to callers when their inbound call is missed (no-answer, busy, or failed).
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-md shadow-blue-600/20 disabled:opacity-50 transition active:scale-95"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Configuration</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
