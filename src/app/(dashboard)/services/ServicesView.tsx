"use client";

import React, { useState, useEffect } from "react";
import { Plus, Edit2, CheckCircle, EyeOff, Loader2, X } from "lucide-react";

interface ServiceItem {
  id: string;
  name: string;
  description?: string | null;
  defaultPriceCents?: number | null;
  active: boolean;
  createdAt: string;
}

export default function ServicesView() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    priceDollars: "",
  });

  async function fetchServices() {
    try {
      setLoading(true);
      const res = await fetch("/api/services");
      if (res.ok) {
        const data = await res.json();
        setServices(data.services || []);
      }
    } catch (err) {
      console.error("Failed to load services:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchServices();
  }, []);

  function openCreateModal() {
    setEditingService(null);
    setFormData({ name: "", description: "", priceDollars: "" });
    setIsModalOpen(true);
  }

  function openEditModal(service: ServiceItem) {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      priceDollars: service.defaultPriceCents ? (service.defaultPriceCents / 100).toString() : "",
    });
    setIsModalOpen(true);
  }

  async function handleSaveService(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const priceCents = formData.priceDollars ? Math.round(parseFloat(formData.priceDollars) * 100) : null;

    try {
      if (editingService) {
        // Edit
        const res = await fetch(`/api/services/${editingService.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
            defaultPriceCents: priceCents,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update service");
        }
      } else {
        // Create
        const res = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
            defaultPriceCents: priceCents,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create service");
        }
      }

      setIsModalOpen(false);
      fetchServices();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save service");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(service: ServiceItem) {
    try {
      const res = await fetch(`/api/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active: !service.active,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to toggle service status");
      }

      fetchServices();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error toggling status");
    }
  }

  const activeServices = services.filter((s) => s.active);
  const inactiveServices = services.filter((s) => !s.active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Services Catalog
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage offerings presented to potential customers
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-600/20 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Service</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
          <p className="text-sm">Loading services...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Services */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Active Services ({activeServices.length})
            </h2>

            {activeServices.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-dashed border-slate-300 text-center text-slate-500 text-sm">
                No active services configured. Click &quot;Add Service&quot; above to create one.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeServices.map((service) => (
                  <div
                    key={service.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {service.name}
                        </h3>
                        {service.defaultPriceCents !== null && service.defaultPriceCents !== undefined && (
                          <span className="text-base font-extrabold text-blue-600">
                            ${service.defaultPriceCents / 100}
                          </span>
                        )}
                      </div>
                      {service.description && (
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                          {service.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-4 mt-3 border-t border-slate-100">
                      <button
                        onClick={() => openEditModal(service)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => toggleActive(service)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Deactivate</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inactive Services */}
          {inactiveServices.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Inactive Services ({inactiveServices.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-75">
                {inactiveServices.map((service) => (
                  <div
                    key={service.id}
                    className="bg-slate-100 rounded-2xl p-5 border border-slate-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold text-slate-600 line-through">
                          {service.name}
                        </h3>
                        {service.defaultPriceCents !== null && service.defaultPriceCents !== undefined && (
                          <span className="text-base font-bold text-slate-500">
                            ${service.defaultPriceCents / 100}
                          </span>
                        )}
                      </div>
                      {service.description && (
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                          {service.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-4 mt-3 border-t border-slate-200">
                      <button
                        onClick={() => toggleActive(service)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 transition"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Reactivate</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900">
              {editingService ? "Edit Service" : "Add New Service"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Available to roofers, detailers, contractors, and local service pros
            </p>

            <form onSubmit={handleSaveService} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Full Detail, Roof Inspection, Oil Change"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Price ($ USD)
                </label>
                <div className="relative rounded-xl">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-slate-500 text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.priceDollars}
                    onChange={(e) => setFormData({ ...formData, priceDollars: e.target.value })}
                    placeholder="150.00"
                    className="w-full text-sm pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What is included in this service?"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingService ? "Update Service" : "Create Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
