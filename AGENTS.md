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
- Shop balance is a ledger: only change it via the `add_balance_movement` / `register_purchase` DB functions; never write balances directly (keeps full history and prevents overspending).
- Data is read/written from the browser client with RLS (any signed-in staff user has full access); the root route renders the login screen until a session exists, so no route loaders fetch data.
- Booking totals are derived from booking_items (quantity × unit_price), never stored, to avoid duplication.
- Shared data hooks live in src/lib/data.ts; mutations call `useRefresh()` to invalidate all queries for simplicity.
- Uploaded company logos are referenced through CDN asset pointers; the favicon is a small local raster derived from the same brand asset to support browser icon loading.
- All editable client selectors use the shared ClientSelect with inline creation and automatic selection, keeping booking and balance workflows consistent.
- Editable event and product selectors use shared controls with inline creation; creation dialogs refresh queries before selecting saved entities and stop nested submit propagation to preserve parent drafts.
- Text search in lists goes through the shared matcher in src/lib/search.ts (case- and accent-insensitive, every word of the query must match, reversed name order accepted) so every section searches the same way.
