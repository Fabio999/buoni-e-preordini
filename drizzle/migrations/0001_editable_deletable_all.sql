-- cascade deletes for clients/events
alter table public.bookings drop constraint bookings_client_id_fkey, add constraint bookings_client_id_fkey foreign key (client_id) references public.clients(id) on delete cascade;
alter table public.bookings drop constraint bookings_event_id_fkey, add constraint bookings_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade;
alter table public.purchases drop constraint purchases_client_id_fkey, add constraint purchases_client_id_fkey foreign key (client_id) references public.clients(id) on delete cascade;
alter table public.balance_movements drop constraint balance_movements_client_id_fkey, add constraint balance_movements_client_id_fkey foreign key (client_id) references public.clients(id) on delete cascade;

-- products deletable: keep name snapshot on booking items
alter table public.booking_items add column product_name text not null default '';
update public.booking_items bi set product_name = p.name from public.products p where p.id = bi.product_id;
alter table public.booking_items alter column product_id drop not null;
alter table public.booking_items drop constraint booking_items_product_id_fkey, add constraint booking_items_product_id_fkey foreign key (product_id) references public.products(id) on delete set null;

create or replace function public.booking_item_name() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is not null then
    select name into new.product_name from public.products where id = new.product_id;
  end if;
  return new;
end $$;
create trigger booking_item_name before insert or update on public.booking_items for each row execute function public.booking_item_name();

-- ledger recompute
create or replace function public.recompute_client_ledger(_client uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from (
      select sum(amount) over (order by created_at, id) as after from public.balance_movements where client_id = _client
    ) s where s.after < 0
  ) then raise exception 'Il saldo non può diventare negativo'; end if;
  update public.balance_movements m set balance_before = s.after - s.amount, balance_after = s.after
  from (select id, amount, sum(amount) over (order by created_at, id) as after from public.balance_movements where client_id = _client) s
  where m.id = s.id;
end $$;
revoke execute on function public.recompute_client_ledger(uuid) from public, anon, authenticated;

create or replace function public.update_balance_movement(_id uuid, _amount numeric, _description text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.balance_movements;
begin
  if auth.uid() is null then raise exception 'Non autorizzato'; end if;
  select * into m from public.balance_movements where id = _id;
  if not found then raise exception 'Movimento non trovato'; end if;
  perform pg_advisory_xact_lock(hashtext(m.client_id::text));
  if m.type = 'ricarica' and _amount <= 0 then raise exception 'La ricarica deve essere positiva'; end if;
  if m.type = 'acquisto' and _amount >= 0 then raise exception 'L''acquisto deve essere negativo'; end if;
  if _amount = 0 then raise exception 'Importo non valido'; end if;
  update public.balance_movements set amount = _amount, description = coalesce(_description, '') where id = _id;
  if m.purchase_id is not null then
    update public.purchases set amount = -_amount where id = m.purchase_id;
  end if;
  perform public.recompute_client_ledger(m.client_id);
end $$;

create or replace function public.delete_balance_movement(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.balance_movements;
begin
  if auth.uid() is null then raise exception 'Non autorizzato'; end if;
  select * into m from public.balance_movements where id = _id;
  if not found then raise exception 'Movimento non trovato'; end if;
  perform pg_advisory_xact_lock(hashtext(m.client_id::text));
  delete from public.balance_movements where id = _id;
  if m.purchase_id is not null then delete from public.purchases where id = m.purchase_id; end if;
  perform public.recompute_client_ledger(m.client_id);
end $$;

revoke execute on function public.update_balance_movement(uuid, numeric, text) from public, anon;
revoke execute on function public.delete_balance_movement(uuid) from public, anon;
grant execute on function public.update_balance_movement(uuid, numeric, text) to authenticated;
grant execute on function public.delete_balance_movement(uuid) to authenticated;