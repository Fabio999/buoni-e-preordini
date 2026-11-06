CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.staff_ranks (
  name_key text PRIMARY KEY,
  display_name text NOT NULL,
  rank text NOT NULL CHECK (rank IN ('amministratore','responsabile')),
  pin_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.staff_ranks TO authenticated;
GRANT ALL ON public.staff_ranks TO service_role;
ALTER TABLE public.staff_ranks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operator_sessions ADD COLUMN rank text NOT NULL DEFAULT 'nessuno';

CREATE OR REPLACE FUNCTION public.operator_session_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('mf.rank_ok', true), '') <> 'on' THEN NEW.rank := 'nessuno'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER operator_session_guard BEFORE INSERT OR UPDATE ON public.operator_sessions FOR EACH ROW EXECUTE FUNCTION public.operator_session_guard();

CREATE OR REPLACE FUNCTION public.rank_key(_name text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lower(regexp_replace(trim(_name), '\s+', ' ', 'g')) $$;

CREATE OR REPLACE FUNCTION public.current_rank() RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RETURN 'nessuno'; END IF;
  -- Bootstrap: until an Amministratore rank exists, the admin account keeps full access.
  IF public.has_role(auth.uid(), 'admin') AND NOT EXISTS (SELECT 1 FROM public.staff_ranks WHERE rank = 'amministratore') THEN RETURN 'amministratore'; END IF;
  SELECT s.rank INTO r FROM public.operator_sessions s
    JOIN public.staff_ranks k ON k.name_key = public.rank_key(s.operator_name) AND k.rank = s.rank
    WHERE s.user_id = auth.uid();
  RETURN coalesce(r, 'nessuno');
END $$;

CREATE OR REPLACE FUNCTION public.is_manager() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.current_rank() IN ('amministratore','responsabile') $$;
CREATE OR REPLACE FUNCTION public.is_rank_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.current_rank() = 'amministratore' $$;

CREATE POLICY "staff read ranks" ON public.staff_ranks FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.start_operator_session(_name text, _pin text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE k public.staff_ranks; r text := 'nessuno';
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Non autorizzato'; END IF;
  SELECT * INTO k FROM public.staff_ranks WHERE name_key = public.rank_key(_name);
  IF FOUND THEN
    IF coalesce(_pin, '') = '' THEN RAISE EXCEPTION 'PIN_RICHIESTO'; END IF;
    IF k.pin_hash <> extensions.crypt(_pin, k.pin_hash) THEN RAISE EXCEPTION 'PIN errato'; END IF;
    r := k.rank;
  END IF;
  PERFORM set_config('mf.rank_ok', 'on', true);
  INSERT INTO public.operator_sessions(user_id, operator_name, rank, updated_at) VALUES (auth.uid(), trim(_name), r, now())
    ON CONFLICT (user_id) DO UPDATE SET operator_name = excluded.operator_name, rank = excluded.rank, updated_at = now();
  PERFORM set_config('mf.rank_ok', 'off', true);
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.set_staff_rank(_name text, _rank text, _pin text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NOT public.is_rank_admin() THEN RAISE EXCEPTION 'Solo un amministratore può assegnare i diritti'; END IF;
  IF _rank = 'nessuno' THEN DELETE FROM public.staff_ranks WHERE name_key = public.rank_key(_name); RETURN; END IF;
  IF _rank NOT IN ('amministratore','responsabile') THEN RAISE EXCEPTION 'Diritto non valido'; END IF;
  IF coalesce(_pin, '') = '' THEN
    UPDATE public.staff_ranks SET rank = _rank, display_name = trim(_name), updated_at = now() WHERE name_key = public.rank_key(_name);
    IF NOT FOUND THEN RAISE EXCEPTION 'Serve un PIN per assegnare il diritto'; END IF;
    RETURN;
  END IF;
  IF length(_pin) < 4 THEN RAISE EXCEPTION 'Il PIN deve avere almeno 4 cifre'; END IF;
  INSERT INTO public.staff_ranks(name_key, display_name, rank, pin_hash) VALUES (public.rank_key(_name), trim(_name), _rank, extensions.crypt(_pin, extensions.gen_salt('bf')))
    ON CONFLICT (name_key) DO UPDATE SET display_name = excluded.display_name, rank = excluded.rank, pin_hash = excluded.pin_hash, updated_at = now();
END $$;

REVOKE ALL ON FUNCTION public.start_operator_session(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_staff_rank(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_operator_session(text, text), public.set_staff_rank(text, text, text), public.current_rank(), public.is_manager(), public.is_rank_admin() TO authenticated;

-- Shifts: managed by Amministratore and Responsabile
ALTER POLICY "admin shift assignments" ON public.shift_assignments USING (public.is_manager()) WITH CHECK (public.is_manager());
ALTER POLICY "admin shift availability" ON public.shift_availability USING (public.is_manager()) WITH CHECK (public.is_manager());
ALTER POLICY "admin shift collaborators" ON public.shift_collaborators USING (public.is_manager()) WITH CHECK (public.is_manager());
ALTER POLICY "admin shift history read" ON public.shift_history USING (public.is_manager());
ALTER POLICY "admin shift sync runs" ON public.shift_sync_runs USING (public.is_manager()) WITH CHECK (public.is_manager());

-- Operator names: Amministratore only
ALTER POLICY "admin delete" ON public.account_operators USING (public.is_rank_admin());
ALTER POLICY "admin insert" ON public.account_operators WITH CHECK (public.is_rank_admin());
ALTER POLICY "admin update" ON public.account_operators USING (public.is_rank_admin()) WITH CHECK (public.is_rank_admin());

-- Products: everyone reads, only managers change the catalogue
DROP POLICY "staff all" ON public.products;
CREATE POLICY "staff read products" ON public.products FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "manager write products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_manager());
CREATE POLICY "manager update products" ON public.products FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());
CREATE POLICY "manager delete products" ON public.products FOR DELETE TO authenticated USING (public.is_manager());

-- Deletions of shop data: managers only (restrictive, counter work keeps insert/update)
CREATE POLICY "manager delete clients" ON public.clients AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_manager());
CREATE POLICY "manager delete bookings" ON public.bookings AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_manager());
CREATE POLICY "manager delete events" ON public.events AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_manager());
CREATE POLICY "manager delete calendar" ON public.calendar_entries AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_manager());
CREATE POLICY "manager delete tasks" ON public.company_tasks AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_manager());

CREATE OR REPLACE FUNCTION public.update_balance_movement(_id uuid, _amount numeric, _description text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare m public.balance_movements;
begin
  if not public.is_manager() then raise exception 'Solo amministratori e responsabili possono modificare i movimenti'; end if;
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

CREATE OR REPLACE FUNCTION public.delete_balance_movement(_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare m public.balance_movements;
begin
  if not public.is_manager() then raise exception 'Solo amministratori e responsabili possono eliminare i movimenti'; end if;
  select * into m from public.balance_movements where id = _id;
  if not found then raise exception 'Movimento non trovato'; end if;
  perform pg_advisory_xact_lock(hashtext(m.client_id::text));
  delete from public.balance_movements where id = _id;
  if m.purchase_id is not null then delete from public.purchases where id = m.purchase_id; end if;
  perform public.recompute_client_ledger(m.client_id);
end $function$;