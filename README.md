# Hatch Rest Control

One Homebridge plugin for Hatch Rest power, sound selection, volume, brightness, and color. Authored and maintained by **Yoav Weiss**.

This is an independent, unofficial integration. It is not affiliated with Hatch or Apple. This is an initial release; hardware validation currently covers Rest 2nd Gen.

## Apple Home controls

Each Rest 2nd Gen exposes one accessory with:

| Control | What it does |
| --- | --- |
| Power | Starts the first touch-ring favorite routine, resumes paused playback, or stops the device. |
| Light | Native light brightness slider and color picker. Turning on only the light from an off device does not start sound. |
| Volume | A 0–100% slider represented as a fan speed. Its on/off toggle enables or mutes sound. |
| Named sound buttons | Selects a sound by name; turning off the active sound button mutes it without changing the light. |

Home determines the visual layout. You can group these services or use **Show as Separate Tiles** where available. The plugin cannot provide a custom Home app screen or a generic track dropdown. Using a fan for volume prevents “set all lights to 100%” from also raising the sound volume.

The basic sound catalog comes from your Hatch account. On Rest 2 this currently includes White Noise, Ocean, Rain, Birds, Wind, Water, Dryer, Heartbeat, Fan, and Thunderstorm. It does not unlock paid content. Additional Hatch+ music, stories, recordings, and routine editing remain in the Hatch app.

Volume changes preserve the current sound and light. Choosing a sound switches playback to manual mode and preserves volume and color. Routine schedules remain stored on the Hatch; a subsequently scheduled routine can change the current settings.

## Siri examples

With an accessory named “Nursery Rest,” try:

- “Turn on Nursery Rest.”
- “Set Nursery Rest Volume to 20 percent.”
- “Turn on Nursery Rest Ocean.”
- “Set Nursery Rest Light to red.”
- “Set Nursery Rest Light to 10 percent.”
- “Turn off Nursery Rest.”

Siri matches the service names in your Home; rename them there if you prefer shorter names. Volume is represented as a fan-speed control, so “set the speed of Nursery Rest Volume to 20 percent” may be more reliable than asking Siri to change a media speaker's volume.

## Installation

Search for **homebridge-hatch-rest-control** in Homebridge UI. Install it, enter the same email and password you use in Hatch, and restart Homebridge.

Manual configuration:

```json
{
  "platform": "HatchRestControl",
  "email": "your-hatch-email@example.com",
  "password": "your-hatch-password"
}
```

Optional `soundIds` limits the named sound buttons. Omit it to expose the full basic catalog; an empty array exposes no sound buttons. Example: `"soundIds": [10138, 10139]` for Ocean and Rain.

Use a child bridge if possible. Pair that bridge in Apple Home. Do not run this and another Hatch plugin for the same device unless you intentionally want duplicate controls. When moving from another plugin, back up Homebridge first. HomeKit rooms, names, automations, and pairing may need to be set up again; automatic migration is not guaranteed.

## Compatibility

| Device | Support |
| --- | --- |
| Rest 2nd Gen (riot) | Full power, named sounds, volume, color and brightness controls. Primary development target. |
| Rest+ 2nd Gen (riotPlus) | Same controls and protocol; separate hardware validation is still needed. |
| First-generation Wi-Fi Rest+, Rest Mini | Inherited upstream controls. These models have not been revalidated for this release. |
| Restore family / Hatch Baby | Inherited upstream routine on/off support, not the full Rest 2 interface. |
| Original Bluetooth-only Rest / Rest Go | Not supported by this Wi-Fi plugin. |

Requires Node 22.12+, 24, or 26 and Homebridge 1.8+ or 2.x. Development tests run on Node 24 and Homebridge 2.5. This plugin uses the Hatch cloud and requires internet access and a working Hatch login. It has no local Bluetooth fallback, live microphone, AirPlay, or Apple Intercom support.

## Privacy and troubleshooting

Credentials stay in your Homebridge configuration and are sent to Hatch for authentication. This plugin has no analytics service or developer-operated server. Never post your full Homebridge configuration, passwords, session tokens, or unredacted device data in an issue.

If no devices appear, verify the account and model in Hatch. If sounds cannot be loaded temporarily, cached names are reused and power/light/volume controls remain available. Create at least one favorite routine in Hatch for the main power button to start. If your phone does not see added controls after restart, reopen the accessory details in Home.

## Development

```sh
npm ci
npm run check
npm test
npm run build
npm pack
```

Automated tests cover command payloads, range validation, independent sound/light behavior, offline errors, color updates, and real HomeKit service construction. Hardware results and release status are recorded in `CHANGELOG.md`. Passing unit tests alone does not prove compatibility with every Hatch model or firmware.

## Credits

- **Dusty Greif (dgreif)** — [homebridge-hatch-baby-rest](https://github.com/dgreif/homebridge-hatch-baby-rest), the original integration and the foundation for authentication, device discovery and communication. This project includes its MIT-licensed code and subsequent upstream connection fixes.
- **Scott MacWatters (ScottMacWatters)** — [homebridge-hatch-baby-rest-volume](https://github.com/ScottMacWatters/homebridge-hatch-baby-rest-volume), whose companion volume-control plugin inspired this consolidation and the effort to make volume accessible in Apple Home.
- **Brian Via** — [hatch-sleep-mcp-cloudflare-workers](https://github.com/BrianVia/hatch-sleep-mcp-cloudflare-workers), used as a reference for Rest 2 sound and light protocol fields.

MIT licensed. Original copyright notices are retained in `LICENSE`; attribution details are in `NOTICE.md`.
