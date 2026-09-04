-- Purpose: classify existing verification people for the public Directory without duplicating names or designations.
-- Security: RLS on verification_records stays authoritative; public callers receive only explicitly published display fields.

alter table public.verification_records
  add column if not exists directory_section text,
  add column if not exists directory_subcategory text,
  add column if not exists directory_photo_url text,
  add column if not exists directory_sort_order integer not null default 0,
  add column if not exists directory_is_published boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'verification_records_directory_section_check' and conrelid = 'public.verification_records'::regclass) then
    alter table public.verification_records add constraint verification_records_directory_section_check
      check (directory_section is null or directory_section in ('officials', 'staff', 'functionaries'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'verification_records_directory_subcategory_check' and conrelid = 'public.verification_records'::regclass) then
    alter table public.verification_records add constraint verification_records_directory_subcategory_check
      check (directory_subcategory is null or (length(btrim(directory_subcategory)) between 1 and 80 and directory_subcategory !~ '[[:cntrl:]]'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'verification_records_directory_photo_url_check' and conrelid = 'public.verification_records'::regclass) then
    alter table public.verification_records add constraint verification_records_directory_photo_url_check
      check (directory_photo_url is null or (length(directory_photo_url) <= 2000 and directory_photo_url ~ '^https://'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'verification_records_directory_sort_order_check' and conrelid = 'public.verification_records'::regclass) then
    alter table public.verification_records add constraint verification_records_directory_sort_order_check check (directory_sort_order >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'verification_records_directory_assignment_check' and conrelid = 'public.verification_records'::regclass) then
    alter table public.verification_records add constraint verification_records_directory_assignment_check check (
      (directory_section is null and directory_subcategory is null and directory_is_published = false)
      or directory_section = 'officials'
      or (directory_section in ('staff', 'functionaries') and directory_subcategory is not null)
    );
  end if;
end $$;

comment on column public.verification_records.directory_section is 'Public Directory section; null keeps the person unlisted.';
comment on column public.verification_records.directory_subcategory is 'Barangay-owned Staff or Functionary group heading.';
comment on column public.verification_records.directory_is_published is 'Explicit opt-in for public Directory display.';

create index if not exists verification_records_public_directory_idx
  on public.verification_records (directory_section, directory_subcategory, directory_sort_order, id)
  where directory_is_published = true and status = 'ACTIVE';

-- Active staff receive only public-safe identity fields, never ID numbers, QR tokens, or dates.
create or replace function public.staff_list_directory_records(
  p_section text, p_view text default 'section', p_search text default '',
  p_offset integer default 0, p_limit integer default 20
)
returns table (
  id bigint, name text, designation text, directory_section text,
  directory_subcategory text, directory_photo_url text, directory_sort_order integer,
  directory_is_published boolean, directory_is_eligible boolean, total_count bigint
)
language plpgsql stable security definer set search_path = public, private, pg_temp
as $$
begin
  if not private.current_user_has_role(array['admin'::public.app_role, 'editor'::public.app_role]) then
    raise exception 'Active staff access required.' using errcode = '42501';
  end if;
  if p_section is null or p_section not in ('officials', 'staff', 'functionaries')
     or p_view is null or p_view not in ('section', 'unassigned', 'all', 'published', 'hidden')
     or p_search is null or length(p_search) > 100
     or p_offset is null or p_offset < 0 or p_offset > 10000
     or p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid Directory list options.' using errcode = '22023';
  end if;
  return query
    select r.id,
      coalesce(nullif(btrim(concat_ws(' ', nullif(btrim(r.first_name), ''), nullif(btrim(r.middle_name), ''), nullif(btrim(r.last_name), ''))), ''), 'Name not recorded'),
      nullif(btrim(r.designation), ''), r.directory_section, r.directory_subcategory,
      r.directory_photo_url, r.directory_sort_order, r.directory_is_published,
      r.status = 'ACTIVE', count(*) over()
    from public.verification_records r
    where (p_view = 'all'
      or (p_view = 'unassigned' and r.directory_section is null)
      or (p_view in ('section', 'published', 'hidden') and r.directory_section = p_section))
      and (p_view <> 'published' or r.directory_is_published = true)
      and (p_view <> 'hidden' or r.directory_is_published = false)
      and (p_search = ''
        or concat_ws(' ', r.first_name, r.middle_name, r.last_name) ilike '%' || p_search || '%'
        or coalesce(r.designation, '') ilike '%' || p_search || '%')
    order by r.directory_section nulls first, r.directory_subcategory nulls first,
      r.directory_sort_order, r.last_name nulls last, r.first_name nulls last, r.id
    offset p_offset limit p_limit;
end;
$$;

-- This narrow write cannot change identity, ID, status, date, or QR fields.
create or replace function public.staff_save_directory_record(
  p_id bigint, p_section text, p_subcategory text, p_photo_url text,
  p_sort_order integer, p_is_published boolean
)
returns table (
  id bigint, name text, designation text, directory_section text,
  directory_subcategory text, directory_photo_url text, directory_sort_order integer,
  directory_is_published boolean, directory_is_eligible boolean
)
language plpgsql security definer set search_path = public, private, pg_temp
as $$
declare
  clean_subcategory text := nullif(btrim(p_subcategory), '');
  clean_photo_url text := nullif(btrim(p_photo_url), '');
begin
  if not private.current_user_has_role(array['admin'::public.app_role, 'editor'::public.app_role]) then
    raise exception 'Active staff access required.' using errcode = '42501';
  end if;
  if p_id is null or p_section is not null and p_section not in ('officials', 'staff', 'functionaries')
     or p_sort_order is null or p_sort_order < 0 or p_is_published is null then
    raise exception 'Invalid Directory assignment.' using errcode = '22023';
  end if;
  if p_section is null then
    clean_subcategory := null; p_is_published := false;
  elsif p_section = 'officials' then
    clean_subcategory := null;
  elsif clean_subcategory is null then
    raise exception 'Choose a Staff or Functionary subcategory.' using errcode = '22023';
  end if;
  if clean_subcategory is not null and (length(clean_subcategory) > 80 or clean_subcategory ~ '[[:cntrl:]]') then
    raise exception 'Subcategory must be 1 to 80 readable characters.' using errcode = '22023';
  end if;
  if clean_photo_url is not null and (length(clean_photo_url) > 2000 or clean_photo_url !~ '^https://') then
    raise exception 'Photo link must be a valid HTTPS URL.' using errcode = '22023';
  end if;
  return query
    with changed as (
      update public.verification_records r
      set directory_section = p_section, directory_subcategory = clean_subcategory,
          directory_photo_url = clean_photo_url, directory_sort_order = p_sort_order,
          directory_is_published = p_is_published, updated_at = now()
      where r.id = p_id returning r.*
    )
    select c.id,
      coalesce(nullif(btrim(concat_ws(' ', nullif(btrim(c.first_name), ''), nullif(btrim(c.middle_name), ''), nullif(btrim(c.last_name), ''))), ''), 'Name not recorded'),
      nullif(btrim(c.designation), ''), c.directory_section, c.directory_subcategory,
      c.directory_photo_url, c.directory_sort_order, c.directory_is_published, c.status = 'ACTIVE'
    from changed c;
  if not found then raise exception 'Directory person was not found.' using errcode = 'P0002'; end if;
end;
$$;

-- Anonymous callers receive only the fields rendered on public Directory cards.
create or replace function public.list_public_directory_records(
  p_section text, p_offset integer default 0, p_limit integer default 50,
  p_excluded_subcategories text[] default '{}'::text[]
)
returns table (
  id bigint, name text, designation text, directory_section text,
  directory_subcategory text, directory_photo_url text, directory_sort_order integer,
  total_count bigint
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if p_section is null or p_section not in ('officials', 'staff', 'functionaries')
     or p_offset is null or p_offset < 0 or p_offset > 10000
     or p_limit is null or p_limit < 1 or p_limit > 100
     or p_excluded_subcategories is null or cardinality(p_excluded_subcategories) > 100
     or exists (select 1 from unnest(p_excluded_subcategories) value where length(value) > 80 or value ~ '[[:cntrl:]]') then
    raise exception 'Invalid public Directory request.' using errcode = '22023';
  end if;
  return query
    select r.id,
      coalesce(nullif(btrim(concat_ws(' ', nullif(btrim(r.first_name), ''), nullif(btrim(r.middle_name), ''), nullif(btrim(r.last_name), ''))), ''), 'Name not recorded'),
      nullif(btrim(r.designation), ''), r.directory_section, r.directory_subcategory,
      r.directory_photo_url, r.directory_sort_order, count(*) over()
    from public.verification_records r
    where r.directory_section = p_section and r.directory_is_published = true and r.status = 'ACTIVE'
      and (p_section = 'officials' or not (r.directory_subcategory = any(p_excluded_subcategories)))
    order by case when p_section = 'officials' then null else r.directory_subcategory end nulls first,
      r.directory_sort_order, r.last_name nulls last, r.first_name nulls last, r.id
    offset p_offset limit p_limit;
end;
$$;

create or replace function public.staff_list_directory_headings()
returns table (directory_section text, directory_subcategory text)
language plpgsql stable security definer set search_path = public, private, pg_temp
as $$
begin
  if not private.current_user_has_role(array['admin'::public.app_role, 'editor'::public.app_role]) then
    raise exception 'Active staff access required.' using errcode = '42501';
  end if;
  return query
    select distinct r.directory_section, r.directory_subcategory
    from public.verification_records r
    where r.directory_section in ('staff', 'functionaries') and r.directory_subcategory is not null
    order by r.directory_section, r.directory_subcategory;
end;
$$;

revoke all on function public.staff_list_directory_records(text, text, text, integer, integer) from public;
revoke all on function public.staff_save_directory_record(bigint, text, text, text, integer, boolean) from public;
revoke all on function public.staff_list_directory_headings() from public;
revoke all on function public.list_public_directory_records(text, integer, integer, text[]) from public;
grant execute on function public.staff_list_directory_records(text, text, text, integer, integer) to authenticated;
grant execute on function public.staff_save_directory_record(bigint, text, text, text, integer, boolean) to authenticated;
grant execute on function public.staff_list_directory_headings() to authenticated;
grant execute on function public.list_public_directory_records(text, integer, integer, text[]) to anon, authenticated;
