alter table if exists place_categories
  add column if not exists parent_id integer references place_categories(id) on delete set null;

create index if not exists place_categories_parent_id_idx
  on place_categories (parent_id);

update place_categories as child
set parent_id = matched_parent.id,
    updated_at = now()
from lateral (
  select parent.id
  from place_categories as parent
  where parent.id <> child.id
    and child.slug like parent.slug || '-%'
  order by length(parent.slug) desc, parent.id asc
  limit 1
) as matched_parent
where child.parent_id is null
  and matched_parent.id is not null;
