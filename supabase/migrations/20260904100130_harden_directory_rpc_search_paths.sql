-- Purpose: prevent object-shadowing inside the four Directory security-definer RPCs.
-- Every table, type, and authorization helper referenced by these functions is schema-qualified.

alter function public.staff_list_directory_records(text, text, text, integer, integer) set search_path = '';
alter function public.staff_save_directory_record(bigint, text, text, text, integer, boolean) set search_path = '';
alter function public.staff_list_directory_headings() set search_path = '';
alter function public.list_public_directory_records(text, integer, integer, text[]) set search_path = '';
