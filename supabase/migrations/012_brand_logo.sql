-- Adds a per-brand logo, shown next to the brand's name on the customer's
-- Home Page. Purely additive: a new nullable column (existing brands get
-- logo_url = null, no different from how they render today) and a new
-- private storage bucket - nothing here touches an existing row or file.
begin;

alter table brands add column if not exists logo_url text;

-- Private storage bucket for brand logos - same signed-URL treatment as
-- captures and menu item reference photos.
insert into storage.buckets (id, name, public)
values ('brand-logos', 'brand-logos', false)
on conflict (id) do update set public = false;

commit;
