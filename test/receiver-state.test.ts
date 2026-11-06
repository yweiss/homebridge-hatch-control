import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ReceiverStateStore } from "../src/devices/receiver-state.ts";

describe("receiver preference migration", () => {
  it("retains aliases and catalog after the legacy cache is removed, without storing unrelated data", () => {
    const directory = mkdtempSync(join(tmpdir(), "receiver-state-"));
    try {
      const store = new ReceiverStateStore(directory);
      const legacy = {
        receiverNames: { "input:1": "Waves" },
        restSounds: [],
        lastPlayback: {
          sound: {
            id: 19998,
            url: "https://example.com/silence.wav",
            v: 100,
            mute: true,
            duration: 0,
            until: "indefinite",
          },
          color: {
            id: 9999,
            r: 0,
            g: 0,
            b: 0,
            w: 65535,
            i: 100,
            duration: 0,
            until: "indefinite" as const,
          },
        },
        password: "synthetic-secret",
      };
      const migrated = store.load("abc-123", legacy);
      store.save("abc-123", migrated);
      expect(new ReceiverStateStore(directory).load("abc-123")).toEqual(
        migrated,
      );
      const file = join(directory, "hatch-rest-control", "abc-123.json");
      expect(readFileSync(file, "utf8")).not.toContain("synthetic-secret");
      expect(statSync(file).mode & 0o777).toBe(0o600);
      expect(() => store.save("../escape", migrated)).toThrow(
        "Invalid receiver",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
