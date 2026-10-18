# AIHub DJ 1.1.0 installer and updates plan

**Goal:** Produce a Windows installer containing the current skins and fixes, with a reliable GitHub update notification and installation flow.
**Architecture:** Retain electron-updater 6.8.9 and electron-builder 26.15.3. Use public pitchiluxe/aihub-dj releases, a cached update state over the preload bridge, and user-initiated download/restart. Publish the installer, blockmap and latest.yml together.
**Tech stack:** Electron, React, TypeScript, Vitest, NSIS and GitHub Actions.
**Spec:** User request in this chat on 2026-10-18.

## Constraints
- Preserve playback, library and preferences. Never restart while users are mixing without their action.
- Preserve stable installer asset name AIHub-DJ-Setup.exe for the landing page.
- Keep original skin selection and full-record artwork fixes in the package.
- Use current installed updater APIs rather than newer breaking changes.

## Tasks
- [x] Add updater tests for checks, downloads, cached notifications and installation guards; observe failures.
- [x] Harden updater and notification bar, and add a manual check entry in app settings.
- [x] Update landing version/download links, update explanation and fallback behaviour; test.
- [x] Bump to 1.1.0, validate tag/release asset workflow and document future releases.
- [x] Run tests/typecheck; package with publishing disabled; verify manifest, installer hash and embedded update provider.
- [x] Prepare a reviewable GitHub draft release if access permits; keep public publication as the final approval step.

## Review focus
Offline/no release, older server version, renderer refresh while downloading, check during download, install before download, and incomplete GitHub asset upload.

## Verification notes

- All 478 tests and type checking passed.
- Installer/update manifest and embedded GitHub feed verified; final archive check excludes temporary test profiles.
- A code reviewer found no blocking issues. Do not push the version tag before publication approval.
- Landing page loads locally, all referenced images load, and it correctly shows the currently published 1.0.0 while 1.1.0 is a draft.
- A real installed-app upgrade between two public versions remains a post-publication check.

- Source review: https://github.com/pitchiluxe/aihub-dj/pull/1 (draft).
- GitHub release v1.1.0 is a draft; publishing and merging remain unperformed.
