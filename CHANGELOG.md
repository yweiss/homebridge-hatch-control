# Changelog

## 0.2.1

- Main power restores the last sound, volume, mute, color and brightness settings in manual mode, with memory retained across restarts.
- Preserves silent/light-only use and remembers externally observed playback.
- Renamed the silent input to No Sound and placed it last in the menu.
- Added regression tests for power cycling, restart persistence, offline snapshots and volume changes while off.

## 0.2.0

- Replaced Rest 2 sound switches with a separately paired audio receiver and single-choice named sound picker.
- Kept power, percentage volume, brightness and color controls together. Apple Home uses a fan-speed slider for percentage volume; native receiver speaker and remote controls are also exposed.
- Supplied real input names during pairing and preserved user renames in private Homebridge storage.
- Removed the alternate layout option and migrated away from its duplicate bridged accessory while retaining existing receiver pairing identity.
- Added persistent preference migration and an inactive-until-configured guard.
- Hardware acceptance covers Rest 2nd Gen. Other models and exact Siri phrases remain unverified.

## 0.1.1

- Register configured service names explicitly to avoid Homebridge startup warnings.

## 0.1.0

- Consolidated Hatch Rest plugin authored by Yoav Weiss, based on dgreif's integration.
- Added Rest 2 and Rest+ 2 power, volume, brightness, color, and named sound controls.
- Added dynamic sound discovery, cached sound names, and optional sound filtering.
- Preserved attribution to Dusty Greif, Scott MacWatters, and protocol reference author Brian Via.
- Thirty automated tests pass, covering controls, HomeKit services, and connection recovery.
- Rest 2nd Gen live device checks confirmed volume, Ocean/Rain selection at zero volume, mute/unmute, red/blue color, brightness, independent light off, power off, and volume adjustment while off. Original device settings were restored after testing.
- Starting a favorite routine uses the upstream mechanism and is unit-tested; Home app/Siri presentation and routine startup still require user acceptance testing.
- Other Hatch models have not been hardware-validated for this release.
