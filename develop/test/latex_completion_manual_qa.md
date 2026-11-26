# LaTeX completion: Typora 1.12.4 manual QA

Host: Windows, Typora installed at `D:\Typora`. The current branch was copied to
`resources/plugin` for manual testing. The original installation remains in
`resources/latex-completion-manual-backup/plugin.original`, with the original
`window.html` in the same backup directory. The pre-block test plugin is saved
as `plugin.pre-block`. The current user settings were preserved.

| Check | Result | Observation |
| --- | --- | --- |
| Plugin startup | Pass | Both inline and block completion loaded in Typora 1.12.4. |
| Inline initial candidate | Pass | With English keyboard input, typing `\` displayed common commands and highlighted the first row. |
| Inline preview avoidance | Pass | The native list appeared to the right of the math preview; both were visible. |
| Inline Tab and mouse | Pass | Tab applied `\frac{}{}`; mouse selection applied `\sqrt{}` at the viewport's right edge. |
| Block CodeMirror | Pass | Typing `\fra` in the active block displayed a list; Enter inserted `\frac{}{}` at the cursor. |
| Block undo and redo | Pass | Ctrl+Z restored the prefix; Ctrl+Shift+Z reapplied the snippet. |
| Block preview avoidance | Pass | The list now appears below the active formula block, with the preview and editor visible. Following paragraphs move down while it is open. |
| Long block prefix and partial match | Pass | Reproduced the supplied `\lefta` screenshot: the list stayed below the block, aligned with its left edge, and did not cover the preceding paragraph. With `\arrow`, `\leftarrow` and `\rightarrow` were the first two suggestions; Enter replaced the typed fragment with `\leftarrow`. |
| Inline partial match | Pass | Editing `\arrow` in inline math displayed `\leftarrow` and `\rightarrow` at the top of Typora's native menu, below the visible preview. |
| Matched-character highlight | Pass | In Typora 1.12.4, both inline and block menus colored only the matched `arrow` letters red inside `\leftarrow` and `\rightarrow`. The highlight remained legible in Github and Night themes. The original Github theme was restored after testing. |
| Block mouse, Esc, blur, block switch | Pass | Mouse applied `\frac{}{}`; Esc and blur hid the menu, and switching blocks displayed candidates only at the active cursor. |
| `ENABLE_BLOCK=false` | Pass | After restarting the test window, block input showed no LaTeX menu while inline completion still worked. |
| `ENABLE=false` and slash fallback | Pass | After restarting, the LaTeX menu was absent; the pre-existing slash menu handled `\` inside math. A line-start `/` showed the normal H1–H5 menu. |
| Dark theme and right edge | Pass | Night theme retained readable candidates, including the new red match highlight and in-flow block layout. An earlier right-edge check showed the inline menu inside the window. The prior Github theme was restored. |
| Textarea fallback and IME | Automated only | Typora 1.12.4 uses CodeMirror; the legacy textarea path and composition handling use mocks. |
| Narrow window | Automated only | Viewport clamping is covered by `develop/test/latex_completion.test.js`; the window itself was not resized for manual inspection. |
| Typora 0.9.98 and Linux | Not run | Static compatibility review and automated tests only. |

The Windows Chinese IME initially consumed typed Latin keys. Switching to the
English keyboard allowed the inline native menu to appear. Typora controls the
number of visible rows in that menu; `MAX_RESULTS` limits generated matches.
Both feature switches displayed Typora's “changes take effect after restart”
notice. After testing, `settings.user.toml` was restored byte-for-byte to its
pre-test SHA-256 `01BA4719C80B6FE911B091A7C05124B64EEECE964E09C058EF8F9805DACA546B`.
