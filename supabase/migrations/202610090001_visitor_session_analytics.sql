create table if not exists public."Visitor_Sessions" (
	session_id uuid not null,
	is_authenticated boolean not null,
	visited_at timestamptz not null default now()
);

create index if not exists visitor_sessions_visited_at_idx
	on public."Visitor_Sessions" (visited_at desc);

alter table public."Visitor_Sessions" enable row level security;

drop policy if exists "Visitors can record their own visitor status"
	on public."Visitor_Sessions";
create policy "Visitors can record their own visitor status"
	on public."Visitor_Sessions"
	for insert to anon, authenticated
	with check (
		is_authenticated = ((select auth.uid()) is not null)
	);

grant insert on public."Visitor_Sessions" to anon, authenticated;

notify pgrst, 'reload schema';
