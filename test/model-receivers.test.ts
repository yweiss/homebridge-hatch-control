import { describe, expect, it, vi } from "vitest";
import { BehaviorSubject, of } from "rxjs";
import { createRequire } from "node:module";
import { RestPlus } from "../src/devices/rest-plus.ts";
import { RestMini } from "../src/devices/rest-mini.ts";
import { Restore } from "../src/devices/restore.ts";
import { RestIot } from "../src/devices/rest-iot.ts";
import {
  audioTracks,
  restMiniAudioTracks,
} from "../src/shared/hatch-sleep-types.ts";
import {
  legacyRestDevice,
  legacySounds,
} from "../src/devices/legacy-rest-controls.ts";
import { RestControls, MAX, NO_COLOR } from "../src/devices/rest-controls.ts";
import { RestControlsAccessory } from "../src/devices/rest-controls-accessory.ts";
import { RestoreReceiverAccessory } from "../src/devices/restore-receiver.ts";
import { setHap } from "../src/shared/hap.ts";
const require = createRequire(import.meta.url);
const hap = require("@homebridge/hap-nodejs");
const {
  PlatformAccessory,
} = require("../node_modules/homebridge/dist/platformAccessory.js");
setHap(hap);

function fake(Model: any, state: any) {
  const subject = new BehaviorSubject(state),
    update = vi.fn().mockResolvedValue(undefined);
  const device = Object.create(Model.prototype, {
    info: {
      value: { id: 1, name: "Test Hatch", macAddress: "00:00:00:00:00:00" },
    },
    model: { value: Model.name },
    onState: { value: subject },
    update: { value: update },
    onFirmwareVersion: { value: of("1.0") },
    onBatteryLevel: { value: of(55) },
    audioTracks: {
      value: Model === RestPlus ? audioTracks : restMiniAudioTracks,
    },
  });
  return { device, subject, update };
}
const plusState = () => ({
  connected: true,
  isPowered: true,
  a: { t: 5, v: 15000 },
  c: { r: 0, g: 0, b: 0, i: 12000, R: false, W: true },
  deviceInfo: { f: "1.0", b: 55 },
});
const miniState = () => ({
  connected: true,
  current: {
    playing: "remote",
    step: 1,
    sound: { id: 10128, v: 15000, until: "indefinite", duration: 0 },
  },
  deviceInfo: { f: "1.0" },
});

describe("model-specific receiver commands", () => {
  it("uses each device's own sound IDs and filters without adding unsupported tracks", () => {
    expect(
      legacySounds(fake(RestPlus, plusState()).device, [5, 10128]),
    ).toEqual([{ id: 5, name: "Ocean", url: "" }]);
    expect(
      legacySounds(fake(RestMini, miniState()).device, [5, 10128]),
    ).toEqual([{ id: 10128, name: "Ocean", url: "" }]);
    expect(legacySounds(fake(RestMini, miniState()).device, [])).toEqual([]);
  });
  it("maps original Rest+ sound, volume and light to its native fields", async () => {
    const { device, update } = fake(RestPlus, plusState());
    const controls = new RestControls(
      legacyRestDevice(device),
      legacySounds(device),
    );
    await controls.setTrack(7, true);
    expect(update).toHaveBeenLastCalledWith({ isPowered: true, a: { t: 7 } });
    await controls.setVolume(50);
    expect(update).toHaveBeenLastCalledWith({ a: { v: 32768 } });
    await controls.setLight({ h: 0, s: 100, b: 10 });
    expect(update).toHaveBeenLastCalledWith({
      c: { r: MAX, g: 0, b: 0, i: 6554, R: false, W: false },
    });
  });
  it("retains the original Rest+ white mode and restores playback after power off", async () => {
    const { device, update, subject } = fake(RestPlus, plusState());
    const controls = new RestControls(
      legacyRestDevice(device),
      legacySounds(device),
    );
    await controls.setPower(false);
    expect(update).toHaveBeenLastCalledWith({ isPowered: false });
    subject.next({ ...plusState(), isPowered: false, a: { t: 0, v: 0 } });
    await controls.setPower(true);
    expect(update).toHaveBeenLastCalledWith({
      isPowered: true,
      a: { t: 5, v: 15000 },
      c: plusState().c,
    });
  });
  it("keeps Rest+ muted/light-only playback muted when restoring", async () => {
    const initial = { ...plusState(), a: { t: 0, v: 15000 } };
    const { device, update, subject } = fake(RestPlus, initial);
    const controls = new RestControls(
      legacyRestDevice(device),
      legacySounds(device),
    );
    await controls.setPower(false);
    subject.next({ ...initial, isPowered: false });
    await controls.setPower(true);
    expect(update.mock.lastCall[0]).toMatchObject({
      isPowered: true,
      a: { t: 0 },
      c: initial.c,
    });
  });
  it("retains the previous Rest+ track for unmute across adapter recreation", async () => {
    const { device, subject, update } = fake(RestPlus, plusState());
    const memory = {};
    const controls = new RestControls(
      legacyRestDevice(device, memory),
      legacySounds(device),
    );
    await controls.setSound(false);
    subject.next({ ...plusState(), a: { t: 0, v: 15000 } });
    const restarted = new RestControls(
      legacyRestDevice(device, memory),
      legacySounds(device),
    );
    await restarted.setSound(true);
    expect(update.mock.lastCall[0].a.t).toBe(5);
    expect(memory).toHaveProperty("legacyTrack", 5);
  });
  it("maps Mini sound and volume without sending Rest 2 URLs, color, routine or pause fields", async () => {
    const { device, update } = fake(RestMini, miniState());
    const controls = new RestControls(
      legacyRestDevice(device),
      legacySounds(device),
    );
    await controls.setTrack(10130, true);
    expect(update).toHaveBeenLastCalledWith({
      current: {
        playing: "remote",
        step: 1,
        sound: { id: 10130, until: "indefinite" },
      },
    });
    await controls.setVolume(50);
    expect(update).toHaveBeenLastCalledWith({
      current: { sound: { v: 32768 } },
    });
    await controls.setSound(false);
    expect(update.mock.lastCall[0].current).toMatchObject({
      playing: "none",
      step: 0,
    });
  });
  it("restores Mini sound and volume and starts a default sound on a fresh empty device", async () => {
    const { device, subject, update } = fake(RestMini, miniState());
    const controls = new RestControls(
      legacyRestDevice(device),
      legacySounds(device),
    );
    await controls.setPower(false);
    subject.next({
      ...miniState(),
      current: { ...miniState().current, playing: "none" },
    });
    await controls.setPower(true);
    expect(update).toHaveBeenLastCalledWith({
      current: {
        playing: "remote",
        step: 1,
        sound: { id: 10128, v: 15000, until: "indefinite" },
      },
    });
    const blank = fake(RestMini, {
      ...miniState(),
      current: { playing: "none", step: 0, sound: { id: 0, v: 100 } },
    });
    await new RestControls(
      legacyRestDevice(blank.device),
      legacySounds(blank.device),
    ).setPower(true);
    expect(blank.update.mock.lastCall[0].current.sound.id).toBe(10126);
  });
  it.each([RestPlus, RestMini])("rejects offline %s writes", async (Model) => {
    const { device, update } = fake(Model, {
      ...(Model === RestPlus ? plusState() : miniState()),
      connected: false,
    });
    await expect(
      new RestControls(
        legacyRestDevice(device),
        legacySounds(device),
      ).setVolume(50),
    ).rejects.toThrow("offline");
    expect(update).not.toHaveBeenCalled();
  });
  it.each([RestPlus, RestMini])(
    "exposes only hardware-supported services for %s",
    (Model) => {
      const { device } = fake(
        Model,
        Model === RestPlus ? plusState() : miniState(),
      );
      const accessory = new PlatformAccessory(
        "Test Hatch",
        hap.uuid.generate(Model.name),
      );
      const warnings = vi.fn();
      accessory._associatedHAPAccessory.on("characteristic-warning", warnings);
      new RestControlsAccessory(
        legacyRestDevice(device),
        accessory,
        legacySounds(device),
      );
      expect(Boolean(accessory.getService(hap.Service.Lightbulb))).toBe(
        Model === RestPlus,
      );
      expect(Boolean(accessory.getService(hap.Service.Battery))).toBe(
        Model === RestPlus,
      );
      expect(accessory.getService(hap.Service.Television)).toBeTruthy();
      expect(accessory.getService(hap.Service.Fan)).toBeTruthy();
      expect(warnings).not.toHaveBeenCalled();
    },
  );
});

describe("Restore routine receiver", () => {
  it.each([Restore, RestIot])(
    "uses only established %s routine commands and shows no unsupported sliders",
    async (Model) => {
      const initial =
        Model === Restore
          ? { connected: true, content: { playing: "none" } }
          : { connected: true, current: { playing: "none", srId: 0 } };
      const { device, update, subject } = fake(Model, initial);
      const accessory = new PlatformAccessory(
        "Test Restore",
        hap.uuid.generate("restore-" + Model.name),
      );
      const id = Model === Restore ? 1 : 42;
      new RestoreReceiverAccessory(
        device,
        accessory,
        [{ id, name: "Bedtime" }],
        () => {},
      );
      expect(accessory.getService(hap.Service.Lightbulb)).toBeUndefined();
      expect(accessory.getService(hap.Service.Fan)).toBeUndefined();
      expect(
        accessory.getService(hap.Service.TelevisionSpeaker),
      ).toBeUndefined();
      const input = accessory
        .getService(hap.Service.Television)
        .getCharacteristic(hap.Characteristic.ActiveIdentifier);
      await input.handleSetRequest(id);
      expect(update).toHaveBeenLastCalledWith(
        Model === Restore
          ? {
              content: {
                playing: "routine",
                paused: false,
                offset: 0,
                step: 1,
              },
            }
          : {
              current: { playing: "routine", step: 1, srId: 42, paused: false },
            },
      );
      await input.handleSetRequest(0);
      expect(
        update.mock.lastCall[0][Model === Restore ? "content" : "current"]
          .playing,
      ).toBe("none");
      await expect(input.handleSetRequest(999)).rejects.toBeDefined();
      subject.next({ ...initial, connected: false });
      await expect(input.handleSetRequest(id)).rejects.toBeDefined();
    },
  );
});
