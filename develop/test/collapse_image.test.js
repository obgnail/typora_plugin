require("./mocks/dom.mock.js")

const { beforeEach, describe, it } = require("node:test")
const assert = require("node:assert")

const pluginPath = require.resolve("../../plugin/collapse_image.js")

let CollapseImagePlugin
let eWrite
let eContent
let eventHub
let exportHooks
let resizeObservers
let mutationObservers
let imageObservers

const config = () => ({
  ENABLE: true,
  NAME: "",
  TRIGGER_HEIGHT: 960,
  COLLAPSED_HEIGHT: 560,
})

const defineHeight = (element, height) => {
  Object.defineProperty(element, "offsetHeight", {
    configurable: true,
    get: () => {
      height.reads = (height.reads || 0) + 1
      return height.value
    },
  })
  element.getBoundingClientRect = () => {
    throw new Error("collapse_image must not read getBoundingClientRect")
  }
}

const addMarkdownImage = ({ height, src = "image.svg", loaded = true }) => {
  const wrapper = document.createElement("span")
  wrapper.className = loaded ? "md-image md-img-loaded" : "md-image"
  const image = document.createElement("img")
  image.setAttribute("src", src)
  defineHeight(image, height)
  wrapper.appendChild(image)
  Object.defineProperty(wrapper, "offsetHeight", {
    configurable: true,
    get: () => height.value + 64,
  })
  eWrite.appendChild(wrapper)
  return { wrapper, image, height }
}

const enterViewport = (...images) => imageObservers[0].callback(images.map(target => ({ target, isIntersecting: true })))

const addMutation = (...nodes) => mutationObservers[0].callback([{
  type: "childList",
  addedNodes: nodes,
  removedNodes: [],
}])

const removeMutation = (...nodes) => mutationObservers[0].callback([{
  type: "childList",
  addedNodes: [],
  removedNodes: nodes,
}])

const changeSource = image => mutationObservers[0].callback([{
  type: "attributes",
  attributeName: "src",
  target: image,
}])

const clickControl = wrapper => {
  const event = new window.MouseEvent("click", { bubbles: true })
  Object.defineProperty(event, "offsetY", { value: wrapper.offsetHeight })
  wrapper.dispatchEvent(event)
}

const createPlugin = () => new CollapseImagePlugin("collapse_image", config(), {
  t: key => ({ "act.expand": "Expand long image", "act.collapse": "Collapse long image" })[key] || key,
})

beforeEach(() => {
  document.body.innerHTML = '<content><div id="write"></div></content>'
  eWrite = document.querySelector("#write")
  eContent = document.querySelector("content")

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
  mutationObservers = []
  imageObservers = []
  global.MutationObserver = class {
    constructor(callback) {
      this.callback = callback
      mutationObservers.push(this)
    }
    observe(target, options) {
      this.target = target
      this.options = options
    }
    disconnect() {}
  }
  global.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback
      resizeObservers.push(this)
    }
    observe(target) { this.target = target }
    disconnect() {}
  }
  global.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback
      this.targets = new Set()
      this.disconnects = 0
      imageObservers.push(this)
    }
    observe(target) { this.targets.add(target) }
    unobserve(target) { this.targets.delete(target) }
    disconnect() {
      this.disconnects++
      this.targets.clear()
    }
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
          registerNative: (name, beforeExportToNative, afterExportToNative, afterExportToNativeFinally) => {
            exportHooks[`${name}:native`] = { beforeExportToNative, afterExportToNative, afterExportToNativeFinally }
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
  it("measures Markdown images only after they enter the viewport", () => {
    const short = addMarkdownImage({ height: { value: 600 }, src: "short.svg" })
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })

    createPlugin().process()

    assert.equal(short.height.reads || 0, 0)
    assert.equal(long.height.reads || 0, 0)
    assert.deepEqual(imageObservers[0].targets, new Set([short.image, long.image]))

    enterViewport(short.image, long.image)

    assert.equal(short.height.reads, 1)
    assert.equal(long.height.reads, 1)
    assert.equal(short.wrapper.querySelector(".plugin-collapse-image-control"), null)
    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-collapsed"))
    assert.equal(imageObservers[0].targets.size, 0)
  })

  it("observes Markdown images added after plugin lifecycle completes", () => {
    const plugin = createPlugin()
    plugin.process()
    const long = addMarkdownImage({ height: { value: 1000 }, src: "late.svg" })

    addMutation(long.wrapper)
    enterViewport(long.image)

    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-collapsed"))
  })

  it("observes an image when Typora adds its loaded class after insertion", () => {
    const image = addMarkdownImage({ height: { value: 1000 }, loaded: false })
    createPlugin().process()
    assert.equal(imageObservers[0].targets.size, 0)

    image.wrapper.classList.add("md-img-loaded")
    mutationObservers[0].callback([{
      type: "attributes",
      attributeName: "class",
      oldValue: "md-image",
      target: image.wrapper,
    }])

    assert.ok(mutationObservers[0].options.attributeFilter.includes("class"))
    assert.equal(mutationObservers[0].options.attributeOldValue, true)
    assert.ok(imageObservers[0].targets.has(image.image))
    enterViewport(image.image)
    assert.ok(image.wrapper.classList.contains("plugin-collapse-image-collapsed"))
  })

  it("re-observes the editor images after size changes without immediately measuring them", () => {
    const long = addMarkdownImage({ height: { value: 1000 }, src: "resize.svg" })
    const plugin = createPlugin()
    plugin.process()
    enterViewport(long.image)
    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-collapsed"))

    long.height.value = 500
    long.height.reads = 0
    resizeObservers[0].callback([{ target: eContent }])

    assert.strictEqual(resizeObservers[0].target, eContent)
    assert.equal(long.height.reads, 0)
    assert.ok(imageObservers[0].targets.has(long.image))

    enterViewport(long.image)
    assert.equal(long.wrapper.querySelector(".plugin-collapse-image-control"), null)
  })

  it("toggles a long image by delegated mouse clicks without changing its source", () => {
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })
    createPlugin().process()
    enterViewport(long.image)

    clickControl(long.wrapper)
    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-expanded"))
    assert.equal(long.wrapper.getAttribute("data-plugin-collapse-image-label"), "Collapse long image")
    assert.equal(long.image.getAttribute("src"), "long.svg")

    clickControl(long.wrapper)
    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-collapsed"))
    assert.equal(long.wrapper.getAttribute("data-plugin-collapse-image-label"), "Expand long image")
  })

  it("keeps Typora's Markdown image wrapper free of plugin control text", () => {
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })
    createPlugin().process()
    enterViewport(long.image)

    assert.deepEqual([...long.wrapper.children], [long.image])
    assert.equal(long.wrapper.textContent, "")
  })

  it("preserves manual expansion across resize and resets it after an image source change", () => {
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })
    createPlugin().process()
    enterViewport(long.image)
    clickControl(long.wrapper)

    resizeObservers[0].callback([{ target: eContent }])
    enterViewport(long.image)
    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-expanded"))

    long.image.setAttribute("src", "replacement.svg")
    changeSource(long.image)
    enterViewport(long.image)
    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-collapsed"))
  })

  it("keeps manual expansion when Typora only changes a local image cache query", () => {
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })
    let currentSrc = "long.svg?lastModify=1"
    Object.defineProperty(long.image, "currentSrc", { configurable: true, get: () => currentSrc })
    const plugin = createPlugin()
    plugin.process()
    enterViewport(long.image)
    clickControl(long.wrapper)
    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-expanded"))

    currentSrc = "long.svg?lastModify=2"
    plugin.refreshImage(long.image)

    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-expanded"))
  })

  it("keeps manual expansion when Typora updates the rendered source URL", () => {
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })
    long.wrapper.setAttribute("data-src", "long.svg")
    const plugin = createPlugin()
    plugin.process()
    enterViewport(long.image)
    clickControl(long.wrapper)
    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-expanded"))

    long.image.setAttribute("src", "long.svg?lastModify=2")
    plugin.refreshImage(long.image)

    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-expanded"))
  })

  it("does not rescan image heights for its own wrapper-class mutations", () => {
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })
    createPlugin().process()
    enterViewport(long.image)
    long.height.reads = 0

    addMutation(long.wrapper)

    assert.equal(long.height.reads, 0)
  })

  it("does not re-observe an image when the plugin changes its own wrapper class", () => {
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })
    createPlugin().process()
    enterViewport(long.image)

    mutationObservers[0].callback([{
      type: "attributes",
      attributeName: "class",
      oldValue: "md-image md-img-loaded",
      target: long.wrapper,
    }])

    assert.equal(long.height.reads, 1)
    assert.equal(imageObservers[0].targets.size, 0)
  })

  it("forgets records for removed images", () => {
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })
    const plugin = createPlugin()
    plugin.process()
    enterViewport(long.image)

    long.wrapper.remove()
    removeMutation(long.wrapper)

    assert.equal(plugin.records.has(long.image), false)
  })

  it("does not intercept copying the image or alter its source", () => {
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })
    createPlugin().process()
    enterViewport(long.image)
    const before = long.image.getAttribute("src")
    const copied = long.image.dispatchEvent(new window.Event("copy", { bubbles: true, cancelable: true }))

    assert.ok(copied)
    assert.equal(long.image.getAttribute("src"), before)
  })

  it("cleans old observers and reapplies folding after a file reload", () => {
    const plugin = createPlugin()
    plugin.process()
    const first = addMarkdownImage({ height: { value: 1000 }, src: "first.svg" })
    addMutation(first.wrapper)
    enterViewport(first.image)
    assert.ok(first.wrapper.classList.contains("plugin-collapse-image-collapsed"))

    eWrite.replaceChildren()
    const replacement = addMarkdownImage({ height: { value: 1000 }, src: "replacement.svg" })
    eventHub.emit("fileContentLoaded")
    enterViewport(replacement.image)

    assert.ok(imageObservers[0].disconnects > 0)
    assert.ok(replacement.wrapper.classList.contains("plugin-collapse-image-collapsed"))
  })

  it("ignores raw HTML images outside Typora's Markdown image wrapper", () => {
    const raw = document.createElement("img")
    raw.setAttribute("src", "raw.svg")
    defineHeight(raw, { value: 1000 })
    eWrite.appendChild(raw)

    createPlugin().process()

    assert.equal(imageObservers[0].targets.size, 0)
    assert.equal(eWrite.querySelector(".plugin-collapse-image-control"), null)
  })

  it("removes the reading aid from collapsed and expanded exported HTML", () => {
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })
    createPlugin().process()

    const exportHtml = state => exportHooks.collapse_image.afterExportToHTML(
      `<span class="md-image md-img-loaded plugin-collapse-image-${state}" data-plugin-collapse-image-label="${state === "collapsed" ? "Expand" : "Collapse"}" style="--plugin-collapse-image-height: 560px"><img src="${long.image.getAttribute("src")}"></span>`,
    )
    ;["collapsed", "expanded"].forEach(state => {
      const exported = exportHtml(state)
      assert.ok(!exported.includes("plugin-collapse-image"))
      assert.ok(!exported.includes("data-plugin-collapse-image-label"))
      assert.ok(exported.includes('<img src="long.svg">'))
    })
  })

  it("removes and restores the reading aid around native export", () => {
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })
    createPlugin().process()
    enterViewport(long.image)

    exportHooks["collapse_image:native"].beforeExportToNative()
    assert.ok(!long.wrapper.classList.contains("plugin-collapse-image-collapsed"))
    assert.equal(long.wrapper.hasAttribute("data-plugin-collapse-image-label"), false)

    exportHooks["collapse_image:native"].afterExportToNativeFinally()
    enterViewport(long.image)
    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-collapsed"))
    assert.equal(long.wrapper.getAttribute("data-plugin-collapse-image-label"), "Expand long image")
  })

  it("restores the reading aid when native export fails", () => {
    const long = addMarkdownImage({ height: { value: 1000 }, src: "long.svg" })
    createPlugin().process()
    enterViewport(long.image)

    exportHooks["collapse_image:native"].beforeExportToNative()
    try {
      throw new Error("export failed")
    } catch (error) {
      assert.equal(error.message, "export failed")
    } finally {
      exportHooks["collapse_image:native"].afterExportToNativeFinally()
    }
    enterViewport(long.image)

    assert.ok(long.wrapper.classList.contains("plugin-collapse-image-collapsed"))
    assert.equal(long.wrapper.getAttribute("data-plugin-collapse-image-label"), "Expand long image")
  })

  it("restores manual expansion when native export rebuilds the document", () => {
    const first = addMarkdownImage({ height: { value: 1000 }, src: "first.svg" })
    const second = addMarkdownImage({ height: { value: 1000 }, src: "second.svg" })
    const plugin = createPlugin()
    plugin.process()
    enterViewport(first.image, second.image)
    clickControl(second.wrapper)
    assert.ok(second.wrapper.classList.contains("plugin-collapse-image-expanded"))

    exportHooks["collapse_image:native"].beforeExportToNative()
    eWrite.replaceChildren()
    const replacementFirst = addMarkdownImage({ height: { value: 1000 }, src: "first.svg" })
    const replacementSecond = addMarkdownImage({ height: { value: 1000 }, src: "second.svg" })
    eventHub.emit("fileContentLoaded")
    exportHooks["collapse_image:native"].afterExportToNativeFinally()
    enterViewport(replacementFirst.image, replacementSecond.image)

    assert.ok(replacementFirst.wrapper.classList.contains("plugin-collapse-image-collapsed"))
    assert.ok(replacementSecond.wrapper.classList.contains("plugin-collapse-image-expanded"))
  })
})
