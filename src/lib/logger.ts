export class Logger {
  private readonly moduleName: string;
  private readonly debug: boolean;
  private readonly tag?: string;

  constructor(moduleName: string, debug = true, tag?: string) {
    this.moduleName = moduleName;
    this.debug = debug;
    this.tag = tag;
  }

  private formatMessage(args: any[]): any[] {
    const prefix = this.tag ? `[${this.tag}][${this.moduleName}]` : `[${this.moduleName}]`;
    return [prefix, ...args];
  }

  // Helper to check global conditions
  private shouldLog(): boolean {
    try {
      // Log if NODE_ENV is not 'production' or if localStorage flag is set
      const envAllows = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
      const localPref = typeof window !== 'undefined' && localStorage.getItem('debugLogs') === 'true';
      return !!(envAllows || localPref); // Ensure boolean return
    } catch (_) {
      // Fallback: if any security error or unavailable APIs, assume logging disabled
      return false;
    }
  }

  log(...args: any[]): void {
    // Log if this instance allows it AND global conditions allow it
    if (this.debug && this.shouldLog()) {
      console.log(...this.formatMessage(args));
    }
  }

  warn(...args: any[]): void {
    // Warn if this instance allows it AND global conditions allow it
    if (this.debug && this.shouldLog()) {
      console.warn(...this.formatMessage(args));
    }
  }

  error(...args: any[]): void {
    // Errors should always be logged
    console.error(...this.formatMessage(args));
  }
}
