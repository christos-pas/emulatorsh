export class EmulatorshError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EmulatorshError";
    this.code = code;
  }
}

export const ErrorCode = {
  DEVICE_NOT_FOUND: "DEVICE_NOT_FOUND",
  DEVICE_AMBIGUOUS: "DEVICE_AMBIGUOUS",
  NO_EMULATOR: "NO_EMULATOR",
  NO_ADB: "NO_ADB",
  NO_AVDMANAGER: "NO_AVDMANAGER",
  NO_SDKMANAGER: "NO_SDKMANAGER",
  CREATE_FAILED: "CREATE_FAILED",
  INSTALL_FAILED: "INSTALL_FAILED",
  SDK_NOT_INSTALLED: "SDK_NOT_INSTALLED",
  PROFILE_NOT_FOUND: "PROFILE_NOT_FOUND",
} as const;
