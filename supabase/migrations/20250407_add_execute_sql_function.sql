
-- Function to execute arbitrary SQL (for admin operations)
-- IMPORTANT: This function should be restricted in production environments
CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
