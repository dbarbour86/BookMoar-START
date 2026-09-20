import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";

export interface InitClientInput {
  businessName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerName?: string;
  businessPhone: string;
  businessEmail?: string;
  timezone?: string;
  websiteUrl?: string;
  address?: string;
  notificationPhone?: string;
  notificationEmail?: string;
  missedCallTextTemplate?: string;
}

export interface InitClientResult {
  success: boolean;
  businessId?: string;
  userId?: string;
  error?: string;
}

/**
 * Provisions a fresh Book Moar START client deployment safely and non-destructively.
 *
 * Safety Guarantees:
 * - NEVER deletes existing data (zero deleteMany / drop operations)
 * - Refuses to initialize if an OWNER account already exists
 * - Refuses duplicate emails
 * - Validates all required inputs
 * - Hashes password using bcrypt (salt rounds: 10)
 * - Never logs or exposes plaintext password
 */
export async function initClient(input: InitClientInput): Promise<InitClientResult> {
  const businessName = input.businessName?.trim();
  const ownerEmail = input.ownerEmail?.toLowerCase().trim();
  const ownerPassword = input.ownerPassword;
  const ownerName = input.ownerName?.trim() || businessName || "Business Owner";
  const businessPhone = input.businessPhone?.trim();
  const businessEmail = (input.businessEmail || input.ownerEmail)?.toLowerCase().trim();
  const timezone = input.timezone?.trim() || "America/New_York";
  const notificationPhone = input.notificationPhone?.trim() || businessPhone;
  const notificationEmail = (input.notificationEmail || input.businessEmail || input.ownerEmail)?.toLowerCase().trim();
  const websiteUrl = input.websiteUrl?.trim() || null;
  const address = input.address?.trim() || null;
  const missedCallTextTemplate =
    input.missedCallTextTemplate?.trim() ||
    `Hey! Sorry we missed your call at ${businessName}. How can we help?`;

  // 1. Validation
  if (!businessName) {
    return { success: false, error: "Validation failed: businessName is required" };
  }
  if (!ownerEmail || !ownerEmail.includes("@")) {
    return { success: false, error: "Validation failed: valid ownerEmail is required" };
  }
  if (!ownerPassword || ownerPassword.length < 8) {
    return { success: false, error: "Validation failed: ownerPassword must be at least 8 characters" };
  }
  if (!businessPhone || businessPhone.length < 7) {
    return { success: false, error: "Validation failed: valid businessPhone is required" };
  }

  // 2. Prevent accidental multi-tenant corruption / overwrite
  const existingOwner = await db.user.findFirst({
    where: { role: "OWNER" },
  });

  if (existingOwner) {
    return {
      success: false,
      error: `Deployment already initialized: An OWNER account already exists (${existingOwner.email}). Book Moar START supports exactly one business per deployment.`,
    };
  }

  const existingEmailUser = await db.user.findUnique({
    where: { email: ownerEmail },
  });

  if (existingEmailUser) {
    return {
      success: false,
      error: `Account conflict: A user with email '${ownerEmail}' already exists in this deployment.`,
    };
  }

  // 3. Create or update Business profile
  let business = await db.business.findFirst();

  if (business) {
    // If a default placeholder was auto-generated, safely update it with client details
    business = await db.business.update({
      where: { id: business.id },
      data: {
        name: businessName,
        phone: businessPhone,
        email: businessEmail,
        timezone,
        websiteUrl,
        address,
        notificationPhone,
        notificationEmail,
        missedCallTextTemplate,
      },
    });
  } else {
    business = await db.business.create({
      data: {
        name: businessName,
        phone: businessPhone,
        email: businessEmail,
        timezone,
        websiteUrl,
        address,
        notificationPhone,
        notificationEmail,
        missedCallTextTemplate,
      },
    });
  }

  // 4. Create OWNER User
  const passwordHash = await hashPassword(ownerPassword);
  const user = await db.user.create({
    data: {
      email: ownerEmail,
      passwordHash,
      name: ownerName,
      role: "OWNER",
    },
  });

  return {
    success: true,
    businessId: business.id,
    userId: user.id,
  };
}

// CLI Execution Handler
function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("--")) {
        result[key] = nextArg;
        i++;
      } else {
        result[key] = "true";
      }
    }
  }
  return result;
}

async function runCli() {
  const cliArgs = parseArgs(process.argv.slice(2));

  // Extract from CLI flags or environment variables
  const businessName = cliArgs.business || cliArgs.businessName || cliArgs.name || process.env.CLIENT_BUSINESS_NAME || "";
  const ownerEmail = cliArgs.email || cliArgs.ownerEmail || process.env.CLIENT_OWNER_EMAIL || "";
  const ownerPassword = cliArgs.password || cliArgs.ownerPassword || process.env.CLIENT_OWNER_PASSWORD || "";
  const ownerName = cliArgs.ownerName || process.env.CLIENT_OWNER_NAME || undefined;
  const businessPhone = cliArgs.phone || cliArgs.businessPhone || process.env.CLIENT_BUSINESS_PHONE || "";
  const businessEmail = cliArgs.businessEmail || process.env.CLIENT_BUSINESS_EMAIL || undefined;
  const timezone = cliArgs.timezone || process.env.CLIENT_TIMEZONE || "America/New_York";
  const websiteUrl = cliArgs.website || cliArgs.websiteUrl || process.env.CLIENT_WEBSITE_URL || undefined;
  const address = cliArgs.address || process.env.CLIENT_ADDRESS || undefined;
  const notificationPhone = cliArgs.notificationPhone || process.env.CLIENT_NOTIFICATION_PHONE || undefined;
  const notificationEmail = cliArgs.notificationEmail || process.env.CLIENT_NOTIFICATION_EMAIL || undefined;
  const missedCallTextTemplate = cliArgs.missedCallText || cliArgs.template || process.env.CLIENT_MISSED_CALL_TEMPLATE || undefined;

  if (!businessName || !ownerEmail || !ownerPassword || !businessPhone) {
    console.error("❌ Missing required arguments for client provisioning.\n");
    console.log("Usage: npm run init:client -- [options]\n");
    console.log("Required options:");
    console.log("  --business, --name        Business name (e.g. \"Apex Auto Detail\")");
    console.log("  --email                   Owner login email (e.g. \"owner@apexdetail.com\")");
    console.log("  --password                Owner initial password (min 8 chars)");
    console.log("  --phone                   Business phone number (e.g. \"+19195550100\")\n");
    console.log("Optional options:");
    console.log("  --ownerName               Owner display name");
    console.log("  --businessEmail           Public business email (defaults to owner email)");
    console.log("  --timezone                IANA Timezone (defaults to \"America/New_York\")");
    console.log("  --website                 Client website URL (e.g. \"https://clientdomain.com\")");
    console.log("  --address                 Physical business address");
    console.log("  --notificationPhone       Phone for new lead SMS (defaults to business phone)");
    console.log("  --notificationEmail       Notification email");
    console.log("  --template                Custom missed-call SMS text\n");
    process.exit(1);
  }

  console.log(`\n🚀 Initializing client deployment for: "${businessName}"...`);

  const result = await initClient({
    businessName,
    ownerEmail,
    ownerPassword,
    ownerName,
    businessPhone,
    businessEmail,
    timezone,
    websiteUrl,
    address,
    notificationPhone,
    notificationEmail,
    missedCallTextTemplate,
  });

  if (!result.success) {
    console.error(`\n❌ Client provisioning aborted: ${result.error}\n`);
    process.exit(1);
  }

  console.log("\n✅ Client deployment provisioned successfully!");
  console.log(`   Business ID:    ${result.businessId}`);
  console.log(`   Owner User ID:  ${result.userId}`);
  console.log(`   Owner Email:    ${ownerEmail}`);
  console.log(`   Business Phone: ${businessPhone}`);
  console.log(`   Timezone:       ${timezone}`);
  console.log("   (Plaintext password was hashed and is never stored or logged)\n");
}

if (require.main === module || (typeof process !== "undefined" && process.argv[1]?.includes("init-client"))) {
  runCli()
    .catch((err) => {
      console.error("\n❌ Unexpected provisioning error:", err);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
