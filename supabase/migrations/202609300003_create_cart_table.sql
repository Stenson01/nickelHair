create table if not exists public."Cart" (
	user_id uuid not null references auth.users(id) on delete cascade,
	product_id text not null check (length(trim(product_id)) > 0),
	quantity integer not null check (quantity > 0),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (user_id, product_id)
);

alter table public."Cart" enable row level security;

do $$
begin
	if not exists (
		select 1 from pg_policies
		where schemaname = 'public' and tablename = 'Cart'
			and policyname = 'Customers can read their own cart'
	) then
		create policy "Customers can read their own cart" on public."Cart"
			for select to authenticated using (user_id = (select auth.uid()));
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public' and tablename = 'Cart'
			and policyname = 'Customers can add to their own cart'
	) then
		create policy "Customers can add to their own cart" on public."Cart"
			for insert to authenticated with check (user_id = (select auth.uid()));
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public' and tablename = 'Cart'
			and policyname = 'Customers can update their own cart'
	) then
		create policy "Customers can update their own cart" on public."Cart"
			for update to authenticated
			using (user_id = (select auth.uid()))
			with check (user_id = (select auth.uid()));
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public' and tablename = 'Cart'
			and policyname = 'Customers can delete from their own cart'
	) then
		create policy "Customers can delete from their own cart" on public."Cart"
			for delete to authenticated using (user_id = (select auth.uid()));
	end if;
end
$$;

grant select, insert, update, delete on public."Cart" to authenticated;

drop function if exists public.add_cart_item(uuid, integer);

create or replace function public.add_cart_item(
	p_product_id text,
	p_quantity integer
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
	customer_id uuid := auth.uid();
begin
	if customer_id is null then
		raise exception 'Sign in before adding items to your cart.';
	end if;
	if p_product_id is null or length(trim(p_product_id)) = 0 then
		raise exception 'Product code is required.';
	end if;
	if p_quantity is null or p_quantity < 1 then
		raise exception 'Cart quantity must be a positive integer.';
	end if;

	insert into public."Cart" as cart (user_id, product_id, quantity)
	values (customer_id, trim(p_product_id), p_quantity)
	on conflict (user_id, product_id)
	do update set
		quantity = cart.quantity + excluded.quantity,
		updated_at = now();
end;
$$;

revoke all on function public.add_cart_item(text, integer) from public;
grant execute on function public.add_cart_item(text, integer) to authenticated;

notify pgrst, 'reload schema';
