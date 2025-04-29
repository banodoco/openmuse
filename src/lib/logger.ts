export class Logger {
  private readonly moduleName: string;
  private readonly debug: boolean;

  constructor(moduleName: string, debug = true) {
    this.moduleName = moduleName;
    this.debug = debug;
  }

  log(...args: any[]): void {
    try {
      const envAllows = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
      const localPref = typeof window !== 'undefined' ? localStorage.getItem('debugLogs') === 'true' : false;
      if (this.debug && (envAllows || localPref)) {
        // eslint-disable-next-line no-console
        console.log(`[${this.moduleName}]`, ...args);
      }
    } catch (_) {
      /* Fallback: if any security error, just no-op */
    }
  }

  warn(...args: any[]): void {
    if (this.debug) console.warn(`[${this.moduleName}]`, ...args);
  }

  error(...args: any[]): void {
    console.error(`[${this.moduleName}]`, ...args);
  }
}
