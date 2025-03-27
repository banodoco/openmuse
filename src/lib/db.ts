
// This file is maintained for backward compatibility
// It re-exports the new database implementation
import { videoDB } from './database/index';

console.log("db.ts: Re-exporting the new database implementation for backward compatibility");

export { videoDB };
