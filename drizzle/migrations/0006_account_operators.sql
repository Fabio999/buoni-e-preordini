CREATE TABLE public.account_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_operators TO authenticated;
GRANT ALL ON public.account_operators TO service_role;
ALTER TABLE public.account_operators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or admin" ON public.account_operators FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin insert" ON public.account_operators FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update" ON public.account_operators FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete" ON public.account_operators FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));