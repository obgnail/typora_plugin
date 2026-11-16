# macOS beta security audit

Audit scope: localhost bridge, WKWebView loader, installer, uninstaller, LaunchAgent, and development signer for `v0.1.0-macos-beta`.

| Severity | Finding | Remediation status |
|---|---|---|
| High | One filesystem root was writable, allowing RPC mutation of installed plugin code | Fixed: separate read/write roots; only external configuration is writable |
| Medium | RPC accepted requests without a verified Origin | Fixed: RPC requires exact `null` or `file://`; other or absent origins are rejected |
| Medium | Symlink components and final write targets could escape policy | Fixed: canonical roots, component checks, real-ancestor containment, and `O_NOFOLLOW` writes |
| Medium | Reinstall could overwrite sealed resources in place; rollback/uninstall were incomplete across repeat installs | Fixed: transactional replacement, persistent original baseline, credential/LaunchAgent restoration, re-signing, idempotent uninstall |
| Medium | State, configuration, token, log, and plist permissions were not consistently private | Fixed: directories 0700, sensitive files 0600, LaunchAgent umask 0077 |
| Low | Unauthenticated health exposed counters and request metadata | Fixed: unauthenticated response is only `{ok:true}`; details require the token |
| Low | Reads were unbounded and encoding handling ambiguous | Fixed: 16 MiB read cap and UTF-8-only normalization |
| Low | Missing Typora host methods produced unhandled promise rejections | Fixed: explicitly optional decorators with regression coverage |

## Accepted residual risks

- The token is embedded in the modified app so WKWebView can authenticate. Another same-user process can read it and invoke the bridge. Origin values are compatibility inputs, not caller identity. Private modes reduce cross-user exposure but cannot defend against a compromised same-UID process.
- Authorization is checked immediately before operations and writes use `O_NOFOLLOW`; a hostile same-user process with access to the permitted configuration directory can still race parent-directory replacement. The writable scope contains configuration only, not plugin code or arbitrary home paths.
- The development entitlement disables library validation because ad-hoc nested code has no shared Apple Team ID. This is limited to the isolated development copy and is not suitable for distribution.
