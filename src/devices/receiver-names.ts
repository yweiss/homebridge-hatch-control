import type { PlatformAccessory, Service } from "homebridge";
import { hap } from "../shared/hap.ts";
export function configureReceiverName(
  accessory: PlatformAccessory,
  service: Service,
  key: string,
  defaultName: string,
  save: () => void,
) {
  const C = hap.Characteristic;
  if (!service.testCharacteristic(C.ConfiguredName))
    service.addOptionalCharacteristic(C.ConfiguredName);
  const names: Record<string, string> = (accessory.context.receiverNames ||=
    {});
  const characteristic = service.getCharacteristic(C.ConfiguredName);
  const generic = (name: string) =>
    key.startsWith("input:") && /^input(?: source)?(?: \d+)?$/i.test(name);
  if (
    names[key] &&
    (generic(names[key]) || (key === "input:0" && names[key] === "Off / Other"))
  )
    delete names[key];
  const getName = () => names[key] || defaultName;
  characteristic.updateValue(getName());
  characteristic.onGet(getName);
  characteristic.onSet((value) => {
    const name = String(value).trim();
    if (!name || generic(name)) {
      // Home can overwrite the catalog names with generic input labels
      // during pairing. Restore after HAP finishes accepting this write.
      setImmediate(() => characteristic.updateValue(getName()));
      return;
    }
    names[key] = name;
    save();
  });
}
