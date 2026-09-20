import { db } from "@/lib/db";
import { z } from "zod";

export const createServiceSchema = z.object({
  name: z.string().min(1, "Service name is required").max(100),
  description: z.string().max(500).optional().nullable(),
  defaultPriceCents: z.number().int().nonnegative().optional().nullable(),
});

export const updateServiceSchema = z.object({
  name: z.string().min(1, "Service name is required").max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  defaultPriceCents: z.number().int().nonnegative().optional().nullable(),
  active: z.boolean().optional(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export async function listActiveServices() {
  return db.service.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}

export async function listAllServices() {
  return db.service.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export async function getServiceById(id: string) {
  return db.service.findUnique({
    where: { id },
  });
}

export async function createService(data: CreateServiceInput) {
  return db.service.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      defaultPriceCents: data.defaultPriceCents ?? null,
      active: true,
    },
  });
}

export async function updateService(id: string, data: UpdateServiceInput) {
  return db.service.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() || null }),
      ...(data.defaultPriceCents !== undefined && { defaultPriceCents: data.defaultPriceCents }),
      ...(data.active !== undefined && { active: data.active }),
    },
  });
}

export async function setServiceActive(id: string, active: boolean) {
  return db.service.update({
    where: { id },
    data: { active },
  });
}
