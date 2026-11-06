# Changelog

## 0.1.0

- Consolidated Hatch Rest plugin authored by Yoav Weiss, based on dgreif's integration.
- Added Rest 2 and Rest+ 2 power, volume, brightness, color, and named sound controls.
- Added dynamic sound discovery, cached sound names, and optional sound filtering.
- Preserved attribution to Dusty Greif, Scott MacWatters, and protocol reference author Brian Via.
- Thirty automated tests pass, covering controls, HomeKit services, and connection recovery.
- Rest 2nd Gen live device checks confirmed volume, Ocean/Rain selection at zero volume, mute/unmute, red/blue color, brightness, independent light off, power off, and volume adjustment while off. Original device settings were restored after testing.
- Starting a favorite routine uses the upstream mechanism and is unit-tested; Home app/Siri presentation and routine startup still require user acceptance testing.
- Other Hatch models have not been hardware-validated for this release.
