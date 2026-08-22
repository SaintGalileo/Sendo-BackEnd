import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcrypt";

dotenv.config();

/** Shared team testing account — admin, not super-admin. */
const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "tester@sendo.express";
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "TestAdmin@123";
const TEST_ADMIN_FIRST_NAME = process.env.TEST_ADMIN_FIRST_NAME || "Sendo";
const TEST_ADMIN_LAST_NAME = process.env.TEST_ADMIN_LAST_NAME || "Tester";
const TEST_ADMIN_PHONE = process.env.TEST_ADMIN_PHONE || "+2348000000001";

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const passwordHash = await bcrypt.hash(TEST_ADMIN_PASSWORD, 12);

  const { data: existing, error: findError } = await supabase
    .from("users")
    .select("id, email, is_admin, is_super_admin")
    .eq("email", TEST_ADMIN_EMAIL)
    .maybeSingle();

  if (findError) {
    console.error("Failed to look up user:", findError.message);
    process.exit(1);
  }

  if (existing) {
    const { error } = await supabase
      .from("users")
      .update({
        first_name: TEST_ADMIN_FIRST_NAME,
        last_name: TEST_ADMIN_LAST_NAME,
        phone: TEST_ADMIN_PHONE,
        role: "admin",
        is_admin: true,
        is_super_admin: false,
        password_hash: passwordHash,
      })
      .eq("id", existing.id);

    if (error) {
      console.error("Failed to update test admin:", error.message);
      process.exit(1);
    }
    console.log(`Updated existing user ${TEST_ADMIN_EMAIL} as non-superadmin admin.`);
  } else {
    const { error } = await supabase.from("users").insert({
      email: TEST_ADMIN_EMAIL,
      phone: TEST_ADMIN_PHONE,
      first_name: TEST_ADMIN_FIRST_NAME,
      last_name: TEST_ADMIN_LAST_NAME,
      role: "admin",
      is_admin: true,
      is_super_admin: false,
      password_hash: passwordHash,
    });

    if (error) {
      console.error("Failed to create test admin:", error.message);
      console.error("Detail:", error.details);
      process.exit(1);
    }
    console.log(`Created test admin user: ${TEST_ADMIN_EMAIL}`);
  }

  console.log("\nShared test admin credentials (NOT super-admin):");
  console.log(`  Email:    ${TEST_ADMIN_EMAIL}`);
  console.log(`  Password: ${TEST_ADMIN_PASSWORD}`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
