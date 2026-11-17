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

For Mission 1, all three member roles can create, update, and delete operational
farm data; only owners can edit the farm or its membership. Finer worker and
accountant permissions are deferred until those workflows exist. Audit
`created_by` fields cannot be reassigned after insertion, and a transaction can
only be inserted with the current user as its creator.

Profiles are readable by the profile owner and by people who share a farm with
that profile. A signup trigger creates the matching profile automatically.

## Demo data

Demo farms are marked with `farms.is_demo`. The reporting views exclude demo
farms so demo activity does not enter product statistics. Operational tables
remain visible to members of a demo farm so the demo remains usable.

## Authentication and localization

Authentication uses Supabase email/password with cookie-backed browser and
server clients from `@supabase/ssr`. Next.js 16 `proxy.ts` refreshes tokens and
performs only an optimistic protected-route redirect; protected pages also
verify the user on the server.

Routes use a required locale prefix (`/fr` and `/ar`) with French as the default.
Small server-side dictionaries avoid adding a localization dependency for the
initial auth-only surface. The locale layout sets both `lang` and `dir`, so
Arabic renders right-to-left when its translations are expanded.

Email confirmation behavior follows the Supabase project's Auth setting. After
signup, FellahPro shows a neutral confirmation message whether a session is
created immediately or email verification is required.

## Deliberately deferred

- No dashboard is included in Mission 1; the protected area is a simple welcome
  screen used to prove authentication and route protection.
- No marketplace, subscription, or AI tables are created.
- No database changes are applied automatically; the migration must be reviewed
  and applied by the project owner.
