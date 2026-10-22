create or replace function public.register_sale(_client uuid, _product uuid, _product_name text, _quantity int, _amount numeric, _buono_used numeric, _date date, _notes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _before numeric; _pid uuid; _used numeric;
begin
  if auth.uid() is null then raise exception 'Non autorizzato'; end if;
  if _amount <= 0 then raise exception 'Importo non valido'; end if;
  perform pg_advisory_xact_lock(hashtext(_client::text));
  _before := public.client_balance(_client);
  _used := least(greatest(coalesce(_buono_used, 0), 0), _amount, _before);
  insert into public.purchases(client_id, product_id, product_name, quantity, amount, purchase_date, notes)
  values (_client, _product, _product_name, _quantity, _amount, coalesce(_date, current_date), coalesce(_notes,'')) returning id into _pid;
  if _used > 0 then
    insert into public.balance_movements(client_id, type, description, amount, balance_before, balance_after, purchase_id)
    values (_client, 'acquisto', _quantity || ' × ' || _product_name || ' (buono)', -_used, _before, _before - _used, _pid);
  end if;
  return _pid;
end $$;

revoke execute on function public.register_sale(uuid, uuid, text, int, numeric, numeric, date, text) from public, anon;
grant execute on function public.register_sale(uuid, uuid, text, int, numeric, numeric, date, text) to authenticated;