import { firstValueFrom, timeout } from "rxjs";
import type { RestIotState } from "../shared/hatch-sleep-types.ts";
import { hsbToRgb, rgbToHsb } from "../shared/colors.ts";
import type { HsbColor } from "../shared/colors.ts";
import { RestIot } from "./rest-iot.ts";
import { apiPath, RestClient } from "./rest-client.ts";
import type { DeepPartial } from "ts-essentials";

export const NO_SOUND = 19998;
export const NO_COLOR = 9998;
export const CUSTOM_COLOR = 9999;
export const MAX = 65535;
export interface HatchSound {
  id: number;
  name: string;
  url: string;
}
export interface CatalogItem {
  id: number;
  title: string;
  contentType: string;
  wavUrl?: string;
}

export function percent(value: number) {
  return Math.round((value * 100) / MAX);
}
export function raw(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100)
    throw new Error("Percentage must be between 0 and 100");
  return Math.round((value * MAX) / 100);
}
export function soundCatalog(
  items: CatalogItem[],
  ids?: number[],
): HatchSound[] {
  const seen = new Set<number>();
  return items
    .filter((item) => {
      if (
        item.contentType !== "sound" ||
        item.id === NO_SOUND ||
        !Number.isInteger(item.id) ||
        !item.title?.trim() ||
        !item.wavUrl?.startsWith("https://") ||
        seen.has(item.id) ||
        (ids && !ids.includes(item.id))
      )
        return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, 40)
    .map((item) => ({
      id: item.id,
      name: item.title.trim(),
      url: item.wavUrl!,
    }));
}
export async function fetchSounds(client: RestClient, ids?: number[]) {
  const result = await client.request<{ contentItems: CatalogItem[] }>({
    url: apiPath(
      "service/app/content/v1/fetchByProduct?product=riot&contentTypes=sound",
    ),
  });
  return soundCatalog(result.contentItems || [], ids);
}
export function isPlaying(state: RestIotState) {
  return state.current.playing !== "none" && !state.current.paused;
}
export function soundOn(state: RestIotState) {
  return (
    isPlaying(state) &&
    state.current.sound.id !== NO_SOUND &&
    !state.current.sound.mute
  );
}
export function lightOn(state: RestIotState) {
  return (
    state.current.playing !== "none" &&
    state.current.color.id !== NO_COLOR &&
    state.current.color.i > 0
  );
}
export function lightHsb(state: RestIotState): HsbColor {
  const c = state.current.color;
  const color = c.w && !c.r && !c.g && !c.b ? { h: 0, s: 0 } : rgbToHsb(c, MAX);
  return { ...color, b: lightOn(state) ? percent(c.i) : 0 };
}
export function volumeChange(value: number): DeepPartial<RestIotState> {
  return { current: { sound: { v: raw(value) } } };
}
export function trackChange(sound: HatchSound): DeepPartial<RestIotState> {
  // Leave volume and color alone; never replace an entire routine definition.
  return {
    current: {
      playing: "remote",
      step: 1,
      srId: 0,
      paused: false,
      sound: {
        id: sound.id,
        url: sound.url,
        mute: false,
        until: "indefinite",
        duration: 0,
      },
    },
  };
}
export function colorChange(
  state: RestIotState,
  hsb: HsbColor,
): DeepPartial<RestIotState> {
  if (!Number.isFinite(hsb.h) || hsb.h < 0 || hsb.h > 360)
    throw new Error("Hue must be between 0 and 360");
  raw(hsb.s);
  const intensity = raw(hsb.b);
  if (!intensity)
    return {
      current: { color: { id: NO_COLOR, r: 0, g: 0, b: 0, w: 0, i: 0 } },
    };
  return {
    current: {
      ...(state.current.playing === "none"
        ? {
            playing: "remote",
            step: 1,
            srId: 0,
            paused: false,
            sound: { mute: true },
          }
        : {}),
      color: {
        ...hsbToRgb({ ...hsb, b: 100 }, MAX),
        w: 0,
        id: CUSTOM_COLOR,
        i: intensity,
        until: "indefinite",
        duration: 0,
      },
    },
  };
}

export class RestControls {
  readonly device: RestIot;
  readonly sounds: HatchSound[];
  constructor(device: RestIot, sounds: HatchSound[]) {
    this.device = device;
    this.sounds = sounds;
  }
  async state() {
    const state = await firstValueFrom(this.device.onState.pipe(timeout(8000)));
    if (state.connected === false) throw new Error("Hatch is offline");
    return state;
  }
  async setVolume(value: number) {
    const change = volumeChange(value);
    await this.state();
    await this.device.update(change);
  }
  async setPower(on: boolean) {
    const state = await this.state();
    if (on && state.current.playing === "none") {
      const routines = await this.device.fetchRoutines();
      if (!routines.length)
        throw new Error("Create a favorite routine in the Hatch app first");
      await this.device.update({
        current: {
          playing: "routine",
          step: 1,
          srId: routines[0].id,
          paused: false,
        },
      });
    } else if (on && state.current.paused)
      await this.device.update({ current: { paused: false } });
    else if (!on)
      await this.device.update({
        current: { playing: "none", step: 0, srId: 0, paused: false },
      });
  }
  async setSound(on: boolean) {
    const state = await this.state();
    if (!on) return this.device.update({ current: { sound: { mute: true } } });
    if (state.current.sound.id === NO_SOUND) {
      if (!this.sounds[0])
        throw new Error("Select a sound in the Hatch app first");
      return this.device.update(trackChange(this.sounds[0]));
    }
    return this.device.update({
      current: {
        playing:
          state.current.playing === "none" ? "remote" : state.current.playing,
        step: state.current.step || 1,
        paused: false,
        sound: { mute: false },
      },
    });
  }
  async setTrack(id: number, on: boolean) {
    const state = await this.state(),
      sound = this.sounds.find((item) => item.id === id);
    if (!sound) throw new Error("Unknown Hatch sound");
    if (on) await this.device.update(trackChange(sound));
    else if (state.current.sound.id === id)
      await this.device.update({ current: { sound: { mute: true } } });
  }
  async setLight(hsb: HsbColor) {
    await this.device.update(colorChange(await this.state(), hsb));
  }
}
