import { RestPlus } from "./rest-plus.ts";
import { RestMini } from "./rest-mini.ts";
import { legacyRestDevice, legacySounds } from "./legacy-rest-controls.ts";
import { RestoreReceiverAccessory } from "./restore-receiver.ts";
import { ReceiverStateStore } from "./receiver-state.ts";
import { ApiConfig, HatchBabyApi } from "./api.ts";
import { hap, isTestHomebridge } from "../shared/hap.ts";
import { delay, useLogger } from "../shared/util.ts";
import type {
  API,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
} from "homebridge";
import { RestIot } from "./rest-iot.ts";
import { Restore } from "./restore.ts";
import { RestControlsAccessory } from "./rest-controls-accessory.ts";
import { fetchSounds, HatchSound } from "./rest-controls.ts";
import { Product } from "../shared/hatch-sleep-types.ts";

export const pluginName = "homebridge-hatch-control";
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

    for (const device of devices) {
      const id = device.id,
        uuid = hap.uuid.generate(debugPrefix + id),
        displayName = debugPrefix + device.name;
      const cached = this.homebridgeAccessories[uuid];
      const legacy = device instanceof RestPlus || device instanceof RestMini;
      const fullControls =
        legacy ||
        (device instanceof RestIot &&
          (device.info.product === Product.riot ||
            device.info.product === Product.riotPlus));
      {
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
        const available = legacy
          ? legacySounds(device as RestPlus | RestMini, this.config.soundIds)
          : (sounds ?? receiver.context.restSounds ?? []);
        receiver.context.restSounds = available;
        // Persist the legacy context before removing the former bridged accessory.
        receiverState.save(receiverUuid, receiver.context);
        const save = () => {
          try {
            receiverState.save(receiverUuid, receiver.context);
          } catch {
            this.log.error(
              "Unable to save receiver settings in Homebridge storage.",
            );
          }
        };
        if (fullControls) {
          const controlled = legacy
            ? legacyRestDevice(
                device as RestPlus | RestMini,
                receiver.context,
                save,
              )
            : (device as RestIot);
          new RestControlsAccessory(controlled, receiver, available, save);
        } else {
          let routines = receiver.context.restRoutines || [];
          if (device instanceof Restore)
            routines = [{ id: 1, name: "Bedtime Routine" }];
          else {
            try {
              const found = await (device as RestIot).fetchRoutines();
              const seen = new Set<number>();
              routines = found
                .filter(
                  (r) =>
                    Number.isInteger(r.id) &&
                    r.id > 0 &&
                    r.id <= 0xffffffff &&
                    !seen.has(r.id) &&
                    seen.add(r.id),
                )
                .slice(0, 40)
                .map((r) => ({
                  id: r.id,
                  name: r.name?.trim() || `Routine ${r.id}`,
                }));
            } catch {
              this.log.warn(
                "Routine catalog unavailable; using cached routine names.",
              );
            }
          }
          receiver.context.restRoutines = routines;
          save();
          new RestoreReceiverAccessory(
            device as Restore | RestIot,
            receiver,
            routines,
            save,
          );
        }
        api.publishExternalAccessories(pluginName, [receiver]);
        this.log.info(
          fullControls
            ? `Receiver controls: ${device.name}; ${available.length} named sounds`
            : `Routine receiver: ${device.name}; ${receiver.context.restRoutines.length} routines (direct sound/light controls unavailable)`,
        );
      }
    }

    api.updatePlatformAccessories(Object.values(this.homebridgeAccessories));

    const staleAccessories = cachedAccessoryIds.map(
      (id) => this.homebridgeAccessories[id],
    );

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
