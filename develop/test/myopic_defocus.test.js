const { describe, it, beforeEach } = require("node:test")
const assert = require("node:assert")
require("./mocks/dom.mock.js")

const MyopicDefocus = require("../../plugin/myopic_defocus/myopic_defocus")

describe("MyopicDefocus", () => {
  beforeEach(() => document.body.innerHTML = "")

  describe("constructor", () => {
    it("applies default config when no config is passed", () => {
      const md = new MyopicDefocus()
      assert.strictEqual(md.config.screenSize, 14)
      assert.strictEqual(md.config.screenResolutionX, 2560)
      assert.strictEqual(md.config.screenResolutionY, 1440)
      assert.strictEqual(md.config.screenDistance, 40)
      assert.strictEqual(md.config.effectStrength, 10)
      assert.strictEqual(md.config.svgContainerId, "myopic-defocus-svg")
      assert.strictEqual(md.config.blurLayerId, "myopic-defocus-layer")
    })

    it("merges caller-supplied config over the defaults", () => {
      const md = new MyopicDefocus({ screenSize: 27, svgContainerId: "custom-svg" })
      assert.strictEqual(md.config.screenSize, 27)
      assert.strictEqual(md.config.svgContainerId, "custom-svg")
      // untouched defaults remain
      assert.strictEqual(md.config.screenResolutionX, 2560)
    })

    it("generates a unique filterId per instance", () => {
      const a = new MyopicDefocus()
      const b = new MyopicDefocus()
      assert.notStrictEqual(a.filterId, b.filterId)
      assert.match(a.filterId, /^Blending_[a-z0-9]+$/)
    })

    it("starts with null blurLayer/svgContainer", () => {
      const md = new MyopicDefocus()
      assert.strictEqual(md.blurLayer, null)
      assert.strictEqual(md.svgContainer, null)
    })
  })

  describe("applyEffect - optics computation", () => {
    it("returns blurB, blurG, effectStrength and the merged config", () => {
      const md = new MyopicDefocus()
      const result = md.applyEffect({
        screenSize: 14,
        screenResolutionX: 1920,
        screenResolutionY: 1080,
        screenDistance: 40,
        effectStrength: 10,
      })
      assert.strictEqual(typeof result.blurB, "number")
      assert.strictEqual(typeof result.blurG, "number")
      assert.strictEqual(result.effectStrength, 0.1) // 10 / 100
      assert.strictEqual(result.config.screenSize, 14)
    })

    it("blurB is always greater than blurG (blue LCA constant > green)", () => {
      // LCA_CONSTANTS = { r: -0.23, g: 0.24, b: 1.10 } -> b - r > g - r, so blurB > blurG always
      const md = new MyopicDefocus()
      const { blurB, blurG } = md.applyEffect({})
      assert.ok(blurB > blurG)
    })

    it("larger screenDistance increases blur radii proportionally", () => {
      const md = new MyopicDefocus()
      const near = md.applyEffect({ screenDistance: 20 })
      const far = md.applyEffect({ screenDistance: 80 })
      assert.ok(far.blurB > near.blurB)
      assert.ok(far.blurG > near.blurG)
    })

    it("higher resolution at the same screen size increases the pixel-space blur radius (each pixel is physically smaller)", () => {
      const md = new MyopicDefocus()
      const lowRes = md.applyEffect({ screenResolutionX: 1280, screenResolutionY: 720 })
      const highRes = md.applyEffect({ screenResolutionX: 3840, screenResolutionY: 2160 })
      assert.ok(highRes.blurB > lowRes.blurB)
      assert.ok(highRes.blurG > lowRes.blurG)
    })

    it("effectStrength of 0 maps to opacity 0, effectStrength of 100 maps to opacity 1", () => {
      const md = new MyopicDefocus()
      const zero = md.applyEffect({ effectStrength: 0 })
      const full = md.applyEffect({ effectStrength: 100 })
      assert.strictEqual(zero.effectStrength, 0)
      assert.strictEqual(full.effectStrength, 1)
    })

    it("merges newConfig over the instance config without mutating the original config object", () => {
      const md = new MyopicDefocus({ screenSize: 14 })
      md.applyEffect({ screenSize: 27 })
      assert.strictEqual(md.config.screenSize, 14, "instance config should remain unchanged; only a local cfg copy is merged")
    })
  })

  describe("applyEffect / _initDom - DOM side effects", () => {
    it("injects an svgContainer and blurLayer into document.body on first call", () => {
      const md = new MyopicDefocus()
      assert.strictEqual(document.getElementById("myopic-defocus-svg"), null)
      assert.strictEqual(document.getElementById("myopic-defocus-layer"), null)

      md.applyEffect({})

      assert.ok(document.getElementById("myopic-defocus-svg"))
      assert.ok(document.getElementById("myopic-defocus-layer"))
      assert.strictEqual(md.svgContainer, document.getElementById("myopic-defocus-svg"))
      assert.strictEqual(md.blurLayer, document.getElementById("myopic-defocus-layer"))
    })

    it("uses custom svgContainerId / blurLayerId from config", () => {
      const md = new MyopicDefocus({ svgContainerId: "custom-svg", blurLayerId: "custom-layer" })
      md.applyEffect({})
      assert.ok(document.getElementById("custom-svg"))
      assert.ok(document.getElementById("custom-layer"))
    })

    it("does not re-create DOM nodes on subsequent applyEffect calls (idempotent init)", () => {
      const md = new MyopicDefocus()
      md.applyEffect({})
      const firstSvg = md.svgContainer
      const firstLayer = md.blurLayer

      md.applyEffect({ effectStrength: 20 })

      assert.strictEqual(md.svgContainer, firstSvg)
      assert.strictEqual(md.blurLayer, firstLayer)
      // only one of each element should exist in the DOM
      assert.strictEqual(document.querySelectorAll("#myopic-defocus-svg").length, 1)
      assert.strictEqual(document.querySelectorAll("#myopic-defocus-layer").length, 1)
    })

    it("updates feGaussianBlur stdDeviation attributes to match the latest computed blur radii", () => {
      const md = new MyopicDefocus()
      const { blurB, blurG, filterId } = { ...md.applyEffect({ effectStrength: 15 }), filterId: md.filterId }

      const blueBlur = document.getElementById(`${filterId}_blur_b`)
      const greenBlur = document.getElementById(`${filterId}_blur_g`)
      assert.strictEqual(blueBlur.getAttribute("stdDeviation"), String(blurB))
      assert.strictEqual(greenBlur.getAttribute("stdDeviation"), String(blurG))
    })

    it("sets blurLayer.style.opacity to the normalized effectStrength", () => {
      const md = new MyopicDefocus()
      md.applyEffect({ effectStrength: 25 })
      assert.strictEqual(md.blurLayer.style.opacity, "0.25")
    })

    it("re-applying with a different effectStrength updates opacity without duplicating DOM nodes", () => {
      const md = new MyopicDefocus()
      md.applyEffect({ effectStrength: 10 })
      assert.strictEqual(md.blurLayer.style.opacity, "0.1")
      md.applyEffect({ effectStrength: 30 })
      assert.strictEqual(md.blurLayer.style.opacity, "0.3")
      assert.strictEqual(document.querySelectorAll("#myopic-defocus-layer").length, 1)
    })

    it("svgContainer is hidden (display:none) while blurLayer is visible and fixed-positioned", () => {
      const md = new MyopicDefocus()
      md.applyEffect({})
      assert.strictEqual(md.svgContainer.style.display, "none")
      assert.strictEqual(md.blurLayer.style.position, "fixed")
      assert.strictEqual(md.blurLayer.style.pointerEvents, "none")
    })

    it("blurLayer backdrop-filter references this instance's unique filterId", () => {
      const md = new MyopicDefocus()
      md.applyEffect({})
      assert.match(md.blurLayer.style.cssText, new RegExp(`url\\("#${md.filterId}"\\)`))
    })
  })

  describe("removeEffect", () => {
    it("removes both DOM nodes and resets internal references to null", () => {
      const md = new MyopicDefocus()
      md.applyEffect({})
      assert.ok(document.getElementById("myopic-defocus-svg"))

      md.removeEffect()

      assert.strictEqual(document.getElementById("myopic-defocus-svg"), null)
      assert.strictEqual(document.getElementById("myopic-defocus-layer"), null)
      assert.strictEqual(md.svgContainer, null)
      assert.strictEqual(md.blurLayer, null)
    })

    it("is safe to call when the effect was never applied (no DOM nodes yet)", () => {
      const md = new MyopicDefocus()
      assert.doesNotThrow(() => md.removeEffect())
    })

    it("is safe to call twice in a row (idempotent)", () => {
      const md = new MyopicDefocus()
      md.applyEffect({})
      md.removeEffect()
      assert.doesNotThrow(() => md.removeEffect())
    })

    it("allows applyEffect to be called again after removeEffect, re-creating fresh DOM nodes", () => {
      const md = new MyopicDefocus()
      md.applyEffect({})
      const firstLayer = md.blurLayer
      md.removeEffect()
      md.applyEffect({})
      assert.notStrictEqual(md.blurLayer, firstLayer)
      assert.ok(document.getElementById("myopic-defocus-layer"))
    })
  })

  describe("multiple independent instances", () => {
    it("two instances with different container ids do not collide in the DOM", () => {
      const md1 = new MyopicDefocus({ svgContainerId: "svg-1", blurLayerId: "layer-1" })
      const md2 = new MyopicDefocus({ svgContainerId: "svg-2", blurLayerId: "layer-2" })
      md1.applyEffect({ effectStrength: 5 })
      md2.applyEffect({ effectStrength: 20 })

      assert.ok(document.getElementById("svg-1"))
      assert.ok(document.getElementById("svg-2"))
      assert.strictEqual(md1.blurLayer.style.opacity, "0.05")
      assert.strictEqual(md2.blurLayer.style.opacity, "0.2")
    })
  })
})
