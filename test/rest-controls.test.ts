import { describe, it, expect, vi } from "vitest";
import { BehaviorSubject } from "rxjs";
import { createRequire } from "node:module";
import { setHap } from "../src/shared/hap.ts";
import { RestControlsAccessory } from "../src/devices/rest-controls-accessory.ts";
import {
  RestControls,
  soundCatalog,
  raw,
  percent,
  trackChange,
  colorChange,
  lightOn,
  lightHsb,
  volumeChange,
} from "../src/devices/rest-controls.ts";
import type { RestIotState } from "../src/shared/hatch-sleep-types.ts";
import type { RestIot } from "../src/devices/rest-iot.ts";

const require = createRequire(import.meta.url);
const hap = require("@homebridge/hap-nodejs");
const {
  PlatformAccessory,
} = require("../node_modules/homebridge/dist/platformAccessory.js");
setHap(hap);
const ocean = {
  id: 10138,
  name: "Ocean",
  url: "https://images.hatchbaby.com/content/sounds/ocean.wav",
};
function state(): RestIotState {
  return {
    connected: true,
    deviceInfo: { f: "1.2.3" },
    current: {
      playing: "none",
      step: 0,
      srId: 0,
      paused: false,
      color: { id: 9998, r: 0, g: 0, b: 0, w: 0, i: 4587 },
      sound: {
        id: 19998,
        v: 11140,
        mute: false,
        url: "https://images.hatchbaby.com/content/sounds/noSound.wav",
      },
    },
  } as RestIotState;
}
function mockDevice() {
  const subject = new BehaviorSubject(state());
  const update = vi.fn().mockResolvedValue(undefined);
  const device = {
    name: "Nursery Rest",
    model: "Rest 2nd Gen",
    macAddress: "00:00:00:00:00:00",
    onState: subject,
    onFirmwareVersion: new BehaviorSubject("1.2.3"),
    update,
    fetchRoutines: vi.fn().mockResolvedValue([{ id: 123 }]),
  } as unknown as RestIot;
  return {
    device,
    subject,
    update,
    controls: new RestControls(device, [ocean]),
  };
}
describe("Rest 2 controls", () => {
  it("round trips volume without wrapping invalid percentages", () => {
    for (let i = 0; i <= 100; i++) expect(percent(raw(i))).toBe(i);
    for (const i of [-1, 101, NaN, Infinity]) expect(() => raw(i)).toThrow();
    expect(volumeChange(17)).toEqual({ current: { sound: { v: 11141 } } });
  });
  it("selects an actual named catalog sound without altering volume or light", () => {
    expect(trackChange(ocean)).toEqual({
      current: {
        playing: "remote",
        step: 1,
        srId: 0,
        paused: false,
        sound: {
          id: 10138,
          url: ocean.url,
          mute: false,
          until: "indefinite",
          duration: 0,
        },
      },
    });
  });
  it("filters placeholders, invalid URLs, duplicates and configured exclusions", () => {
    const items = [
      { id: 10138, title: "Ocean", contentType: "sound", wavUrl: ocean.url },
      {
        id: 10138,
        title: "Duplicate",
        contentType: "sound",
        wavUrl: ocean.url,
      },
      { id: 19998, title: "No Sound", contentType: "sound", wavUrl: ocean.url },
      { id: 5, title: "Bad", contentType: "sound", wavUrl: "file:///secret" },
      { id: 234, title: "Red", contentType: "color", wavUrl: ocean.url },
    ];
    expect(soundCatalog(items)).toEqual([ocean]);
    expect(soundCatalog(items, [5])).toEqual([]);
  });
  it("turns light on quietly from an off device and preserves playing sound otherwise", () => {
    const s = state(),
      change = colorChange(s, { h: 0, s: 100, b: 10 });
    expect(change.current).toMatchObject({
      playing: "remote",
      sound: { mute: true },
      color: { id: 9999, r: 65535, g: 0, b: 0, i: 6554 },
    });
    s.current.playing = "routine";
    expect(
      colorChange(s, { h: 240, s: 100, b: 10 }).current?.sound,
    ).toBeUndefined();
    expect(colorChange(s, { h: 0, s: 100, b: 0 })).toEqual({
      current: { color: { id: 9998, r: 0, g: 0, b: 0, w: 0, i: 0 } },
    });
  });
  it("keeps the light visible when audio is paused", () => {
    const s = state();
    s.current.playing = "routine";
    s.current.paused = true;
    s.current.color = { ...s.current.color, id: 233, w: 65535, i: 32768 };
    expect(lightOn(s)).toBe(true);
    expect(lightHsb(s)).toMatchObject({ s: 0, b: 50 });
  });
  it("rejects offline changes, and does not mute another sound when an inactive button is turned off", async () => {
    const { controls, subject, update } = mockDevice();
    await controls.setTrack(ocean.id, false);
    expect(update).not.toHaveBeenCalled();
    subject.next({ ...state(), connected: false });
    await expect(controls.setVolume(20)).rejects.toThrow("offline");
    expect(update).not.toHaveBeenCalled();
  });
  it("uses favorite routine power and resumes a paused routine without resetting it", async () => {
    const { controls, subject, update } = mockDevice();
    await controls.setPower(true);
    expect(update).toHaveBeenLastCalledWith({
      current: { playing: "routine", step: 1, srId: 123, paused: false },
    });
    subject.next({
      ...state(),
      current: { ...state().current, playing: "routine", paused: true },
    });
    await controls.setPower(true);
    expect(update).toHaveBeenLastCalledWith({ current: { paused: false } });
    await controls.setPower(false);
    expect(update).toHaveBeenLastCalledWith({
      current: { playing: "none", step: 0, srId: 0, paused: false },
    });
  });
  it("reports failed commands to the HomeKit caller", async () => {
    const { controls, update } = mockDevice();
    update.mockRejectedValueOnce(new Error("Not authorized"));
    await expect(controls.setVolume(20)).rejects.toThrow("Not authorized");
  });
  it("creates distinct power, volume, color and named sound services without duplicating them after restart", async () => {
    const { device, update } = mockDevice();
    const accessory = new PlatformAccessory(
      "Nursery Rest",
      hap.uuid.generate("test-rest"),
    );
    const warnings = vi.fn();
    accessory._associatedHAPAccessory.on("characteristic-warning", warnings);
    const power = accessory.addService(hap.Service.Switch, "Nursery Rest");
    new RestControlsAccessory(device, accessory, [ocean]);
    expect(accessory.getService(hap.Service.Switch)).toBe(power);
    expect(
      accessory.getServiceById(hap.Service.Lightbulb, "light"),
    ).toBeTruthy();
    const volume = accessory.getServiceById(hap.Service.Fan, "volume");
    await volume
      .getCharacteristic(hap.Characteristic.RotationSpeed)
      .handleSetRequest(25);
    expect(update).toHaveBeenLastCalledWith({
      current: { sound: { v: 16384 } },
    });
    expect(
      accessory.getServiceById(hap.Service.Switch, "sound:10138").displayName,
    ).toBe("Nursery Rest Ocean");
    const count = accessory.services.length;
    new RestControlsAccessory(device, accessory, [ocean]);
    expect(accessory.services.length).toBe(count);
    expect(warnings).not.toHaveBeenCalled();
    const light = accessory.getServiceById(hap.Service.Lightbulb, "light");
    await Promise.all([
      light.getCharacteristic(hap.Characteristic.Hue).handleSetRequest(120),
      light
        .getCharacteristic(hap.Characteristic.Saturation)
        .handleSetRequest(100),
      light
        .getCharacteristic(hap.Characteristic.Brightness)
        .handleSetRequest(10),
    ]);
    expect(update).toHaveBeenLastCalledWith({
      current: {
        playing: "remote",
        step: 1,
        srId: 0,
        paused: false,
        sound: { mute: true },
        color: {
          id: 9999,
          r: 0,
          g: 65535,
          b: 0,
          w: 0,
          i: 6554,
          until: "indefinite",
          duration: 0,
        },
      },
    });
  });
  it("offers one receiver sound selection with ordered inputs and no track switches", async () => {
    const { device, subject, update } = mockDevice();
    const rain = { ...ocean, id: 10139, name: "Rain" };
    const accessory = new PlatformAccessory(
      "Rest Preview",
      hap.uuid.generate("receiver-test"),
      hap.Categories.AUDIO_RECEIVER,
    );
    const warnings = vi.fn();
    accessory._associatedHAPAccessory.on("characteristic-warning", warnings);
    new RestControlsAccessory(device, accessory, [ocean, rain], "receiver");
    expect(warnings).not.toHaveBeenCalled();
    expect(
      accessory.services.filter((s) => s.UUID === hap.Service.Switch.UUID),
    ).toHaveLength(0);
    const tv = accessory.getService(hap.Service.Television);
    expect(tv.isPrimaryService).toBe(true);
    const input = tv.getCharacteristic(hap.Characteristic.ActiveIdentifier);
    await input.handleSetRequest(ocean.id);
    expect(update).toHaveBeenLastCalledWith(trackChange(ocean));
    await input.handleSetRequest(rain.id);
    expect(update).toHaveBeenLastCalledWith(trackChange(rain));
    subject.next({
      ...state(),
      current: {
        ...state().current,
        playing: "remote",
        sound: { ...state().current.sound, id: rain.id },
      },
    });
    expect(await input.handleGetRequest()).toBe(rain.id);
    await input.handleSetRequest(0);
    expect(update).toHaveBeenLastCalledWith({
      current: { sound: { mute: true } },
    });
    await expect(input.handleSetRequest(999)).rejects.toBeDefined();
    const visible = accessory.services.filter((s) =>
      [
        hap.Service.Television.UUID,
        hap.Service.Fan.UUID,
        hap.Service.Lightbulb.UUID,
      ].includes(s.UUID),
    );
    expect(visible.map((s) => s.UUID)).toEqual([
      hap.Service.Television.UUID,
      hap.Service.Fan.UUID,
      hap.Service.Lightbulb.UUID,
    ]);
    const order = Buffer.from(
      tv.getCharacteristic(hap.Characteristic.DisplayOrder).value,
      "base64",
    );
    expect(order.readUInt32LE(2)).toBe(0);
    expect(order.readUInt32LE(10)).toBe(ocean.id);
    expect(order.readUInt32LE(18)).toBe(rain.id);
  });
  it("supports receiver volume controls without resetting sound or light", async () => {
    const { device, update } = mockDevice();
    const accessory = new PlatformAccessory(
      "Rest Preview",
      hap.uuid.generate("receiver-volume"),
    );
    new RestControlsAccessory(device, accessory, [ocean], "receiver");
    const speaker = accessory.getService(hap.Service.TelevisionSpeaker);
    await speaker
      .getCharacteristic(hap.Characteristic.Volume)
      .handleSetRequest(20);
    expect(update).toHaveBeenLastCalledWith(volumeChange(20));
    await speaker
      .getCharacteristic(hap.Characteristic.VolumeSelector)
      .handleSetRequest(hap.Characteristic.VolumeSelector.INCREMENT);
    expect(update).toHaveBeenLastCalledWith(volumeChange(22));
    await speaker
      .getCharacteristic(hap.Characteristic.Mute)
      .handleSetRequest(true);
    expect(update).toHaveBeenLastCalledWith({
      current: { sound: { mute: true } },
    });
  });
  it("supplies catalog input names, rejects pairing placeholders, and retains user renames", async () => {
    const { device } = mockDevice();
    const names: Record<string, string> = {};
    const saved = vi.fn();
    function create() {
      const accessory = new PlatformAccessory(
        "Rest Preview",
        hap.uuid.generate("names-test"),
      );
      accessory.context.receiverNames = names;
      new RestControlsAccessory(device, accessory, [ocean], "receiver", saved);
      return accessory;
    }
    const accessory = create();
    const C = hap.Characteristic;
    expect(
      await accessory
        .getService(hap.Service.AccessoryInformation)
        .getCharacteristic(C.ConfiguredName)
        .handleGetRequest(),
    ).toBe("Rest Preview");
    const name = accessory
      .getServiceById(hap.Service.InputSource, "input:10138")
      .getCharacteristic(C.ConfiguredName);
    expect(await name.handleGetRequest()).toBe("Ocean");
    await name.handleSetRequest("Input Source 3");
    await new Promise((resolve) => setImmediate(resolve));
    expect(name.value).toBe("Ocean");
    expect(saved).not.toHaveBeenCalled();
    await name.handleSetRequest("Bedtime Waves");
    expect(saved).toHaveBeenCalledOnce();
    const restarted = create()
      .getServiceById(hap.Service.InputSource, "input:10138")
      .getCharacteristic(C.ConfiguredName);
    expect(await restarted.handleGetRequest()).toBe("Bedtime Waves");
    await restarted.handleSetRequest("Input Source");
    await new Promise((resolve) => setImmediate(resolve));
    expect(restarted.value).toBe("Bedtime Waves");
  });
});
