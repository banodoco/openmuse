
import { supabase } from '@/integrations/supabase/client';
import { Logger } from './logger';

const logger = new Logger('AddLoraBaseModelColumn');

/**
 * Directly adds the lora_base_model column to the assets table if it doesn't exist
 */
export const addLoraBaseModelColumn = async (): Promise<boolean> => {
  try {
    logger.log('Checking if lora_base_model column exists in assets table');
    
    // First check if the column exists
    const { data: columnExists, error: checkError } = await supabase.rpc(
      'debug_column_exists',
      { table_name: 'assets', column_name: 'lora_base_model' }
    );
    
    if (checkError) {
      logger.error('Error checking if column exists:', checkError);
      return false;
    }
    
    logger.log(`Column check result: lora_base_model exists = ${columnExists}`);
    
    if (!columnExists) {
      logger.log('Adding lora_base_model column to assets table');
      
      // Use raw SQL to add the column
      const { error: alterError } = await supabase.rpc(
        'execute_sql', 
        { 
          sql: 'ALTER TABLE assets ADD COLUMN lora_base_model TEXT;' 
        }
      );
      
      if (alterError) {
        logger.error('Error adding column:', alterError);
        return false;
      }
      
      logger.log('Column added successfully, updating existing assets');
      
      // Update existing LoRA assets with default value
      const { error: updateError } = await supabase.rpc(
        'execute_sql',
        {
          sql: `UPDATE assets SET lora_base_model = 'wan' WHERE type = 'LoRA' AND lora_base_model IS NULL;`
        }
      );
      
      if (updateError) {
        logger.error('Error updating existing assets:', updateError);
        return false;
      }
      
      logger.log('Successfully added and populated lora_base_model column');
      return true;
    } else {
      logger.log('lora_base_model column already exists, no action needed');
      return true;
    }
  } catch (error) {
    logger.error('Unexpected error adding lora_base_model column:', error);
    return false;
  }
};
