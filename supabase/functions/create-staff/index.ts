// create-staff -- onboards a staff member for a clinic admin.
//
// Creating a login needs the Admin API, and the Admin API needs the service role
// key, which must never reach the browser. So the client sends the form here with
// its own access token, this function re-derives who the caller is from that token,
// and only then does it act with elevated rights.
//
// Two things are deliberately *not* trusted from the request body: who the caller
// is, and which clinic the new staff member lands in. Both are read from the
// caller's own staff_profiles row.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Mirrors public.admin_manageable_roles(). An admin onboards delivery staff only --
// never another admin, owner, or super_admin.
const ADMIN_MANAGEABLE_ROLES = ["doctor", "receptionist", "pharmacist"];

const ROLE_CODE_PREFIX: Record<string, string> = {
  doctor: "DOC",
  receptionist: "REC",
  pharmacist: "PHAR",
};

type CreateStaffBody = {
  full_name?: string;
  email?: string;
  password?: string;
  phone?: string;
  role_key?: string;
  branch_id?: string | null;
  user_id?: string;
  department?: string;
  specialization?: string;
  qualification?: string;
  consultation_fee?: number | string;
  slot_duration_minutes?: number | string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function fail(message: string, status: number) {
  return json({ error: message }, status);
}

// A short, human-quotable stand-in for the clinic in a staff code (SUNRISE-DOC-004).
// staff_profiles.user_id is unique across the whole platform, not per clinic, so the
// prefix has to disambiguate clinics itself -- a bare "VNX-" prefix shared by every
// clinic collided the moment a second clinic onboarded its first receptionist.
function clinicCode(slug: string) {
  const alnum = slug.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return alnum.slice(0, 6) || "CLINIC";
}

// Staff codes are derived from the highest existing code for that clinic+role rather
// than a count, so deleting a profile never hands the next hire a code that was
// already printed on something. The lookup is global (not clinic-scoped) because the
// prefix already encodes the clinic and the uniqueness constraint itself is global.
async function nextStaffCode(admin: ReturnType<typeof createClient>, clinicSlug: string, roleKey: string) {
  const prefix = `${clinicCode(clinicSlug)}-${ROLE_CODE_PREFIX[roleKey] ?? "STF"}-`;
  const { data, error } = await admin
    .from("staff_profiles")
    .select("user_id")
    .like("user_id", `${prefix}%`);
  if (error) throw error;

  let highest = 0;
  for (const row of data ?? []) {
    const suffix = Number.parseInt(String(row.user_id).slice(prefix.length), 10);
    if (Number.isFinite(suffix) && suffix > highest) highest = suffix;
  }
  return `${prefix}${String(highest + 1).padStart(3, "0")}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return fail("Use POST.", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) return fail("Function is missing its Supabase environment.", 500);

  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return fail("Missing bearer token.", 401);

  // Identity comes from the token, never from the body.
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData?.user) return fail("Your session is not valid. Sign in again.", 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: callerProfile, error: profileError } = await admin
    .from("staff_profiles")
    .select("id, clinic_id, branch_id, role_key, status")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) return fail(profileError.message, 500);
  if (!callerProfile) return fail("No staff profile is linked to your account.", 403);
  if (callerProfile.status !== "active") return fail("Your staff profile is not active.", 403);
  if (callerProfile.role_key !== "admin" && callerProfile.role_key !== "super_admin") {
    return fail("Only a clinic admin can onboard staff.", 403);
  }

  let body: CreateStaffBody;
  try {
    body = await request.json();
  } catch {
    return fail("Request body must be JSON.", 400);
  }

  const fullName = body.full_name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const roleKey = body.role_key?.trim() ?? "";

  if (!fullName) return fail("Full name is required.", 400);
  if (!email) return fail("Email is required.", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("That email address is not valid.", 400);
  if (password.length < 8) return fail("Password must be at least 8 characters.", 400);
  if (!ADMIN_MANAGEABLE_ROLES.includes(roleKey)) {
    return fail(`Role must be one of: ${ADMIN_MANAGEABLE_ROLES.join(", ")}.`, 400);
  }

  // A super_admin has no clinic of their own, so there is nothing to place staff
  // into. Onboarding for another clinic stays a platform-console action.
  const clinicId = callerProfile.clinic_id;
  if (!clinicId) return fail("Your account is not linked to a clinic.", 400);

  const { data: clinicRow, error: clinicError } = await admin.from("clinics").select("slug").eq("id", clinicId).single();
  if (clinicError || !clinicRow) return fail("Could not resolve your clinic.", 500);

  // Reject a duplicate email before creating anything, so the caller gets a clear
  // message instead of a constraint violation halfway through.
  const { data: existingProfile } = await admin
    .from("staff_profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingProfile) return fail("A staff profile already uses that email address.", 409);

  const staffCode = body.user_id?.trim() || (await nextStaffCode(admin, clinicRow.slug, roleKey));

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role_key: roleKey, clinic_id: clinicId },
  });
  if (createError || !created?.user) {
    return fail(createError?.message ?? "Could not create the login.", 400);
  }

  const newUserId = created.user.id;

  // From here on any failure has to undo the auth user, otherwise the email is
  // burned: it exists in auth with no profile, so it can neither sign in usefully
  // nor be created again.
  const rollback = async (message: string, status: number) => {
    await admin.auth.admin.deleteUser(newUserId);
    return fail(message, status);
  };

  const { data: profile, error: insertError } = await admin
    .from("staff_profiles")
    .insert({
      id: newUserId,
      clinic_id: clinicId,
      branch_id: body.branch_id || callerProfile.branch_id || null,
      role_key: roleKey,
      full_name: fullName,
      user_id: staffCode,
      email,
      phone: body.phone?.trim() || null,
      status: "active",
      metadata: {},
    })
    .select("*")
    .single();
  if (insertError) return rollback(insertError.message, 400);

  if (roleKey === "doctor") {
    const fee = Number(body.consultation_fee);
    const slot = Number(body.slot_duration_minutes);
    const { error: doctorError } = await admin.from("doctor_profiles").insert({
      clinic_id: clinicId,
      branch_id: profile.branch_id,
      staff_id: newUserId,
      department: body.department?.trim() || null,
      specialization: body.specialization?.trim() || null,
      qualification: body.qualification?.trim() || null,
      consultation_fee: Number.isFinite(fee) && fee > 0 ? fee : null,
      slot_duration_minutes: Number.isFinite(slot) && slot > 0 ? slot : 15,
      status: "active",
    });
    if (doctorError) {
      await admin.from("staff_profiles").delete().eq("id", newUserId);
      return rollback(doctorError.message, 400);
    }
  }

  await admin.from("audit_logs").insert({
    clinic_id: clinicId,
    branch_id: profile.branch_id,
    actor_id: callerProfile.id,
    user_id: callerProfile.id,
    actor_role: callerProfile.role_key,
    event_type: "staff.created",
    entity_type: "staff_profiles",
    entity_id: newUserId,
    action: "create",
    status: "success",
    severity: "info",
    message: `${callerProfile.role_key} onboarded ${roleKey} ${fullName} (${staffCode}).`,
    metadata: { role_key: roleKey, staff_code: staffCode, email },
  });

  return json({ staff: profile, staff_code: staffCode }, 201);
});
