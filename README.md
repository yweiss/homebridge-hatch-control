# Hatch Control

**One Apple Home receiver per Hatch device, with the controls its model supports.**

Authored and maintained by **Yoav Weiss**. Built on [Dusty Greif’s Hatch integration](https://github.com/dgreif/homebridge-hatch-baby-rest), with credit to [Scott MacWatters’ volume add-on](https://github.com/ScottMacWatters/homebridge-hatch-baby-rest-volume).

This independent, unofficial Homebridge plugin provides model-specific receivers for **Hatch Rest, Rest+ and Rest Mini**, plus routine receivers for **Restore and Hatch Baby**. Full hardware validation currently covers Rest 2nd Gen. It uses a receiver accessory so sounds appear in a single-choice input menu, together with volume and light controls. It is not affiliated with Hatch or Apple.

**Release status:** Version 0.3.0 introduces receivers for Rest+, Rest Mini and Restore routines. Homebridge verification is pending. Older GitHub releases use the previous switch interface. A verified badge is awarded by Homebridge after review; this project does not currently claim verification.

## Contents

- [What you can control](#what-you-can-control)
- [What the Home interface looks like](#what-the-home-interface-looks-like)
- [Supported devices](#supported-devices)
- [Requirements](#requirements)
- [Install and configure](#install-and-configure)
- [Pair with Apple Home](#pair-with-apple-home)
- [Configuration reference](#configuration-reference)
- [Siri, scenes and automations](#siri-scenes-and-automations)
- [Moving from another Hatch plugin](#moving-from-another-hatch-plugin)
- [Troubleshooting](#troubleshooting)
- [Privacy](#privacy)
- [Development and credits](#development)

## What you can control

The full controls below apply to Rest 2nd Gen and Rest+ 2nd Gen. Original Wi-Fi Rest+ uses the same interface with its native sounds and light controls; Mini omits the light. Restore/Baby have routine-only receivers, described below.

| Control | Behavior |
| --- | --- |
| Main power | Turns the device off and restores the last sound, volume, mute, color and brightness settings when turned back on. If nothing has been remembered yet, starts the first available touch-ring favorite routine. |
| Sound selection | Selects one basic sound by its actual name using the receiver’s input menu. Selecting a sound enters manual playback and preserves volume and light settings. |
| Sound mute | Mutes audio without turning off the light. The volume control’s on/off toggle enables or mutes sound. |
| Volume | Sets audio volume from 0 to 100%. Adjusting it preserves the chosen sound and light; changing volume while the device is off does not start playback. |
| Light on/off | Controls the light independently. Turning on the light from an off device does not start sound. |
| Brightness | Sets light intensity from 0 to 100%. |
| Color | Uses Home’s native color picker to set hue and saturation. |
| Receiver speaker | Exposes native volume/mute characteristics and 5-percentage-point volume steps for compatible HomeKit clients or remote controls. |
| State updates | Reflects device changes received through Hatch’s cloud connection, including changes made in the Hatch app. |

The basic catalog is discovered from Hatch. On the tested Rest 2 it includes **White Noise, Ocean, Rain, Birds, Wind, Water, Dryer, Heartbeat, Fan and Thunderstorm**. Availability can vary; the plugin does not unlock paid content.

Power remembers the last active settings, including light-only use with muted audio, and keeps that memory across Homebridge restarts. Restoring uses manual playback; it does not resume a routine’s timer or advance through its steps. Existing Hatch schedules still run independently.

The input **No Sound**, placed last in the sound menu, represents muted audio, no sound, or a sound outside the exposed catalog. Choosing it mutes audio while leaving the light alone. Only one sound input can be active at a time.

### What stays in the Hatch app

Use Hatch for creating or editing favorites, routines, schedules, account settings and paid content. Hatch+ music, stories and recordings are not exposed as a complete music library here. Existing schedules continue to run on the device and may override manual changes later.

This plugin does not add AirPlay, Apple Intercom, microphone access, two-way audio, custom audio uploads or spoken announcements. It requires Hatch’s cloud; it does not provide a local-only or Bluetooth control path.

## What the Home interface looks like

Each supported device is an **audio receiver accessory** with one main tile. Open it to access:

1. Receiver power and the named sound/input picker.
2. A percentage volume slider, labeled **Volume**.
3. A light control with brightness and a color picker, on Rest/Rest+ models. Mini has no light; Restore/Baby expose only routine selection and power.

Apple Home determines the exact panel arrangement, icon choices and wording for your OS version. The plugin supplies sound ordering and creates receiver, volume and light services in that order, but cannot force a custom Home screen layout.

### Why does volume have a fan icon?

Apple Home does not show the receiver’s native speaker-volume characteristic as a percentage slider in this interface. A fan-speed service provides the usable 0–100% slider. It controls sound volume, not a physical fan. This also avoids putting audio volume in lighting commands such as “set all lights to 100%.”

The native receiver speaker controls are exposed too, but their presentation depends on the HomeKit client. The plugin cannot replace Apple’s fan icon or guarantee a speaker slider in Apple Home.

### Can I rename sounds?

Yes. Catalog names are supplied automatically, so inputs start as **Ocean**, **Rain**, and so on. Rename them in the accessory’s Home settings if desired. Custom input names are saved in Homebridge storage and restored after restart. Generic labels that Home may send during pairing, such as “Input Source 3,” are replaced with the actual catalog name.

There is no alternate switch layout in this release.

## Supported devices

| Device | Current support and testing |
| --- | --- |
| **Rest 2nd Gen (`riot`)** | Full receiver interface: power, named sounds, volume, brightness and color. Hardware-tested development target. |
| **Rest+ 2nd Gen (`riotPlus`)** | Same full-control implementation. Separate hardware validation is still needed. |
| **Original Wi-Fi Rest+ (`restPlus`)** | New receiver with native named sounds, power, volume, color/brightness and battery status. Protocol-adapter tests pass; physical validation is pending. |
| **Rest Mini (`restMini`)** | New receiver with native named sounds, power and volume. No light controls. Protocol-adapter tests pass; physical validation is pending. |
| **Original Restore (`restore`)** | New routine-only receiver: Bedtime Routine and stop/power controls. No individual tracks, volume slider or color controls. Experimental until hardware-tested. |
| **Restore IoT / Restore 2 and later recognized variants** | New routine-only receiver: named touch-ring/favorite routines and power. No direct sound/volume/color controls. Experimental until hardware-tested; exact model labels depend on Hatch’s product identifier. |
| **Hatch Baby (`restBaby`)** | Same experimental routine-only receiver as modern Restore. Full Rest 2 controls are not claimed. |
| Original Bluetooth-only Rest / Rest Go | Not supported by this Wi-Fi/cloud plugin. |

### Model-specific sound and routine menus

Original Wi-Fi Rest+ uses its built-in catalog: Stream, Pink Noise, Dryer, Ocean, Wind, Rain, Birds, Crickets, Brahms Lullaby, Twinkle Twinkle and Rock a Bye. Rest Mini uses White Noise, Ocean, Rain, Water, Wind, Birds, Dryer and Heartbeat. These IDs differ from Rest 2; the plugin selects the correct catalog automatically. **No Sound** is last in each sound menu. On Mini, stopping sound also turns the audio-only device off.

Restore/Baby receivers deliberately expose only established routine commands. Modern variants list touch-ring/favorite routine names from Hatch; the original Restore has a single **Bedtime Routine** input. **Off or Other** means no listed routine is currently selected, and selecting it stops playback. This is not a direct track picker. Power starts the first available routine; remembered manual sound/light restoration is supported on the Rest family, not Restore. Create/edit routines in Hatch. No unsupported sliders are shown.

Please check the generation in your Hatch app before installing. A shared product name does not guarantee the same protocol or features.

## Requirements

- A supported Hatch device already set up and working in the Hatch app.
- The email and password for the Hatch account that owns or can access it.
- Internet access from Homebridge to Hatch and its AWS IoT service.
- Homebridge **1.8+ or 2.x** and Node.js **22.12+, 24.x or 26.x**.
- For Rest 2 and modern Restore/Baby, a touch-ring favorite in Hatch for initial routine startup. Original Rest+ and Mini use their native power/sound controls.
- Apple Home for pairing and control. Remote access and Home automations additionally depend on your Apple Home hub setup.

Automated release checks cover Node 22, 24 and 26 with Homebridge 2.5. Physical testing currently covers Rest 2nd Gen only.

## Install and configure

### Homebridge UI

1. Open Homebridge UI → **Plugins**.
2. Search for **homebridge-hatch-control** and install it.
3. Open the plugin’s settings and enter your Hatch email and password.
4. Leave **Sound IDs** unset to expose the full basic catalog.
5. Enable a child bridge for the plugin if your setup supports it. This isolates it from other integrations.
6. Save and restart Homebridge.
7. Check the logs for discovered devices and the number of named sounds, then [pair the receiver](#pair-with-apple-home).

Plugin search may take time to refresh after a new npm release. For development or manual installation, build from this repository and install the resulting package using your Homebridge installation’s normal plugin-install procedure.

### Manual npm installation

On installations that use globally installed Homebridge plugins:

```sh
npm install -g homebridge-hatch-control
```

Use Homebridge UI instead on managed installations such as Docker or the Raspberry Pi image, where plugin paths and permissions are managed for you.

### Minimal configuration

Add this object to the `platforms` array in Homebridge’s `config.json`; do not replace the rest of your configuration:

```json
{
  "platform": "HatchRestControl",
  "name": "Hatch Control",
  "email": "your-hatch-email@example.com",
  "password": "your-hatch-password"
}
```

The plugin remains inactive until both email and password are configured. Device names come from Hatch; no device name, network address or serial number needs to be entered into source code.

## Pair with Apple Home

All receivers in this release are **external accessories** and must be paired separately, even when the plugin runs inside a child bridge.

1. Start Homebridge and wait for the plugin to discover the Rest.
2. In Apple Home, choose **Add Accessory → More Options** (or the equivalent option for an accessory without a scannable code).
3. Choose the receiver matching your Hatch device name.
4. Enter the setup code shown in Homebridge for the bridge or child bridge hosting the plugin. Do not use a code from a README example or another user’s logs.
5. Follow Home’s prompts, choose a room, and give the accessory a convenient name such as **Nursery Rest**.
6. Open its controls and confirm that the input picker has actual sound names, the Volume slider changes sound level, and the Light control changes brightness/color.

Repeat for each device. Pairing only the bridge does not automatically add its external receivers.

Existing receiver-preview installations retain their pairing identity when upgraded to 0.3.0. The old duplicate switch accessory is removed automatically. Home may retain a name you previously chose, including “Preview”; rename that accessory in Home if desired.

## Configuration reference

| Setting | Required | Default | Meaning |
| --- | --- | --- | --- |
| `platform` | Yes | — | Must be `HatchRestControl`. |
| `name` | No | Homebridge default | Label for the platform in Homebridge logs/settings; not a device-name override. |
| `email` | Yes | — | Your Hatch login email. |
| `password` | Yes | — | Your Hatch login password. |
| `soundIds` | No | All basic catalog sounds | Array of numeric Hatch sound IDs to include in the receiver picker. `[]` leaves only No Sound. Does not enable additional content. |
| `debug` | No | `false` | Upstream diagnostic detail, particularly for unsupported devices. Diagnostics may contain private device information; keep them local or redact before sharing. |

Example limiting the catalog to Ocean and Rain on the tested Rest 2:

```json
{
  "platform": "HatchRestControl",
  "name": "Hatch Control",
  "email": "your-hatch-email@example.com",
  "password": "your-hatch-password",
  "soundIds": [10138, 10139]
}
```

IDs are model-specific Hatch sound IDs, not input positions. The same sound has different IDs on different generations; a global filter applies to every discovered Rest-family device. Leave it unset in mixed-model homes unless you include the desired IDs for each model. They must exist in the returned catalog. The filter does not set the sound order or create new tracks. Remove `soundIds` to restore the complete basic catalog. Restart Homebridge after configuration changes.

Child-bridge settings such as `_bridge` are managed by Homebridge UI. There is no `receiverPreview` setting or alternate interface to enable in this release.

## Siri, scenes and automations

With the receiver named **Nursery Rest**, try:

- “Turn on Nursery Rest.”
- “Turn off Nursery Rest.”
- “Set Nursery Rest Light to 10 percent.”
- “Set Nursery Rest Light to blue.”
- “Set the speed of Nursery Rest Volume to 50 percent.”

Siri’s phrasing and matching vary by Home setup and OS version. Because percentage volume is exposed as a fan, “set the speed” may work more reliably than “set the volume.” Giving the receiver, Volume and Light services distinct names helps Siri select the intended control. These phrases are examples, not a guarantee of Siri interpretation.

### Selecting a sound by voice

For dependable named actions, use a **Home scene** rather than assuming Siri understands “set the Hatch to Ocean.” In Home, create a scene such as **Ocean at Bedtime**, add the Rest, and select the Ocean input where Home exposes receiver input selection in the scene editor. Set power, volume and light values that your Home version allows you to include, save it, and test the scene before relying on it. Then ask Siri to run **Ocean at Bedtime**.

If Apple Home’s scene editor does not expose the input selector, another compatible HomeKit automation app may expose it. The plugin exposes the standard receiver input characteristic, but cannot change the controls offered by Apple’s scene editor. A combined power-and-track sentence is not guaranteed to work.

Remember that a Hatch schedule may later replace manual settings or scene changes. Configure schedules in Hatch to agree with your Home automations.

## Moving from another Hatch plugin

1. Make a Homebridge backup.
2. Note any Home scenes or automations using the old accessory; they may need to be recreated.
3. Install and configure this plugin, then pair and test its receiver.
4. Once it works, disable or uninstall the old plugin for the same device to avoid duplicate controls.

The npm package and repository were renamed from `homebridge-hatch-rest-control` to `homebridge-hatch-control` for version 0.3.0. The configuration alias remains `HatchRestControl` for compatibility. Existing Rest 2 receiver UUIDs and preference-storage paths are preserved. When upgrading from the old package, install the new package, keep your platform credentials and child-bridge settings, and uninstall the old package before restarting to avoid duplicate platform registrations. Older Rest+/Mini/Restore bridged tiles require pairing their new external receivers and updating scenes.

You do not need to keep either `homebridge-hatch-baby-rest` or `homebridge-hatch-baby-rest-volume` installed to use this plugin. Automatic migration of names, rooms, scenes or pairing from another plugin is not guaranteed.

Upgrading this plugin from the old switch layout removes that legacy tile. Existing scenes attached to its switches must be updated to use the receiver. Custom names saved by the receiver preview are migrated before the old cached accessory is removed.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Plugin is absent from search | npm publication must be complete first; Homebridge search may take time to refresh its index. |
| No supported devices found | Confirm that the same account can see the device in Hatch, and check its exact model/generation against the table above. |
| Login fails / HTTP 401 or 403 | Verify the login in Hatch and plugin settings. An error from the old volume add-on’s endpoint does not prove this plugin will fail; ensure the log belongs to Hatch Control. Repeated failures can also reflect Hatch API changes or service restrictions. Do not post credentials in an issue. |
| Main power does not start playback | If no previous playback has been remembered yet, create a touch-ring favorite in Hatch and confirm it works there. Once playback is observed, main power restores those sound/light settings in manual mode. |
| Receiver does not appear in Home | Check that Homebridge and the phone can discover one another on the network, inspect startup logs, and look under Add Accessory → More Options. Pair the external receiver separately from its child bridge. |
| Duplicate Hatch tiles | Check for another Hatch plugin still running. On an upgrade, inspect logs to confirm removal of former bridged accessories. Do not remove your working receiver while diagnosing another tile. |
| Volume looks like a fan | Expected: this service supplies Apple Home’s percentage slider. It changes audio volume. |
| Sound menu only shows No Sound | Check whether `soundIds` is empty or contains IDs missing from the catalog. If catalog loading failed and no cache exists yet, restore cloud connectivity and restart. |
| Sound catalog temporarily unavailable | Previously cached sound names are reused; power, volume and light controls remain available when the device connection is working. |
| Inputs have generic names | Restart with the current plugin version and reopen accessory details. The plugin supplies catalog names and rejects generic pairing placeholders while preserving custom names. |
| Home says No Response | Check Hatch app connectivity, internet access and Homebridge logs. Offline writes fail instead of being reported as successful. |
| Settings change by themselves later | A scheduled Hatch routine, another Home automation or another controller may be taking control. |
| New controls or names seem stale | Reopen the accessory in Home and allow its home hub to synchronize. Avoid deleting pairing data as a first step. |

For an issue, include the plugin, Homebridge and Node versions; Hatch model; what you tried; expected versus actual behavior; and **redacted** relevant log lines. Report untested models explicitly. Do not attach a complete Homebridge backup or full configuration.

[Open an issue](https://github.com/yweiss/homebridge-hatch-control/issues).

## Privacy

Credentials remain in your Homebridge configuration and are sent to Hatch for authentication. Device communication uses Hatch’s services and AWS IoT. The plugin has no analytics service or developer-operated server.

Custom input names, cached catalog entries, remembered sound/volume/mute/color/brightness settings and the last light color chosen through this plugin are stored inside `<Homebridge storage>/hatch-rest-control/`. These local preferences may contain names you assigned at home; they are not included in the npm package. Include that folder in private Homebridge backups if you want to preserve aliases.

Never publish your configuration, passwords, session tokens, pairing code or unredacted device details. Debug logs should be treated as private. The repository’s examples use fictional names and placeholder credentials.

## Development

```sh
npm ci
npm run check
npm test
npm run build
npm pack
```

The package includes only compiled plugin code, its settings schema, README, changelog, license and attribution notice. It has no install-time script that modifies the user’s system.

Tests cover command payloads, range validation, independent sound/light behavior, offline errors, coalesced color changes, HomeKit service construction, exclusive input selection, name persistence, migration and connection recovery. Unit tests do not prove compatibility with every Hatch device, firmware or Siri phrase. See [CHANGELOG.md](CHANGELOG.md) for release changes and hardware test scope.

## Credits

- **Dusty Greif (dgreif)** — [homebridge-hatch-baby-rest](https://github.com/dgreif/homebridge-hatch-baby-rest), the original integration and foundation for authentication, discovery and device communication. This project includes its MIT-licensed code and upstream connection fixes.
- **Scott MacWatters (ScottMacWatters)** — [homebridge-hatch-baby-rest-volume](https://github.com/ScottMacWatters/homebridge-hatch-baby-rest-volume), whose companion volume-control plugin inspired this consolidation and the effort to make volume accessible in Home.
- **Brian Via** — [hatch-sleep-mcp-cloudflare-workers](https://github.com/BrianVia/hatch-sleep-mcp-cloudflare-workers), a reference for Rest 2 sound and light protocol fields.

MIT licensed. Original copyright notices are retained in [LICENSE](LICENSE); attribution details are in [NOTICE.md](NOTICE.md).
