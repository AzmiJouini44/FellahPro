-- Mission 2 onboarding fallback for Auth users whose signup profile is missing.

create policy "users can create their profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
