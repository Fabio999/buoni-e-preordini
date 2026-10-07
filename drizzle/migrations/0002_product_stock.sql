alter table public.products add column stock integer not null default 0;

create or replace function public.stock_from_booking_items() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.product_id is not null then
    update public.products set stock = stock + old.quantity where id = old.product_id;
  end if;
  if tg_op in ('INSERT','UPDATE') and new.product_id is not null then
    update public.products set stock = stock - new.quantity where id = new.product_id;
  end if;
  return null;
end $$;
create trigger booking_items_stock after insert or update or delete on public.booking_items
for each row execute function public.stock_from_booking_items();

create or replace function public.stock_from_purchases() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.product_id is not null then
    update public.products set stock = stock + old.quantity where id = old.product_id;
  end if;
  if tg_op in ('INSERT','UPDATE') and new.product_id is not null then
    update public.products set stock = stock - new.quantity where id = new.product_id;
  end if;
  return null;
end $$;
create trigger purchases_stock after insert or update or delete on public.purchases
for each row execute function public.stock_from_purchases();

revoke execute on function public.stock_from_booking_items() from public, anon;
revoke execute on function public.stock_from_purchases() from public, anon;