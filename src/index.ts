import { createEmulatorsh, EmulatorshError } from "./sdk";
import { createHostSystem } from "./system/host";

const emulatorsh = createEmulatorsh({ system: createHostSystem() });

export { createEmulatorsh, EmulatorshError, emulatorsh };
export type { Emulatorsh, EmulatorshOptions, FormFactor, MenuItem, SystemImage } from "./sdk";
export default emulatorsh;
