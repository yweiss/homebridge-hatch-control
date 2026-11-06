import type {
  Characteristic,
  CharacteristicValue,
  PlatformAccessory,
  Service,
  WithUUID,
} from "homebridge";
import { firstValueFrom, Observable, timeout } from "rxjs";
import { distinctUntilChanged, map } from "rxjs/operators";
import { hap } from "../shared/hap.ts";
import { BaseAccessory } from "../shared/base-accessory.ts";
import type { HsbColor } from "../shared/colors.ts";
import { RestIot } from "./rest-iot.ts";
import {
  HatchSound,
  lightHsb,
  lightOn,
  percent,
  RestControls,
  soundOn,
} from "./rest-controls.ts";

export class RestControlsAccessory extends BaseAccessory {
  readonly controls: RestControls;
  private readonly saveNames: () => void;
  private readonly pendingColor: Partial<HsbColor> = {};
  private colorTimer?: NodeJS.Timeout;
  private colorWaiters: {
    resolve: () => void;
    reject: (error: unknown) => void;
  }[] = [];

  constructor(
    device: RestIot,
    accessory: PlatformAccessory,
    sounds: HatchSound[],
    saveNames: () => void = () => {},
  ) {
    super(device, accessory);
    this.saveNames = saveNames;
    this.controls = new RestControls(device, sounds);
    const { Service, Characteristic } = hap;
    const prefix = accessory.displayName
      .replace(/[^\p{L}\p{N} ']/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    const service = (
      type: WithUUID<typeof Service>,
      suffix: string,
      subtype?: string,
    ) => {
      // The original power service has no subtype; retaining it preserves its IID.
      const found = subtype
        ? accessory.getServiceById(type, subtype)
        : accessory.services.find((s) => s.UUID === type.UUID && !s.subtype);
      const result =
        found ||
        accessory.addService(type, `${prefix} ${suffix}`.trim(), subtype || "");
      result.setCharacteristic(
        Characteristic.Name,
        `${prefix} ${suffix}`.trim(),
      );
      if (!result.testCharacteristic(Characteristic.ConfiguredName))
        result.addOptionalCharacteristic(Characteristic.ConfiguredName);
      this.configureReceiverName(
        result,
        subtype || "receiver",
        `${prefix} ${suffix}`.trim(),
      );
      return result;
    };
    this.addReceiver(device, accessory, sounds);

    const volume = service(Service.Fan, "Volume", "volume");
    this.bind(
      volume.getCharacteristic(Characteristic.On),
      device.onState.pipe(map(soundOn)),
      (value) => this.controls.setSound(Boolean(value)),
    );
    this.bind(
      volume
        .getCharacteristic(Characteristic.RotationSpeed)
        .setProps({ minValue: 0, maxValue: 100, minStep: 1 }),
      device.onState.pipe(map((s) => percent(s.current.sound.v))),
      (value) => this.controls.setVolume(Number(value)),
    );

    const light = service(Service.Lightbulb, "Light", "light");
    const context = accessory.context;
    context.restColor = context.restColor || { h: 0, s: 0, b: 10 };
    device.onState.subscribe((state) => {
      if (lightOn(state)) context.restColor = lightHsb(state);
    });
    this.bind(
      light.getCharacteristic(Characteristic.On),
      device.onState.pipe(map(lightOn)),
      (value) => this.setColor({ b: value ? context.restColor.b || 10 : 0 }),
    );
    this.bind(
      light.getCharacteristic(Characteristic.Brightness),
      device.onState.pipe(map((s) => lightHsb(s).b)),
      (value) => this.setColor({ b: Number(value) }),
    );
    this.bind(
      light.getCharacteristic(Characteristic.Hue),
      device.onState.pipe(
        map((s) => (lightOn(s) ? lightHsb(s).h : context.restColor.h)),
      ),
      (value) => this.setColor({ h: Number(value) }),
    );
    this.bind(
      light.getCharacteristic(Characteristic.Saturation),
      device.onState.pipe(
        map((s) => (lightOn(s) ? lightHsb(s).s : context.restColor.s)),
      ),
      (value) => this.setColor({ s: Number(value) }),
    );
  }

  private addReceiver(
    device: RestIot,
    accessory: PlatformAccessory,
    sounds: HatchSound[],
  ) {
    const { Service, Characteristic: C } = hap;
    const tv = accessory.addService(Service.Television, "Sound", "receiver");
    tv.setPrimaryService(true);
    this.configureReceiverName(tv, "receiver", accessory.displayName);
    accessory
      .getService(Service.AccessoryInformation)!
      .setCharacteristic(C.Name, accessory.displayName);
    this.configureReceiverName(
      accessory.getService(Service.AccessoryInformation)!,
      "receiver",
      accessory.displayName,
    );
    tv.setCharacteristic(
      C.SleepDiscoveryMode,
      C.SleepDiscoveryMode.ALWAYS_DISCOVERABLE,
    );
    this.bind(
      tv.getCharacteristic(C.Active),
      device.onState.pipe(map((s) => Number(s.current.playing !== "none"))),
      (value) => this.controls.setPower(Boolean(value)),
    );
    // Identifier zero explicitly represents an off, muted or non-catalog sound.
    // HomeKit has one ActiveIdentifier, so sounds cannot appear simultaneously selected.
    this.bind(
      tv.getCharacteristic(C.ActiveIdentifier),
      device.onState.pipe(
        map((s) =>
          soundOn(s) && sounds.some((sound) => sound.id === s.current.sound.id)
            ? s.current.sound.id
            : 0,
        ),
      ),
      async (value) => {
        const id = Number(value);
        if (id === 0) await this.controls.setSound(false);
        else await this.controls.setTrack(id, true);
      },
    );
    const inputs = [{ id: 0, name: "Off / Other" }, ...sounds];
    for (const sound of inputs) {
      const input = accessory.addService(
        Service.InputSource,
        sound.name,
        `input:${sound.id}`,
      );
      input
        .setCharacteristic(C.Identifier, sound.id)
        .setCharacteristic(C.IsConfigured, C.IsConfigured.CONFIGURED)
        .setCharacteristic(C.InputSourceType, C.InputSourceType.APPLICATION)
        .setCharacteristic(
          C.CurrentVisibilityState,
          C.CurrentVisibilityState.SHOWN,
        );
      this.configureReceiverName(input, `input:${sound.id}`, sound.name);
      tv.addLinkedService(input);
    }
    // DisplayOrder controls the sound menu only. Apple chooses the order of
    // the visible receiver, volume and light panels.
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
    const speaker = accessory.addService(
      Service.TelevisionSpeaker,
      "Audio",
      "speaker",
    );
    speaker
      .setCharacteristic(C.Active, C.Active.ACTIVE)
      .setCharacteristic(C.VolumeControlType, C.VolumeControlType.ABSOLUTE);
    this.bind(
      speaker.getCharacteristic(C.Mute),
      device.onState.pipe(map((s) => !soundOn(s))),
      (value) => this.controls.setSound(!value),
    );
    this.bind(
      speaker.getCharacteristic(C.Volume),
      device.onState.pipe(map((s) => percent(s.current.sound.v))),
      (value) => this.controls.setVolume(Number(value)),
    );
    speaker.getCharacteristic(C.VolumeSelector).onSet(async (value) => {
      const state = await this.controls.state();
      await this.controls.setVolume(
        Math.max(
          0,
          Math.min(
            100,
            percent(state.current.sound.v) +
              (value === C.VolumeSelector.INCREMENT ? 5 : -5),
          ),
        ),
      );
    });
    tv.addLinkedService(speaker);
    tv.getCharacteristic(C.RemoteKey).onSet(async (value) => {
      if (value === C.RemoteKey.PLAY_PAUSE) {
        await this.controls.setSound(!soundOn(await this.controls.state()));
      } else if (
        (value === C.RemoteKey.NEXT_TRACK ||
          value === C.RemoteKey.PREVIOUS_TRACK) &&
        sounds.length
      ) {
        const state = await this.controls.state();
        const current = sounds.findIndex(
          (sound) => sound.id === state.current.sound.id,
        );
        const next =
          (Math.max(0, current) +
            (value === C.RemoteKey.NEXT_TRACK ? 1 : -1) +
            sounds.length) %
          sounds.length;
        await this.controls.setTrack(sounds[next].id, true);
      }
    });
  }

  private configureReceiverName(
    service: Service,
    key: string,
    defaultName: string,
  ) {
    const C = hap.Characteristic;
    if (!service.testCharacteristic(C.ConfiguredName))
      service.addOptionalCharacteristic(C.ConfiguredName);
    const names: Record<string, string> =
      (this.accessory.context.receiverNames ||= {});
    const characteristic = service.getCharacteristic(C.ConfiguredName);
    const generic = (name: string) =>
      key.startsWith("input:") && /^input(?: source)?(?: \d+)?$/i.test(name);
    if (names[key] && generic(names[key])) delete names[key];
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
      this.saveNames();
    });
  }

  private bind(
    characteristic: Characteristic,
    values: Observable<CharacteristicValue>,
    setter: (value: CharacteristicValue) => Promise<unknown>,
  ) {
    characteristic.onGet(() => firstValueFrom(values.pipe(timeout(8000))));
    characteristic.onSet(async (value) => {
      await setter(value);
    });
    values
      .pipe(distinctUntilChanged())
      .subscribe((value) => characteristic.updateValue(value));
  }

  private setColor(change: Partial<HsbColor>): Promise<void> {
    Object.assign(this.pendingColor, change);
    if (this.colorTimer) clearTimeout(this.colorTimer);
    const promise = new Promise<void>((resolve, reject) =>
      this.colorWaiters.push({ resolve, reject }),
    );
    this.colorTimer = setTimeout(() => {
      const edits = { ...this.pendingColor },
        waiters = this.colorWaiters.splice(0);
      for (const key of Object.keys(this.pendingColor))
        delete this.pendingColor[key as keyof HsbColor];
      this.colorTimer = undefined;
      const color = {
        ...this.accessory.context.restColor,
        ...edits,
      } as HsbColor;
      this.controls.setLight(color).then(
        () => {
          if (color.b > 0) {
            this.accessory.context.restColor = color;
            this.saveNames();
          }
          waiters.forEach((waiter) => waiter.resolve());
        },
        (error) => waiters.forEach((waiter) => waiter.reject(error)),
      );
    }, 120);
    return promise;
  }
}
