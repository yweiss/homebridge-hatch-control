# Hatch Control

Bring your Hatch into Apple Home with one receiver tile for the controls your model supports.

**By Yoav Weiss** · [npm](https://www.npmjs.com/package/homebridge-hatch-control) · [Homebridge verification pending](https://github.com/homebridge/plugins/issues/1335)

## Features

- Power, named sound selection and a 0–100% volume slider.
- Brightness and color controls on supported Rest models.
- Remembers sound, volume, mute and light settings across power cycles and Homebridge restarts.
- **No Sound** at the bottom of the sound picker for silent/light-only use.
- Routine selection and power controls for Restore and Hatch Baby.

Apple Home displays the percentage volume slider as a fan control. It adjusts audio volume; Home determines the icon and panel layout. Sound input names can be customized in Home.

## Compatibility

| Model | Controls | Validation |
| --- | --- | --- |
| Rest 2nd Gen | Power, sounds, volume, brightness, color and remembered state | Hardware-tested |
| Rest+ 2nd Gen | Same controls as Rest 2 | Hardware testing pending |
| Original Wi-Fi Rest+ | Power, native sounds, volume, brightness, color, battery and remembered state | Hardware testing pending |
| Rest Mini | Power, native sounds, volume and remembered state; no light | Hardware testing pending |
| Original Restore | Bedtime Routine and power | Experimental |
| Recognized newer Restore models / Hatch Baby | Named touch-ring/favorite routines and power | Experimental |
| Original Bluetooth-only Rest / Rest Go | Not supported | — |

Restore/Baby receivers do not expose individual tracks, volume or color controls. Their **Off or Other** input stops playback. Hardware testing currently covers Rest 2nd Gen; automated tests cover the additional model adapters.

## Setup

Requires **Homebridge 1.8+ or 2.x**, **Node.js 22.12+, 24.x or 26.x**, and a supported device working in the Hatch app. Internet access is required.

1. In Homebridge UI, search for **homebridge-hatch-control** under **Plugins** and install it.
2. Enter your Hatch account email and password in the plugin settings. Leave **Sound IDs** unset for the full catalog.
3. Enable a child bridge if available, save, and restart Homebridge.
4. In Apple Home, choose **Add Accessory → More Options**, then select your Hatch receiver.
5. Enter the setup code shown in Homebridge for the bridge or child bridge hosting the plugin, and choose a room and name.

**Pair each receiver separately.** Pairing the Homebridge bridge alone does not add these receivers. Avoid running multiple Hatch plugins for the same device.

### Manual configuration

Add this object to the `platforms` array in Homebridge’s configuration:

```json
{
  "platform": "HatchRestControl",
  "name": "Hatch Control",
  "email": "your-hatch-email@example.com",
  "password": "your-hatch-password"
}
```

Optional `soundIds` limits the Rest-family sound menu. For example, `"soundIds": [10138, 10139]` selects Ocean and Rain on Rest 2. IDs differ by model; leave this unset in mixed-model homes unless you know the IDs you need. An empty array leaves only **No Sound**. It does not filter Restore routines.

Optional `debug: true` enables extra diagnostics. Redact logs before sharing them. Restart Homebridge after configuration changes.

## Everyday use

Choose a sound, volume and light setting, then use the main power button. Rest-family receivers restore the last active settings in manual mode, including muted/light-only use. Rest 2 uses the first touch-ring favorite if no previous playback has been remembered. Restore/Baby power starts the first available routine instead.

Create favorites and schedules in the Hatch app. Schedules continue to run and can override manual settings. Paid content, routine editing, AirPlay, Intercom and microphone access are not provided by this plugin.

### Siri

With an accessory named **Nursery Rest**, try:

- “Turn on Nursery Rest.”
- “Set Nursery Rest Light to 10 percent.”
- “Set Nursery Rest Light to blue.”
- “Set the speed of Nursery Rest Volume to 50 percent.”

For named sound actions, create a Home scene that selects the desired receiver input where your Home app supports it, then ask Siri to run the scene. Siri wording and available scene controls vary by Home setup.

## Troubleshooting

- **Missing or unresponsive receiver:** check Hatch connectivity and Homebridge logs; pair the receiver separately through More Options.
- **Login fails:** confirm the same account can access the device in the Hatch app.
- **Missing sounds or routines:** clear `soundIds`, check cloud connectivity, or create a touch-ring favorite in Hatch; then restart Homebridge.

[Report an issue](https://github.com/yweiss/homebridge-hatch-control/issues) with the model, plugin/Homebridge/Node versions and relevant redacted logs. Never share passwords, tokens, pairing codes or your full configuration.

## Privacy

Credentials are stored in your Homebridge configuration and used to authenticate with Hatch. Preferences and remembered settings stay in Homebridge storage. There are no analytics or developer-operated servers.

## Credits

- [Dusty Greif](https://github.com/dgreif/homebridge-hatch-baby-rest) — foundation for authentication, discovery and device communication.
- [Scott MacWatters](https://github.com/ScottMacWatters/homebridge-hatch-baby-rest-volume) — companion volume-control plugin that inspired this integration.
- [Brian Via](https://github.com/BrianVia/hatch-sleep-mcp-cloudflare-workers) — Rest 2 protocol reference.

MIT licensed. See [LICENSE](LICENSE), [NOTICE.md](NOTICE.md) and [CHANGELOG.md](CHANGELOG.md).
