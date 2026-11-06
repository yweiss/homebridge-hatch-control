import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HsbColor } from "../shared/colors.ts";
import type { PlaybackMemory, HatchSound } from "./rest-controls.ts";

interface ReceiverState extends PlaybackMemory {
  receiverNames?: Record<string, string>;
  restSounds?: HatchSound[];
  restColor?: HsbColor;
}

// Only UI preferences and playback settings are persisted; never account credentials.
export class ReceiverStateStore {
  private readonly directory: string;
  constructor(storagePath: string) {
    this.directory = join(storagePath, "hatch-rest-control");
  }

  private path(uuid: string) {
    if (!/^[a-f0-9-]+$/i.test(uuid))
      throw new Error("Invalid receiver identifier");
    return join(this.directory, `${uuid}.json`);
  }

  load(uuid: string, legacy?: ReceiverState): ReceiverState {
    try {
      const state = JSON.parse(readFileSync(this.path(uuid), "utf8"));
      return this.preferences(state);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return this.preferences(legacy || {});
    }
  }

  private preferences(state: ReceiverState): ReceiverState {
    return {
      receiverNames: { ...state.receiverNames },
      restSounds: state.restSounds,
      restColor: state.restColor,
      lastPlayback: state.lastPlayback,
    };
  }

  save(uuid: string, state: ReceiverState) {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const destination = this.path(uuid);
    const temporary = destination + ".tmp";
    writeFileSync(temporary, JSON.stringify(this.preferences(state)), {
      mode: 0o600,
    });
    renameSync(temporary, destination);
  }
}
