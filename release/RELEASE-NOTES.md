# Hatch Rest Control 0.2.0

Rest 2 controls now live in a single receiver accessory with a named sound picker, power, percentage volume, brightness and color. The sound menu permits one active selection, and actual catalog names are provided during pairing. Custom names persist across restarts.

The former switch layout and its configuration option have been removed. Existing receiver pairings keep their identity; the old duplicate switch tile is removed automatically. Scenes targeting old switches need to be updated. New installations pair each receiver separately using the hosting bridge’s setup code.

Apple Home uses a fan-speed service for the visible percentage volume slider. Native speaker volume/mute and remote steps are exposed as well. Home controls its own icon and panel arrangement.

Validation: 36 automated tests on Node 22, 24 and 26, successful TypeScript build, package-content and known-private-data scans. Rest 2nd Gen is the hardware-tested model; other models and exact Siri phrases are not claimed as validated.

Author: Yoav Weiss. Credits retained for Dusty Greif, Scott MacWatters and Brian Via.
