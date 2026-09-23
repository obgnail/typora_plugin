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
| Inline Tab | Pass | Tab applied the active `\frac{}{}` snippet. |
| Block CodeMirror | Pass | Typing `\fra` in the active block displayed a list; Enter inserted `\frac{}{}` at the cursor. |
| Block undo and redo | Pass | Ctrl+Z restored the prefix; Ctrl+Shift+Z reapplied the snippet. |
| Block preview avoidance | Pass | The list appeared above the block editor without covering the preview. |
| Block mouse, Esc, blur, block switch | Automated only | Covered in part by `develop/test/latex_completion.test.js`; manual checks remain for the user. |
| Textarea fallback, IME, disabled setting | Automated only | Typora 1.12.4 uses CodeMirror; the legacy textarea path and composition handling use mocks. |
| Dark theme, narrow window, `/` fallback | Automated only | Placement and priority have unit tests; visual inspection remains for the user. |
| Typora 0.9.98 and Linux | Not run | Static compatibility review and automated tests only. |

The Windows Chinese IME initially consumed typed Latin keys. Switching to the
English keyboard allowed the inline native menu to appear. Typora controls the
number of visible rows in that menu; `MAX_RESULTS` limits generated matches.
