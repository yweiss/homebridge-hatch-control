# Hatch Control 0.3.0

The plugin is now **homebridge-hatch-control**, reflecting support beyond Rest 2. The configuration alias remains `HatchRestControl`, and existing Rest 2 receiver pairing identities and private preferences are preserved.

- Rest 2 / Rest+ 2: receiver sound picker, power, volume, brightness, color and remembered playback.
- Original Wi-Fi Rest+: new receiver using native sound IDs, power, volume, color/brightness and battery status.
- Rest Mini: new receiver with named sounds, power and volume; no light controls.
- Restore and Hatch Baby: experimental routine-only receivers. Modern recognized variants expose touch-ring/favorite routines; original Restore exposes Bedtime Routine. No unvalidated direct track, volume or color controls are shown.
- Bluetooth-only original Rest and Rest Go remain unsupported.

Rest-family receivers put No Sound last in the menu and restore remembered playback settings after power cycles. Apple Home uses a fan-speed service for the visible percentage volume slider; native receiver speaker controls are also exposed where supported.

**Migration:** install the new package and remove the old homebridge-hatch-rest-control package before restarting. Keep existing Hatch credentials and child-bridge settings. Rest 2 receivers retain pairing. Former bridged Rest+/Mini/Restore tiles require pairing the new external receiver separately and updating scenes/automations.

Validation: 52 automated tests pass on Node 22, 24 and 26; TypeScript builds successfully. Physical validation covers Rest 2nd Gen only. Newly added model adapters and Restore routine receivers are explicitly unvalidated on hardware. Privacy and package-content scans are performed before release.

Author: Yoav Weiss. Credits retained for Dusty Greif, Scott MacWatters and Brian Via. MIT licensed.
