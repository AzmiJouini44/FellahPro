# FellahPro

FellahPro is a mobile-first agricultural management application built with
Next.js and Supabase. The current foundation includes email/password
authentication, French and Arabic routes, first-farm onboarding, and a
server-protected application shell.

## Local development

1. Install dependencies with `npm install`.
2. Create `.env.local` from `.env.example` and provide your own local or test
   Supabase project settings.
3. Apply the SQL files in `supabase/migrations` in filename order.
4. Add the local confirmation URLs to the Supabase Auth redirect allow list:
   `http://localhost:3000/fr/auth/confirm` and
   `http://localhost:3000/ar/auth/confirm`.
5. Start the application with `npm run dev`.

The required public environment variables are:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The publishable key is intentionally used by browser and server-rendered user
requests. Do not add a Supabase service-role key to this application; data
access is authorized by the signed-in user's session and the database RLS
policies.

See [docs/SETUP.md](docs/SETUP.md) for Supabase configuration, authentication
behavior, and validation commands.

## Validation

Run the local application checks with:

```text
npm test
npm run lint
npm run typecheck
npm run build
```

Database smoke tests are SQL scripts under `supabase/tests`. Run them only
against a clean disposable database after applying every migration.
