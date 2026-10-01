alter table public."Orders"
	add column if not exists payment_provider text,
	add column if not exists moncash_order_id text;

create unique index if not exists orders_moncash_order_id_idx
	on public."Orders" (moncash_order_id)
	where moncash_order_id is not null;

notify pgrst, 'reload schema';
