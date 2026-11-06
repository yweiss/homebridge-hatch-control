import type {
  PlatformAccessory,
  Characteristic,
  CharacteristicValue,
} from "homebridge";
import { firstValueFrom, timeout, type Observable } from "rxjs";
import { map, distinctUntilChanged } from "rxjs/operators";
import { BaseAccessory } from "../shared/base-accessory.ts";
import { hap } from "../shared/hap.ts";
import { RestIot } from "./rest-iot.ts";
import { Restore } from "./restore.ts";
import { configureReceiverName } from "./receiver-names.ts";

export interface ReceiverRoutine {
  id: number;
  name: string;
}

// Expose only the established routine commands. Do not borrow Rest 2 sound/color payloads.
export class RestoreReceiverAccessory extends BaseAccessory {
  constructor(
    device: Restore | RestIot,
    accessory: PlatformAccessory,
    routines: ReceiverRoutine[],
    save: () => void,
  ) {
    super(device, accessory);
    const { Service: S, Characteristic: C } = hap;
    const tv = accessory.addService(S.Television, "Routine", "receiver");
    tv.setPrimaryService(true);
    configureReceiverName(
      accessory,
      tv,
      "receiver",
      accessory.displayName,
      save,
    );
    configureReceiverName(
      accessory,
      accessory.getService(S.AccessoryInformation)!,
      "receiver",
      accessory.displayName,
      save,
    );
    tv.setCharacteristic(
      C.SleepDiscoveryMode,
      C.SleepDiscoveryMode.ALWAYS_DISCOVERABLE,
    );
    const state: Observable<{
      playing: boolean;
      routine: number;
      connected?: boolean;
    }> =
      device instanceof Restore
        ? device.onState.pipe(
            map((s) => ({
              playing: s.content.playing !== "none",
              routine: s.content.playing === "routine" ? 1 : 0,
              connected: s.connected,
            })),
          )
        : device.onState.pipe(
            map((s) => ({
              playing: s.current.playing !== "none",
              routine: s.current.srId,
              connected: s.connected,
            })),
          );
    const ready = async () => {
      const value = await firstValueFrom(state.pipe(timeout(8000)));
      if (value.connected === false) throw new Error("Hatch is offline");
      return value;
    };
    const bind = (
      characteristic: Characteristic,
      values: Observable<CharacteristicValue>,
      setter: (value: CharacteristicValue) => Promise<unknown>,
    ) => {
      characteristic.onGet(() => firstValueFrom(values.pipe(timeout(8000))));
      characteristic.onSet(async (value) => {
        await ready();
        await setter(value);
      });
      values
        .pipe(distinctUntilChanged())
        .subscribe((value) => characteristic.updateValue(value));
    };
    const choose = async (id: number) => {
      if (!id) return device.turnOff();
      if (!routines.some((r) => r.id === id))
        throw new Error("Unknown Hatch routine");
      if (device instanceof Restore) return device.turnOnRoutine(1);
      return device.update({
        current: { playing: "routine", step: 1, srId: id, paused: false },
      });
    };
    bind(
      tv.getCharacteristic(C.Active),
      state.pipe(map((s) => Number(s.playing))),
      async (value) => {
        if (!value) return device.turnOff();
        if ((await ready()).playing) return;
        if (routines[0]) return choose(routines[0].id);
        throw new Error(
          "Create a touch-ring favorite in the Hatch app, then restart Homebridge to refresh routines",
        );
      },
    );
    bind(
      tv.getCharacteristic(C.ActiveIdentifier),
      state.pipe(
        map((s) =>
          s.playing && routines.some((r) => r.id === s.routine) ? s.routine : 0,
        ),
      ),
      (value) => choose(Number(value)),
    );
    const inputs = [...routines, { id: 0, name: "Off or Other" }];
    for (const routine of inputs) {
      const input = accessory.addService(
        S.InputSource,
        routine.name,
        `routine:${routine.id}`,
      );
      input
        .setCharacteristic(C.Identifier, routine.id)
        .setCharacteristic(C.IsConfigured, C.IsConfigured.CONFIGURED)
        .setCharacteristic(C.InputSourceType, C.InputSourceType.APPLICATION)
        .setCharacteristic(
          C.CurrentVisibilityState,
          C.CurrentVisibilityState.SHOWN,
        );
      configureReceiverName(
        accessory,
        input,
        `input:routine:${routine.id}`,
        routine.name,
        save,
      );
      tv.addLinkedService(input);
    }
    tv.setCharacteristic(
      C.DisplayOrder,
      Buffer.concat(
        inputs.flatMap((input, index) => {
          const item = Buffer.alloc(6);
          item[0] = 1;
          item[1] = 4;
          item.writeUInt32LE(input.id, 2);
          return index ? [Buffer.from([0, 0]), item] : [item];
        }),
      ).toString("base64"),
    );
    tv.getCharacteristic(C.RemoteKey).onSet(async (value) => {
      const current = await ready();
      if (value === C.RemoteKey.PLAY_PAUSE) {
        if (current.playing) await device.turnOff();
        else if (routines[0]) await choose(routines[0].id);
        else throw new Error("No Hatch routines available");
      }
    });
  }
}
