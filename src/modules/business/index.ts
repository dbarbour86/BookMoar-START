import { db } from "@/lib/db";
import { z } from "zod";

export const updateBusinessSchema = z.object({
  name: z.string().min(1, "Business name is required").max(120),
  phone: z.string().min(1, "Business phone is required"),
  email: z.string().email("Invalid email address"),
  timezone: z.string().min(1, "Timezone is required").default("America/New_York"),
  websiteUrl: z.string().url("Invalid website URL").optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  notificationPhone: z.string().min(1, "Notification phone is required"),
  notificationEmail: z.string().email().optional().nullable().or(z.literal("")),
  missedCallTextTemplate: z.string().min(5, "Missed call text template is required").max(320),
});

export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;

export async function getBusinessProfile() {
  const business = await db.business.findFirst();
  if (!business) {
    // If not yet created, create default initial record
    return db.business.create({
      data: {
        name: "My Local Service Business",
        phone: "+15555550100",
        email: "contact@example.com",
        timezone: "America/New_York",
        notificationPhone: "+15555550199",
        missedCallTextTemplate: "Hey! Sorry we missed your call. How can we help?",
      },
    });
  }
  return business;
}

export async function updateBusinessProfile(input: UpdateBusinessInput) {
  const current = await getBusinessProfile();
  return db.business.update({
    where: { id: current.id },
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      timezone: input.timezone,
      websiteUrl: input.websiteUrl || null,
      address: input.address || null,
      notificationPhone: input.notificationPhone,
      notificationEmail: input.notificationEmail || null,
      missedCallTextTemplate: input.missedCallTextTemplate,
    },
  });
}
