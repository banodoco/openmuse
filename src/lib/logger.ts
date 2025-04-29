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

  log(...args: any[]): void {
    try {
      const envAllows = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
      const localPref = typeof window !== 'undefined' ? localStorage.getItem('debugLogs') === 'true' : false;
      if (this.debug && (envAllows || localPref)) {
         
        console.log(...this.formatMessage(args));
      }
    } catch (_) {
      /* Fallback: if any security error, just no-op */
    }
  }

  warn(...args: any[]): void {
    if (this.debug) console.warn(...this.formatMessage(args));
  }

  error(...args: any[]): void {
    console.error(...this.formatMessage(args));
  }
}
