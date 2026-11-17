# FellahPro implementation plan

## Mission 1 — foundation

1. Document the product architecture and the decisions that affect the data model.
2. Add Supabase browser/server clients and a Next.js 16 session-refresh proxy.
3. Define the first, unapplied Postgres migration with the farm membership model,
   activity-linked ledgers, row-level security, and reporting views.
4. Add French-first email/password authentication with locale-ready routes and
   right-to-left support for Arabic.
5. Add lint, type-check, build verification, and pull-request CI.

## Delivery boundaries

- This mission provides authentication and a protected placeholder only; it does
  not include a dashboard.
- The migration is committed for review but is not applied to Supabase.
- Marketplace, subscription, and AI-advisor tables are deferred.
- Production deployment and environment configuration remain operator tasks.

## Verification

- Run `npm run lint`.
- Run `npm run typecheck`.
- Run `npm run build` using placeholder public Supabase values where needed.
- Review the migration separately before applying it to any Supabase project,
  with particular attention to RLS recursion and financial-view semantics.

## Later missions

- Farm onboarding and the operational dashboard.
- Transaction, inventory, crop-cycle, herd, and task workflows.
- Offline/PWA behavior and production-grade translations.
- AI advice only after the underlying ledgers and reporting views are stable.
