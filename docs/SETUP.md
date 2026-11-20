# Local setup and Supabase configuration

## Prerequisites

- Node.js 20 or newer
- npm
- A disposable or development Supabase project
- PostgreSQL tooling when running the database smoke tests locally

Never use production credentials or production data for local validation.

## Environment variables

Copy `.env.example` to `.env.local` and set these variables locally:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Both variables are public by design. The application does not require a
service-role key and must never expose one to the browser. `.env.local` is
ignored by Git and should not be committed.

## Database setup

Apply all files in `supabase/migrations` in filename order to a clean database.
The initial migration creates the Mission 1 schema, triggers, grants, and RLS
policies. The Mission 2 profile policy lets a signed-in user create only their
own missing profile; it cannot create or modify another user's profile.

Signup normally creates a profile through the existing Auth trigger. The
onboarding fallback handles development or legacy Auth users whose profile is
missing. Creating a farm is performed with the user's authenticated Supabase
client, so RLS remains active. The existing database trigger assigns that user
the `owner` membership. A database function serializes concurrent first-farm
requests per profile, preventing duplicate farms without a service-role client.

The current workspace is the oldest farm for which the user still has a
`farm_members` row. A farm that remains visible only because the user originally
created it is not treated as an active workspace.

## Authentication settings

Enable email/password authentication in Supabase. Add the deployed site URL and
the locale-specific callback paths to the Auth redirect allow list. For local
development, use:

```text
http://localhost:3000/fr/auth/confirm
http://localhost:3000/ar/auth/confirm
```

If email confirmation is enabled, signup returns the user to sign-in with a
check-email message. If it is disabled, signup creates a session and proceeds
directly to onboarding.

Session cookies are read and refreshed through `@supabase/ssr`. The Next.js
proxy provides an early redirect for obviously unauthenticated requests, while
protected layouts and server actions independently verify signed claims near
the data access. The browser never supplies a trusted user identifier.

## Application routes

- `/{locale}`: public landing page
- `/{locale}/signup`: account creation
- `/{locale}/login`: sign in
- `/{locale}/onboarding`: protected first-farm setup
- `/{locale}/app`: protected application shell and dashboard placeholder

Supported locale values are `fr` and `ar`. The Arabic layout sets `dir="rtl"`.
Displayed monetary amounts use Tunisian dinar formatting with three fractional
digits.

## Validation

```text
npm test
npm run lint
npm run typecheck
npm run build
```

For database validation, apply all migrations to a clean disposable database,
then run every SQL file in `supabase/tests` using `psql` with `-X`,
`-v ON_ERROR_STOP=1`, and `-f <test-file>`. The RLS suites roll back their fixtures.
The area concurrency suite uses two independent `dblink` sessions and commits
fixtures to exercise real lock waits for both INSERT and UPDATE orderings
against a concurrent plot resize.
It requires an administrative database connection, the `dblink` extension in
the `extensions` schema, and server-side loopback connectivity. An existing
extension in another schema is rejected rather than relocated. Each wait polls
for the expected backend PID and blocker with a 10-second deadline.

Successful concurrency runs disconnect both sessions and remove fixtures,
helper functions, and the temporary PID table. The extension/schema are removed
only when that run created them. If `psql` exits on failure, its connections
close and open remote transactions roll back, but already-committed fixtures,
helpers, or a newly installed extension/schema may remain. A rerun cleans stale
fixtures/helpers; discard the disposable database after a failure to guarantee
full cleanup. Do not run parallel copies against the same database because the
test uses fixed fixture IDs.
