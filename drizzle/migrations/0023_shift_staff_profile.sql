ALTER TABLE public.shift_collaborators
  ADD COLUMN staff_role text NOT NULL DEFAULT '' CHECK (char_length(staff_role) <= 80),
  ADD COLUMN contact_email text NOT NULL DEFAULT '' CHECK (char_length(contact_email) <= 254),
  ADD COLUMN staff_notes text NOT NULL DEFAULT '' CHECK (char_length(staff_notes) <= 2000);