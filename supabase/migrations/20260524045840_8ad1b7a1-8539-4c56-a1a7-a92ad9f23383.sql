insert into storage.buckets (id, name, public) values ('category-icons', 'category-icons', true) on conflict (id) do nothing;

create policy "Category icons publicly readable"
on storage.objects for select
using (bucket_id = 'category-icons');

create policy "Authenticated can upload category icons"
on storage.objects for insert to authenticated
with check (bucket_id = 'category-icons');

create policy "Authenticated can update category icons"
on storage.objects for update to authenticated
using (bucket_id = 'category-icons');

create policy "Authenticated can delete category icons"
on storage.objects for delete to authenticated
using (bucket_id = 'category-icons');