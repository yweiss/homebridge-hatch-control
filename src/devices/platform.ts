import { ReceiverStateStore } from "./receiver-state.ts";
import { ApiConfig, HatchBabyApi } from "./api.ts";
import { hap, isTestHomebridge } from "../shared/hap.ts";
import { delay, useLogger } from "../shared/util.ts";
import { LightAndSoundMachineAccessory } from "../shared/light-and-sound-machine.ts";
import { SoundMachineAccessory } from "../shared/sound-machine.ts";
import type {
  API,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
} from "homebridge";
import { RestoreAccessory } from "./restore-accessory.ts";
import { RestIot } from "./rest-iot.ts";
import { Restore } from "./restore.ts";
import { RestControlsAccessory } from "./rest-controls-accessory.ts";
import { fetchSounds, HatchSound } from "./rest-controls.ts";
import { Product } from "../shared/hatch-sleep-types.ts";

export const pluginName = "homebridge-hatch-rest-control";
export const platformName = "HatchRestControl";

const initialConnectRetryDelay = 30000,
  maxConnectRetryDelay = 600000;

export class HatchBabyRestPlatform implements DynamicPlatformPlugin {
  public log;
  public config;
  public api;
  private readonly homebridgeAccessories: {
    [uuid: string]: PlatformAccessory;
  } = {};

  constructor(log: Logging, config: PlatformConfig & ApiConfig, api: API) {
    this.log = log;
    this.config = config;
    this.api = api;
    useLogger({
      logInfo(message) {
        log.info(message);
      },
      logError(message) {
        log.error(message);
      },
    });

    if (!config?.email || !config?.password) {
      this.log.info(
        "Configure your Hatch email and password to enable HatchRestControl",
      );
      return;
    }

    this.api.on("didFinishLaunching", () => {
      this.log.debug("didFinishLaunching");
      this.connectToApiWithRetry().catch((e) => {
        this.log.error("Error connecting to API");
        this.log.error(e);
      });
    });

    this.homebridgeAccessories = {};
  }

  private async connectToApiWithRetry() {
    let retryDelay = initialConnectRetryDelay;

    for (;;) {
      try {
        await this.connectToApi();
        return;
      } catch (e) {
        // The rest client only retries network-level failures - an HTTP
        // error response at boot (e.g. a 429 from login, or a 5xx from the
        // Hatch API) lands here. Without a retry, cached accessories would
        // sit in HomeKit responding to nothing until homebridge is restarted
        this.log.error("Error connecting to API");
        this.log.error(e as unknown as string);
        this.log.error(
          `Retrying connection in ${Math.round(retryDelay / 1000)}s`,
        );
        await delay(retryDelay);
        retryDelay = Math.min(retryDelay * 2, maxConnectRetryDelay);
      }
    }
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info(
      `Configuring cached accessory ${accessory.UUID} ${accessory.displayName}`,
    );
    this.log.debug("%j", accessory);
    this.homebridgeAccessories[accessory.UUID] = accessory;
  }

  async connectToApi() {
    if (!this.config?.email || !this.config?.password) return;
    const hatchBabyApi =
        this.config.email && this.config.password
          ? new HatchBabyApi(this.config)
          : undefined,
      {
        restPluses,
        restMinis,
        restores,
        restoreIots,
        restIots,
        restIotPluses,
        restoreV4s,
        restoreV5s,
        restBabies,
      } = hatchBabyApi
        ? await hatchBabyApi.getDevices()
        : {
            restPluses: [],
            restMinis: [],
            restores: [],
            restIots: [],
            restIotPluses: [],
            restoreIots: [],
            restoreV4s: [],
            restoreV5s: [],
            restBabies: [],
          },
      { api } = this,
      cachedAccessoryIds = Object.keys(this.homebridgeAccessories),
      platformAccessories: PlatformAccessory[] = [],
      activeAccessoryIds: string[] = [],
      debugPrefix = isTestHomebridge ? "TEST " : "",
      devices = [
        ...restPluses,
        ...restMinis,
        ...restIots,
        ...restIotPluses,
        ...restores,
        ...restoreIots,
        ...restoreV4s,
        ...restoreV5s,
        ...restBabies,
      ];

    this.log.info("Configuring Hatch Devices:");

    if (devices.length) {
      const countByModel = devices.reduce(
        (acc, device) => {
          const model = device.model;
          acc[model] = (acc[model] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      Object.entries(countByModel).forEach(([model, count]) => {
        this.log.info(`  ${model}: ${count}`);
      });
    } else {
      this.log.info("  No supported devices found");
    }

    let sounds: HatchSound[] | undefined;
    if (hatchBabyApi && (restIots.length || restIotPluses.length)) {
      try {
        sounds = await fetchSounds(
          hatchBabyApi.restClient,
          this.config.soundIds,
        );
      } catch {
        this.log.warn(
          "Sound catalog unavailable; using cached sound names. Power, light and volume controls remain available.",
        );
      }
    }

    const receiverState = new ReceiverStateStore(api.user.storagePath());

    devices.forEach((device) => {
      const id = device.id,
        uuid = hap.uuid.generate(debugPrefix + id),
        displayName = debugPrefix + device.name;
      const cached = this.homebridgeAccessories[uuid];
      if (
        device instanceof RestIot &&
        (device.info.product === Product.riot ||
          device.info.product === Product.riotPlus)
      ) {
        // Keep the original external UUID namespace to preserve existing pairings.
        const receiverUuid = hap.uuid.generate(
          "hatch-rest-receiver-preview:" + id,
        );
        const receiver = new api.platformAccessory(
          displayName,
          receiverUuid,
          hap.Categories.AUDIO_RECEIVER,
        );
        receiver.context = receiverState.load(receiverUuid, cached?.context);
        const available = sounds ?? receiver.context.restSounds ?? [];
        receiver.context.restSounds = available;
        // Persist the legacy context before removing the former bridged accessory.
        receiverState.save(receiverUuid, receiver.context);
        new RestControlsAccessory(device, receiver, available, () => {
          try {
            receiverState.save(receiverUuid, receiver.context);
          } catch {
            this.log.error(
              "Unable to save receiver settings in Homebridge storage.",
            );
          }
        });
        api.publishExternalAccessories(pluginName, [receiver]);
        this.log.info(
          `Full controls: ${device.name}; ${available.length} named sounds`,
        );
        return;
      }
      const homebridgeAccessory =
        cached ||
        new api.platformAccessory(displayName, uuid, hap.Categories.LIGHTBULB);
      if (!cached) {
        platformAccessories.push(homebridgeAccessory);
        this.log.info(`Adding new Hatch ${device.model} - ${displayName}`);
      }
      if (device instanceof Restore || device instanceof RestIot) {
        new RestoreAccessory(device, homebridgeAccessory);
      } else if ("onBrightness" in device) {
        new LightAndSoundMachineAccessory(device, homebridgeAccessory);
      } else {
        new SoundMachineAccessory(device, homebridgeAccessory);
      }

      this.homebridgeAccessories[uuid] = homebridgeAccessory;
      activeAccessoryIds.push(uuid);
    });

    if (platformAccessories.length) {
      api.registerPlatformAccessories(
        pluginName,
        platformName,
        platformAccessories,
      );
    }

    api.updatePlatformAccessories(Object.values(this.homebridgeAccessories));

    const staleAccessories = cachedAccessoryIds
      .filter((cachedId) => !activeAccessoryIds.includes(cachedId))
      .map((id) => this.homebridgeAccessories[id]);

    staleAccessories.forEach((staleAccessory) => {
      this.log.info(
        `Removing stale cached accessory ${staleAccessory.UUID} ${staleAccessory.displayName}`,
      );
    });

    if (staleAccessories.length) {
      this.api.unregisterPlatformAccessories(
        pluginName,
        platformName,
        staleAccessories,
      );
    }
  }
}
