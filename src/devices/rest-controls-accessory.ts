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
  ) {
    super(device, accessory);
    this.controls = new RestControls(device, sounds);
    const { Service, Characteristic } = hap;
    const prefix = device.name
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
      result.setCharacteristic(
        Characteristic.ConfiguredName,
        `${prefix} ${suffix}`.trim(),
      );
      return result;
    };
    const power = service(Service.Switch, "");
    power.setPrimaryService(true);
    this.bind(
      power.getCharacteristic(Characteristic.On),
      device.onState.pipe(map((s) => s.current.playing !== "none")),
      (value) => this.controls.setPower(Boolean(value)),
    );

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

    const active = new Set(sounds.map((sound) => `sound:${sound.id}`));
    for (const old of [...accessory.services]) {
      if (old.subtype?.startsWith("sound:") && !active.has(old.subtype))
        accessory.removeService(old);
    }
    for (const sound of sounds) {
      const button = service(Service.Switch, sound.name, `sound:${sound.id}`);
      this.bind(
        button.getCharacteristic(Characteristic.On),
        device.onState.pipe(
          map((s) => soundOn(s) && s.current.sound.id === sound.id),
        ),
        (value) => this.controls.setTrack(sound.id, Boolean(value)),
      );
    }
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
          if (color.b > 0) this.accessory.context.restColor = color;
          waiters.forEach((waiter) => waiter.resolve());
        },
        (error) => waiters.forEach((waiter) => waiter.reject(error)),
      );
    }, 120);
    return promise;
  }
}
