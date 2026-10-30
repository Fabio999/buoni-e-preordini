CREATE TABLE public.shift_collaborators (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 first_name text NOT NULL,
 last_name text NOT NULL,
 active boolean NOT NULL DEFAULT true,
 realtime_topic text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT shift_names_length CHECK (length(first_name) BETWEEN 1 AND 80 AND length(last_name) BETWEEN 1 AND 80)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_collaborators TO authenticated;
GRANT ALL ON public.shift_collaborators TO service_role;
ALTER TABLE public.shift_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin shift collaborators" ON public.shift_collaborators FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.shift_link_keys (
 collaborator_id uuid PRIMARY KEY REFERENCES public.shift_collaborators(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.shift_link_keys TO service_role;
ALTER TABLE public.shift_link_keys ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.shift_availability (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 collaborator_id uuid NOT NULL REFERENCES public.shift_collaborators(id) ON DELETE CASCADE,
 day date NOT NULL,
 status text NOT NULL,
 note text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (collaborator_id, day),
 CONSTRAINT shift_status_valid CHECK (status IN ('disponibile','assente','meglio_di_no')),
 CONSTRAINT shift_note_length CHECK (length(note) <= 1000)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_availability TO authenticated;
GRANT ALL ON public.shift_availability TO service_role;
ALTER TABLE public.shift_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin shift availability" ON public.shift_availability FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE OR REPLACE FUNCTION public.shift_refresh_broadcast() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE topic text;
BEGIN
 IF TG_TABLE_NAME = 'shift_availability' THEN
  SELECT realtime_topic INTO topic FROM public.shift_collaborators WHERE id = COALESCE(NEW.collaborator_id, OLD.collaborator_id);
 ELSE
  topic := OLD.realtime_topic;
 END IF;
 IF topic IS NOT NULL THEN
  PERFORM realtime.send('{}'::jsonb, 'refresh', 'shift:' || topic, false);
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.shift_refresh_broadcast() FROM PUBLIC;
CREATE TRIGGER shift_availability_refresh AFTER INSERT OR UPDATE OR DELETE ON public.shift_availability FOR EACH ROW EXECUTE FUNCTION public.shift_refresh_broadcast();
CREATE TRIGGER shift_collaborator_refresh AFTER UPDATE OR DELETE ON public.shift_collaborators FOR EACH ROW EXECUTE FUNCTION public.shift_refresh_broadcast();
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_availability;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_collaborators;