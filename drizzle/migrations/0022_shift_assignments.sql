CREATE TABLE public.shift_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 collaborator_id uuid NOT NULL REFERENCES public.shift_collaborators(id) ON DELETE CASCADE,
 day date NOT NULL,
 status text NOT NULL CHECK (status IN ('accettato','rifiutato')),
 starts_at time NOT NULL,
 ends_at time NOT NULL,
 ends_next_day boolean NOT NULL DEFAULT false,
 note text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(collaborator_id,day),
 CHECK (ends_next_day OR ends_at > starts_at),
 CHECK (length(note) <= 1000)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_assignments TO authenticated;
GRANT ALL ON public.shift_assignments TO service_role;
ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin shift assignments" ON public.shift_assignments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER shift_assignments_refresh AFTER INSERT OR UPDATE OR DELETE ON public.shift_assignments FOR EACH ROW EXECUTE FUNCTION public.shift_refresh_broadcast();
CREATE OR REPLACE FUNCTION public.shift_refresh_broadcast()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE topic text;
BEGIN
 IF TG_TABLE_NAME IN ('shift_availability', 'shift_assignments') THEN
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
$function$;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_assignments;