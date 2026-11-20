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
- `/{locale}/app`: protected application shell and farm statistics
- `/{locale}/app/plots`: plot management and optional economic activity assignment
- `/{locale}/app/crop-cycles`: crop-cycle management and optional economic activity assignment
- `/{locale}/app/activities`: economic activity categories, filters, details, and owner management
- `/{locale}/app/tasks`: task lists, reminders, filters, details, and permitted task management
- `/{locale}/app/livestock`: animal groups, event history, linked tasks and recorded ledger lines

Supported locale values are `fr` and `ar`. The Arabic layout sets `dir="rtl"`.
Displayed monetary amounts use Tunisian dinar formatting with three fractional
digits.

Activities reuse the existing schema; Mission 3C has no migration or additional
environment variables. Workers and accountants can view categories; only owners
manage them. Owners and workers retain plot/cycle assignment permissions.
Inactive categories remain visible in historical references and selectors.
Creation-date filters refer to record creation in UTC, not farming-operation
dates. Referenced categories cannot be deleted; deactivate them to retain history.
Unchanged edit selectors preserve current assignments. New crop cycles inherit
the selected plot's activity only when no explicit assignment/unassignment is
submitted. Plot edits never bulk-update existing crop cycles.

Mission 3D reuses `public.tasks` without a migration or new environment variables.
Owners can manage and delete tasks; workers can create and edit; accountants
have read-only access. Assignees must be current members of the selected farm.
Task links support an optional economic activity and at most one crop cycle or
animal group. A linked cycle/group supplies its matching activity. Unclassified
cycles must receive an activity in Crop Cycles before a task can reference them.
Existing inactive categories remain available for historical work.

Task reminders use calendar dates in `Africa/Tunis`. Pending means `a_faire`
or `en_cours`; overdue means a pending task due before today. Upcoming includes
today and the next six days. Completed and cancelled tasks do not become
overdue. The dashboard shows exact farm-scoped pending, due-today, overdue,
completed, and upcoming counts. Read screens refresh while visible every minute
and on returning to the page. Reminders are displayed inside the application;
there is no external notification or background delivery service.

Mission 4 adds livestock management without migrations or additional environment
variables. Existing RLS permits owners to manage animal groups, owners/workers
to record events, and accountants to read. Create an economic activity before
creating a group; inactive and non-livestock categories remain valid references
under the existing schema. Events are appended to history with no edit/delete
controls. Group deletion is blocked by any linked events, tasks, transactions or
inventory movements; owners can deactivate a group instead.

Counts come from `v_animal_group_counts`, including inactive groups. Births and
purchases add animals; sales and deaths subtract them. Transfers, care and other
events have no count effect. Negative balances are displayed with an alert.
Event dates cannot be future in Tunisia in the application; the existing view
includes all database events, including any future-dated legacy imports.
The financial section reads generated ledger-line amounts explicitly linked to
the group, including settled transactions. It does not record event prices or
create ledger transactions automatically. No amounts are inferred.

Groups link to their full task list and can prefill a new task with a verified
same-farm group/activity. Task details link back to the animal group. Mobile
navigation retains six destinations; sign-out is in the mobile header.

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
This includes `activities_crud_rls.sql`, which verifies the role matrix,
cross-farm INSERT/UPDATE references, nullable assignments, inactive history,
and each of the six dependency deletion restrictions. Run it alongside all
existing suites, including the four area-concurrency orderings. The pull-request
workflow also runs `npm test`; database suites require a separate disposable
PostgreSQL/Supabase environment and are not currently run by that workflow.
Run `tasks_crud_rls.sql` as well. It tests task CRUD, all status/priority values,
assignee membership, cross-farm and composite-reference rejection, the role
matrix, derived reminder queries, and unassignment when a member leaves.
`livestock_crud_rls.sql` additionally verifies group/event permissions, counts,
history preservation, the four independent group deletion dependencies,
cross-farm references, task links and recorded financial amounts.
There are nine SQL suites in total; run them all against the same disposable
database after applying the four migrations in filename order.
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
