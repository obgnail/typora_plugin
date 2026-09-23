# Inline LaTeX completion: Typora 1.12.4 QA

Test host: Windows, installed Typora at `D:\Typora`. The plugin was temporarily
copied into `resources/plugin`, and `window.html` was temporarily injected.
After both sessions, Typora was closed normally, the original plugin directory
was restored, and the original `window.html` SHA-256 was confirmed as
`2B39A2386E700C16BE81A487C1A39D7A8BC1DFA07699CAD4916221D367AD8BC7`.

| Check | Result | Observation |
| --- | --- | --- |
| Plugin startup in installed Typora | Pass | Inline math `\` displayed Typora's native candidate list. |
| Formula preview overlap | Pass | Candidate rows appeared above the formula preview after the z-index change. |
| Compact hint and snippet preview | Pass | The list showed the command, localized description, and snippet. |
| Candidate choice by keyboard and mouse | Inconclusive | The active Windows Chinese IME consumed letter keys; synthetic text paste did not refresh Typora's native completion. |
| Nested braces, aliases, selection, source mode, slash fallback | Automated only | Covered by `develop/test/latex_completion.test.js`. |
| Undo/redo, dark theme, window edge positioning | Not run | Require another interactive session with English keyboard input. |
| Typora 0.9.98 and Linux | Not run | Static compatibility review and automated tests only. |

The existing native menu displayed five rows even when `MAX_RESULTS` was ten;
Typora controls the number of visible rows. No claim is made that this setting
can override Typora's own visible-row limit.
