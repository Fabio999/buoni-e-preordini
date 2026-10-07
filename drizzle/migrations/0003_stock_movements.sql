create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  delta integer not null,
  stock_after integer not null,
  source text not null,
  booking_id uuid,
  purchase_id uuid,
  label text not null default '',
  created_at timestamptz not null default now()
);
create index on public.stock_movements(product_id, created_at desc);
grant select on public.stock_movements to authenticated;
grant all on public.stock_movements to service_role;
alter table public.stock_movements enable row level security;
create policy "staff read" on public.stock_movements for select to authenticated using (true);

create or replace function public.log_stock(_product uuid, _delta int, _source text, _booking uuid, _purchase uuid, _label text)
returns void language plpgsql security definer set search_path = public as $$
declare s int;
begin
  if _product is null or _delta = 0 then return; end if;
  perform set_config('app.stock_auto', '1', true);
  update public.products set stock = stock + _delta where id = _product returning stock into s;
  perform set_config('app.stock_auto', '', true);
  if s is not null then
    insert into public.stock_movements(product_id, delta, stock_after, source, booking_id, purchase_id, label)
    values (_product, _delta, s, _source, _booking, _purchase, _label);
  end if;
end $$;

create or replace function public.stock_from_booking_items() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; lbl text;
begin
  r := coalesce(new, old);
  select coalesce(c.first_name || ' ' || c.last_name, '') || ' · ' || coalesce(e.name, '') into lbl
  from public.bookings b left join public.clients c on c.id = b.client_id left join public.events e on e.id = b.event_id
  where b.id = r.booking_id;
  if tg_op in ('UPDATE','DELETE') then
    perform public.log_stock(old.product_id, old.quantity, 'prenotazione_annullata', old.booking_id, null, coalesce(lbl, 'Prenotazione eliminata'));
  end if;
  if tg_op in ('INSERT','UPDATE') then
    perform public.log_stock(new.product_id, -new.quantity, 'prenotazione', new.booking_id, null, coalesce(lbl, ''));
  end if;
  return null;
end $$;

create or replace function public.stock_from_purchases() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; lbl text;
begin
  r := coalesce(new, old);
  select c.first_name || ' ' || c.last_name into lbl from public.clients c where c.id = r.client_id;
  if tg_op in ('UPDATE','DELETE') then
    perform public.log_stock(old.product_id, old.quantity, 'acquisto_annullato', null, old.id, coalesce(lbl, ''));
  end if;
  if tg_op in ('INSERT','UPDATE') then
    perform public.log_stock(new.product_id, -new.quantity, 'acquisto', null, new.id, coalesce(lbl, ''));
  end if;
  return null;
end $$;

create or replace function public.stock_manual_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.stock_auto', true), '') = '1' then return null; end if;
  if tg_op = 'INSERT' then
    if new.stock <> 0 then
      insert into public.stock_movements(product_id, delta, stock_after, source, label) values (new.id, new.stock, new.stock, 'manuale', 'Quantità iniziale');
    end if;
  elsif new.stock <> old.stock then
    insert into public.stock_movements(product_id, delta, stock_after, source, label) values (new.id, new.stock - old.stock, new.stock, 'manuale', 'Modifica manuale');
  end if;
  return null;
end $$;
create trigger products_stock_log after insert or update of stock on public.products
for each row execute function public.stock_manual_log();

revoke execute on function public.log_stock(uuid,int,text,uuid,uuid,text) from public, anon, authenticated;
revoke execute on function public.stock_manual_log() from public, anon;