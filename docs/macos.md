# macOS development port

This port targets Typora 1.14.15's native WKWebView build. It is a development installation: modifying `TypeMark` invalidates Typora's vendor signature, and an ad-hoc signature is not a distributable or notarized signature.

## Diagnosed signing failure

The tested `~/Desktop/Typora-Test.app` had `com.apple.FinderInfo` and `com.apple.fileprovider.fpfs#P` on the app, `Sparkle.framework`, and `Autoupdate.app`. It also had `com.apple.macl` on the outer app. There was no quarantine attribute. Desktop File Provider recreated `FinderInfo` after removal, so a signature could be created and then immediately fail verification. `com.apple.provenance` existed broadly but did not prevent signing or strict verification in a non-File-Provider location.

Use a local, non-synchronised development directory. Never install into `/Applications/Typora.app`; copy the vendor app and modify only the copy. Do not remove quarantine or provenance merely to make an app launch.

```bash
ditto --noextattr --norsrc /Applications/Typora.app /private/tmp/Typora-Test.app
plugin/bin/diagnose_macos.sh --app /private/tmp/Typora-Test.app
plugin/bin/install_macos.sh --app /private/tmp/Typora-Test.app --yes
codesign --verify --deep --strict --verbose=2 /private/tmp/Typora-Test.app
open -n /private/tmp/Typora-Test.app
```

Quit Typora before installation. The installer refuses `/Applications/Typora.app` unless its separate production override is supplied; that override is not part of this development workflow. It backs up the target's existing `index.html` and plugin directory, installs the bridge LaunchAgent, injects the loader idempotently, and signs nested code before the outer app. To remove the development installation, run `plugin/bin/uninstall_macos.sh --app /private/tmp/Typora-Test.app` while Typora is closed.

The signer processes nested Mach-O code from the inside out. The main app keeps Typora's three observed JIT-related entitlements and adds `disable-library-validation` only for the ad-hoc development build; otherwise hardened runtime rejects the ad-hoc Sparkle framework because no shared Team ID exists.

`codesign --verify --deep --strict` validates bundle integrity. `spctl --assess` is a separate Gatekeeper check and is expected to reject or error for an ad-hoc development signature.

## Runtime and security

`macos/loader.js` supplies a small CommonJS/path adapter and sends explicit filesystem operations to a Node bridge. It exposes the adapter as `global.reqnode` and deliberately preserves Typora's native `window.require`. The bridge binds only to `127.0.0.1`, uses a 256-bit header token, accepts only `file://` (observed in Typora 1.14.15) or the standard opaque `null` file origin, limits request bodies, resolves symlinks, restricts filesystem roots, and exposes no shell or general network execution.

The health endpoint never returns the token. The token is stored mode `0600` and embedded into the installed loader, so the modified app bundle should be treated as user-private.

The installer seeds `~/.config/typora_plugin/settings.user.toml` only when it does not already exist. This is required because writing the fallback copy inside the app after signing invalidates the sealed resource. With the external config present, deep/strict verification remained valid after editor initialization and 56 authenticated RPC calls.

## Runtime evidence and compatibility

The development app launched successfully after consistent nested signing and the development library-validation entitlement. Opening a Markdown document produced an authenticated probe and initialized the original framework container. The sanitized Typora 1.14.15 snapshot, captured at `document.readyState === "interactive"`, was:

| Object/capability | Observed |
|---|---|
| `window.File` | object |
| `File.editor` / `File.getMountFolder` | available / available |
| `window.JSBridge` / `JSBridge.invoke` | object / available |
| `window.SystemJS` / `SystemJS.import` | undefined / unavailable |
| `window.require` | function (Typora-provided and preserved) |
| `window.global` / `global.reqnode` | object / available (adapter-provided) |
| `window.process` / `process.versions` | object / available (adapter-provided) |

The adapter-provided values do not establish that Node-style globals exist before `loader.js` runs. `SystemJS` was not available when the probe executed.

Each row below was run with only that plugin enabled against the same seven-block fixture in an isolated `/private/tmp` copy. A passing report required framework/container enablement, JavaScript construction, plugin UI state, a DOM-backed interaction, and a persistence check when the plugin owns persistent state.

| Plugin | JS load | UI and interaction | Persistence | Typora 1.14.15 result |
|---|---:|---:|---:|---|
| `callouts` | Pass | Native `.md-alert` decorated as a folded plugin callout; hover rule present | N/A | Works |
| `editor_width_slider` | Pass | Shadow DOM dialog rendered; range input changed editor width to 73% | Pass: `WIDTH_RATIO` re-read as 73 | Works |
| `collapse_paragraph` | Pass | Command-click collapsed and expanded the heading body | Pass: `RECORD_COLLAPSE` toggle re-read | Works |
| `fence_enhance` | Pass | Toolbar rendered; fold button collapsed a real CodeMirror fence | Pass: `ENABLE_FOLD` toggle re-read | Works |
| `command_palette` | Pass | Overlay rendered; input search produced results; Escape closed it | N/A | Works |
| `markmap` | Pass | Local assets loaded; TOC SVG nodes rendered; fit button invoked | Session-local by design | Works |

Compatibility fixes covered by automated regressions are: Typora 1.14 native alert DOM, preserving native `window.require`, non-throwing CommonJS directory fallback, safe `process`/`buffer` shims, `fs-extra.readdir`, awaited async plugin lifecycle hooks, and inlining/rebasing local Markmap styles because WKWebView rejects `fetch(file://...)` responses.

The complete suite was run under Node.js 22.23.5 LTS with serialized test concurrency: 1,663 tests, 1,662 passed, 0 failed, 1 skipped, no hang (23.1 seconds). Node 25 is not used for the reported suite result.

The console also reports four Typora-owned `decorate timeout` rejections (`showPreferencePanel`, `closePreferencePanel`, `show`, and `hide`) around ten seconds after launch. Their stacks are in Typora's minified `appsrc/main.js`; all six plugin reports completed successfully before them. They remain a host warning, not a plugin test failure.

In Web Inspector, evaluate `window.__typoraMacProbe`. The loader is injected at the end of `body` with `defer`; Typora's existing deferred `appsrc/main.js` remains first and the adapter does not alter its later `SystemJS.import` call. The probe only executed after an editor document was opened; the welcome window alone is not runtime evidence.
