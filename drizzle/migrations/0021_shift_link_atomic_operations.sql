CREATE OR REPLACE FUNCTION public.create_shift_collaborator(_first text, _last text, _hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
 INSERT INTO public.shift_collaborators(first_name,last_name) VALUES (_first,_last) RETURNING id INTO new_id;
 INSERT INTO public.shift_link_keys(collaborator_id,token_hash) VALUES(new_id,_hash);
 RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_shift_collaborator(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_shift_collaborator(text,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.rotate_shift_link(_id uuid, _hash text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 UPDATE public.shift_collaborators SET realtime_topic = encode(gen_random_bytes(32),'hex') WHERE id = _id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Collaboratore non trovato'; END IF;
 INSERT INTO public.shift_link_keys(collaborator_id,token_hash) VALUES(_id,_hash) ON CONFLICT(collaborator_id) DO UPDATE SET token_hash=EXCLUDED.token_hash, created_at=now();
END;
$$;
REVOKE ALL ON FUNCTION public.rotate_shift_link(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_shift_link(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.save_personal_shift(_hash text, _day date, _status text, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
 SELECT c.id INTO cid FROM public.shift_collaborators c JOIN public.shift_link_keys k ON k.collaborator_id=c.id WHERE k.token_hash=_hash AND c.active FOR SHARE OF c,k;
 IF cid IS NULL THEN RAISE EXCEPTION 'Link non valido o disattivato'; END IF;
 IF _status IS NULL THEN
  DELETE FROM public.shift_availability WHERE collaborator_id=cid AND day=_day;
 ELSE
  INSERT INTO public.shift_availability(collaborator_id,day,status,note) VALUES(cid,_day,_status,_note) ON CONFLICT(collaborator_id,day) DO UPDATE SET status=EXCLUDED.status,note=EXCLUDED.note,updated_at=now();
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.save_personal_shift(text,date,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_personal_shift(text,date,text,text) TO service_role;