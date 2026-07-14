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

test("uses theme-safe controls and the shared dropdown", () => {
  const instance = new RepositoryPlugin()
  instance.pluginName = "仓库"
  instance.config = {}

  assert.doesNotMatch(instance.html(), /<\/?(?:select|option|button)\b/i)
  assert.match(instance.html(), /<fast-dropdown class="repository-sort"/)
  assert.doesNotMatch(instance.style(), /\breplaceChildren\b|\binset\s*:/)
})

test("stores repository data through utils.getStorage", async () => {
  let storageKey
  let value = null
  const storage = {
    get: () => value,
    set: nextValue => value = JSON.parse(JSON.stringify(nextValue)),
    remove: () => value = null,
  }
  const instance = new RepositoryPlugin()
  instance.fixedName = "repository"
  instance.utils = {
    getStorage: key => {
      storageKey = key
      return storage
    },
  }

  await instance.prepare()

  assert.equal(storageKey, "repository.data")
  assert.deepEqual(value, instance._emptyData())
})

test("registers repository search with the smart input handler", () => {
  const eventTarget = () => ({ addEventListener: () => undefined })
  const instance = new RepositoryPlugin()
  const search = eventTarget()
  let smartInputArgs
  instance.entities = {
    panel: eventTarget(),
    close: eventTarget(),
    search,
    sort: eventTarget(),
    add: eventTarget(),
    list: eventTarget(),
  }
  instance.pendingWarnings = []
  instance.loadError = null
  instance.utils = {
    createSmartInputHandler: (...args) => smartInputArgs = args,
    hide: () => undefined,
    isShown: () => false,
    getMountFolder: () => "",
    eventHub: {
      eventType: { fileOpened: "fileOpened" },
      addEventListener: () => undefined,
    },
  }

  const originalDocument = global.document
  global.document = { addEventListener: () => undefined }
  try {
    instance.process()
  } finally {
    global.document = originalDocument
  }

  assert.equal(smartInputArgs[0], search)
  assert.equal(smartInputArgs[1], instance.render)
  assert.deepEqual(smartInputArgs[2], { debounceDelay: 100 })
})
