import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { setHap } from "../src/shared/hap.ts";
import { HatchBabyRestPlatform } from "../src/devices/platform.ts";
import { HatchBabyApi } from "../src/devices/api.ts";
import { RestIot } from "../src/devices/rest-iot.ts";
import { Product } from "../src/shared/hatch-sleep-types.ts";
import { ReceiverStateStore } from "../src/devices/receiver-state.ts";
vi.mock("../src/devices/api.ts", () => ({
  HatchBabyApi: class {
    async getDevices() {
      return {};
    }
  },
}));
vi.mock("../src/devices/rest-controls-accessory.ts", () => ({
  RestControlsAccessory: class {},
}));
vi.mock("../src/devices/rest-controls.ts", () => ({
  fetchSounds: vi.fn().mockRejectedValue(new Error("offline")),
}));
const require = createRequire(import.meta.url);
const hap = require("@homebridge/hap-nodejs");
const {
  PlatformAccessory,
} = require("../node_modules/homebridge/dist/platformAccessory.js");
setHap(hap);
const log = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };

describe("platform release migration", () => {
  it("does not launch or remove cached accessories without credentials", async () => {
    const api = { on: vi.fn(), unregisterPlatformAccessories: vi.fn() };
    const platform = new HatchBabyRestPlatform(
      log as any,
      { platform: "HatchRestControl" } as any,
      api as any,
    );
    await platform.connectToApi();
    expect(api.on).not.toHaveBeenCalled();
    expect(api.unregisterPlatformAccessories).not.toHaveBeenCalled();
  });
  it("persists legacy names before removing the old tile and retains the external pairing UUID", async () => {
    const directory = mkdtempSync(join(tmpdir(), "hatch-platform-"));
    try {
      const device = Object.create(RestIot.prototype);
      Object.defineProperties(device, {
        id: { value: "fixture-device" },
        name: { value: "Nursery Rest" },
        model: { value: "Rest 2nd Gen" },
        info: { value: { product: Product.riot } },
      });
      vi.spyOn(HatchBabyApi.prototype, "getDevices").mockResolvedValue({
        restPluses: [],
        restMinis: [],
        restores: [],
        restoreIots: [],
        restIots: [device],
        restIotPluses: [],
        restoreV4s: [],
        restoreV5s: [],
        restBabies: [],
      } as any);
      const api = {
        on: vi.fn(),
        user: { storagePath: () => directory },
        platformAccessory: PlatformAccessory,
        publishExternalAccessories: vi.fn(),
        registerPlatformAccessories: vi.fn(),
        updatePlatformAccessories: vi.fn(),
        unregisterPlatformAccessories: vi.fn(),
      };
      const platform = new HatchBabyRestPlatform(
        log as any,
        {
          platform: "HatchRestControl",
          email: "example@example.com",
          password: "fixture",
        },
        api as any,
      );
      const cached = new PlatformAccessory(
        "Nursery Rest",
        hap.uuid.generate("fixture-device"),
      );
      cached.context.receiverNames = { "input:1": "Waves" };
      cached.context.restSounds = [];
      platform.configureAccessory(cached);
      await platform.connectToApi();
      const receiver = api.publishExternalAccessories.mock.calls[0][1][0];
      expect(receiver.UUID).toBe(
        hap.uuid.generate("hatch-rest-receiver-preview:fixture-device"),
      );
      expect(
        new ReceiverStateStore(directory).load(receiver.UUID).receiverNames,
      ).toEqual(cached.context.receiverNames);
      expect(api.registerPlatformAccessories).not.toHaveBeenCalled();
      expect(api.unregisterPlatformAccessories).toHaveBeenCalledWith(
        "homebridge-hatch-rest-control",
        "HatchRestControl",
        [cached],
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
