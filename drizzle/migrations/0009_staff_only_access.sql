CREATE TABLE public.staff_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.staff_members TO authenticated;
GRANT ALL ON public.staff_members TO service_role;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own membership" ON public.staff_members FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select _user_id is not null and (exists (select 1 from public.staff_members where user_id = _user_id)
    or exists (select 1 from public.user_roles where user_id = _user_id and role = 'admin'))
$$;

INSERT INTO public.staff_members(user_id) SELECT id FROM auth.users ON CONFLICT DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients','events','bookings','booking_items','checklist_items','products'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "staff all" ON public.%I', t);
    EXECUTE format('CREATE POLICY "staff all" ON public.%I FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['balance_movements','purchases','stock_movements'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "staff read" ON public.%I', t);
    EXECUTE format('CREATE POLICY "staff read" ON public.%I FOR SELECT TO authenticated USING (public.is_staff(auth.uid()))', t);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.recompute_client_ledger(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.add_balance_movement(_client uuid, _type movement_type, _amount numeric, _description text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _before numeric; _id uuid;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Non autorizzato'; end if;
  if _type = 'acquisto' then raise exception 'Usa register_purchase per gli acquisti'; end if;
  if _type = 'ricarica' and _amount <= 0 then raise exception 'La ricarica deve essere positiva'; end if;
  if _amount = 0 then raise exception 'Importo non valido'; end if;
  perform pg_advisory_xact_lock(hashtext(_client::text));
  _before := public.client_balance(_client);
  if _before + _amount < 0 then raise exception 'Il saldo non può diventare negativo'; end if;
  insert into public.balance_movements(client_id, type, description, amount, balance_before, balance_after)
  values (_client, _type, coalesce(_description,''), _amount, _before, _before + _amount) returning id into _id;
  return _id;
end $function$;
CREATE OR REPLACE FUNCTION public.delete_balance_movement(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m public.balance_movements;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Non autorizzato'; end if;
  select * into m from public.balance_movements where id = _id;
  if not found then raise exception 'Movimento non trovato'; end if;
  perform pg_advisory_xact_lock(hashtext(m.client_id::text));
  delete from public.balance_movements where id = _id;
  if m.purchase_id is not null then delete from public.purchases where id = m.purchase_id; end if;
  perform public.recompute_client_ledger(m.client_id);
end $function$;
CREATE OR REPLACE FUNCTION public.register_purchase(_client uuid, _product uuid, _product_name text, _quantity integer, _amount numeric, _date date, _notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _before numeric; _pid uuid;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Non autorizzato'; end if;
  if _amount <= 0 then raise exception 'Importo non valido'; end if;
  perform pg_advisory_xact_lock(hashtext(_client::text));
  _before := public.client_balance(_client);
  if _amount > _before then raise exception 'Saldo insufficiente (disponibile € %)', _before; end if;
  insert into public.purchases(client_id, product_id, product_name, quantity, amount, purchase_date, notes)
  values (_client, _product, _product_name, _quantity, _amount, coalesce(_date, current_date), coalesce(_notes,'')) returning id into _pid;
  insert into public.balance_movements(client_id, type, description, amount, balance_before, balance_after, purchase_id)
  values (_client, 'acquisto', _quantity || ' × ' || _product_name, -_amount, _before, _before - _amount, _pid);
  return _pid;
end $function$;
CREATE OR REPLACE FUNCTION public.register_sale(_client uuid, _product uuid, _product_name text, _quantity integer, _amount numeric, _buono_used numeric, _date date, _notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _before numeric; _pid uuid; _used numeric;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Non autorizzato'; end if;
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
end $function$;
CREATE OR REPLACE FUNCTION public.update_balance_movement(_id uuid, _amount numeric, _description text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m public.balance_movements;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Non autorizzato'; end if;
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
end $function$;