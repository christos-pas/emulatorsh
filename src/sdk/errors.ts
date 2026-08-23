export class EmulatorshError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EmulatorshError";
    this.code = code;
  }
}
