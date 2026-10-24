import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TEST_USERS = [
  {
    email: "super_admin@vernex.test",
    userId: "VNX-SUPER-001",
    roleKey: "super_admin",
    fullName: "Vernex Super Admin",
    clinicScoped: false,
  },
  {
    email: "owner@vernex.test",
    userId: "VNX-OWNER-001",
    roleKey: "owner",
    fullName: "Vernex Demo Owner",
    clinicScoped: true,
  },
  {
    email: "reception@vernex.test",
    userId: "VNX-REC-001",
    roleKey: "receptionist",
    fullName: "Vernex Demo Receptionist",
    clinicScoped: true,
  },
  {
    email: "doctor@vernex.test",
    userId: "VNX-DOC-001",
    roleKey: "doctor",
    fullName: "Vernex Demo Doctor",
    clinicScoped: true,
  },
  {
    email: "pharmacist@vernex.test",
    userId: "VNX-PHAR-001",
    roleKey: "pharmacist",
    fullName: "Vernex Demo Pharmacist",
    clinicScoped: true,
  },
];

loadEnvFile(".env");

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.VERNEX_TEST_PASSWORD;

if (!supabaseUrl) {
  fail("Missing SUPABASE_URL or VITE_SUPABASE_URL.");
}

if (!serviceRoleKey) {
  fail("Missing SUPABASE_SERVICE_ROLE_KEY. Run this only in a secure admin terminal.");
}

if (!password) {
  fail("Missing VERNEX_TEST_PASSWORD. Pass the temporary test password via environment.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const clinic = await upsertOne(
  "clinics",
  {
    name: "Vernex Demo Clinic",
    slug: "vernex-demo-clinic",
    clinic_mode: "multi_speciality",
    specialty: "General Medicine",
    phone: "+91 00000 00000",
    email: "demo-clinic@vernex.test",
    address: "Demo Main Road",
    status: "active",
    settings: { demo: true, phase: "4.5" },
  },
  "slug"
);

const branch = await ensureMainBranch(clinic.id);
const modules = await selectAll("modules", "key");
await upsertRows(
  "clinic_modules",
  modules.map(({ key }) => ({
    clinic_id: clinic.id,
    module_key: key,
    enabled: true,
  })),
  "clinic_id,module_key"
);

const createdUsers = [];

for (const testUser of TEST_USERS) {
  const authUser = await ensureAuthUser(testUser);
  createdUsers.push({
    ...testUser,
    authId: authUser.id,
  });

  await upsertOne(
    "staff_profiles",
    {
      id: authUser.id,
      clinic_id: testUser.clinicScoped ? clinic.id : null,
      branch_id: testUser.clinicScoped ? branch.id : null,
      role_key: testUser.roleKey,
      full_name: testUser.fullName,
      user_id: testUser.userId,
      email: testUser.email,
      status: "active",
      metadata: { demo: true, phase: "4.5" },
    },
    "id"
  );

  await assignRoleDefaults(authUser.id, testUser.roleKey);
}

const doctor = createdUsers.find((user) => user.roleKey === "doctor");
await upsertOne(
  "doctor_profiles",
  {
    clinic_id: clinic.id,
    branch_id: branch.id,
    staff_id: doctor.authId,
    department: "General Medicine",
    specialization: "General Medicine",
    qualification: "MBBS",
    consultation_fee: 500,
    slot_duration_minutes: 15,
    max_appointments_per_slot: 1,
    status: "active",
  },
  "staff_id"
);

console.log("Phase 4.5 bootstrap completed.");
console.table(
  createdUsers.map(({ email, userId, roleKey, authId, clinicScoped }) => ({
    email,
    user_id: userId,
    role: roleKey,
    auth_id: authId,
    clinic_id: clinicScoped ? clinic.id : null,
    branch_id: clinicScoped ? branch.id : null,
  }))
);
console.log(`Clinic: ${clinic.name} (${clinic.id})`);
console.log(`Branch: ${branch.name} (${branch.id})`);

async function ensureAuthUser(testUser) {
  const existing = await findAuthUserByEmail(testUser.email);

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: {
        full_name: testUser.fullName,
        user_id: testUser.userId,
        role_key: testUser.roleKey,
      },
      app_metadata: {
        provider: "email",
        providers: ["email"],
      },
    });

    if (error) throw error;
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: testUser.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: testUser.fullName,
      user_id: testUser.userId,
      role_key: testUser.roleKey,
    },
    app_metadata: {
      provider: "email",
      providers: ["email"],
    },
  });

  if (error) throw error;
  return data.user;
}

async function findAuthUserByEmail(email) {
  let page = 1;

  while (page < 20) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) throw error;

    const user = data.users.find((candidate) => candidate.email === email);
    if (user) return user;
    if (data.users.length < 100) return null;
    page += 1;
  }

  throw new Error("Could not scan all Auth users within the pagination limit.");
}

async function ensureMainBranch(clinicId) {
  const { data: existing, error: selectError } = await supabase
    .from("branches")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("name", "Main Branch")
    .maybeSingle();

  if (selectError) throw selectError;

  const payload = {
    clinic_id: clinicId,
    name: "Main Branch",
    address: "Demo Main Road",
    phone: "+91 00000 00000",
    is_main: true,
    status: "active",
  };

  if (existing) {
    const { data, error } = await supabase
      .from("branches")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from("branches").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

async function assignRoleDefaults(staffId, roleKey) {
  const roleModules = await selectBy("role_modules", "module_key, enabled", "role_key", roleKey);
  const rolePermissions = await selectBy(
    "role_permissions",
    "permission_key, allowed",
    "role_key",
    roleKey
  );

  await deleteBy("staff_modules", "staff_id", staffId);
  await deleteBy("staff_permissions", "staff_id", staffId);

  await upsertRows(
    "staff_modules",
    roleModules.map((row) => ({
      staff_id: staffId,
      module_key: row.module_key,
      enabled: row.enabled,
    })),
    "staff_id,module_key"
  );

  await upsertRows(
    "staff_permissions",
    rolePermissions.map((row) => ({
      staff_id: staffId,
      permission_key: row.permission_key,
      allowed: row.allowed,
    })),
    "staff_id,permission_key"
  );
}

async function upsertOne(table, payload, onConflict) {
  const { data, error } = await supabase
    .from(table)
    .upsert(payload, { onConflict })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function upsertRows(table, rows, onConflict) {
  if (rows.length === 0) return [];

  const { data, error } = await supabase.from(table).upsert(rows, { onConflict }).select("*");
  if (error) throw error;
  return data;
}

async function selectAll(table, columns) {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw error;
  return data;
}

async function selectBy(table, columns, column, value) {
  const { data, error } = await supabase.from(table).select(columns).eq(column, value);
  if (error) throw error;
  return data;
}

async function deleteBy(table, column, value) {
  const { error } = await supabase.from(table).delete().eq(column, value);
  if (error) throw error;
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
