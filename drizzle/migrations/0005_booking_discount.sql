ALTER TABLE public.bookings ADD COLUMN discount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_discount_nonneg CHECK (discount >= 0);