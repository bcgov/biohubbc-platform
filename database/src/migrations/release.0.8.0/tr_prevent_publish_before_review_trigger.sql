CREATE OR REPLACE FUNCTION prevent_publish_before_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY definer
AS $$
BEGIN
    IF NEW.publish_timestamp IS NOT NULL AND NEW.security_review_timestamp IS NULL THEN
        RAISE EXCEPTION 'Invalid state: security_review_timestamp cannot be null while publish_timestamp is set.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER check_publish_date
BEFORE INSERT OR UPDATE ON biohub.submission
FOR EACH ROW
EXECUTE FUNCTION prevent_publish_before_review();