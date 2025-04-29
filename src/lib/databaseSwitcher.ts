import { databaseProvider } from './database/DatabaseProvider';
import { videoDB } from './database/index';
import { Logger } from './logger';

const SWITCHER_VERSION = '1.1.0'; // Increment on changes that impact behaviour or logs

/**
 * Legacy compatibility layer for the database switcher
 * This ensures that existing code continues to work with the new database structure
 */
class DatabaseSwitcher {
  private readonly logger = new Logger(`DatabaseSwitcher-Legacy[v${SWITCHER_VERSION}]`, true, 'SessionPersist');
  
  /**
   * Return the video database facade.  Adds timing + versioned logs so we can
   * diagnose delays when multiple tabs all try to open IndexedDB at once.
   */
  async getDatabase() {
    const start = performance.now();
    this.logger.log(`[v${SWITCHER_VERSION}] getDatabase() called.`);

    // Currently synchronous, but we retain the pattern in case this becomes
    // an async provider (e.g., waiting for an IDB open).
    const db = videoDB;

    const duration = (performance.now() - start).toFixed(2);
    this.logger.log(`[v${SWITCHER_VERSION}] getDatabase() resolved in ${duration} ms`);

    return db;
  }
}

export const databaseSwitcher = new DatabaseSwitcher();
