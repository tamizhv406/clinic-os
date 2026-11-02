# Setting up a new database

Use this when you move from the development database to a fresh Supabase project (staging or production). Everything the app needs is created from the files in `supabase/`; nothing is copied from the old database.

## 1. Create the project
In the Supabase dashboard create a new project. Choose the Mumbai region for clinics in India. Note the **project ref** (the id in the URL), the **database password** you set, and under Project Settings → API the **URL**, the **anon key** and the **service role key**.

## 2. Link and build the schema
```
supabase login
supabase link --project-ref <project-ref>
supabase db push
```
`db push` applies every file in `supabase/migrations/` in order. They create all tables, security rules (row level security), roles, modules and permissions. Do not run `supabase/seed/demo_seed.sql` on production; it only creates demo clinics and staff for development.

## 3. Deploy the server functions
```
supabase functions deploy create-staff
supabase functions deploy whatsapp-dispatch
```
Secrets the functions use are listed in `docs/INTEGRATION_GUIDE.md` (section 8). With no secrets set, WhatsApp runs in safe simulator mode.

## 4. Point the app at it
Copy `frontend/.env.example` to `frontend/.env` and fill in the URL and anon key. Never put the service role key in this file.

## 5. Create the first super admin
Put the service role key in `scrips/.secret.env` (this folder is ignored by git):
```
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```
Then:
```
node tools/admin/create-super-admin.mjs you@yourcompany.com "<a strong password>" "Your Name"
```

## 6. Everything else happens in the app
Sign in as the super admin. Under **All Clinics**: create the clinic (it gets a main branch and all modules), then create its owner and admin with **Create a login for a clinic**. For a brand with several branches, create each clinic under the same brand and tick the sibling clinics when creating the shared admin. The admin then creates doctors, receptionists and pharmacists from **Staff**.

## 7. Check it works
With the dev server running and a test clinic set up, `node tools/qa/multi-clinic.mjs`, `node tools/qa/create-staff.mjs`, `node tools/qa/whatsapp-dispatch.mjs` and `node tools/qa/isolation.mjs` run automated checks against the database (they create `test-` clinics, so use a development project only).

## When you are done with the development database
Rotate or delete the service role key, the access token and the database password you used here, and delete the project.
