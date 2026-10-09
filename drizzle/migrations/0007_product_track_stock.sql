ALTER TABLE public.products ADD COLUMN track_stock boolean NOT NULL DEFAULT true;
create or replace function public.log_stock(_product uuid, _delta int, _source text, _booking uuid, _purchase uuid, _label text)
returns void language plpgsql security definer set search_path = public as $$
declare s int;
begin
  if _product is null or _delta = 0 then return; end if;
  if exists (select 1 from public.products where id = _product and not track_stock) then return; end if;
  perform set_config('app.stock_auto', '1', true);
  update public.products set stock = stock + _delta where id = _product returning stock into s;
  perform set_config('app.stock_auto', '', true);
  if s is not null then
    insert into public.stock_movements(product_id, delta, stock_after, source, booking_id, purchase_id, label)
    values (_product, _delta, s, _source, _booking, _purchase, _label);
  end if;
end $$;
revoke execute on function public.log_stock(uuid,int,text,uuid,uuid,text) from public, anon, authenticated;