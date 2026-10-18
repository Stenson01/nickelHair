create table if not exists public."Site_Analytics_Daily" (
	visit_day date primary key,
	page_views bigint not null default 0 check (page_views >= 0)
);

alter table public."Site_Analytics_Daily" enable row level security;
revoke all on table public."Site_Analytics_Daily" from public, anon, authenticated;

insert into public."Site_Analytics_Daily" (visit_day, page_views)
select
	(visited_at at time zone 'UTC')::date,
	count(distinct session_id)
from public."Visitor_Sessions"
where event_type = 'visit'
group by (visited_at at time zone 'UTC')::date
on conflict (visit_day) do update
set page_views = public."Site_Analytics_Daily".page_views + excluded.page_views;

drop table public."Visitor_Sessions";
drop table if exists public."Product_Search_Events";

create or replace function public.record_anonymous_page_view()
returns void
language sql
security definer
set search_path = ''
as $$
	insert into public."Site_Analytics_Daily" as daily (visit_day, page_views)
	values ((pg_catalog.now() at time zone 'UTC')::date, 1)
	on conflict (visit_day) do update
	set page_views = daily.page_views + 1;
$$;

revoke all on function public.record_anonymous_page_view() from public;
grant execute on function public.record_anonymous_page_view() to anon, authenticated;

notify pgrst, 'reload schema';
