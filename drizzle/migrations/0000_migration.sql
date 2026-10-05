create type public.event_status as enum ('programmato','in_preparazione','concluso');
create type public.booking_status as enum ('da_preparare','pronta','consegnata','annullata');
create type public.payment_status as enum ('non_pagato','pagato');
create type public.movement_type as enum ('ricarica','acquisto','correzione');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  created_at timestamptz not null default now()
);
create unique index clients_unique_name on public.clients (lower(trim(first_name)), lower(trim(last_name)));

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  location text not null default '',
  notes text not null default '',
  status public.event_status not null default 'programmato',
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  category text not null default '',
  sku text,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  status public.booking_status not null default 'da_preparare',
  payment_status public.payment_status not null default 'non_pagato',
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index on public.bookings(client_id);
create index on public.bookings(event_id);

create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0)
);
create index on public.booking_items(booking_id);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  amount numeric(10,2) not null check (amount > 0),
  purchase_date date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index on public.purchases(client_id);

create table public.balance_movements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  type public.movement_type not null,
  description text not null default '',
  amount numeric(10,2) not null,
  balance_before numeric(10,2) not null,
  balance_after numeric(10,2) not null check (balance_after >= 0),
  purchase_id uuid references public.purchases(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.balance_movements(client_id, created_at);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  category text not null default 'Altro',
  label text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.checklist_items(event_id);

-- grants
grant select, insert, update, delete on public.clients, public.events, public.products, public.bookings, public.booking_items, public.checklist_items to authenticated;
grant select on public.purchases, public.balance_movements to authenticated;
grant all on public.clients, public.events, public.products, public.bookings, public.booking_items, public.checklist_items, public.purchases, public.balance_movements to service_role;

alter table public.clients enable row level security;
alter table public.events enable row level security;
alter table public.products enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.checklist_items enable row level security;
alter table public.purchases enable row level security;
alter table public.balance_movements enable row level security;

create policy "staff all" on public.clients for all to authenticated using (true) with check (true);
create policy "staff all" on public.events for all to authenticated using (true) with check (true);
create policy "staff all" on public.products for all to authenticated using (true) with check (true);
create policy "staff all" on public.bookings for all to authenticated using (true) with check (true);
create policy "staff all" on public.booking_items for all to authenticated using (true) with check (true);
create policy "staff all" on public.checklist_items for all to authenticated using (true) with check (true);
create policy "staff read" on public.purchases for select to authenticated using (true);
create policy "staff read" on public.balance_movements for select to authenticated using (true);

-- balance helpers
create or replace function public.client_balance(_client uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select balance_after from public.balance_movements where client_id = _client order by created_at desc, id desc limit 1), 0)
$$;

create or replace function public.add_balance_movement(_client uuid, _type public.movement_type, _amount numeric, _description text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _before numeric; _id uuid;
begin
  if auth.uid() is null then raise exception 'Non autorizzato'; end if;
  if _type = 'acquisto' then raise exception 'Usa register_purchase per gli acquisti'; end if;
  if _type = 'ricarica' and _amount <= 0 then raise exception 'La ricarica deve essere positiva'; end if;
  if _amount = 0 then raise exception 'Importo non valido'; end if;
  perform pg_advisory_xact_lock(hashtext(_client::text));
  _before := public.client_balance(_client);
  if _before + _amount < 0 then raise exception 'Il saldo non può diventare negativo'; end if;
  insert into public.balance_movements(client_id, type, description, amount, balance_before, balance_after)
  values (_client, _type, coalesce(_description,''), _amount, _before, _before + _amount) returning id into _id;
  return _id;
end $$;

create or replace function public.register_purchase(_client uuid, _product uuid, _product_name text, _quantity int, _amount numeric, _date date, _notes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _before numeric; _pid uuid;
begin
  if auth.uid() is null then raise exception 'Non autorizzato'; end if;
  if _amount <= 0 then raise exception 'Importo non valido'; end if;
  perform pg_advisory_xact_lock(hashtext(_client::text));
  _before := public.client_balance(_client);
  if _amount > _before then raise exception 'Saldo insufficiente (disponibile € %)', _before; end if;
  insert into public.purchases(client_id, product_id, product_name, quantity, amount, purchase_date, notes)
  values (_client, _product, _product_name, _quantity, _amount, coalesce(_date, current_date), coalesce(_notes,'')) returning id into _pid;
  insert into public.balance_movements(client_id, type, description, amount, balance_before, balance_after, purchase_id)
  values (_client, 'acquisto', _quantity || ' × ' || _product_name, -_amount, _before, _before - _amount, _pid);
  return _pid;
end $$;

revoke execute on function public.add_balance_movement(uuid, public.movement_type, numeric, text) from public, anon;
revoke execute on function public.register_purchase(uuid, uuid, text, int, numeric, date, text) from public, anon;
revoke execute on function public.client_balance(uuid) from public, anon;
grant execute on function public.add_balance_movement(uuid, public.movement_type, numeric, text) to authenticated;
grant execute on function public.register_purchase(uuid, uuid, text, int, numeric, date, text) to authenticated;
grant execute on function public.client_balance(uuid) to authenticated;