alter table public."Visitor_Sessions"
	add column if not exists visitor_id uuid,
	add column if not exists user_id uuid default auth.uid()
		references auth.users(id) on delete set null,
	add column if not exists event_type text not null default 'visit'
		check (event_type in ('visit', 'preference_update', 'product_view', 'add_to_cart', 'authentication')),
	add column if not exists preferences jsonb
		check (preferences is null or jsonb_typeof(preferences) = 'object');

update public."Visitor_Sessions"
set visitor_id = session_id
where visitor_id is null;

alter table public."Visitor_Sessions"
	alter column visitor_id set not null;

create index if not exists visitor_sessions_visitor_visited_idx
	on public."Visitor_Sessions" (visitor_id, visited_at desc);
create index if not exists visitor_sessions_user_visited_idx
	on public."Visitor_Sessions" (user_id, visited_at desc)
	where user_id is not null;

drop policy if exists "Visitors can record their own visitor status"
	on public."Visitor_Sessions";
create policy "Visitors can record their own visitor status"
	on public."Visitor_Sessions"
	for insert to anon, authenticated
	with check (
		is_authenticated = ((select auth.uid()) is not null)
		and user_id is not distinct from (select auth.uid())
	);

drop policy if exists "Visitors can record product search events"
	on public."Product_Search_Events";
revoke insert on public."Product_Search_Events" from anon, authenticated;

notify pgrst, 'reload schema';
