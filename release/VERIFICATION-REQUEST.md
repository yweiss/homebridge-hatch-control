# Verification Request: homebridge-hatch-control

Draft only — submit after version 0.3.0 is published to npm and the matching GitHub release is live.

## Basic details

Plugin Name: homebridge-hatch-control

Link To GitHub Repo: https://github.com/yweiss/homebridge-hatch-control

npm package: https://www.npmjs.com/package/homebridge-hatch-control (pending publication)

Plugin Icon: none submitted; use the default until a separate licensed icon is available.

## Proposed verification answers

- Additional functionality beyond existing verified plugins: **Yes.** Derived from dgreif/homebridge-hatch-baby-rest, adding direct Rest 2 / Rest+ 2 sound selection, percentage volume, brightness and color through a single receiver interface. The single-choice input menu replaces the separate sound-switch layout. Full attribution and upstream MIT notices are retained.
- Installs and does not start unless configured: **Yes.** Platform requires both email and password before subscribing to launch or connecting; regression-tested. No install/postinstall scripts.
- No TTY or special startup parameters required: **Yes.** Standard Homebridge dynamic platform and settings GUI; receivers pair through the normal Home accessory flow.
- No analytics or developer tracking: **Yes.** Network connections serve Hatch authentication, discovery, catalog and AWS IoT device control.
- Files stored inside Homebridge storage: **Yes.** Receiver preferences are stored beneath `api.user.storagePath()` with private file permissions; no credentials are stored in that preference file.
- Catches and logs its errors: **Yes, within the tested scope.** Connection errors are caught/retried; HomeKit writes propagate failures; preference writes are caught and logged. Tests cover offline and rejected commands and connection recovery.

## More information

Maintainer: Yoav Weiss (@yweiss on GitHub; yoav_weiss on npm).

Version 0.3.0 is a dynamic platform using the Homebridge settings schema. Automated checks: 52 tests pass on Node 22, 24 and 26; TypeScript builds successfully. CI includes the same Node matrix. Attach a successful CI run for the final public commit when submitting.

Physical validation covers Rest 2nd Gen only. Rest+ 2nd Gen uses the same implemented protocol but is not separately hardware-validated. Original Wi-Fi Rest+ and Rest Mini now use model-specific receiver adapters based on established upstream protocol fields. Restore/Baby use routine-only receivers and do not expose unvalidated sound/color controls. These additions have automated tests but remain hardware-unvalidated, explicitly documented in the README.

The receiver exposes native speaker volume/mute and remote volume controls. A fan service supplies the percentage volume slider because Apple Home does not render the native receiver volume characteristic as that slider. This limitation is documented. Sound selection is exclusive and catalog names/custom aliases persist. Power restores remembered playback settings, including muted/light-only use; the No Sound input appears last. No audio streaming or microphone support is claimed.

Credits: Dusty Greif, Scott MacWatters and Brian Via. MIT copyright notices remain in LICENSE and NOTICE.md.

## Before submission

- Publish version 0.3.0 to npm; verify registry metadata and clean installation.
- Push the release commit and create the matching GitHub release with notes.
- Confirm final public CI is green and issues remain enabled.
- Replace pending statements and attach the exact public release/CI links.
- Submit through the Homebridge verification issue form. Approval is Homebridge’s decision; no badge should be claimed in advance.

Requirements checked: https://github.com/homebridge/plugins/wiki/Verified-Plugins

Form: https://github.com/homebridge/plugins/issues/new?template=1_verification-request.yml
