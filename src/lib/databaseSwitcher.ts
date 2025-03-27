
import { databaseProvider } from './database/DatabaseProvider';
import { videoDB } from './database/index';
import { Logger } from './logger';

/**
 * Legacy compatibility layer for the database switcher
 * This ensures that existing code continues to work with the new database structure
 */
class DatabaseSwitcher {
  private readonly logger = new Logger('DatabaseSwitcher-Legacy');
  
  async getDatabase() {
    this.logger.log("Legacy database switcher called, using new database provider");
    // Simply redirect to the new videoDB facade
    return videoDB;
  }
}

export const databaseSwitcher = new DatabaseSwitcher();
