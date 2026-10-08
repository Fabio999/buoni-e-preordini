CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE lower(email) = 'info@manaflask.it' ON CONFLICT DO NOTHING;

CREATE TABLE public.operator_sessions (
  user_id uuid PRIMARY KEY,
  operator_name text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_sessions TO authenticated;
GRANT ALL ON public.operator_sessions TO service_role;
ALTER TABLE public.operator_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own session" ON public.operator_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.current_operator()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT operator_name FROM public.operator_sessions WHERE user_id = auth.uid()), '')
$$;

ALTER TABLE public.bookings ADD COLUMN operator_name text NOT NULL DEFAULT public.current_operator();
ALTER TABLE public.balance_movements ADD COLUMN operator_name text NOT NULL DEFAULT public.current_operator();
ALTER TABLE public.purchases ADD COLUMN operator_name text NOT NULL DEFAULT public.current_operator();
ALTER TABLE public.stock_movements ADD COLUMN operator_name text NOT NULL DEFAULT public.current_operator();