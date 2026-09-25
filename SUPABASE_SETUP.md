# Supabase setup

## 1. Create the table

Open the Supabase project SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql). Run the latest version again when the app adds a new table or policy; the script is safe to rerun.

The app stores one JSON document per user in `expense_tracker_data`. Categories are stored separately in `expense_categories`, and starter categories are seeded by a database trigger when a new account is created. Row-level security allows a user to read and write only their own rows.

## 2. Enable email authentication

In Supabase, open **Authentication > Providers**, enable **Email**, and save.

The app uses email/password accounts so the same user can access their data from different browsers and devices. For a simpler first login, you can disable email confirmation in the provider settings; otherwise users must confirm their email before signing in.

## 3. Add local environment variables

Copy `.env.example` to `.env.local` and fill in the project values from **Project Settings > API**:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Restart Vite after changing environment variables:

```powershell
npm run dev
```

Use only the Supabase **anon** key in this frontend. Never put the service-role key in `.env.local` or commit it.

## 4. Deploying

Add the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values to the hosting provider's environment settings, then rebuild and deploy.

If the variables are missing or Supabase is unavailable, the app falls back to its existing browser `localStorage` behavior.
