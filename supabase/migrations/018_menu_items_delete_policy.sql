-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- against your existing project. Safe to run more than once.
--
-- menu_items had select/insert/update policies but no delete policy - there
-- was no delete-a-menu-item feature yet. Adding one (deleteMenuItemAction)
-- needs this first, or the delete would silently affect zero rows (RLS
-- defaults to deny, not an error) instead of actually removing anything.

drop policy if exists "menu_items_delete" on menu_items;
create policy "menu_items_delete" on menu_items for delete using (
  (select role from current_profile()) = 'super_admin'
);
