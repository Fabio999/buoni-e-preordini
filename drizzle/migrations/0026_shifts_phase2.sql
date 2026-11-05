-- Turni fase 2: stati Bozza/Pubblicato/Modificato, storico immutabile, foglio Google per collaboratore, registro sincronizzazioni.

-- 1. Storico delle modifiche: solo inserimenti da trigger, mai modificato o cancellato.
CREATE TABLE public.shift_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entity_type text NOT NULL CHECK (entity_type IN ('disponibilita','turno')),
 entity_id uuid NOT NULL,
 collaborator_id uuid NOT NULL,
 collaborator_name text NOT NULL DEFAULT '',
 day date NOT NULL,
 action text NOT NULL,
 source text NOT NULL DEFAULT 'app',
 after_deadline boolean NOT NULL DEFAULT false,
 operator_name text NOT NULL DEFAULT public.current_operator(),
 user_id uuid,
 before_data jsonb,
 after_data jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shift_history TO authenticated;
GRANT ALL ON public.shift_history TO service_role;
ALTER TABLE public.shift_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin shift history read" ON public.shift_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX shift_history_day ON public.shift_history(day, collaborator_id, created_at);
CREATE INDEX shift_history_entity ON public.shift_history(entity_type, entity_id, created_at);

CREATE FUNCTION public.shift_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Lo storico dei turni non si può modificare né cancellare'; END $$;
REVOKE ALL ON FUNCTION public.shift_history_immutable() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER shift_history_no_update BEFORE UPDATE OR DELETE ON public.shift_history FOR EACH ROW EXECUTE FUNCTION public.shift_history_immutable();
CREATE TRIGGER shift_history_no_truncate BEFORE TRUNCATE ON public.shift_history FOR EACH STATEMENT EXECUTE FUNCTION public.shift_history_immutable();

-- 2. Le disponibilità di una settimana (lun-dom) si chiudono alla fine del venerdì precedente, ora di Roma.
CREATE FUNCTION public.shift_availability_deadline(_day date) RETURNS timestamptz LANGUAGE sql STABLE AS $$
 SELECT (date_trunc('week', _day::timestamp) - interval '2 days') AT TIME ZONE 'Europe/Rome'
$$;

-- 3. Turni esistenti: copia nello storico, poi accettato -> pubblicato; i rifiutati restano solo nello storico.
INSERT INTO public.shift_history(entity_type, entity_id, collaborator_id, collaborator_name, day, action, source, operator_name, before_data)
SELECT 'turno', a.id, a.collaborator_id, c.first_name || ' ' || c.last_name, a.day, 'migrazione', 'sistema', '', to_jsonb(a)
FROM public.shift_assignments a JOIN public.shift_collaborators c ON c.id = a.collaborator_id;

DO $$ DECLARE c text; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.shift_assignments'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%accettato%' LOOP
  EXECUTE format('ALTER TABLE public.shift_assignments DROP CONSTRAINT %I', c);
 END LOOP;
END $$;
DELETE FROM public.shift_assignments WHERE status = 'rifiutato';
ALTER TABLE public.shift_assignments ADD COLUMN published_at timestamptz;
UPDATE public.shift_assignments SET status = 'pubblicato', published_at = updated_at WHERE status = 'accettato';
ALTER TABLE public.shift_assignments
 ALTER COLUMN status SET DEFAULT 'bozza',
 ADD CONSTRAINT shift_assignment_status_valid CHECK (status IN ('bozza','pubblicato','modificato'));

-- 4. Regole dei turni: nuovo = bozza, un pubblicato cambiato diventa modificato, niente sovrapposizioni con i turni notturni dei giorni vicini.
CREATE FUNCTION public.shift_assignment_validate() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s timestamptz; e timestamptz;
BEGIN
 s := (NEW.day + NEW.starts_at) AT TIME ZONE 'Europe/Rome';
 e := ((NEW.day + CASE WHEN NEW.ends_next_day THEN 1 ELSE 0 END) + NEW.ends_at) AT TIME ZONE 'Europe/Rome';
 IF EXISTS (
  SELECT 1 FROM public.shift_assignments o
  WHERE o.collaborator_id = NEW.collaborator_id AND o.id <> NEW.id AND o.day <> NEW.day AND o.day BETWEEN NEW.day - 1 AND NEW.day + 1
   AND (o.day + o.starts_at) AT TIME ZONE 'Europe/Rome' < e
   AND ((o.day + CASE WHEN o.ends_next_day THEN 1 ELSE 0 END) + o.ends_at) AT TIME ZONE 'Europe/Rome' > s
 ) THEN RAISE EXCEPTION 'Il turno si sovrappone a un altro turno dello stesso collaboratore'; END IF;
 IF TG_OP = 'INSERT' THEN
  NEW.status := 'bozza'; NEW.published_at := NULL;
 ELSIF OLD.status = 'pubblicato' AND NEW.status = 'pubblicato'
  AND (NEW.collaborator_id, NEW.day, NEW.starts_at, NEW.ends_at, NEW.ends_next_day, NEW.note) IS DISTINCT FROM (OLD.collaborator_id, OLD.day, OLD.starts_at, OLD.ends_at, OLD.ends_next_day, OLD.note) THEN
  NEW.status := 'modificato';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.shift_assignment_validate() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER shift_assignment_validate BEFORE INSERT OR UPDATE ON public.shift_assignments FOR EACH ROW EXECUTE FUNCTION public.shift_assignment_validate();

-- 5. Scrittura automatica dello storico per disponibilità e turni.
CREATE FUNCTION public.shift_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev jsonb; next_data jsonb; act text; person uuid; target date; who text;
 src text := coalesce(nullif(current_setting('mana.shift_source', true), ''), 'app');
BEGIN
 IF TG_OP = 'DELETE' THEN prev := to_jsonb(OLD); person := OLD.collaborator_id; target := OLD.day; act := 'eliminazione';
 ELSIF TG_OP = 'INSERT' THEN next_data := to_jsonb(NEW); person := NEW.collaborator_id; target := NEW.day; act := 'creazione';
 ELSE
  prev := to_jsonb(OLD); next_data := to_jsonb(NEW); person := NEW.collaborator_id; target := NEW.day;
  IF (prev - 'updated_at') = (next_data - 'updated_at') THEN RETURN NEW; END IF;
  act := CASE WHEN TG_TABLE_NAME = 'shift_assignments' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'pubblicato' THEN 'pubblicazione' ELSE 'modifica' END;
 END IF;
 SELECT first_name || ' ' || last_name INTO who FROM public.shift_collaborators WHERE id = person;
-- Eliminando un collaboratore la sua scheda è già sparita: si riprende il nome dallo storico.
 IF who IS NULL THEN
  SELECT collaborator_name INTO who FROM public.shift_history WHERE collaborator_id = person AND collaborator_name <> '' ORDER BY created_at DESC LIMIT 1;
 END IF;
 INSERT INTO public.shift_history(entity_type, entity_id, collaborator_id, collaborator_name, day, action, source, after_deadline, user_id, before_data, after_data)
 VALUES (CASE WHEN TG_TABLE_NAME = 'shift_availability' THEN 'disponibilita' ELSE 'turno' END,
  coalesce(next_data->>'id', prev->>'id')::uuid, person, coalesce(who, ''), target, act, src,
  TG_TABLE_NAME = 'shift_availability' AND now() >= public.shift_availability_deadline(target), auth.uid(), prev, next_data);
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.shift_audit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER shift_availability_audit AFTER INSERT OR UPDATE OR DELETE ON public.shift_availability FOR EACH ROW EXECUTE FUNCTION public.shift_audit();
CREATE TRIGGER shift_assignments_audit AFTER INSERT OR UPDATE OR DELETE ON public.shift_assignments FOR EACH ROW EXECUTE FUNCTION public.shift_audit();

-- 6. Pubblicazione: bozze e modificati del periodo diventano pubblicati, con data e ora.
CREATE FUNCTION public.publish_shifts(_from date, _to date) RETURNS SETOF public.shift_assignments LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Non autorizzato'; END IF;
 RETURN QUERY WITH published AS (
  UPDATE public.shift_assignments SET status = 'pubblicato', published_at = now(), updated_at = now()
  WHERE day BETWEEN _from AND _to AND status IN ('bozza','modificato') RETURNING *
 ) SELECT * FROM published;
END $$;
REVOKE ALL ON FUNCTION public.publish_shifts(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_shifts(date, date) TO authenticated;

-- 7. Foglio Google personale di ogni collaboratore.
ALTER TABLE public.shift_collaborators
 ADD COLUMN sheet_id text NOT NULL DEFAULT '' CHECK (sheet_id ~ '^[A-Za-z0-9_-]{0,200}$'),
 ADD COLUMN sheet_synced_at timestamptz;

-- 8. Importazione dal foglio: scrive solo le giornate cambiate e le segna come provenienti dal foglio nello storico.
CREATE FUNCTION public.apply_sheet_availability(_collaborator uuid, _rows jsonb) RETURNS integer LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r jsonb; changed integer := 0; k integer;
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Non autorizzato'; END IF;
 PERFORM set_config('mana.shift_source', 'foglio', true);
 FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
  IF coalesce(r->>'status', '') = '' THEN
   DELETE FROM public.shift_availability WHERE collaborator_id = _collaborator AND day = (r->>'day')::date;
  ELSE
   INSERT INTO public.shift_availability(collaborator_id, day, status, note)
   VALUES (_collaborator, (r->>'day')::date, r->>'status', coalesce(r->>'note', ''))
   ON CONFLICT (collaborator_id, day) DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, updated_at = now()
   WHERE (shift_availability.status, shift_availability.note) IS DISTINCT FROM (EXCLUDED.status, EXCLUDED.note);
  END IF;
  GET DIAGNOSTICS k = ROW_COUNT; changed := changed + k;
 END LOOP;
 UPDATE public.shift_collaborators SET sheet_synced_at = now() WHERE id = _collaborator;
 PERFORM set_config('mana.shift_source', '', true);
 RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.apply_sheet_availability(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sheet_availability(uuid, jsonb) TO authenticated;

-- 9. Registro delle sincronizzazioni e pubblicazioni.
CREATE TABLE public.shift_sync_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK (kind IN ('importazione','pubblicazione')),
 status text NOT NULL DEFAULT 'in_corso' CHECK (status IN ('in_corso','completata','con_errori','fallita')),
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 summary jsonb NOT NULL DEFAULT '{}'::jsonb,
 error text NOT NULL DEFAULT '' CHECK (length(error) <= 4000),
 user_id uuid DEFAULT auth.uid(),
 operator_name text NOT NULL DEFAULT public.current_operator()
);
GRANT SELECT, INSERT, UPDATE ON public.shift_sync_runs TO authenticated;
GRANT ALL ON public.shift_sync_runs TO service_role;
ALTER TABLE public.shift_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin shift sync runs" ON public.shift_sync_runs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX shift_sync_runs_started ON public.shift_sync_runs(started_at DESC);

-- 10. Il link personale registra le sue modifiche come tali.
CREATE OR REPLACE FUNCTION public.save_personal_shift(_hash text, _day date, _status text, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
 SELECT c.id INTO cid FROM public.shift_collaborators c JOIN public.shift_link_keys k ON k.collaborator_id=c.id WHERE k.token_hash=_hash AND c.active FOR SHARE OF c,k;
 IF cid IS NULL THEN RAISE EXCEPTION 'Link non valido o disattivato'; END IF;
 PERFORM set_config('mana.shift_source', 'link', true);
 IF _status IS NULL THEN
  DELETE FROM public.shift_availability WHERE collaborator_id=cid AND day=_day;
 ELSE
  INSERT INTO public.shift_availability(collaborator_id,day,status,note) VALUES(cid,_day,_status,_note) ON CONFLICT(collaborator_id,day) DO UPDATE SET status=EXCLUDED.status,note=EXCLUDED.note,updated_at=now();
 END IF;
 PERFORM set_config('mana.shift_source', '', true);
END;
$$;