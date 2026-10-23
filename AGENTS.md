<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Task reminders run in the signed-in operator shell against cached tasks; local acknowledgements are scoped by account/operator/task/deadline/phase, with no scheduled server requests.
- Company planning uses separate task/calendar tables and immutable trigger-written audit rows; all transitions are attributed by the database operator session, and date alternatives are retained when confirming a final date.
- Planning timestamps are stored as UTC instants, edited via explicit IANA zones with date-fns-tz, and shown in Europe/Rome in the shared calendar to keep cross-zone scheduling consistent.
- Shop balance is a ledger: only change it via DB functions (`add_balance_movement`, `register_purchase`, `update_balance_movement`, `delete_balance_movement`, which recompute later balances); never write balances directly (keeps history consistent, prevents negatives).
- Data is read/written from the browser client with RLS (any signed-in staff user has full access); the root route renders the login screen until a session exists, so no route loaders fetch data.
- Booking totals are derived from booking_items (quantity × unit_price), never stored, to avoid duplication.
- Shared data hooks live in src/lib/data.ts; mutations call `useRefresh()` to invalidate all queries for simplicity.
- Uploaded company logos are referenced through CDN asset pointers; the favicon is a small local raster derived from the same brand asset to support browser icon loading.
- All editable client selectors use the shared ClientSelect with inline creation and automatic selection, keeping booking and balance workflows consistent.
- Editable event and product selectors use shared controls with inline creation; creation dialogs refresh queries before selecting saved entities and stop nested submit propagation to preserve parent drafts.
- Text search in lists goes through the shared matcher in src/lib/search.ts (case- and accent-insensitive, every word of the query must match, reversed name order accepted) so every section searches the same way.
- Product stock is adjusted only by DB triggers on booking_items and purchases (keeps quantities consistent with edits/deletes).
- Stock changes are logged to stock_movements by triggers (log_stock for bookings/purchases, products trigger for manual edits); the table is read-only for the app.
- Admin = `admin` row in user_roles checked with has_role; account management goes through server functions in src/lib/admin.functions.ts that verify the role before using the admin client (keeps passwords/users server-side).
- The working operator's name is stored per signed-in user in operator_sessions and stamped by the `operator_name` column default (current_operator()) on bookings, purchases, balance and stock movements, so no RPC needs an extra parameter.
- Buoni offline: ricariche/acquisti salvati sul dispositivo e inviati al ritorno della rete (src/lib/offline.tsx); dati letti raramente (staleTime 5 min, niente polling) per ridurre l'uso del backend.
- Vendite con sconto buono passano dal RPC `register_sale` (un’unica conferma registra vendita + movimento buono; il buono usato è limitato a totale e saldo, mai negativo); il calcolo lato app usa `saleSplit` in src/lib/data.ts.
- Data access requires staff membership (`staff_members` row or admin role, checked by `is_staff()` in RLS and RPCs); accounts are created only from Amministrazione, which adds the membership, so self-signups see nothing.
