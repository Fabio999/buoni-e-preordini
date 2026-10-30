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
- Shared browser data hooks use RLS-protected staff access and useRefresh() after mutations; the root login gate prevents signed-out reads, so content routes have no data loaders. Accounts are created by admin functions after server-side role verification; roles stay in user_roles, memberships in staff_members.
- Dashboard owns its panels and excludes voucher data. Task and Calendar have separate routes sharing PlanningPage: task queues contain no event lists and calendars contain no tasks.
- Calendar details use the shared labeled-description parser/formatter, preserving legacy notes and alternatives. Timestamps are UTC instants, edited in explicit IANA zones and displayed in Europe/Rome through DateTimeField's 24-hour selects.
- Recurrences are finite atomic inserts with individually editable occurrences. Wall-date shifts retain local times across DST; weekly dates align to the chosen weekday. Editing defaults to one occurrence, optionally reschedules following cached members, and propagates color to following members in one batch upsert. All EVENT_COLORS must satisfy database constraints.
- Calendar-dialog deletion delegates to PlanningPage's existing single-entry confirmation/delete, preserving other occurrences, audit history and shared refresh behavior.
- Calendar filters compare Europe/Rome start times. Eventi derives chronological upcoming and archived calendar lists without database writes; booking events remain separate. EventDot-only recurring buttons expose hover details and click editing.
- Event and task reminders use cached rows and account/operator-scoped local acknowledgements, without backend polling; white event popups queue after task reminders. Task responsible text uses deduplicated newline-separated names through task-people.
- Company planning uses separate task/calendar tables with immutable trigger-written audit rows, attributed through the database operator session. Confirming dates preserves alternatives.
- Tasks have dedicated category/game/location columns. Workflow stages and completed-prefix position are independent of manually editable checklist JSON; shared helpers preserve status transitions and defensively parse legacy checklist data.
- Task category/game inline creation persists locally per account and merges cached values; games share the event vocabulary without additional requests. Event game suggestions merge cached event/product games with local account memory.
- Task AI is explicit-only through authenticated staff-checked functions: title/description drafts, bounded output, no retries, exact-description templates and account-scoped similarity reuse.
- Shop balances change only through ledger RPCs (add_balance_movement, register_purchase, update_balance_movement, delete_balance_movement), which recompute later balances and prevent negatives. register_sale atomically records a sale and voucher deduction bounded by total and balance; saleSplit supplies the browser calculation.
- Voucher operations are queued locally in src/lib/offline.tsx and sent when online; cached reads have five-minute staleTime and no polling. Booking totals derive from booking_items quantity × unit_price, not duplicated stored totals.
- Product stock is changed only by booking_items/purchases triggers; stock_movements is app-read-only and records triggered booking/purchase/manual-product changes.
- ClientSelect and shared event/product selectors support inline creation, refresh before selecting saved entities and stop nested submit propagation to preserve drafts.
- Client/voucher/movement views share /clienti through the tab search parameter; BalancePanel owns voucher statistics and active balances, and /saldo redirects to /clienti?tab=buoni. Client last activity derives from cached creation, movement and booking dates.
- All list text search uses src/lib/search.ts for accent/case-insensitive all-word matching and reversed names. Admin client CSV exports use cached data via src/lib/csv.ts, Italian Excel formatting and exclude cancelled bookings.
- Account management stays server-side in src/lib/admin.functions.ts with verified admin role before privileged access. operator_sessions scopes working names per user; current_operator() defaults stamp movements, bookings and stock without RPC parameters.
- Uploaded logos use CDN pointers; the local raster favicon derives from the same official asset.
- AccessLayout shares the credential and operator screens; operator previews show names only after authentication and do not change operator-session persistence.
- Shift calendars use admin-only RLS; personal access bypasses only the root gate at /disponibilita and verifies a hashed fragment capability via POST before scoped access. Revocable links and secret data-free broadcast topics avoid signup, expose no rows and refresh without polling; privileged link/write RPCs are service-only.
