-- tr_permit.sql
create or replace function tr_permit() returns trigger
language plpgsql
security invoker
as
$$
-- *******************************************************************
-- Procedure: tr_permit
-- Purpose: performs specific data validation
--
-- MODIFICATION HISTORY
-- Person           Date        Comments
-- ---------------- ----------- --------------------------------------
-- charlie.garrettjones@quartech.com
--                  2021-05-13  initial release
-- *******************************************************************
declare

begin
  if new.end_date is not null then
    if new.end_date < new.issue_date then
      raise exception 'The permit issue date cannot be greater than end date.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists permit_val on biohub.permit;
create trigger permit_val before insert or update on biohub.permit for each row execute procedure tr_permit();
