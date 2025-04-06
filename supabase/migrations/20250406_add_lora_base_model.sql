
-- First, check if the column exists before trying to add it
DO $$
BEGIN
  -- Check if the lora_base_model column already exists in the assets table
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'assets'
    AND column_name = 'lora_base_model'
  ) THEN
    -- Add the lora_base_model column if it doesn't exist
    ALTER TABLE assets ADD COLUMN lora_base_model TEXT;
    
    -- Update existing assets with a default value based on type
    UPDATE assets
    SET lora_base_model = 
      CASE 
        WHEN type = 'LoRA' THEN 'wan'
        ELSE type
      END
    WHERE lora_base_model IS NULL;
  END IF;
END
$$;

-- Add a debug function to check if a column exists
CREATE OR REPLACE FUNCTION debug_column_exists(table_name text, column_name text)
RETURNS boolean AS $$
DECLARE
  column_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = $1
    AND column_name = $2
  ) INTO column_exists;
  
  RETURN column_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also add a function to get all assets with debug info
CREATE OR REPLACE FUNCTION debug_get_all_assets()
RETURNS SETOF json AS $$
BEGIN
  RETURN QUERY
  SELECT row_to_json(a) 
  FROM assets a;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
