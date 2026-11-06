# Release readiness — Hatch Control 0.3.0

Publication authorized by the maintainer. This checklist records preparation; public release links are added when each release step succeeds.

- Model-specific receivers for Rest 2, Rest+ 2, original Wi-Fi Rest+, Rest Mini and Restore/Baby routines.
- Existing Rest 2 pairing UUID namespace, configuration alias and storage path retained across the package rename.
- Complete setup, compatibility, limitations and migration documentation; Yoav Weiss authorship and upstream credits retained.
- 52 tests pass on Node 22, 24 and 26; TypeScript build passes.
- Rest 2 has live hardware testing. New model adapters and routine receivers are not hardware-validated and are labeled accordingly.
- GitHub release notes and verification-request draft prepared.
- Installed v0.3.0 on the test Homebridge host and restarted successfully; logs confirm the renamed plugin and 10 Rest 2 sounds.
- Audited tarball SHA-256: `d78ca8976bffb19cfb0ec3b8efe6c76e0add20c537706a2466818fa81b31f533`. Clean temporary install and platform registration smoke test pass.
- Known private-identifier and credential-pattern scan passes for source, reachable Git history and release archives.
- Before publishing: commit, push and confirm public CI.
- After publishing: verify npm metadata and a clean registry install, create the matching GitHub release, then submit the Homebridge verification form.
- Verification is pending external review; no green shield is claimed in advance.
