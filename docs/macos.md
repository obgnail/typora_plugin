# macOS experimental beta

[简体中文](macos.zh-CN.md) · [Security audit](macos-security-audit.md) · [Draft release notes](releases/v0.1.0-macos-beta.md)

This workflow supports Typora 1.14.15 on macOS arm64 and x86_64. It modifies and ad-hoc signs a private copy of Typora for development; it is not notarized, is not official Typora support, and must not be redistributed as a modified `Typora.app`.

## Requirements

- vendor Typora 1.14.15 at `/Applications/Typora.app`
- Node.js 22 or 24 LTS on `PATH`
- a local, non-synchronised `/private/tmp` destination
- Typora fully quit before install, update, or uninstall

The installer rejects unsupported versions, non-universal builds, quarantine, File Provider locations, a running Typora process, and `/Applications/Typora.app`. Test-only override flags are not part of these instructions.

## Install

From the extracted beta package:

```bash
plugin/bin/install_macos.sh --dry-run
plugin/bin/install_macos.sh --yes
codesign --verify --deep --strict --verbose=2 /private/tmp/Typora-Plugin-Beta.app
open -n /private/tmp/Typora-Plugin-Beta.app
```

The default target is `/private/tmp/Typora-Plugin-Beta.app`. If absent, the installer copies the vendor app without extended attributes, records an original-state backup, installs the plugin, seeds external configuration at `~/.config/typora_plugin/settings.user.toml`, rotates the bridge token, creates a least-privilege LaunchAgent, and signs nested code before the outer bundle. Repeat installation is idempotent and keeps the original uninstall baseline.

Use `plugin/bin/diagnose_macos.sh --app /private/tmp/Typora-Plugin-Beta.app` for version, architecture, injection, extended-attribute, and signature diagnostics. Transaction backups and bridge logs live under `~/Library/Application Support/typora_plugin/`.

## Uninstall

Quit Typora, then run:

```bash
plugin/bin/uninstall_macos.sh --app /private/tmp/Typora-Plugin-Beta.app --yes
```

This unloads and removes the LaunchAgent, restores the original `index.html` and plugin directory, removes bridge credentials, and re-signs the isolated copy. User configuration and transaction backups are preserved. Repeated uninstall is safe.

## Security model

The Node bridge binds only to `127.0.0.1`, accepts a restricted RPC allowlist, requires a 256-bit token and exact `Origin: null` or `Origin: file://`, limits request/read sizes, and exposes no shell or general network execution. The plugin tree is read-only to RPC; only `~/.config/typora_plugin` is writable. Symlink components are rejected, writes use `O_NOFOLLOW` where available, and private files use restrictive modes.

WKWebView supplies `null` for local-file origins; accepting it is necessary but is not an identity guarantee. The token is embedded in the private modified app and can be read by another process running as the same macOS user. This is a same-user trust boundary, not a sandbox. Do not share the modified bundle, token, log, or user account with untrusted software. See the [security audit](macos-security-audit.md).

## Verified compatibility

Live tests used Typora 1.14.15 in `/private/tmp`, a real Markdown document, authenticated runtime reports, and a 14-second post-startup observation window.

| Plugin | JavaScript | UI / interaction | Persistence | Shortcut | Result |
|---|---:|---:|---:|---:|---|
| `callouts` | Pass | Native alert decorated; fold-hover CSS active | N/A | Not configured | Works |
| `editor_width_slider` | Pass | Shadow-DOM dialog; width changed to 73% | Pass | Not configured | Works |
| `collapse_paragraph` | Pass | Command-click collapsed and expanded a section | Pass | Pass | Works |
| `fence_enhance` | Pass | Toolbar rendered; real CodeMirror fence folded | Pass | Default not configured | Works |
| `command_palette` | Pass | Overlay search and Escape interaction | N/A | `Control/Command+Shift+P` pass | Works |
| `markmap` | Pass | Local assets, SVG nodes, and Fit interaction | Session-local | Default not configured | Works |

The framework completed repeated cold starts. Compatibility fixes cover the WKWebView module adapter, external settings, UTF-8 spelling normalization, deferred/post-load bootstrap, optional host menu decorators, native alert DOM, and Markmap lazy-load ordering.

## Known limitations and troubleshooting

- Ad-hoc signing is local development only. `codesign --verify --deep --strict` should pass; Gatekeeper `spctl` is expected to reject a non-notarized build.
- Do not use Desktop, iCloud, or File Provider locations. Recreated metadata can invalidate a signature.
- Only Typora 1.14.15 and the six plugins above are claimed compatible. Other plugins are unverified.
- The bridge needs a user LaunchAgent and free loopback port 45678.
- If startup fails, inspect `bridge.log`, run the diagnostic script, confirm LTS Node is on `PATH`, and reinstall to rotate credentials and refresh signing.
- Never remove quarantine automatically, disable SIP, weaken Gatekeeper, or patch Typora's minified source.

The final Node 22 LTS result and package checksum are recorded in the draft release notes.
