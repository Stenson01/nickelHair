create table if not exists public."Categories" (
	id uuid primary key default gen_random_uuid(),
	name text not null unique,
	is_active boolean not null default true,
	created_at timestamptz not null default now()
);

create table if not exists public."Products" (
	id uuid primary key default gen_random_uuid(),
	category_id uuid references public."Categories"(id) on delete set null,
	name text not null,
	description text,
	price numeric(12, 2) not null default 0 check (price >= 0),
	image_url text,
	is_active boolean not null default true,
	created_at timestamptz not null default now()
);

alter table public."Products"
	add column if not exists category_id uuid references public."Categories"(id) on delete set null,
	add column if not exists name text,
	add column if not exists description text,
	add column if not exists price numeric(12, 2) default 0,
	add column if not exists image_url text,
	add column if not exists is_active boolean not null default true,
	add column if not exists created_at timestamptz not null default now();

create table if not exists public."Orders" (
	id uuid primary key default gen_random_uuid(),
	customer_id uuid references auth.users(id) on delete set null,
	status text not null default 'pending'
		check (status in ('pending', 'paid', 'completed', 'cancelled', 'refunded')),
	created_at timestamptz not null default now(),
	completed_at timestamptz
);

create table if not exists public."Order_Items" (
	id uuid primary key default gen_random_uuid(),
	order_id uuid not null references public."Orders"(id) on delete cascade,
	product_id text not null,
	product_name text not null,
	unit_price numeric(12, 2) not null check (unit_price >= 0),
	quantity integer not null check (quantity > 0),
	created_at timestamptz not null default now()
);

create table if not exists public."Customer_Category_Interests" (
	id uuid primary key default gen_random_uuid(),
	customer_id uuid not null references auth.users(id) on delete cascade,
	category_id uuid not null references public."Categories"(id) on delete cascade,
	created_at timestamptz not null default now(),
	unique (customer_id, category_id)
);

create index if not exists products_category_active_idx
	on public."Products" (category_id, is_active);
create index if not exists orders_status_completed_idx
	on public."Orders" (status, completed_at);
create index if not exists order_items_product_idx
	on public."Order_Items" (product_id);
create index if not exists customer_category_interests_customer_idx
	on public."Customer_Category_Interests" (customer_id, created_at desc);

alter table public."Categories" enable row level security;
alter table public."Products" enable row level security;
alter table public."Orders" enable row level security;
alter table public."Order_Items" enable row level security;
alter table public."Customer_Category_Interests" enable row level security;

do $$
begin
	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'Categories' and policyname = 'Anyone can read active categories') then
		create policy "Anyone can read active categories" on public."Categories"
			for select using (is_active);
	end if;

	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'Products' and policyname = 'Anyone can read active products') then
		create policy "Anyone can read active products" on public."Products"
			for select using (is_active);
	end if;

	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'Orders' and policyname = 'Customers can read their own orders') then
		create policy "Customers can read their own orders" on public."Orders"
			for select to authenticated using (customer_id = (select auth.uid()));
	end if;

	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'Order_Items' and policyname = 'Customers can read their own order items') then
		create policy "Customers can read their own order items" on public."Order_Items"
			for select to authenticated using (
				exists (
					select 1 from public."Orders"
					where "Orders".id = "Order_Items".order_id
						and "Orders".customer_id = (select auth.uid())
				)
			);
	end if;

	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'Customer_Category_Interests' and policyname = 'Customers can read their own category interests') then
		create policy "Customers can read their own category interests" on public."Customer_Category_Interests"
			for select to authenticated using (customer_id = (select auth.uid()));
	end if;

	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'Customer_Category_Interests' and policyname = 'Customers can record their own category interests') then
		create policy "Customers can record their own category interests" on public."Customer_Category_Interests"
			for insert to authenticated with check (customer_id = (select auth.uid()));
	end if;
end
$$;

grant select on public."Categories", public."Products" to anon, authenticated;
grant select on public."Orders", public."Order_Items" to authenticated;
grant select, insert on public."Customer_Category_Interests" to authenticated;

create or replace function public.get_best_selling_products(
	p_category_ids uuid[],
	p_limit_per_category integer default 5
)
returns table (
	category_id uuid,
	category_name text,
	product_id text,
	product_name text,
	product_description text,
	product_price numeric,
	product_image_url text,
	units_sold bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
	with sales as (
		select
			categories.id as category_id,
			categories.name as category_name,
			products.id::text as product_id,
			products.name::text as product_name,
			products.description::text as product_description,
			products.price::numeric as product_price,
			products.image_url::text as product_image_url,
			sum(items.quantity)::bigint as units_sold
		from public."Order_Items" as items
		join public."Orders" as orders on orders.id = items.order_id
		join public."Products" as products on products.id::text = items.product_id
		join public."Categories" as categories on categories.id = products.category_id
		where orders.status = 'completed'
			and products.is_active
			and categories.is_active
			and products.category_id = any(coalesce(p_category_ids, array[]::uuid[]))
		group by categories.id, categories.name, products.id
	), ranked as (
		select
			sales.*,
			row_number() over (
				partition by sales.category_id
				order by sales.units_sold desc, sales.product_name
			) as category_rank
		from sales
	)
	select
		ranked.category_id,
		ranked.category_name,
		ranked.product_id,
		ranked.product_name,
		ranked.product_description,
		ranked.product_price,
		ranked.product_image_url,
		ranked.units_sold
	from ranked
	where ranked.category_rank <= greatest(1, least(coalesce(p_limit_per_category, 5), 20))
	order by ranked.category_name, ranked.category_rank;
$$;

revoke all on function public.get_best_selling_products(uuid[], integer) from public;
grant execute on function public.get_best_selling_products(uuid[], integer) to anon, authenticated;

notify pgrst, 'reload schema';