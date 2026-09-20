import { PrismaClient, LeadSource, LeadStatus, AppointmentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ REFUSING TO RUN DEMO SEED IN PRODUCTION!");
    console.error("prisma/seed.ts contains destructive deleteMany() operations and demo data.");
    console.error("To initialize a real client deployment safely, run: npm run init:client");
    process.exit(1);
  }

  console.log("🌱 Seeding Book Moar START development data...");

  // Clean existing data for single-client idempotent seed
  await prisma.appointment.deleteMany();
  await prisma.callWebhookEvent.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();
  await prisma.business.deleteMany();

  // 1. Create Business Profile (Apex Auto Detail)
  const business = await prisma.business.create({
    data: {
      name: "Apex Auto Detail",
      phone: "+19195550100",
      email: "contact@apexdetail.com",
      timezone: "America/New_York",
      websiteUrl: "https://apexdetail.example.com",
      address: "123 High Octane Way, Raleigh, NC 27601",
      notificationPhone: "+19195550199",
      notificationEmail: "owner@apexdetail.com",
      missedCallTextTemplate: "Hey! Sorry we missed your call at Apex Auto Detail. How can we help you with your vehicle?",
    },
  });
  console.log(`✅ Business profile created: ${business.name}`);

  // 2. Create Owner Account
  const passwordHash = await bcrypt.hash("Password123!", 10);
  const owner = await prisma.user.create({
    data: {
      email: "owner@apexdetail.com",
      passwordHash,
      name: "Derek (Apex Owner)",
      role: "OWNER",
    },
  });
  console.log(`✅ Owner account created: ${owner.email} (Password: Password123!)`);

  // 3. Create Services
  const exterior = await prisma.service.create({
    data: {
      name: "Exterior Detail",
      description: "Hand wash, clay bar paint decontamination, wheel cleaning, and premium hydrophobic sealant.",
      defaultPriceCents: 15000, // $150
      active: true,
    },
  });

  const interior = await prisma.service.create({
    data: {
      name: "Interior Detail",
      description: "Deep steam cleaning, shampooing carpets, leather conditioning, and total odor elimination.",
      defaultPriceCents: 17500, // $175
      active: true,
    },
  });

  const full = await prisma.service.create({
    data: {
      name: "Full Detail",
      description: "Comprehensive bumper-to-bumper interior sanitization and exterior gloss enhancement.",
      defaultPriceCents: 30000, // $300
      active: true,
    },
  });
  console.log("✅ Services created (Exterior Detail, Interior Detail, Full Detail)");

  // 4. Create Sample Leads
  await prisma.lead.create({
    data: {
      name: "Sarah Miller",
      phone: "(919) 555-1234",
      normalizedPhone: "+19195551234",
      email: "sarah.miller@example.com",
      message: "Interested in the Full Detail for my Honda CR-V next week. Can you do Tuesday?",
      serviceId: full.id,
      source: LeadSource.WEBSITE,
      status: LeadStatus.NEW,
    },
  });

  await prisma.lead.create({
    data: {
      name: "Marcus Vance",
      phone: "(919) 555-5678",
      normalizedPhone: "+19195555678",
      email: "mvance@example.com",
      message: "Walk-in inquiry at the shop looking to clean up spilled coffee.",
      serviceId: interior.id,
      source: LeadSource.MANUAL,
      status: LeadStatus.CONTACTED,
      contactedAt: new Date(Date.now() - 3600 * 1000 * 2), // 2 hours ago
    },
  });

  await prisma.lead.create({
    data: {
      name: "Missed Call (+19195559900)",
      phone: "+19195559900",
      normalizedPhone: "+19195559900",
      message: "Inbound call missed. Automated text-back sent.",
      serviceId: null,
      source: LeadSource.MISSED_CALL,
      status: LeadStatus.CLOSED,
      closedAt: new Date(Date.now() - 86400 * 1000), // 1 day ago
    },
  });
  console.log("✅ Sample leads created across NEW, CONTACTED, CLOSED");

  // 5. Create Sample Appointments for Today
  const today = new Date();
  const appointment1Time = new Date(today);
  appointment1Time.setHours(14, 0, 0, 0); // 2:00 PM today

  const appointment2Time = new Date(today);
  appointment2Time.setHours(10, 0, 0, 0); // 10:00 AM today

  await prisma.appointment.create({
    data: {
      customerName: "Sarah Miller",
      customerPhone: "(919) 555-1234",
      customerEmail: "sarah.miller@example.com",
      serviceId: full.id,
      serviceName: full.name,
      scheduledAt: appointment1Time,
      durationMinutes: 120,
      valueCents: 30000, // $300
      status: AppointmentStatus.SCHEDULED,
      notes: "Black Honda CR-V - customer requested extra tire shine",
    },
  });

  await prisma.appointment.create({
    data: {
      customerName: "Mike Jones",
      customerPhone: "(919) 555-7788",
      customerEmail: "mike.j@example.com",
      serviceId: interior.id,
      serviceName: interior.name,
      scheduledAt: appointment2Time,
      durationMinutes: 90,
      valueCents: 17500, // $175
      status: AppointmentStatus.COMPLETED,
      notes: "Completed at 11:30 AM - customer satisfied",
    },
  });
  console.log("✅ Sample appointments created for today (SCHEDULED & COMPLETED)");

  console.log("🚀 Development seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
