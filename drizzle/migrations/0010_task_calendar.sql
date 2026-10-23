CREATE TABLE public.company_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text NOT NULL DEFAULT '', starts_at timestamptz, due_at timestamptz, priority text NOT NULL DEFAULT 'normale' CHECK (priority IN ('bassa','normale','alta','urgente')), mandatory boolean NOT NULL DEFAULT false, responsible text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'da_fare' CHECK (status IN ('da_fare','in_corso','completata')), archived boolean NOT NULL DEFAULT false, claimed_by text NOT NULL DEFAULT '', claimed_at timestamptz, started_by text NOT NULL DEFAULT '', started_at timestamptz, completed_by text NOT NULL DEFAULT '', completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_tasks TO authenticated;
GRANT ALL ON public.company_tasks TO service_role;
ALTER TABLE public.company_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff tasks" ON public.company_tasks FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TABLE public.calendar_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text NOT NULL DEFAULT '', starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, timezone text NOT NULL DEFAULT 'Europe/Rome', alternatives jsonb NOT NULL DEFAULT '[]', responsible_names text[] NOT NULL DEFAULT '{}', task_id uuid REFERENCES public.company_tasks(id) ON DELETE SET NULL, confirmed boolean NOT NULL DEFAULT false, archived boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_entries TO authenticated;
GRANT ALL ON public.calendar_entries TO service_role;
ALTER TABLE public.calendar_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff calendar" ON public.calendar_entries FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TABLE public.planning_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text NOT NULL, entity_id uuid NOT NULL, action text NOT NULL, operator_name text NOT NULL DEFAULT public.current_operator(), user_id uuid, before_data jsonb, after_data jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.planning_history TO authenticated;
GRANT ALL ON public.planning_history TO service_role;
ALTER TABLE public.planning_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff history read" ON public.planning_history FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX planning_history_entity ON public.planning_history(entity_type,entity_id,created_at);
CREATE INDEX company_tasks_due ON public.company_tasks(due_at);
CREATE INDEX calendar_entries_start ON public.calendar_entries(starts_at);
CREATE FUNCTION public.planning_validate() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a jsonb; actor text := public.current_operator();
BEGIN
 IF length(trim(NEW.title)) = 0 THEN RAISE EXCEPTION 'Inserisci un titolo'; END IF;
 NEW.updated_at := now();
 IF TG_TABLE_NAME = 'company_tasks' THEN
  IF NEW.starts_at IS NOT NULL AND NEW.due_at IS NOT NULL AND NEW.due_at < NEW.starts_at THEN RAISE EXCEPTION 'La scadenza precede la data di inizio'; END IF;
  IF TG_OP = 'INSERT' THEN
   NEW.claimed_by := ''; NEW.claimed_at := NULL; NEW.started_by := ''; NEW.started_at := NULL; NEW.completed_by := ''; NEW.completed_at := NULL;
   IF NEW.responsible <> '' THEN NEW.claimed_by := actor; NEW.claimed_at := now(); END IF;
   IF NEW.status = 'in_corso' THEN NEW.started_by := actor; NEW.started_at := now(); END IF;
   IF NEW.status = 'completata' THEN NEW.completed_by := actor; NEW.completed_at := now(); END IF;
  ELSE
   NEW.claimed_by := OLD.claimed_by; NEW.claimed_at := OLD.claimed_at; NEW.started_by := OLD.started_by; NEW.started_at := OLD.started_at; NEW.completed_by := OLD.completed_by; NEW.completed_at := OLD.completed_at;
   IF NEW.responsible IS DISTINCT FROM OLD.responsible AND NEW.responsible <> '' THEN NEW.claimed_by := actor; NEW.claimed_at := now(); END IF;
   IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'in_corso' THEN NEW.started_by := actor; NEW.started_at := now(); END IF;
    IF NEW.status = 'completata' THEN NEW.completed_by := actor; NEW.completed_at := now(); END IF;
   END IF;
  END IF;
 ELSE
  IF NEW.ends_at <= NEW.starts_at THEN RAISE EXCEPTION 'La fine deve essere successiva all’inizio'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN RAISE EXCEPTION 'Fuso orario non valido'; END IF;
  IF jsonb_typeof(NEW.alternatives) <> 'array' THEN RAISE EXCEPTION 'Date alternative non valide'; END IF;
  FOR a IN SELECT value FROM jsonb_array_elements(NEW.alternatives) LOOP
   IF a->>'starts_at' IS NULL OR a->>'ends_at' IS NULL OR (a->>'ends_at')::timestamptz <= (a->>'starts_at')::timestamptz THEN RAISE EXCEPTION 'Controlla inizio e fine delle date alternative'; END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.planning_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE act text; entity uuid; prev jsonb; next_data jsonb;
BEGIN
 IF TG_OP = 'DELETE' THEN entity := OLD.id; prev := to_jsonb(OLD); act := 'eliminazione';
 ELSIF TG_OP = 'INSERT' THEN entity := NEW.id; next_data := to_jsonb(NEW); act := 'creazione';
 ELSE
  entity := NEW.id; prev := to_jsonb(OLD); next_data := to_jsonb(NEW);
  IF (prev - 'updated_at') = (next_data - 'updated_at') THEN RETURN NEW; END IF;
  act := 'modifica';
  IF OLD.archived IS DISTINCT FROM NEW.archived THEN act := CASE WHEN NEW.archived THEN 'archiviazione' ELSE 'ripristino' END;
  ELSIF TG_TABLE_NAME = 'company_tasks' AND prev->>'status' IS DISTINCT FROM next_data->>'status' THEN act := 'cambio_stato'; END IF;
 END IF;
 INSERT INTO public.planning_history(entity_type,entity_id,action,user_id,before_data,after_data) VALUES (CASE WHEN TG_TABLE_NAME = 'company_tasks' THEN 'task' ELSE 'evento' END,entity,act,auth.uid(),prev,next_data);
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.planning_validate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_audit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER tasks_validate BEFORE INSERT OR UPDATE ON public.company_tasks FOR EACH ROW EXECUTE FUNCTION public.planning_validate();
CREATE TRIGGER calendar_validate BEFORE INSERT OR UPDATE ON public.calendar_entries FOR EACH ROW EXECUTE FUNCTION public.planning_validate();
CREATE TRIGGER tasks_audit AFTER INSERT OR UPDATE OR DELETE ON public.company_tasks FOR EACH ROW EXECUTE FUNCTION public.planning_audit();
CREATE TRIGGER calendar_audit AFTER INSERT OR UPDATE OR DELETE ON public.calendar_entries FOR EACH ROW EXECUTE FUNCTION public.planning_audit();