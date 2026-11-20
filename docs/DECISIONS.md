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

## Deliberately deferred

- The Mission 2 dashboard is an authenticated placeholder; operational feature
  pages and farm switching remain deferred.
- No marketplace, subscription, or AI tables are created.
- No database changes are applied automatically; the migration must be reviewed
  and applied by the project owner.
