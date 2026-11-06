# Release readiness — Hatch Control 0.3.0

Released as homebridge-hatch-control 0.3.0.

- GitHub release: https://github.com/yweiss/homebridge-hatch-control/releases/tag/v0.3.0
- npm: https://www.npmjs.com/package/homebridge-hatch-control
- Homebridge verification submitted: https://github.com/homebridge/plugins/issues/1335
- Passing release CI: https://github.com/yweiss/homebridge-hatch-control/actions/runs/42286865433

- Model-specific receivers for Rest 2, Rest+ 2, original Wi-Fi Rest+, Rest Mini and Restore/Baby routines.
- Existing Rest 2 pairing UUID namespace, configuration alias and storage path retained across the package rename.
- Complete setup, compatibility, limitations and migration documentation; Yoav Weiss authorship and upstream credits retained.
- 52 tests pass on Node 22, 24 and 26; TypeScript build passes.
- Rest 2 has live hardware testing. New model adapters and routine receivers are not hardware-validated and are labeled accordingly.
- GitHub release notes and verification-request draft prepared.
- Installed v0.3.0 on the test Homebridge host and restarted successfully; logs confirm the renamed plugin and 10 Rest 2 sounds.
- Audited tarball SHA-256: `d78ca8976bffb19cfb0ec3b8efe6c76e0add20c537706a2466818fa81b31f533`. Clean temporary install and platform registration smoke test pass.
- Known private-identifier and credential-pattern scan passes for source, reachable Git history and release archives.
- Release commit `d813191a04a42de0cd92af97dc885a75cb054c05` pushed; public CI passes on Node 22/24/26.
- Public npm installation and platform-registration smoke test pass. Registry integrity matches the audited tarball exactly. Matching GitHub release and Homebridge verification request are live.
- Verification is pending external review; no green shield is claimed in advance.
