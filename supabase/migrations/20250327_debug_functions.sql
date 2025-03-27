
-- This is a helper function to get all assets for debugging purposes
create or replace function debug_get_all_assets()
returns json as $$
begin
  return (
    select json_agg(a)
    from assets a
  );
end;
$$ language plpgsql security definer;
