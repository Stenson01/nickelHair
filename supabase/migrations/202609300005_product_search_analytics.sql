create table if not exists public."Product_Search_Events" (
	id bigint generated always as identity primary key,
	event_type text not null
		check (event_type in ('search', 'search_result', 'product_click', 'add_to_cart')),
	search_term text
		check (search_term is null or length(trim(search_term)) between 1 and 120),
	product_id text,
	result_position integer,
	user_id uuid default auth.uid() references auth.users(id) on delete set null,
	created_at timestamptz not null default now(),
	constraint product_search_events_payload_check check (
		(event_type = 'search' and search_term is not null and product_id is null and result_position is null)
		or (event_type = 'search_result' and search_term is not null and product_id is not null and result_position > 0)
		or (event_type in ('product_click', 'add_to_cart') and product_id is not null and result_position is null)
	)
);

create index if not exists product_search_events_product_idx
	on public."Product_Search_Events" (event_type, product_id, created_at desc);
create index if not exists product_search_events_term_idx
	on public."Product_Search_Events" (event_type, search_term, created_at desc);

alter table public."Product_Search_Events" enable row level security;

drop policy if exists "Visitors can record product search events"
	on public."Product_Search_Events";
create policy "Visitors can record product search events"
	on public."Product_Search_Events"
	for insert to anon, authenticated
	with check (
		user_id is not distinct from (select auth.uid())
		and (
			product_id is null
			or exists (
				select 1
				from public."Products" as products
				where products.id::text = "Product_Search_Events".product_id
			)
		)
	);

grant insert on public."Product_Search_Events" to anon, authenticated;

notify pgrst, 'reload schema';
