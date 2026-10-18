alter table public."Orders"
	add column if not exists cancellation_reason text
		check (cancellation_reason is null or length(trim(cancellation_reason)) between 1 and 500);

create or replace function public.cancel_customer_order(
	p_order_id uuid,
	p_cancellation_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_customer_id uuid := auth.uid();
	v_updated_order_id uuid;
begin
	if v_customer_id is null then
		raise exception 'Sign in before cancelling an order.';
	end if;
	if p_cancellation_reason is null
		or length(trim(p_cancellation_reason)) not between 1 and 500 then
		raise exception 'Enter a cancellation reason between 1 and 500 characters.';
	end if;

	update public."Orders"
	set status = 'cancelled',
		cancellation_reason = trim(p_cancellation_reason)
	where id = p_order_id
		and customer_id = v_customer_id
		and status = 'pending'
	returning id into v_updated_order_id;

	if v_updated_order_id is null then
		raise exception 'Only your pending orders can be cancelled.';
	end if;
end;
$$;

revoke all on function public.cancel_customer_order(uuid, text) from public, anon;
grant execute on function public.cancel_customer_order(uuid, text) to authenticated;

notify pgrst, 'reload schema';
