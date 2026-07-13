const assert = require("node:assert/strict")
const test = require("node:test")

global.BasePlugin = class {
  i18n = { t: key => key }
}

const { plugin: RepositoryPlugin } = require("../../plugin/repository")

test("uses the shared action-buttons entry point and configured hotkey", () => {
  const instance = new RepositoryPlugin()
  instance.pluginName = "仓库"
  instance.config = { HOTKEY: "ctrl+alt+r" }

  assert.doesNotMatch(instance.html(), /plugin-repository-launcher/)
  assert.doesNotMatch(instance.style(), /plugin-repository-launcher/)
  assert.deepEqual(instance.hotkey(), [{ hotkey: "ctrl+alt+r", callback: instance.call }])
})

test("uses the same modal shell and entrance motion as plugin preferences", () => {
  const instance = new RepositoryPlugin()
  instance.pluginName = "仓库"
  instance.config = {}

  assert.doesNotMatch(instance.html(), /<fast-window/)
  assert.doesNotMatch(instance.html(), /<(?:header|main)\b/)
  assert.match(instance.html(), /class="repository-mask plugin-common-hidden"/)
  assert.match(instance.html(), /class="repository-dialog"/)
  assert.match(instance.style(), /animation: repository-fade-in \.2s linear forwards/)
  assert.match(instance.style(), /animation: repository-slide-up \.3s ease-out forwards/)
  assert.match(instance.style(), /transform: translateY\(12px\)/)
})
