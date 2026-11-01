CREATE OR REPLACE FUNCTION public.task_deadline_personal_refresh() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE topic text;
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.title IS NOT DISTINCT FROM OLD.title AND NEW.responsible IS NOT DISTINCT FROM OLD.responsible AND NEW.due_at IS NOT DISTINCT FROM OLD.due_at AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.archived IS NOT DISTINCT FROM OLD.archived THEN RETURN NEW; END IF;
 FOR topic IN SELECT realtime_topic FROM public.shift_collaborators WHERE active = true LOOP
  PERFORM realtime.send('{}'::jsonb, 'refresh', 'shift:' || topic, false);
 END LOOP;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.task_deadline_personal_refresh() FROM PUBLIC;
CREATE TRIGGER task_deadline_personal_refresh AFTER INSERT OR UPDATE OR DELETE ON public.company_tasks FOR EACH ROW EXECUTE FUNCTION public.task_deadline_personal_refresh();