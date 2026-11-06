import { firstValueFrom, timeout, type Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { DeepPartial } from "ts-essentials";
import { RestPlus } from "./rest-plus.ts";
import { RestMini } from "./rest-mini.ts";
import {
  AudioTrack,
  RestMiniAudioTrack,
  type RestIotState,
  type RestPlusState,
  type RestMiniState,
} from "../shared/hatch-sleep-types.ts";
import {
  CUSTOM_COLOR,
  MAX,
  NO_COLOR,
  NO_SOUND,
  type HatchSound,
  type RestControlDevice,
} from "./rest-controls.ts";

// An internal marker used only in remembered settings to retain Rest+'s rainbow mode.
const RAINBOW = 1000000;
const names: Record<string, string> = {
  PinkNoise: "Pink Noise",
  WhiteNoise: "White Noise",
  Bird: "Birds",
  RockABye: "Rock a Bye",
  Brahms: "Brahms Lullaby",
  Twinkle: "Twinkle Twinkle",
};
export function legacySounds(
  device: RestPlus | RestMini,
  ids?: number[],
): HatchSound[] {
  const tracks = device instanceof RestPlus ? AudioTrack : RestMiniAudioTrack;
  return device.audioTracks
    .filter((id) => id !== 0 && (!ids || ids.includes(id)))
    .map((id) => {
      const key = Object.entries(tracks).find(([, value]) => value === id)![0];
      return { id, name: names[key] || key, url: "" };
    });
}

/** Translate the receiver's common control state to the established legacy protocol. */
export function legacyRestDevice(
  device: RestPlus | RestMini,
  memory: { legacyTrack?: number } = {},
  save: () => void = () => {},
): RestControlDevice {
  const plus = device instanceof RestPlus;
  let lastTrack =
    memory.legacyTrack &&
    device.audioTracks.includes(memory.legacyTrack as never)
      ? memory.legacyTrack
      : device.audioTracks.find((id) => id !== 0) || 0;
  const rememberTrack = (id: number) => {
    if (id && device.audioTracks.includes(id as never)) {
      lastTrack = id;
      if (memory.legacyTrack !== id) {
        memory.legacyTrack = id;
        save();
      }
    }
  };
  const sourceState: Observable<RestPlusState | RestMiniState> = device.onState;
  const onState = sourceState.pipe(
    map((source: RestPlusState | RestMiniState): RestIotState => {
      let current: RestIotState["current"];
      if (plus) {
        const state = source as RestPlusState,
          c = state.c;
        rememberTrack(state.a.t);
        current = {
          playing: state.isPowered ? "remote" : "none",
          step: state.isPowered ? 1 : 0,
          srId: 0,
          paused: false,
          sound: {
            id: state.a.t || NO_SOUND,
            url: "",
            v: state.a.v,
            mute: !state.a.t,
            until: "indefinite",
            duration: 0,
          },
          color: {
            id: c.R
              ? RAINBOW
              : c.W || c.r || c.g || c.b
                ? CUSTOM_COLOR
                : NO_COLOR,
            r: c.r,
            g: c.g,
            b: c.b,
            w: c.W ? MAX : 0,
            i: c.i,
            until: "indefinite",
            duration: 0,
          },
        };
      } else {
        const state = source as RestMiniState;
        rememberTrack(state.current.sound.id);
        current = {
          playing: state.current.playing,
          step: state.current.step,
          srId: 0,
          paused: false,
          sound: {
            ...state.current.sound,
            id: state.current.sound.id || NO_SOUND,
            mute: false,
            url: "",
          },
          color: {
            id: NO_COLOR,
            r: 0,
            g: 0,
            b: 0,
            w: 0,
            i: 0,
            until: "indefinite",
            duration: 0,
          },
        };
      }
      return {
        connected: source.connected,
        current,
        deviceInfo: { f: source.deviceInfo.f },
      } as RestIotState;
    }),
  );
  return {
    name: device.name,
    model: device.model,
    macAddress: device.macAddress,
    onFirmwareVersion: device.onFirmwareVersion,
    onState,
    hasLight: plus,
    resumeSoundId: () => lastTrack,
    onBatteryLevel: plus ? (device as RestPlus).onBatteryLevel : undefined,
    // The shared controller's initial fallback maps to legacy native power-on below.
    async fetchRoutines() {
      return [{ id: 0 }];
    },
    async update(change: DeepPartial<RestIotState>) {
      const current = change.current;
      if (!current) return;
      const source = await firstValueFrom(sourceState.pipe(timeout(8000)));
      if (source.connected === false) throw new Error("Hatch is offline");
      if (plus) {
        const state = source as RestPlusState;
        const update: DeepPartial<RestPlusState> = {};
        if (current.playing !== undefined)
          update.isPowered = current.playing !== "none";
        if (current.sound) {
          const sound = current.sound;
          update.a = {};
          if (sound.v !== undefined) update.a.v = sound.v;
          if (sound.id !== undefined)
            update.a.t =
              sound.id === NO_SOUND ? 0 : (sound.id as RestPlusState["a"]["t"]);
          if (sound.mute === true) update.a.t = 0;
          else if (
            sound.mute === false &&
            update.a.t === undefined &&
            !state.a.t
          )
            update.a.t = lastTrack as RestPlusState["a"]["t"];
        }
        if (current.color) {
          const c = current.color;
          update.c = {
            r: c.r ?? state.c.r,
            g: c.g ?? state.c.g,
            b: c.b ?? state.c.b,
            i: c.i ?? state.c.i,
            R: c.id === RAINBOW,
            W: Boolean(c.w),
          };
          if (c.id === NO_COLOR)
            update.c = { r: 0, g: 0, b: 0, i: 0, R: false, W: false };
        }
        return (device as RestPlus).update(update);
      }
      const state = source as RestMiniState;
      const update: DeepPartial<RestMiniState> = { current: {} };
      const target = update.current!;
      if (current.playing !== undefined) {
        target.playing = current.playing === "none" ? "none" : "remote";
        target.step = target.playing === "none" ? 0 : 1;
      }
      if (current.sound) {
        const sound = current.sound;
        target.sound = {};
        if (sound.v !== undefined) target.sound.v = sound.v;
        if (sound.id !== undefined && sound.id !== NO_SOUND) {
          target.sound.id = sound.id;
          target.sound.until = "indefinite";
        }
        if (sound.mute === true || sound.id === NO_SOUND) {
          target.playing = "none";
          target.step = 0;
        } else if (sound.mute === false && !state.current.sound.id) {
          target.sound.id = target.sound.id ?? lastTrack;
          target.sound.until = "indefinite";
        }
      }
      if (
        target.playing === "remote" &&
        !state.current.sound.id &&
        !target.sound?.id
      ) {
        target.sound = { ...target.sound, id: lastTrack, until: "indefinite" };
      }
      return (device as RestMini).update(update);
    },
  };
}
