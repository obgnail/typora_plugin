require("./mocks/dom.mock.js")

const { beforeEach, describe, it } = require("node:test")
const assert = require("node:assert")

const pluginPath = require.resolve("../../plugin/collapse_image.js")

let CollapseImagePlugin
let container
let eWrite
let eContent
let eventHub
let exportHooks
let resizeObservers

const config = () => ({
  ENABLE: true,
  NAME: "",
  TRIGGER_HEIGHT_PERCENT: 120,
  COLLAPSED_HEIGHT_PERCENT: 70,
})

const defineHeight = (element, getHeight) => {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ width: 800, height: getHeight(), top: 0, right: 800, bottom: getHeight(), left: 0 }),
  })
}

const setViewportHeight = height => {
  Object.defineProperty(eContent, "clientHeight", { configurable: true, value: height })
}

const addMarkdownImage = ({ height, src = "image.svg" }) => {
  const wrapper = document.createElement("span")
  wrapper.className = "md-image md-img-loaded"
  const image = document.createElement("img")
  image.setAttribute("src", src)
  defineHeight(image, () => height.value)
  wrapper.appendChild(image)
  eWrite.appendChild(wrapper)
  return { wrapper, image, height }
}

const createPlugin = () => new CollapseImagePlugin("collapse_image", config(), {
  t: key => ({ "act.expand": "Expand long image", "act.collapse": "Collapse long image" })[key] || key,
})

beforeEach(() => {
  document.body.innerHTML = '<content><div id="write"></div></content>'
  container = document.querySelector("content")
  eWrite = document.querySelector("#write")
  eContent = container
  setViewportHeight(600)

  const listeners = new Map()
  eventHub = {
    eventType: {
      fileContentLoaded: "fileContentLoaded",
      fileOpened: "fileOpened",
      allPluginsHadInjected: "allPluginsHadInjected",
      beforeToggleSourceMode: "beforeToggleSourceMode",
    },
    on: (type, listener) => listeners.set(type, listener),
    emit: type => listeners.get(type)?.(),
  }
  exportHooks = {}
  resizeObservers = []
  global.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback
      resizeObservers.push(this)
    }
    observe() {}
    disconnect() {}
  }

  global.BasePlugin = class {
    constructor(fixedName, pluginConfig, i18n) {
      this.fixedName = fixedName
      this.config = pluginConfig
      this.i18n = i18n
      this.utils = {
        entities: { eWrite, eContent },
        eventHub,
        debounce: fn => fn,
        exportHelper: {
          register: (name, beforeExportToHTML, afterExportToHTML) => {
            exportHooks[name] = { beforeExportToHTML, afterExportToHTML }
          },
          registerNative: (name, beforeExportToNative, afterExportToNative) => {
            exportHooks[`${name}:native`] = { beforeExportToNative, afterExportToNative }
          },
        },
      }
    }
    postprocess() {}
  }

  delete require.cache[pluginPath]
  CollapseImagePlugin = require(pluginPath).plugin
})

describe("collapse_image", () => {
  it("automatically collapses only tall Markdown images", () => {
    const short = addMarkdownImage({ height: { value: 600 }, src: "short.svg" })
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })

    createPlugin().process()

    assert.ok(!short.wrapper.classList.contains("plugin-collapse-image-collapsed"))
    assert.equal(short.wrapper.querySelector(".plugin-collapse-image-control"), null)
    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-collapsed"))
    assert.equal(long.wrapper.querySelector(".plugin-collapse-image-control")?.textContent, "Expand long image")
  })

  it("refreshes Markdown images added after plugin lifecycle completes", () => {
    const plugin = createPlugin()
    plugin.process()
    plugin.postprocess()
    const long = addMarkdownImage({ height: { value: 1000 }, src: "late.svg" })

    eventHub.emit("fileContentLoaded")

    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-collapsed"))
  })

  it("toggles a long image by mouse and keyboard without changing its source", () => {
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })
    createPlugin().process()

    const control = long.wrapper.querySelector(".plugin-collapse-image-control")
    control.click()
    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-expanded"))
    assert.equal(control.textContent, "Collapse long image")
    assert.equal(long.image.getAttribute("src"), "long.svg")

    control.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-collapsed"))
    assert.equal(control.textContent, "Expand long image")
  })

  it("preserves a manual choice until the image stops qualifying or its source changes", () => {
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })
    const plugin = createPlugin()
    plugin.process()

    long.wrapper.querySelector(".plugin-collapse-image-control").click()
    setViewportHeight(500)
    window.dispatchEvent(new window.Event("resize"))
    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-expanded"))

    long.height.value = 500
    window.dispatchEvent(new window.Event("resize"))
    assert.ok(!long.wrapper.classList.contains("plugin-collapse-image-collapsed"))
    assert.equal(long.wrapper.querySelector(".plugin-collapse-image-control"), null)

    long.height.value = 1000
    long.image.setAttribute("src", "replacement.svg")
    long.image.dispatchEvent(new window.Event("load", { bubbles: false }))
    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-collapsed"))
    assert.equal(long.wrapper.querySelector(".plugin-collapse-image-control")?.textContent, "Expand long image")
  })

  it("ignores raw HTML images outside Typora's Markdown image wrapper", () => {
    const raw = document.createElement("img")
    raw.setAttribute("src", "raw.svg")
    defineHeight(raw, () => 1000)
    eWrite.appendChild(raw)

    createPlugin().process()

    assert.equal(eWrite.querySelector(".plugin-collapse-image-control"), null)
    assert.ok(!raw.classList.contains("plugin-collapse-image-collapsed"))
  })

  it("removes the reading aid from exported HTML", () => {
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })
    createPlugin().process()

    const exported = exportHooks.collapse_image.afterExportToHTML(
      `<span class="md-image md-img-loaded plugin-collapse-image-collapsed" style="--plugin-collapse-image-height: 420px"><img src="${long.image.getAttribute("src")}"><div class="plugin-collapse-image-control" role="button">Expand long image</div></span>`,
    )

    assert.ok(!exported.includes("plugin-collapse-image"))
    assert.ok(exported.includes('<img src="long.svg">'))
  })

  it("removes and restores the reading aid around native export", () => {
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })
    createPlugin().process()

    exportHooks["collapse_image:native"].beforeExportToNative()
    assert.ok(!long.wrapper.classList.contains("plugin-collapse-image-collapsed"))
    assert.equal(long.wrapper.querySelector(".plugin-collapse-image-control"), null)

    exportHooks["collapse_image:native"].afterExportToNative()
    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-collapsed"))
    assert.ok(long.wrapper.querySelector(".plugin-collapse-image-control"))
  })
})
