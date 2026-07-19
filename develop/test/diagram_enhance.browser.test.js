const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")

let chromium
try {
  ({ chromium } = require("playwright-core"))
} catch {
  chromium = null
}

const defaultBrowserPath = process.platform === "win32"
  ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  : ""
const browserPath = process.env.TYPORA_PLUGIN_BROWSER_PATH || defaultBrowserPath
const browserAvailable = Boolean(chromium && browserPath && fs.existsSync(browserPath))

const read = file => fs.readFileSync(path.join(__dirname, "../../plugin/diagram_enhance", file), "utf8")

const browserBundle = () => {
  const sources = {
    core: read("core.js"),
    style: read("style.js"),
    plugin: read("index.js"),
  }
  return `
    window.BasePlugin = class {
      constructor() { this.i18n = { t: key => key } }
    }
    const sources = ${JSON.stringify(sources)}
    const modules = {}
    const load = (name, source) => {
      const module = { exports: {} }
      const localRequire = request => {
        if (request === "./core") return modules.core
        if (request === "./style") return modules.style
        throw new Error("Unexpected require: " + request)
      }
      new Function("module", "exports", "require", source)(module, module.exports, localRequire)
      modules[name] = module.exports
    }
    load("core", sources.core)
    load("style", sources.style)
    load("plugin", sources.plugin)
    window.DiagramEnhancePlugin = modules.plugin.plugin
  `
}

const runBrowserVerification = async () => {
  const browser = await chromium.launch({
    executablePath: browserPath,
    headless: true,
  })

  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 850 } })
    await page.setContent(`
      <style>
        body { margin: 0; font-family: sans-serif; }
        #write { min-height: 1800px; padding: 20px; }
        .md-diagram-panel { width: 640px; margin-bottom: 30px; }
        .md-diagram-panel-preview { width: 600px; height: 320px; border: 1px solid #999; }
        svg { width: 400px; height: 200px; display: block; }
        #write .md-diagram-panel-preview .scoped-node { fill: rgb(238, 238, 255); stroke: rgb(120, 100, 200); }
      </style>
      <div id="write">
        <textarea id="host-editor"></textarea>
        <div class="md-diagram-panel" id="svg-panel">
          <div class="md-diagram-panel-preview">
            <svg viewBox="0 0 400 200">
              <defs><clipPath id="clip"><rect width="400" height="200"></rect></clipPath></defs>
              <rect class="scoped-node" width="400" height="200" clip-path="url(#clip)"></rect>
            </svg>
          </div>
        </div>
        <div class="md-diagram-panel" id="canvas-panel">
          <div class="md-diagram-panel-preview"><canvas width="300" height="150"></canvas></div>
        </div>
      </div>
    `)
    await page.addScriptTag({ content: browserBundle() })
    await page.evaluate(() => {
      const canvas = document.querySelector("#canvas-panel canvas")
      const context = canvas.getContext("2d")
      context.fillStyle = "rgb(255, 0, 0)"
      context.fillRect(0, 0, canvas.width, canvas.height)

      const instance = new window.DiagramEnhancePlugin()
      instance.fixedName = "diagram_enhance"
      instance.config = {}
      instance.utils = {
        entities: { eWrite: document.querySelector("#write") },
        exportHelper: { register() {}, registerNative() {} },
        eventHub: { eventType: { fileOpened: "fileOpened" }, addEventListener() {} },
      }
      instance.prepare()
      const style = document.createElement("style")
      style.textContent = instance.style()
      document.head.appendChild(style)
      instance.process()
      let fullscreenElement = null
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        get: () => fullscreenElement,
      })
      document.exitFullscreen = async () => {
        fullscreenElement = null
        document.dispatchEvent(new Event("fullscreenchange"))
      }
      document.querySelectorAll(".md-diagram-panel-preview").forEach(surface => {
        surface.requestFullscreen = async function () {
          fullscreenElement = this
          document.dispatchEvent(new Event("fullscreenchange"))
        }
      })
      window.diagramEnhance = instance
    })

    const svgSurface = page.locator("#svg-panel .md-diagram-panel-preview")
    assert.equal(await svgSurface.locator(".plugin-diagram-toolbar").count(), 1)
    assert.equal(await svgSurface.locator(".plugin-diagram-resize-handle").count(), 8)
    assert.equal(await svgSurface.locator(".plugin-diagram-content").count(), 1)

    const rangeIdle = await svgSurface.evaluate(surface => ({
      backgroundColor: getComputedStyle(surface).backgroundColor,
      boxShadow: getComputedStyle(surface).boxShadow,
    }))
    await svgSurface.hover({ position: { x: 20, y: 20 } })
    await page.waitForTimeout(180)
    const rangeHovered = await svgSurface.evaluate(surface => ({
      backgroundColor: getComputedStyle(surface).backgroundColor,
      boxShadow: getComputedStyle(surface).boxShadow,
    }))
    assert.notDeepEqual(rangeHovered, rangeIdle)
    assert.notEqual(rangeHovered.boxShadow, "none")

    assert.equal(await svgSurface.locator('[data-action="wheel-toggle"]').getAttribute("aria-pressed"), "true")
    const wheelDefaultOn = await svgSurface.evaluate(surface => {
      const rect = surface.getBoundingClientRect()
      const event = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 150,
        clientY: rect.top + 100,
        deltaY: -100,
      })
      surface.dispatchEvent(event)
      return { prevented: event.defaultPrevented, scale: Number(surface.dataset.diagramScale) }
    })
    assert.equal(wheelDefaultOn.prevented, true)
    assert.ok(wheelDefaultOn.scale > 1)

    await svgSurface.locator('[data-action="wheel-toggle"]').click()
    assert.equal(await svgSurface.locator('[data-action="wheel-toggle"]').getAttribute("aria-pressed"), "false")
    const wheelOff = await svgSurface.evaluate(surface => {
      const rect = surface.getBoundingClientRect()
      const before = Number(surface.dataset.diagramScale)
      const event = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 150,
        clientY: rect.top + 100,
        deltaY: -100,
      })
      surface.dispatchEvent(event)
      return {
        prevented: event.defaultPrevented,
        before,
        scale: Number(surface.dataset.diagramScale),
      }
    })
    assert.equal(wheelOff.prevented, false)
    assert.equal(wheelOff.scale, wheelOff.before)

    await svgSurface.locator('[data-action="reset"]').click()
    await page.evaluate(() => {
      window.hostPointerDowns = 0
      window.hostPointerUps = 0
      document.querySelector("#svg-panel").addEventListener("pointerdown", () => {
        window.hostPointerDowns += 1
        document.querySelector("#host-editor").focus()
      })
      document.querySelector("#svg-panel").addEventListener("pointerup", () => {
        window.hostPointerUps += 1
        document.querySelector("#host-editor").focus()
      })
    })
    const beforePan = await svgSurface.boundingBox()
    await page.mouse.click(beforePan.x + 120, beforePan.y + 120)
    assert.equal(await page.evaluate(() => window.hostPointerDowns), 0)
    assert.equal(await page.evaluate(() => window.hostPointerUps), 0)
    assert.notEqual(await page.evaluate(() => document.activeElement?.id), "host-editor")
    await page.waitForTimeout(400)
    await page.mouse.dblclick(beforePan.x + 120, beforePan.y + 120, { delay: 60 })
    assert.equal(await page.evaluate(() => window.hostPointerDowns), 1)
    assert.equal(await page.evaluate(() => window.hostPointerUps), 1)
    assert.equal(await page.evaluate(() => document.activeElement?.id), "host-editor")
    await page.evaluate(() => {
      window.hostPointerDowns = 0
      window.hostPointerUps = 0
      document.querySelector("#host-editor").blur()
      window.diagramEnhance.options.doubleClickToEdit = false
    })
    await page.mouse.click(beforePan.x + 120, beforePan.y + 120)
    assert.equal(await page.evaluate(() => window.hostPointerDowns), 1)
    assert.equal(await page.evaluate(() => window.hostPointerUps), 1)
    assert.equal(await page.evaluate(() => document.activeElement?.id), "host-editor")
    await page.evaluate(() => {
      window.hostPointerDowns = 0
      window.hostPointerUps = 0
      document.querySelector("#host-editor").blur()
      window.diagramEnhance.options.doubleClickToEdit = true
    })
    await page.mouse.move(beforePan.x + 120, beforePan.y + 120)
    await page.mouse.down()
    await page.mouse.move(beforePan.x + 175, beforePan.y + 155, { steps: 4 })
    await page.mouse.up()
    assert.equal(await page.evaluate(() => window.hostPointerDowns), 0)
    assert.equal(await page.evaluate(() => window.hostPointerUps), 0)
    assert.notEqual(await page.evaluate(() => document.activeElement?.id), "host-editor")
    const panned = await svgSurface.evaluate(surface => ({
      x: Number(surface.dataset.diagramTranslateX),
      y: Number(surface.dataset.diagramTranslateY),
    }))
    assert.ok(panned.x >= 50)
    assert.ok(panned.y >= 30)

    const pinchScale = await svgSurface.evaluate(surface => {
      surface.setPointerCapture = () => {}
      surface.releasePointerCapture = () => {}
      const rect = surface.getBoundingClientRect()
      const emit = (type, pointerId, x, y) => surface.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType: "touch",
        button: 0,
        clientX: rect.left + x,
        clientY: rect.top + y,
      }))
      surface.querySelector('[data-action="reset"]').click()
      emit("pointerdown", 11, 100, 100)
      emit("pointerdown", 12, 200, 100)
      emit("pointermove", 12, 280, 100)
      emit("pointerup", 12, 280, 100)
      emit("pointerup", 11, 100, 100)
      const scale = Number(surface.dataset.diagramScale)
      delete surface.setPointerCapture
      delete surface.releasePointerCapture
      return scale
    })
    assert.ok(pinchScale > 1.5)

    const beforeResize = await svgSurface.boundingBox()
    const resizeHandle = svgSurface.locator('[data-position="bottom-right"]')
    const handleBox = await resizeHandle.boundingBox()
    await page.mouse.move(handleBox.x + 4, handleBox.y + 4)
    await page.mouse.down()
    assert.equal(await svgSurface.evaluate(surface => surface.classList.contains("plugin-diagram-resizing-active")), true)
    await page.mouse.move(handleBox.x + 64, handleBox.y + 44, { steps: 4 })
    await page.mouse.up()
    assert.equal(await svgSurface.evaluate(surface => surface.classList.contains("plugin-diagram-resizing-active")), false)
    const afterResize = await svgSurface.boundingBox()
    assert.ok(afterResize.width >= beforeResize.width + 50)
    assert.ok(afterResize.height >= beforeResize.height + 30)

    const canvasSurface = page.locator("#canvas-panel .md-diagram-panel-preview")
    const scopedFillBefore = await svgSurface.locator(".scoped-node").evaluate(node => getComputedStyle(node).fill)
    const originalCanvasHandle = await canvasSurface.locator("canvas").elementHandle()
    await canvasSurface.locator('[data-action="fullscreen"]').click()
    assert.equal(await canvasSurface.evaluate(surface => document.fullscreenElement === surface), true)
    assert.equal(await page.locator(".plugin-diagram-modal").count(), 0)
    assert.equal(await canvasSurface.locator('[data-action="fullscreen"]').getAttribute("aria-pressed"), "true")
    const sameCanvas = await canvasSurface.locator("canvas").evaluate((canvas, original) => canvas === original, originalCanvasHandle)
    assert.equal(sameCanvas, true)
    const fullscreenPixel = await canvasSurface.locator("canvas").evaluate(canvas => Array.from(canvas.getContext("2d").getImageData(1, 1, 1, 1).data))
    assert.deepEqual(fullscreenPixel, [255, 0, 0, 255])
    const scopedFillAfter = await svgSurface.locator(".scoped-node").evaluate(node => getComputedStyle(node).fill)
    assert.equal(scopedFillAfter, scopedFillBefore)

    const fullscreenZoom = await canvasSurface.evaluate(surface => {
      const rect = surface.getBoundingClientRect()
      const before = Number(surface.dataset.diagramScale)
      const event = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        deltaY: -100,
      })
      surface.dispatchEvent(event)
      return { before, after: Number(surface.dataset.diagramScale), prevented: event.defaultPrevented }
    })
    assert.equal(fullscreenZoom.prevented, true)
    assert.ok(fullscreenZoom.after > fullscreenZoom.before)

    await canvasSurface.locator('[data-action="fullscreen"]').click()
    assert.equal(await canvasSurface.evaluate(() => document.fullscreenElement === null), true)
  } finally {
    await browser.close()
  }
}

if (process.env.DIAGRAM_BROWSER_VERIFY === "1") {
  runBrowserVerification()
    .then(() => console.log("BROWSER VERIFY OK"))
    .catch(error => {
      console.error(error)
      process.exitCode = 1
    })
} else {
  test("runs wheel, pan, pinch, resize, and original-DOM fullscreen in Chromium", {
    skip: !browserAvailable,
    timeout: 30000,
  }, runBrowserVerification)
}
