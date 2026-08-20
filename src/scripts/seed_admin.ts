import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcrypt";

dotenv.config();

const ADMIN_EMAIL = "enwonontuk20@gmail.com";
const ADMIN_PASSWORD = "Admin@123";
const ADMIN_FIRST_NAME = "Enwono";
const ADMIN_LAST_NAME = "Ntuk";
const ADMIN_PHONE = "+2348069940870";

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Run migration: add columns if they don't exist
  console.log("Applying admin auth migration...");
  const { error: migError } = await supabase.rpc("exec_sql", {
    sql: `
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;
    `,
  });

  if (migError) {
    // exec_sql RPC may not exist; columns might already be present — try direct insert anyway
    console.warn(
      "Migration via RPC skipped (columns may already exist):",
      migError.message,
    );
  } else {
    console.log("Migration applied successfully.");
  }

  // 2. Hash the password
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  // 3. Check if admin user already exists
  const { data: existing } = await supabase
    .from("users")
    .select("id, email, is_admin")
    .eq("email", ADMIN_EMAIL)
    .maybeSingle();

  if (existing) {
    // Update existing user to be super-admin
    const { error } = await supabase
      .from("users")
      .update({
        is_admin: true,
        is_super_admin: true,
        role: "admin",
        password_hash: passwordHash,
      })
      .eq("id", existing.id);

    if (error) {
      console.error("Failed to update existing user:", error.message);
      process.exit(1);
    }
    console.log(`Updated existing user ${ADMIN_EMAIL} as super-admin.`);
  } else {
    // Insert new super-admin user
    const { error } = await supabase.from("users").insert({
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      first_name: ADMIN_FIRST_NAME,
      last_name: ADMIN_LAST_NAME,
      role: "admin",
      is_admin: true,
      is_super_admin: true,
      password_hash: passwordHash,
    });

    if (error) {
      console.error("Failed to insert admin user:", error.message);
      console.error("Detail:", error.details);
      process.exit(1);
    }
    console.log(`Created super-admin user: ${ADMIN_EMAIL}`);
  }

  console.log("\nAdmin credentials:");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
