create table if not exists public."Orders" (
	id uuid primary key default gen_random_uuid(),
	customer_id uuid references auth.users(id) on delete set null,
	status text not null default 'pending'
		check (status in ('pending', 'paid', 'completed', 'cancelled', 'refunded')),
	payment_provider text,
	moncash_order_id text,
	total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
	delivery_name text,
	delivery_phone text,
	delivery_address text,
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

alter table public."Products"
	add column if not exists is_active boolean not null default true;

alter table public."Orders"
	add column if not exists payment_provider text,
	add column if not exists moncash_order_id text,
	add column if not exists total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
	add column if not exists delivery_name text,
	add column if not exists delivery_phone text,
	add column if not exists delivery_address text;

create index if not exists orders_status_completed_idx
	on public."Orders" (status, completed_at);
create index if not exists order_items_product_idx
	on public."Order_Items" (product_id);

create unique index if not exists orders_moncash_order_id_idx
	on public."Orders" (moncash_order_id)
	where moncash_order_id is not null;

alter table public."Orders" enable row level security;
alter table public."Order_Items" enable row level security;

do $$
begin
	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'Orders'
			and policyname = 'Customers can read their own orders'
	) then
		create policy "Customers can read their own orders" on public."Orders"
			for select to authenticated using (customer_id = (select auth.uid()));
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'Order_Items'
			and policyname = 'Customers can read their own order items'
	) then
		create policy "Customers can read their own order items" on public."Order_Items"
			for select to authenticated using (
				exists (
					select 1 from public."Orders"
					where "Orders".id = "Order_Items".order_id
						and "Orders".customer_id = (select auth.uid())
				)
			);
	end if;
end
$$;

grant select on public."Orders", public."Order_Items" to authenticated;

create or replace function public.place_cash_on_delivery_order(
	p_delivery_name text,
	p_delivery_phone text,
	p_delivery_address text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_customer_id uuid := auth.uid();
	v_order_id uuid;
	v_cart_count integer;
	v_valid_item_count integer;
	v_inserted_item_count integer;
	v_order_total numeric(12, 2);
begin
	if v_customer_id is null then
		raise exception 'Sign in before placing an order.';
	end if;
	if p_delivery_name is null or length(trim(p_delivery_name)) not between 1 and 120 then
		raise exception 'Enter a valid delivery name.';
	end if;
	if p_delivery_phone is null or length(trim(p_delivery_phone)) not between 1 and 40 then
		raise exception 'Enter a valid delivery phone number.';
	end if;
	if p_delivery_address is null or length(trim(p_delivery_address)) not between 1 and 500 then
		raise exception 'Enter a valid delivery address.';
	end if;

	perform 1
	from public."Cart"
	where user_id = v_customer_id
	for update;

	perform 1
	from public."Cart" as cart
	join public."Products" as product
		on product.id::text = cart.product_id
	where cart.user_id = v_customer_id
	for share of product;

	select count(*)
	into v_cart_count
	from public."Cart"
	where user_id = v_customer_id;
	if v_cart_count = 0 then
		raise exception 'Your cart is empty.';
	end if;

	select count(*)
	into v_valid_item_count
	from public."Cart" as cart
	join public."Products" as product
		on product.id::text = cart.product_id
	where cart.user_id = v_customer_id
		and product.is_active;
	if v_valid_item_count <> v_cart_count then
		raise exception 'The cart contains unavailable products.';
	end if;

	select round(sum(product.price * cart.quantity), 2)
	into v_order_total
	from public."Cart" as cart
	join public."Products" as product
		on product.id::text = cart.product_id
	where cart.user_id = v_customer_id
		and product.is_active;
	if v_order_total is null or v_order_total <= 0 then
		raise exception 'The order total must be greater than zero.';
	end if;

	insert into public."Orders" (
		customer_id,
		status,
		payment_provider,
		total_amount,
		delivery_name,
		delivery_phone,
		delivery_address
	)
	values (
		v_customer_id,
		'pending',
		'cash_on_delivery',
		v_order_total,
		trim(p_delivery_name),
		trim(p_delivery_phone),
		trim(p_delivery_address)
	)
	returning id into v_order_id;

	insert into public."Order_Items" (
		order_id,
		product_id,
		product_name,
		unit_price,
		quantity
	)
	select
		v_order_id,
		cart.product_id,
		product.name,
		product.price,
		cart.quantity
	from public."Cart" as cart
	join public."Products" as product
		on product.id::text = cart.product_id
	where cart.user_id = v_customer_id
		and product.is_active;

	get diagnostics v_inserted_item_count = row_count;
	if v_inserted_item_count <> v_cart_count then
		raise exception 'Unable to save all order items.';
	end if;

	delete from public."Cart"
	where user_id = v_customer_id;

	return v_order_id;
end;
$$;

revoke all on function public.place_cash_on_delivery_order(text, text, text) from public, anon;
grant execute on function public.place_cash_on_delivery_order(text, text, text) to authenticated;

notify pgrst, 'reload schema';
