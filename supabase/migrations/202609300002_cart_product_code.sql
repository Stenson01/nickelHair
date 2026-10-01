alter table public."Cart"
	drop constraint if exists "Cart_product_id_fkey";

alter table public."Cart"
	alter column product_id type text using product_id::text;

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
