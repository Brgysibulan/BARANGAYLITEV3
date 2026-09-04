-- Purpose: remove Supabase's default anonymous EXECUTE grant from staff-only Directory RPCs.
-- The functions also verify an active staff profile internally as a second authorization boundary.

revoke all on function public.staff_list_directory_records(text, text, text, integer, integer) from public, anon;
revoke all on function public.staff_save_directory_record(bigint, text, text, text, integer, boolean) from public, anon;
revoke all on function public.staff_list_directory_headings() from public, anon;

grant execute on function public.staff_list_directory_records(text, text, text, integer, integer) to authenticated;
grant execute on function public.staff_save_directory_record(bigint, text, text, text, integer, boolean) to authenticated;
grant execute on function public.staff_list_directory_headings() to authenticated;
