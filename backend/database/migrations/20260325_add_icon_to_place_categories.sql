-- Add icon support for place categories used in admin map management.
-- Safe to run multiple times.

alter table if exists place_categories
  add column if not exists icon varchar(16);

update place_categories
set icon = case slug
  when 'restaurant' then '🍽️'
  when 'cafe' then '☕'
  when 'street-food' then '🍜'
  when 'bakery' then '🥐'
  when 'bar' then '🍸'
  when 'dessert' then '🍰'
  when 'local-market' then '🛍️'
  when 'other' then '📍'
  else '📍'
end
where icon is null or btrim(icon) = '';
