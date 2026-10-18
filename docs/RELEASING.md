# Releasing AIHub DJ

## Version 1.1.0

This release includes the current console skins and palette fixes, full-record artwork, and GitHub Releases updates. The original 1.0.0 installer did not include an updater; its users must install 1.1.0 once.

Installed copies check 15 seconds after launch and every six hours while the app is open. Users receive an in-app update notice (and a Windows notification when the app is not focused). They choose Download and then Restart to update. Downloaded updates also install when the app is quit. Mixing is never stopped automatically to begin an update.

## Build locally

1. Use Node.js 22 or later and install the locked dependencies with `npm ci`.
2. Run `npm run typecheck` and `npm test`.
3. Run `npm run package` on Windows. This builds without publishing.
4. Run `npm run verify:release`.

The complete release consists of:

- `dist/AIHub-DJ-Setup.exe`
- `dist/AIHub-DJ-Setup.exe.blockmap`
- `dist/latest.yml`
- `dist/SHA256SUMS.txt`

Keep the installer filename stable: the landing page and update manifest depend on it. The embedded feed must remain public GitHub repository `pitchiluxe/aihub-dj`. Never put a GitHub access token in the installed app.

## Future releases

1. Update the version in `package.json` and `package-lock.json` (for example `npm version patch --no-git-tag-version`).
2. Commit the release changes and merge the reviewed branch.
3. Create and push the matching version tag, for example `v1.1.1`. Pushing the tag is the action that publishes the new release through `.github/workflows/release.yml`.
4. The workflow checks the version, runs tests/type checking, builds on Windows, verifies the installer checksum and update feed, uploads all four files to a draft, then publishes it as the latest release.
5. Check the published release has `latest.yml` and the installer before announcing it. Installed 1.1.0+ apps detect it on their next check; Settings also offers a manual check.

The stable landing download is `https://github.com/pitchiluxe/aihub-dj/releases/latest/download/AIHub-DJ-Setup.exe`. Its version label follows the latest release only when the expected installer asset exists. Deploy `landing/` when site content changes.

## Signing

The installer is built with the repository's existing signing configuration. A trusted code-signing certificate is not configured here; Windows may show the publisher as unknown. To introduce signing, configure a certificate and its secrets in the Windows build environment; never commit certificate credentials.
