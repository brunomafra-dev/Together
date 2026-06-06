# Together Production Readiness Gaps

## Completed in this pass

- Added Supabase schema for `goals`, `goal_plan_items`, `goal_progress_rows`, and `financial_commitments`.
- Added service functions for goals and financial commitments.
- Updated Goals screen to read from Supabase when data exists.
- Updated Installments screen to read real financial commitments when data exists.
- Kept local fallback behavior for empty databases.

## Remaining gaps

- Goals CRUD UI is still read-first and needs dedicated add/edit/delete controls.
- Goal plan items and goal progress rows are not editable from the UI yet.
- Financial commitments currently load from Supabase, but create/edit/delete UI is still placeholder-only.
- Migration file must be executed in Supabase before production data will appear.
- You should review and seed at least one goal and one commitment per household for a good first-run experience.
- Some screens still contain fallback content that should be removed once the database is fully seeded.

## Recommended next steps

1. Add a goal editor modal.
2. Add a commitment editor modal tied to `financial_commitments`.
3. Seed starter goals and commitments for each household.
4. Remove fallback content once the database is populated.
