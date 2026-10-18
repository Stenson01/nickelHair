alter table public."Products"
	add column if not exists category_id uuid references public."Categories"(id) on delete set null;

alter table public."Products"
	add column if not exists what_it_does text,
	add column if not exists how_to_use text,
	add column if not exists ingredients text,
	add column if not exists suitable_for text;

create table if not exists public."Product_Delivery_Details" (
	product_id uuid primary key references public."Products"(id) on delete cascade,
	min_delivery_days integer not null check (min_delivery_days > 0),
	max_delivery_days integer not null check (max_delivery_days >= min_delivery_days),
	day_type text not null default 'business' check (day_type in ('business', 'calendar')),
	delivery_fee numeric(12, 2) not null default 0 check (delivery_fee >= 0),
	delivery_notes text check (delivery_notes is null or char_length(delivery_notes) <= 500),
	updated_at timestamptz not null default now()
);

alter table public."Product_Delivery_Details" enable row level security;
revoke all on table public."Product_Delivery_Details" from public, anon, authenticated;
grant select on public."Product_Delivery_Details" to anon, authenticated;

drop policy if exists "Anyone can read product delivery details" on public."Product_Delivery_Details";
create policy "Anyone can read product delivery details"
	on public."Product_Delivery_Details"
	for select
	to anon, authenticated
	using (true);

create table if not exists public."Store_Settings" (
	setting_key text primary key,
	setting_value text not null
);

alter table public."Store_Settings" enable row level security;
revoke all on table public."Store_Settings" from public, anon, authenticated;
grant select on public."Store_Settings" to authenticated;

drop policy if exists "Signed-in customers can read the WhatsApp contact" on public."Store_Settings";
create policy "Signed-in customers can read the WhatsApp contact"
	on public."Store_Settings"
	for select
	to authenticated
	using (setting_key = 'whatsapp_phone');

create table if not exists public."Product_Reviews" (
	id uuid primary key default gen_random_uuid(),
	product_id uuid not null references public."Products"(id) on delete cascade,
	customer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
	display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
	rating smallint not null check (rating between 1 and 5),
	review_text text not null check (char_length(btrim(review_text)) between 1 and 1000),
	photo_path text,
	created_at timestamptz not null default now(),
	unique (product_id, customer_id),
	check (photo_path is null or photo_path like customer_id::text || '/%')
);

create table if not exists public."Store_Admins" (
	user_id uuid primary key references auth.users(id) on delete cascade,
	created_at timestamptz not null default now()
);

alter table public."Store_Admins" enable row level security;
revoke all on table public."Store_Admins" from public, anon, authenticated;

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public."Store_Admins" as admins
		where admins.user_id = (select auth.uid())
	);
$$;

revoke all on function public.is_store_admin() from public, anon;
grant execute on function public.is_store_admin() to authenticated;

create or replace function public.can_review_product(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public."Orders" as orders
		join public."Order_Items" as items on items.order_id = orders.id
		where orders.customer_id = (select auth.uid())
			and orders.status = 'completed'
			and items.product_id = p_product_id::text
			and not exists (
				select 1
				from public."Product_Reviews" as reviews
				where reviews.product_id = p_product_id
					and reviews.customer_id = (select auth.uid())
			)
	);
$$;

revoke all on function public.can_review_product(uuid) from public, anon;
grant execute on function public.can_review_product(uuid) to authenticated;

grant insert, update on public."Categories", public."Products" to authenticated;
grant insert, update on public."Product_Delivery_Details", public."Store_Settings" to authenticated;
grant delete on public."Product_Reviews" to authenticated;

drop policy if exists "Store admins can manage categories" on public."Categories";
create policy "Store admins can manage categories"
	on public."Categories"
	for all
	to authenticated
	using ((select public.is_store_admin()))
	with check ((select public.is_store_admin()));

drop policy if exists "Store admins can manage products" on public."Products";
create policy "Store admins can manage products"
	on public."Products"
	for all
	to authenticated
	using ((select public.is_store_admin()))
	with check ((select public.is_store_admin()));

drop policy if exists "Store admins can manage product delivery details" on public."Product_Delivery_Details";
create policy "Store admins can manage product delivery details"
	on public."Product_Delivery_Details"
	for all
	to authenticated
	using ((select public.is_store_admin()))
	with check ((select public.is_store_admin()));

drop policy if exists "Store admins can manage store settings" on public."Store_Settings";
create policy "Store admins can manage store settings"
	on public."Store_Settings"
	for all
	to authenticated
	using ((select public.is_store_admin()))
	with check ((select public.is_store_admin()));

drop policy if exists "Store admins can remove product reviews" on public."Product_Reviews";
create policy "Store admins can remove product reviews"
	on public."Product_Reviews"
	for delete
	to authenticated
	using ((select public.is_store_admin()));

create index if not exists product_reviews_product_created_idx
	on public."Product_Reviews" (product_id, created_at desc);

alter table public."Product_Reviews" enable row level security;
revoke all on table public."Product_Reviews" from public, anon, authenticated;
grant select (id, product_id, display_name, rating, review_text, photo_path, created_at)
	on public."Product_Reviews" to anon, authenticated;
grant insert (product_id, display_name, rating, review_text, photo_path)
	on public."Product_Reviews" to authenticated;

drop policy if exists "Anyone can read product reviews" on public."Product_Reviews";
create policy "Anyone can read product reviews"
	on public."Product_Reviews"
	for select
	to anon, authenticated
	using (true);

drop policy if exists "Verified customers can review completed purchases" on public."Product_Reviews";
create policy "Verified customers can review completed purchases"
	on public."Product_Reviews"
	for insert
	to authenticated
	with check (
		customer_id = (select auth.uid())
		and (select public.can_review_product(product_id))
	);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'product-review-photos',
	'product-review-photos',
	true,
	5242880,
	array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view product review photos" on storage.objects;
create policy "Anyone can view product review photos"
	on storage.objects
	for select
	to public
	using (bucket_id = 'product-review-photos');

drop policy if exists "Customers can upload their own product review photos" on storage.objects;
create policy "Customers can upload their own product review photos"
	on storage.objects
	for insert
	to authenticated
	with check (
		bucket_id = 'product-review-photos'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

drop policy if exists "Customers can remove their own product review photos" on storage.objects;
create policy "Customers can remove their own product review photos"
	on storage.objects
	for delete
	to authenticated
	using (
		bucket_id = 'product-review-photos'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

drop policy if exists "Store admins can remove product review photos" on storage.objects;
create policy "Store admins can remove product review photos"
	on storage.objects
	for delete
	to authenticated
	using (
		bucket_id = 'product-review-photos'
		and (select public.is_store_admin())
	);

notify pgrst, 'reload schema';
