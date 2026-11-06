Latest update: 0.2.1 adds remembered playback and No Sound. The 0.2.0 checksum and validation below are historical; rebuild and re-audit 0.2.1 before publication. Publishing remains paused.

# Release readiness — 0.2.0

Prepared locally. Publication remains on hold; no verification request has been sent.

## Prepared

- Receiver-only implementation, duplicate switch migration, persistent custom input names.
- Expanded README covering capabilities, Home limitations, pairing, all settings, examples, Siri/scenes, migration, troubleshooting and privacy.
- Version, package metadata, repository/issue links, Homebridge keyword and settings schema.
- Yoav Weiss author credit and retained upstream MIT/attribution notices.
- GitHub release notes and Homebridge verification request draft.
- 36 tests pass on Node 22, 24 and 26. TypeScript build passes.
- Version 0.2.0 installed on the test Homebridge host and restarted successfully. Logs confirm 10 named sounds and removal of the old bridged switch accessory; receiver advertising identity is retained. Final Home app interaction remains a user check.
- Audited tarball SHA-256: `cc366eefdd14bf50600d66c2cc1a59211e179c5908bef59824137619501909f2`.
- Clean temporary package install and Homebridge platform registration smoke test pass.
- npm package allowlist verified: compiled code, metadata, schema and documentation only.
- Known private identifiers and credential-pattern scan passes for working source, all reachable local Git history, final package, receiver preview packages and downloaded public v0.1.0/v0.1.1 release archives. This targeted audit is not a guarantee against every possible secret format.
- Public repository issues are enabled. Existing public releases are v0.1.0 and v0.1.1; the receiver release is not yet public.

## Release sequence when authorized

1. Replace README’s pending-publication wording with released installation guidance. Keep verification marked pending.
2. Commit/rebuild/re-audit the exact final package; record its checksum.
3. Fast-forward main to the accepted receiver release and push. Let the Node matrix pass.
4. Publish 0.2.0 to npm as yoav_weiss, completing npm’s per-publish authentication if requested.
5. Verify a clean registry install and Homebridge search metadata. Create GitHub release v0.2.0 from that same commit with RELEASE-NOTES.md and the matching tarball.
6. Complete the verification form using VERIFICATION-REQUEST.md and final public links. Do not claim a green verification shield until Homebridge approves it.

npm account profile information may appear in public maintainer metadata independently of package source. Review the npm account’s public email before publication if it should differ from the account’s current email.
