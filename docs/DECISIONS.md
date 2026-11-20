# Architecture decisions

## Financial precision

Money is stored as `numeric(12,3)` because the Tunisian dinar has three decimal
places. Quantities use `numeric(14,3)` so that physical units can also retain
three-decimal precision.

All financial calculations live in SQL views or functions, never in an LLM.
Application code and future AI features consume the database's calculated
results rather than recomputing accounting values.

## One transaction ledger

Expenses and revenue share one central ledger:

- `transactions` contains the document header and its `depense` or `revenu` kind.
- `transaction_lines` contains products, quantities, unit prices, and line totals.
- `payments` records settlement against a transaction.

There are no separate expenses, sales, or purchases tables. In the first
migration, each transaction line stores a non-negative amount and SQL views
apply the transaction kind as the reporting sign.

Every transaction belongs to an activity and may additionally reference a crop
cycle or animal group. A database trigger validates that these references all
belong to the same farm and that the cycle or group belongs to the selected
activity. This makes profitability by activity reliable.

## Inventory ledger

Stock is derived from append-only-style `inventory_movements` rows rather than a
mutable quantity on `products`. Movement quantities are positive, and the
movement kind determines whether the `v_stock_levels` view adds or subtracts
them. Adjustments have an explicit direction.

## Access control

Farm access is based on `farm_members`, not a bare `owner_id`. The initial roles
are `owner`, `worker`, and `accountant`, leaving room for delegated access without
changing every business table later.

The creator becomes an owner through a farm-insert trigger. Direct membership
management is owner-only. RLS helper functions are `security definer` functions
with a fixed `search_path` so policies can check membership without recursively
querying `farm_members` under its own policy.

Membership identity is immutable: `farm_members.farm_id` and `user_id` cannot be
updated. Authenticated clients receive column-level update permission only for
`role`, and the owner-only UPDATE policy checks the existing row and resulting
row. A database trigger also rejects identity changes made through privileged
or direct SQL, so moving a membership cannot bypass authorization or owner
protection.

Owners have full access. Accountants can manage financial records while other
farm data is read-only. Workers can insert and update operational records and
can insert, but not update or delete, transactions, lines, and payments.
Transactions, transaction lines, payments, and inventory movements are
owner-delete-only. Members can leave a farm unless they are its last owner, and
a farm can never be left without an owner through membership changes. Owner
removals and demotions lock the parent farm row before checking for another
owner, serializing concurrent attempts. Deleting a farm is explicitly allowed:
once the parent farm row has been deleted, its membership cascade no longer
needs to preserve an owner.

An owner may demote themselves when another owner remains. The role change takes
effect immediately, so the demoted member loses owner-only permissions and must
ask a remaining owner to promote them again. Self-demotion is rejected when it
would remove the farm's last owner.

Deleting an Auth account cascades through its profile and memberships, but an
account deletion is rejected if that profile is the sole owner of any existing
farm. The owner must first add or promote another owner, or delete the farm.
When another owner remains, account deletion succeeds and audit `created_by`
fields and task assignments are cleared rather than reassigned. A transaction
can only be inserted with the current user as its creator.

Profiles are readable by the profile owner and by people who share a farm with
that profile. A signup trigger creates the matching profile automatically.

## Demo data

Demo farms are marked with `farms.is_demo`. Reporting views include them and
expose `is_demo`, so every consumer can explicitly include or exclude demo data.
Operational tables remain visible to members of a demo farm.

## Animal counts

`animal_groups.opening_count` is the starting number of animals in a group.
`v_animal_group_counts.current_count` adds `naissance` and `achat` events and
subtracts `vente` and `deces` events. `transfert`, `soin`, and `autre` events do
not change the count: transfers do not identify a destination group in this
schema, while care and miscellaneous events are non-population events.

## Authentication and localization

Authentication uses Supabase email/password with cookie-backed browser and
server clients from `@supabase/ssr`. Next.js 16 `proxy.ts` refreshes tokens and
performs only an optimistic protected-route redirect. Protected layouts, data
loaders, and server actions verify signed claims on the server near data access.
User identifiers are derived from those claims rather than accepted from forms.

Routes use a required locale prefix (`/fr` and `/ar`) with French as the default.
Small server-side dictionaries avoid adding a localization dependency for the
initial application surface. The locale layout sets both `lang` and `dir`, so
Arabic renders right-to-left. Currency display uses `Intl.NumberFormat` with
the selected Tunisian locale and TND's three fractional digits.

Email confirmation behavior follows the Supabase project's Auth setting. After
signup, FellahPro shows a neutral confirmation message whether a session is
created immediately or email verification is required.

## First-farm onboarding

The Auth signup trigger remains the primary way profiles are created. A narrow
insert policy also lets an authenticated user create only their own missing
profile, which supports onboarding for legacy or partially provisioned Auth
accounts without a service-role client. Existing profile update RLS remains in
force.

The first farm is inserted through the signed-in user's regular Supabase client.
The application does not set `created_by` or insert an owner membership itself:
the database derives the creator from `auth.uid()` and the existing Mission 1
trigger creates the owner membership. This keeps authorization and the
ownership invariant in the database and leaves RLS enabled throughout.

The application selects the oldest accessible farm as the current workspace.
"Accessible" here requires a current `farm_members` row; creator-only SELECT
visibility on a farm is not sufficient. The role is returned from that same
membership. Explicit farm switching is deferred until the product supports
managing more than one farm.

Workspace selection and first-farm creation are exposed as narrow
`security invoker` database functions. They derive the user from `auth.uid()`
and continue to run under the authenticated user's grants and RLS policies.
First-farm creation locks the caller's profile row before checking membership.
Concurrent onboarding submissions for the same user therefore serialize, and
later submissions return the membership created by the first transaction
instead of creating duplicate farms.

## Plot management

Mission 3A reuses the existing `plots` table without a schema migration. The
interface exposes only the fields already supported for standalone plot
management: name, area in hectares, and notes. Activity assignment remains
unset until the Activities module is implemented.

All plot reads and mutations are scoped to the current workspace derived from
the authenticated session. A plot UUID from a URL or form is treated only as an
untrusted reference and is always combined with the authorized farm ID. The
existing RLS matrix remains authoritative: every member can read plots, owners
and workers can create or edit them, and only owners can delete them.

Plot deletion uses the existing restrictive crop-cycle foreign key. A referenced
plot is preserved and the application reports that dependency instead of
cascading or deleting crop-cycle data.

## Crop-cycle management

Mission 3B adds a forward migration rather than changing the applied initial
schema. The original `crop_cycles` table required an activity even though the
Activities module is deliberately deferred, and exposed only one ambiguous end
date. The migration makes `activity_id` optional, preserves the selected plot's
activity automatically when one exists, and separates expected and actual
harvest dates. It also adds cultivated area and notes because these values are
part of the operational crop-cycle record requested by the module.

Expected and actual harvest dates cannot precede planting, and completed cycles
must have an actual harvest date. A database trigger locks and verifies the
selected plot so cultivated area cannot exceed plot area, including during
concurrent writes. A companion plot trigger prevents later plot resizing from
invalidating existing cycles.

Every crop-cycle read and mutation combines an untrusted cycle or plot UUID with
the farm derived from the authenticated workspace. The existing RLS matrix is
unchanged: all members read, owners and workers create or update, and only
owners delete. Existing task, transaction, and inventory foreign keys remain
restrictive, so linked operational records block deletion instead of cascading.

## Economic activity management

Mission 3C manages the existing economic categories in `public.activities`:
name, kind (`culture`, `elevage`, `commerce`, `autre`), and active state. It adds
no migration and does not turn categories into dated agricultural operations.
Creation-date filters use the existing audit timestamp and explicitly use UTC.
The application validates names between 2 and 120 characters; historical
database values are not truncated or rewritten.

All category reads use the authenticated SSR client and the current member
workspace. Only owners create, edit, activate, deactivate, or delete categories.
Workers and accountants can read them, including inactive history. The existing
owner/worker permissions for plot and crop-cycle assignment remain unchanged.
Server Actions derive the farm and role from membership, accept only editable
fields, and combine record UUIDs with the authorized farm ID for every mutation.
RLS remains authoritative if membership changes between rendering and writing.

Plots and cycles have optional activity selectors. A new cycle can default to
the selected plot's activity, use a different same-farm category, or explicitly
have no category. On UPDATE, a missing assignment field omits `activity_id`
from the SQL payload, preserving even an assignment changed concurrently after
the form was loaded. An unchanged edit selector does not submit that field;
an explicitly empty selection unassigns it. Plot reassignment never rewrites
existing cycles. Inactive categories remain visible and assignable, and no new
restriction is imposed on category kind.

Deletion requires UI confirmation and remains subject to all six existing
activity foreign keys: plots, cycles, animal groups, transactions, inventory
movements, and tasks. The application reports dependency failures and offers
deactivation as the history-preserving alternative. It never cascades, detaches,
or reassigns dependent records automatically. Cycle reassignment/unassignment
can similarly be rejected by dependent composite foreign keys.

Activities lists use stable creation-time/UUID ordering and 24-row pages.
Related plot/cycle sections show at most 50 records with exact totals. Activity
options are fetched in pages, including inactive records. Dashboard statistics
use exact database counts rather than a potentially API-truncated row list.
These independent counts are a current overview, not a transactional reporting
snapshot. Financial reporting continues to use the existing SQL views.

Validation and authorization orchestration are tested through the same service
used by the SSR actions, with a repository substitute for unit tests. Database
security is tested separately under authenticated/anonymous roles against real
PostgreSQL; unit substitutes are not treated as hosted Supabase verification.

## Tasks and in-app reminders

Mission 3D reuses `public.tasks`, its existing indexes, audit trigger, composite
foreign keys and RLS. No migration or optional start date is needed: `due_on`
supports the requested scheduling and reminders. Task statuses remain
`a_faire`, `en_cours`, `terminee`, `annulee`; priorities remain `basse`, `normale`,
`haute`. Status transitions can reopen or cancel a task without rewriting its
due date or relationships. Application titles are normalized to 2–120
characters and descriptions to at most 2,000; historical rows are not rewritten.

All reads, counts, option lookups, and mutations use the authenticated SSR
client and the farm selected from actual membership. The user's identity for
“my tasks” comes from authenticated claims. Submitted farm IDs, user identity,
roles, audit values, and other fields are excluded from task writes. Owners
read/create/update/delete; workers read/create/update any task in their farm;
accountants read only, including when assigned a task. Server-side role checks
complement RLS, which remains authoritative after membership changes.

Activity/cycle/group options and assignees are resolved within the selected
farm. Assignees may be any current member, including an accountant. A task may
link to at most one crop cycle or animal group, with the same activity as that
parent. The server derives or verifies this activity independently of the form.
An unclassified cycle cannot be linked until its activity is assigned. Inactive
activities and all existing activity kinds remain valid. A full edit explicitly
sets/clears optional fields; quick status changes submit only the status.
Database foreign keys catch races with membership or parent changes. Leaving a
farm clears that member's task assignments without deleting the tasks. Task
deletion requires confirmation and does not modify its parent records.

Due dates are calendar dates in `Africa/Tunis`, independent of the browser or
server machine's time zone. Pending is `a_faire`/`en_cours`. Overdue is derived
from a pending status and `due_on < today`. Upcoming is today through today + 6
days inclusive; it includes due-today tasks. Missing due dates stay pending but
are excluded from dated reminder counts. Completed/cancelled tasks never become
overdue; no redundant overdue state is stored. Past due dates are valid.

Lists use stable due-date/creation-time/UUID ordering with 24-row pages and
combined title/status/priority/assignee/date filters. Assignee and association
options are paged to avoid the API row limit. Dashboard counts are exact
farm-scoped queries, independent of list pagination. As with activity summaries,
these separate counts are an overview rather than a transactional snapshot.
Visible list/detail/dashboard screens refresh every minute and on focus or
visibility return; edit forms are excluded. This provides in-app reminders
only, without email, SMS, browser push, or background notification delivery.

The same validation/authorization service powers server actions and unit
tests; SQL tests independently exercise the existing policies and constraints
with real authenticated/anonymous PostgreSQL roles. Neither is a substitute
for hosted Supabase authentication or browser end-to-end validation.

## Livestock management

Mission 4 reuses `animal_groups`, `animal_events`, their farm indexes, composite
foreign keys, the group audit trigger and `v_animal_group_counts`. There are no
new columns, migrations or policy changes. Species/type is existing free text,
not an invented breed or species taxonomy. Groups require a same-farm economic
activity, including inactive categories and any existing activity kind.
Application group names are 2–120 characters, species labels 2–80 characters,
and opening counts are nonnegative PostgreSQL integers. Existing rows are not
rewritten to fit these application limits.

Group mutation is owner-only under existing RLS. Workers can record events but
cannot manage structural groups; accountants read. Every loader, reference
lookup, list, summary and mutation uses the authenticated SSR client and the
farm selected through actual membership. Record IDs are untrusted selectors
combined with this farm. Farm, user, role, audit and derived-count fields are
excluded from writes. Membership and composite foreign keys remain authoritative
if authorization or references change after a form is rendered.

The supported event kinds are exactly `naissance`, `achat`, `vente`, `deces`,
`transfert`, `soin`, `autre`. The application exposes INSERT-only event history:
no existing event is overwritten or deleted through this module. Notes are at
most 2,000 characters; quantities are integers within the PostgreSQL range,
positive for population-changing types and optionally zero for neutral types.
Arabic/Persian digits are normalized. Event dates are real calendar dates no
later than today in `Africa/Tunis`; these are historical records, not scheduled
interventions. Inactive groups may still receive historical entries. Existing
direct database UPDATE/DELETE permissions are preserved; this is not a new
tamper-proof audit ledger. Care events record facts/notes only, with no medical
recommendations or prescriptions.

All displayed counts use the existing security-invoker SQL view: opening count
plus births/purchases minus sales/deaths. The application never independently
replays event quantities to calculate a second balance. Transfers have no
destination in the schema and remain neutral, as do care and other events.
Opening count is an explicitly editable starting baseline, with a form warning
that changing it changes the calculated balance without modifying history.
The view includes every recorded event, even future-dated legacy data; it is
a recorded balance, not an as-of-date census. Negative values remain visible
and generate data-quality alerts. SQL bigint counts are kept exact; unsafe
already-rounded numeric JSON or missing view rows produce an error, not zero.
Dashboard totals sum those balances across all current-farm groups, including
inactive history, and group counts are broken down by stored species labels.
At most eight species labels and five recent events are previewed on the
dashboard; full group/history lists are available. Independent paged reads are
an operational overview, not a transactional reporting snapshot.

Group deletion requires confirmation and is blocked independently by events,
tasks, transactions or inventory movements. No linked data is cascaded or
detached by the module; deactivation preserves history. Reassigning the group's
activity can also be blocked by dependent composite keys. Group/event lists use
24-row pages with stable UUID tie-breakers. Event history supports kind/date
filters, and all events remain accessible through pagination.

Animal events have no amount or transaction link. The financial section shows
only actual generated `transaction_lines.amount` values from transactions
explicitly linked to the authorized group. It paginates lines without recomputing
prices, costs, payments or profit. It does not label every expense as a purchase
or every revenue as an animal sale. `v_debts` cannot supply this history because
it intentionally excludes settled transactions. There is no automatic ledger
write or event-specific purchase/sale price capture in this mission.

Task list filtering by `animalGroupId` first verifies the group in the current
farm. Group-to-task creation derives the initial activity/group from that same
verified record; the ordinary task service validates the final submitted
references again. Task pages link back to the group. These additions preserve
existing assignee, role, date and cross-farm protections.

## Deliberately deferred

- Farm switching and dated agricultural field operations remain deferred.
- No marketplace, subscription, or AI tables are created.
- No database changes are applied automatically; the migration must be reviewed
  and applied by the project owner.
