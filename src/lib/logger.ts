export class Logger {
  private readonly moduleName: string;
  private readonly debug: boolean;

  constructor(moduleName: string, debug = true) {
    this.moduleName = moduleName;
    this.debug = debug;
  }

  log(...args: any[]): void {
    // if (this.debug) console.log(`[${this.moduleName}]`, ...args);
  }

  warn(...args: any[]): void {
    if (this.debug) console.warn(`[${this.moduleName}]`, ...args);
  }

  error(...args: any[]): void {
    console.error(`[${this.moduleName}]`, ...args);
  }
}
