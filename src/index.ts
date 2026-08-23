import { createEmulatorsh, EmulatorshError, helpers } from "./sdk";
import { createHostSystem } from "./system/host";

const emulatorsh = createEmulatorsh({ system: createHostSystem() });

export { createEmulatorsh, EmulatorshError, emulatorsh, helpers };
export type {
  Emulatorsh,
  EmulatorshOptions,
  FormFactor,
  AndroidDevice,
  AndroidRef,
  AppleDevice,
  AppleRef,
  CreateOptions,
  DeviceProfile,
  ImageRef,
  Platform,
  PlatformName,
  SystemImage,
} from "./sdk";
export default emulatorsh;
