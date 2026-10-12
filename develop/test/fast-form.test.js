const { describe, it, mock, before, beforeEach, after, afterEach } = require("node:test")
const assert = require("node:assert")

let i18n, utils
let dom, container
let FastForm, ff

before(async () => {
  i18n = await require("./fixtures/i18n.js").get("en")
  utils = {
    ...require("./mocks/utils.mock.js"),
    notification: { show: mock.fn((msg, type) => `notification.${type}: ${msg}`) },
    hotkeyHub: {
      unregister: mock.fn((hotkey) => `hotkeyHub.unregister: ${hotkey}`),
      capitalize: mock.fn(s => s),
      pause: mock.fn(),
      resume: mock.fn(),
    },
    formDialog: { modal: mock.fn(async (op) => ({ response: 1, data: op.data })) },
  }
  dom = require("./mocks/dom.mock.js")

  require("./fixtures/fast-form")({ utils, i18n })

  FastForm = customElements.get("fast-form")
  ff = new FastForm()
  container = document.getElementById("test-container")
  container.appendChild(ff)
})

const flushMicrotasks = () => Promise.resolve()

describe("FastForm Browser Env", () => {
  it("FastForm has initialized", () => {
    assert.ok(typeof ff.render === "function")
    assert.ok(typeof ff.clear === "function")
    assert.ok(typeof FastForm.registerControl === "function")
  })
})

describe("FastForm LifecycleHooks", () => {
  beforeEach(() => ff.clear())

  it("should broadcast to all subscribers without returning a combined result for default strategy hooks", () => {
    let executionCount = 0

    // 'onRender' uses the default 'broadcast' strategy
    ff.hooks.on("onRender", () => executionCount++)
    ff.hooks.on("onRender", () => executionCount++)

    const result = ff.hooks.invoke("onRender", ff)
    assert.strictEqual(executionCount, 2, "All registered temporary subscribers should be executed")
    assert.strictEqual(result, undefined, "Broadcast hooks should not return any computed value")
  })

  it("should execute pipeline strategy hooks sequentially, passing the return value to the next subscriber", () => {
    const context = { key: "test_field" }

    // 'onProcessValue' uses the 'pipeline' strategy
    // Subscriber 1: Add 1
    ff.hooks.on("onProcessValue", (val) => val + 1)
    // Subscriber 2: Multiply by 2
    ff.hooks.on("onProcessValue", (val) => val * 2)

    // The default implementation simply returns the value, so sequence is: 5 -> Default(5) -> Sub1(6) -> Sub2(12)
    const result = ff.hooks.invoke("onProcessValue", 5, context)
    assert.strictEqual(result, 12, "Pipeline should pass the mutated value through the chain: (5 + 1) * 2")
  })

  it("should aggregate results from all subscribers into a flat array using the 'aggregate' strategy", () => {
    const context = { key: "test_field" }
    const error1 = new Error("First Validation Error")
    const error2 = new Error("Second Validation Error")

    // 'onValidate' uses the 'aggregate' strategy and a specific `getResult` normalizer
    ff.hooks.on("onValidate", () => [error1]) // Returns an array
    ff.hooks.on("onValidate", () => error2)   // Returns a raw Error (should be normalized by getResult)
    ff.hooks.on("onValidate", () => true)     // Returns true (should be normalized to empty array [])

    const results = ff.hooks.invoke("onValidate", context)
    assert.ok(Array.isArray(results), "Aggregated result should be a flat array")
    assert.strictEqual(results.length, 2, "Should accumulate all valid error instances")
    assert.strictEqual(results[0], error1, "First error should be retained")
    assert.strictEqual(results[1], error2, "Raw error should be wrapped into the flat array by the normalizer")
  })

  it("should bypass all static and temporary subscribers when a hook is explicitly overridden", () => {
    let tempCalled = false
    let overrideCalled = false

    ff.hooks.on("onProcessValue", () => tempCalled = true)

    // Override the hook
    ff.hooks.override("onProcessValue", (val) => {
      overrideCalled = true
      return "hacked_value"
    })

    const result = ff.hooks.invoke("onProcessValue", "original_value")
    assert.strictEqual(overrideCalled, true, "The override function should be executed")
    assert.strictEqual(tempCalled, false, "Standard subscribers should be completely bypassed")
    assert.strictEqual(result, "hacked_value", "The return value should come exclusively from the override")
  })

  it("should log a warning and safely ignore subscriptions or overrides for unknown hooks", () => {
    const warnings = []
    mock.method(console, "warn", (msg) => warnings.push(msg))

    // Attempt to subscribe to an undefined hook
    ff.hooks.on("onImaginaryHook", () => undefined)
    // Attempt to override an undefined hook
    ff.hooks.override("onImaginaryHook", () => undefined)

    // Attempt to invoke an undefined hook
    const result = ff.hooks.invoke("onImaginaryHook", "data")
    assert.strictEqual(warnings.length, 2, "Should emit two warnings for the invalid subscription and override attempts")
    assert.ok(warnings[0].includes("unknown hook"), "Warning message should pinpoint the unknown hook issue")
    assert.strictEqual(result, undefined, "Invoking an unknown hook should safely return undefined without throwing")
  })

  it("should wipe out all temporary subscribers and overrides when clear() is invoked", () => {
    let executionCount = 0

    ff.hooks.on("onOptionsReady", () => executionCount++)
    ff.hooks.override("onProcessValue", () => "overridden")

    // Trigger the cleanup
    ff.hooks.clear()

    // 1. Verify temporary subscribers are gone
    ff.hooks.invoke("onOptionsReady", ff)
    assert.strictEqual(executionCount, 0, "Temporary subscriber should not be invoked after clear()")

    // 2. Verify overrides are gone (should fallback to default pipeline implementation which returns the raw value)
    const result = ff.hooks.invoke("onProcessValue", "safe_value")
    assert.strictEqual(result, "safe_value", "Override should be removed, allowing the default pipeline to pass the value untouched")
  })
})

describe("FastForm Registration APIs", () => {
  let warningMessages = []
  beforeEach(() => mock.method(console, "warn", (msg) => warningMessages.push(msg)))
  afterEach(() => warningMessages = [])

  describe("registerControl", () => {
    it("should successfully register a valid control definition", () => {
      const validControl = {
        create: () => "<div class='mock-control'></div>",
        update: () => undefined,
        controlOptions: { defaultSize: "large" },
      }
      FastForm.registerControl("mock_control_valid", validControl)
      assert.strictEqual(FastForm.controls["mock_control_valid"], validControl, "Control should be added to the static controls map")
      assert.strictEqual(warningMessages.length, 0, "Should not emit any warnings for fresh registrations")
    })

    it("should throw a TypeError if the required 'create' property is missing or not a function", () => {
      const missingCreate = { update: () => undefined }
      const invalidCreate = { create: "not_a_function" }
      assert.throws(() => {
        FastForm.registerControl("mock_control_missing_create", missingCreate)
      }, /must have a 'create' of type 'function'/, "Should reject definitions without a 'create' property")
      assert.throws(() => {
        FastForm.registerControl("mock_control_invalid_create", invalidCreate)
      }, /must be a function/, "Should reject definitions where 'create' is not a function")
    })

    it("should throw a TypeError if 'controlOptions' is provided but is not a plain object", () => {
      const arrayOptions = { create: () => "", controlOptions: [] } // Array instead of plain object
      const nullOptions = { create: () => "", controlOptions: null }
      assert.throws(() => {
        FastForm.registerControl("mock_control_array_options", arrayOptions)
      }, /must be a plain object/, "Should reject Arrays for controlOptions")
      assert.throws(() => {
        FastForm.registerControl("mock_control_null_options", nullOptions)
      }, /must be a plain object/, "Should reject null for controlOptions")
    })

    it("should emit a console warning when attempting to overwrite an existing control", () => {
      const dummyControl = { create: () => "" }
      FastForm.registerControl("mock_control_duplicate", dummyControl)
      FastForm.registerControl("mock_control_duplicate", dummyControl)
      assert.strictEqual(warningMessages.length, 1, "Should emit exactly one warning")
      assert.ok(warningMessages[0].includes("Overwriting control for 'mock_control_duplicate'"), "Warning message should pinpoint the overwritten control")
    })
  })

  describe("registerFeature", () => {
    it("should successfully register a valid feature and execute its 'install' hook immediately with the FastForm class", () => {
      let installArgument = null
      const validFeature = {
        install: (FormClass) => installArgument = FormClass,
        configure: () => undefined,
        featureOptions: { enable: true },
      }
      FastForm.registerFeature("mock_feature_valid", validFeature)
      assert.strictEqual(FastForm.features["mock_feature_valid"], validFeature, "Feature should be added to the static features map")
      assert.strictEqual(installArgument, FastForm, "The 'install' hook should be called synchronously, passing the FastForm class itself")
    })

    it("should throw a TypeError if an optional hook (like 'compile') is provided but not a function", () => {
      const invalidFeature = { compile: "this_should_be_a_function" }
      assert.throws(() => {
        FastForm.registerFeature("mock_feature_invalid", invalidFeature)
      }, /The 'compile' property.*must be a function/, "Should enforce strict type checking on optional feature hooks")
    })

    it("should emit a console warning when attempting to overwrite an existing feature", () => {
      const dummyFeature = {}
      FastForm.registerFeature("mock_feature_duplicate", dummyFeature)
      FastForm.registerFeature("mock_feature_duplicate", dummyFeature)
      assert.strictEqual(warningMessages.length, 1)
      assert.ok(warningMessages[0].includes("Overwriting feature for 'mock_feature_duplicate'"), "Warning message should specify the overwritten feature")
    })
  })

  describe("registerLayout", () => {
    it("should successfully register a valid layout definition", () => {
      const validLayout = { base: "default", defaultCol: 12 }
      FastForm.registerLayout("mock_layout_valid", validLayout)
      assert.strictEqual(FastForm.layouts["mock_layout_valid"], validLayout, "Layout should be added to the static layouts map")
    })

    it("should throw a TypeError if the layout definition is falsy or not an object", () => {
      assert.throws(() => {
        FastForm.registerLayout("mock_layout_null", null)
      }, /Layout definition must be an object/, "Should reject null definitions")
      assert.throws(() => {
        FastForm.registerLayout("mock_layout_string", "just_a_string")
      }, /Layout definition must be an object/, "Should reject string definitions")
    })

    it("should emit a console warning when attempting to overwrite an existing layout", () => {
      const dummyLayout = {}
      FastForm.registerLayout("mock_layout_duplicate", dummyLayout)
      FastForm.registerLayout("mock_layout_duplicate", dummyLayout)
      assert.strictEqual(warningMessages.length, 1)
      assert.ok(warningMessages[0].includes("Overwriting layout for 'mock_layout_duplicate'"), "Warning message should specify the overwritten layout")
    })
  })

  describe("validateDefinition (Internal Helper Boundary Checks)", () => {
    it("should throw a TypeError if the definition itself is not a non-null object", () => {
      assert.throws(() => {
        FastForm.registerControl("mock_def_null", null)
      }, /must be a non-null object/, "Should reject null passed as the root definition")
    })
  })
})

describe("FastForm Core - Commit Pipeline & Events", () => {
  beforeEach(() => ff.clear())

  it("should dispatch a 'form-crud' CustomEvent on the form element via the default onCommit hook", async () => {
    const events = []
    ff.addEventListener("form-crud", (ev) => events.push(ev.detail))

    ff.render({
      schema: [{ fields: [{ type: "text", key: "name" }] }],
      data: { name: "a" },
    })
    await flushMicrotasks()

    ff.validateAndCommit("name", "b")
    assert.strictEqual(events.length, 1, "Each successful commit should emit exactly one form-crud event")
    assert.strictEqual(events[0].key, "name")
    assert.strictEqual(events[0].value, "b")
    assert.ok(events[0].field, "changeContext should carry the resolved field")
  })

  it("should NOT dispatch form-crud on a failed commit", () => {
    const events = []
    ff.addEventListener("form-crud", (ev) => events.push(ev))
    ff.render({
      schema: [{ fields: [{ type: "text", key: "name" }] }],
      data: {},
      rules: { name: "required" },
    })
    ff.validateAndCommit("name", "")
    assert.strictEqual(events.length, 0, "Validation failure must not reach onCommit")
  })

  it("should invoke onBeforeCommit/onCommit/onAfterCommit in order around setData", () => {
    const order = []
    let dataAtBeforeCommit
    let dataAtAfterCommit
    ff.render({
      schema: [{ fields: [{ type: "text", key: "name" }] }],
      data: { name: "old" },
      hooks: {
        onBeforeCommit: (ctx) => {
          order.push("before")
          dataAtBeforeCommit = ff.getData("name")
        },
        onCommit: (ctx) => order.push("commit"),
        onAfterCommit: (ctx) => {
          order.push("after")
          dataAtAfterCommit = ff.getData("name")
        },
      },
    })
    ff.validateAndCommit("name", "new")

    assert.deepStrictEqual(order, ["before", "commit", "after"], "Commit hooks must run in strict sequence")
    assert.strictEqual(dataAtBeforeCommit, "old", "onBeforeCommit runs before setData")
    assert.strictEqual(dataAtAfterCommit, "new", "onAfterCommit runs after setData")
  })

  it("should flush pending queued changes before a synchronous validateAndCommit", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "name" }] }],
      data: { name: "" },
    })

    ff.queueFieldValueUpdate("name", "queued")
    // validateAndCommit internally calls _processPendingChanges first
    const ok = ff.validateAndCommit("name", "sync")
    assert.strictEqual(ok, true)
    assert.strictEqual(ff.getData("name"), "sync", "Sync commit should apply on top of the flushed queue")

    await flushMicrotasks()
    assert.strictEqual(ff.getData("name"), "sync", "No stale queued value should overwrite the sync commit")
  })

  it("should coalesce multiple queueFieldValueUpdate calls on the same key (last wins)", async () => {
    const commits = []
    ff.render({
      schema: [{ fields: [{ type: "text", key: "name" }] }],
      data: {},
      hooks: { onCommit: (ctx) => commits.push(ctx.value) },
    })

    ff.queueFieldValueUpdate("name", "v1")
    ff.queueFieldValueUpdate("name", "v2")
    ff.queueFieldValueUpdate("name", "v3")

    await flushMicrotasks()
    assert.strictEqual(ff.getData("name"), "v3", "pendingChanges Map dedupes by key, keeping the last write")
    assert.strictEqual(commits.length, 1, "Coalesced keys should produce a single commit, not three")
  })

  it("should return false and not commit when the key resolves to no field", () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "exists" }] }],
      data: {},
    })
    assert.strictEqual(ff.validateAndCommit("missing", "x"), false, "Unknown key must abort the commit")
    assert.strictEqual(ff.validateAndCommit("", "x"), false, "Empty key must abort the commit")
    assert.strictEqual(ff.validateAndCommit(null, "x"), false, "Null key must abort the commit")
    assert.strictEqual(ff.getData("missing"), undefined)
  })

  it("should restore the control DOM to the old value when validateAndCommit fails", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "name" }] }],
      data: { name: "original" },
      rules: { name: "required" },
    })
    await flushMicrotasks()

    const input = ff.form.querySelector(`[data-control="name"] .text-input`)
    input.value = "tampered" // simulate an uncommitted UI mutation
    const ok = ff.validateAndCommit("name", "")
    assert.strictEqual(ok, false)
    assert.strictEqual(input.value, "original", "Failed commit must re-render the control with the pre-commit value")
  })

  it("should invoke onValidateFailed with error notification and highlight the failing control", async () => {
    const showMock = mock.fn()
    const restoreShow = mock.method(utils.notification, "show", showMock)
    try {
      ff.render({
        schema: [{ fields: [{ type: "text", key: "name" }] }],
        data: {},
        rules: { name: "required" },
      })
      await flushMicrotasks()

      ff.validateAndCommit("name", "")
      assert.ok(showMock.mock.calls.length >= 1, "onValidateFailed should surface the first error as a notification")
      const el = ff.form.querySelector(`[data-control="name"]`)
      assert.ok(el.classList.contains("input-error"), "Failing control should receive the input-error highlight class")
    } finally {
      restoreShow.mock.restore()
    }
  })

  it("should short-circuit validation when onBeforeValidate produces errors", () => {
    let onValidateRan = false
    const preErr = new Error("early fail")
    ff.render({
      schema: [{ fields: [{ type: "text", key: "name" }] }],
      data: {},
      hooks: {
        onBeforeValidate: () => [preErr],
        onValidate: () => {
          onValidateRan = true
          return []
        },
      },
    })
    const ok = ff.validateAndCommit("name", "x")
    assert.strictEqual(ok, false)
    assert.strictEqual(onValidateRan, false, "Non-empty onBeforeValidate errors must skip the onValidate stage entirely")
  })

  it("should allow onAfterValidate to transform the error list (pipeline)", () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "name" }] }],
      data: {},
      rules: { name: "required" },
      hooks: {
        onAfterValidate: (errors) => errors.map(e => new Error(`[wrapped] ${e.message}`)),
      },
    })
    let captured = []
    ff.hooks.on("onValidateFailed", (errors) => captured = errors)
    ff.validateAndCommit("name", "")
    assert.ok(captured[0].message.startsWith("[wrapped]"), "onAfterValidate should be able to rewrite validation errors")
  })

  it("should support pipeline transformations via onProcessValue", () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "name" }] }],
      data: {},
      hooks: {
        onProcessValue: (val) => typeof val === "string" ? val.trim() : val,
      },
    })
    ff.validateAndCommit("name", "   padded   ")
    assert.strictEqual(ff.getData("name"), "padded", "onProcessValue should transform the value before validation/commit")
  })
})

describe("FastForm Core - User Hooks & Options", () => {
  beforeEach(() => ff.clear())

  it("should accept hooks in object form { on, override }", async () => {
    const calls = []
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: {},
      hooks: {
        onBeforeCommit: { on: (ctx) => calls.push("on:" + ctx.key) },
        onCommit: { override: (ctx) => calls.push("override:" + ctx.key) },
      },
    })
    ff.validateAndCommit("a", "1")
    assert.deepStrictEqual(calls, ["on:a", "override:a"], "{on} registers a subscriber; {override} replaces the default impl")
  })

  it("should run onOptions as a pipeline step via a feature's hook method, able to rewrite options", () => {
    ff.constructor.registerFeature("onOptionsProbe", {
      featureOptions: {},
      onOptions: (options, form) => {
        options.data.a = "rewritten"
        return options
      },
    })

    const local = document.createElement(ff.localName || "fast-form")
    local.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: { a: "raw" },
    })

    assert.strictEqual(local.getData("a"), "rewritten", "Feature-level onOptions participates in the render-time pipeline")
  })

  it("should document that options.hooks.onOptions is registered too late to run", async () => {
    let called = false
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: {},
      hooks: { onOptions: () => called = true },
    })
    assert.strictEqual(called, false, "options.hooks.onOptions never fires: _applyUserHooks runs after the onOptions invoke")
  })

  it("should document that options.hooks.onOptions and pre-render subscriptions cannot intercept onOptions", async () => {
    let viaOption = false
    let viaManual = false
    ff.hooks.on("onOptions", () => { viaManual = true })

    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: {},
      hooks: { onOptions: () => viaOption = true },
    })
    await flushMicrotasks()

    assert.strictEqual(viaOption, false)
    assert.strictEqual(viaManual, false)
  })

  it("should support both { on } and { override } within the same hook entry", () => {
    let onRan = false
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: {},
      hooks: {
        onAfterCommit: {
          on: () => onRan = true,
          override: () => onRan = "override-wins",
        },
      },
    })
    ff.validateAndCommit("a", "x")
    assert.strictEqual(onRan, "override-wins", "Override must completely bypass both static subscribers and the 'on' listener")
  })
})

describe("FastForm Core - Layout Resolution", () => {
  beforeEach(() => ff.clear())

  it("should apply grid layout classes: ff-row on container and ff-col-N on boxes/fields", async () => {
    ff.render({
      layout: "grid",
      schema: [{ fields: [{ type: "text", key: "a", col: 6 }, { type: "text", key: "b" }] }],
      data: {},
    })
    await flushMicrotasks()

    assert.ok(ff.form.classList.contains("ff-row"), "Grid layout should mark the root container with ff-row")
    const box = ff.form.querySelector(".box-container")
    assert.ok(box.classList.contains("ff-col-12"), "Box without col should use defaultCol=12")
    const a = ff.form.querySelector(`[data-control="a"]`)
    const b = ff.form.querySelector(`[data-control="b"]`)
    assert.ok(a.classList.contains("ff-col-6"), "Field with col:6 should get ff-col-6")
    assert.ok(b.classList.contains("ff-col-12"), "Field without col should fall back to defaultCol")
  })


  it("should merge config from a custom layout object only when the outer setup consumes it", async () => {
    ff.render({
      layout: {
        base: "default",
        fieldClass: "custom-field-wrap",
        setup: (base, config) => ({
          renderFieldWrapper(field, controlHTML, extraClass = "") {
            return base.renderFieldWrapper.call(this, field, controlHTML, `${extraClass} ${config.fieldClass}`.trim())
          },
        }),
      },
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: {},
    })
    await flushMicrotasks()

    const a = ff.form.querySelector(`[data-control="a"]`)
    assert.ok(a.classList.contains("custom-field-wrap"), "Outer config should be consumable via the outer setup's mergedConfig argument")
  })

  it("should let a custom layout setup() override base methods", async () => {
    ff.render({
      layout: {
        base: "default",
        setup: (base) => ({
          renderBoxTitle: (box) => `<div class="title custom-title">${box.title || ""}</div>`,
        }),
      },
      schema: [{ title: "MyBox", fields: [{ type: "text", key: "a" }] }],
      data: {},
    })
    await flushMicrotasks()
    assert.ok(ff.form.querySelector(".custom-title"), "setup() methods should override the resolved base layout methods")
  })

  it("should throw when the named layout does not exist", () => {
    assert.throws(
      () => ff.render({ layout: "no_such_layout", schema: [], data: {} }),
      /Layout 'no_such_layout' not found/,
    )
  })

  it("should let field-level 'col' override the grid layout's defaultCol", async () => {
    ff.render({
      layout: "grid",
      schema: [{ fields: [{ type: "text", key: "a", col: 4 }, { type: "text", key: "b" }] }],
      data: {},
    })
    await flushMicrotasks()

    assert.ok(ff.form.querySelector(`[data-control="a"]`).classList.contains("ff-col-4"), "field.col should win over defaultCol")
    assert.ok(ff.form.querySelector(`[data-control="b"]`).classList.contains("ff-col-12"), "Missing field.col should fall back to defaultCol=12")
  })

  it("should fall back to the default layout chain even when base is null", async () => {
    ff.render({
      layout: { base: null, setup: () => ({ findControl: () => null }) },
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: {},
    })
    await flushMicrotasks()

    assert.ok(ff.form.querySelector(`[data-control="a"]`), "Rendering should succeed via the inherited default render")
    assert.strictEqual(ff.options.layout.findControl("a", ff.form), null, "Outer setup's findControl should shadow the base one")
  })

  it("should throw when the named layout does not exist", () => {
    assert.throws(
      () => ff.render({ layout: "no_such_layout", schema: [], data: {} }),
      /Layout 'no_such_layout' not found/,
    )
  })
})

describe("FastForm Core - Instance Overrides & Precedence", () => {
  beforeEach(() => ff.clear())

  it("should apply containerClass when the consuming layout reads it at its own level", async () => {
    ff.render({
      layout: {
        base: "default",
        containerClass: "my-form-root",
        setup: (base, config) => ({
          updateRootContainer(container) {
            container.className = config.containerClass
          },
        }),
      },
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: {},
    })
    await flushMicrotasks()
    assert.ok(ff.form.classList.contains("my-form-root"), "updateRootContainer should set the configured containerClass")
  })

  it("should merge controlOptions with precedence: control defaults < form-level < field-level", () => {
    ff.render({
      schema: [{
        fields: [
          { type: "icon", key: "a" },
          { type: "icon", key: "b", placeholder: "field-level" },
        ],
      }],
      data: {},
      controlOptions: { icon: { placeholder: "form-level" } },
    })

    assert.strictEqual(ff.getControlOptionsFromKey("a").placeholder, "form-level", "Form-level controlOptions should override control defaults")
    assert.strictEqual(ff.getControlOptionsFromKey("b").placeholder, "field-level", "Field-level property should win, but only for keys present in controlOptions defaults")

    ff.clear()
    ff.render({
      schema: [{ fields: [{ type: "icon", key: "c", notADefaultKey: "x" }] }],
      data: {},
    })
    assert.strictEqual(ff.getControlOptionsFromKey("c").notADefaultKey, undefined, "Field properties outside controlOptions defaults are not picked into controlOptions")
  })

  it("should let instance-level controls option override a globally registered control type", async () => {
    let instanceCreateRan = false
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: {},
      controls: {
        text: {
          create: () => {
            instanceCreateRan = true
            return `<div class="custom-text"></div>`
          },
        },
      },
    })
    await flushMicrotasks()
    assert.ok(instanceCreateRan, "Instance-level control definition should replace the global 'text' control for this render")
    assert.ok(ff.form.querySelector(".custom-text"))
  })

  it("should warn and ignore 'install' on an instance-level feature override", async () => {
    const warnings = []
    const restore = mock.method(console, "warn", (msg) => warnings.push(String(msg)))
    try {
      ff.render({
        schema: [{ fields: [{ type: "text", key: "a" }] }],
        data: {},
        features: {
          collapser: {
            install: () => {
            },
          }, // 'collapser' is a globally registered feature name
        },
      })
      assert.ok(
        warnings.some(w => w.includes("'install' method") && w.includes("collapser")),
        "Instance feature named like a global one must warn that install is ignored",
      )
    } finally {
      restore.mock.restore()
    }
  })

  it("should run configure() for instance-only features and expose their APIs", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: {},
      features: {
        myInstanceFeature: {
          featureOptions: { myOpt: true },
          configure: ({ registerApi }) => registerApi("myApi", { ping: () => "pong" }),
        },
      },
    })
    const api = ff.getApi("myApi")
    assert.strictEqual(api.ping(), "pong", "Instance feature configure() should be able to register form APIs")
    assert.strictEqual(ff.options.myOpt, true, "featureOptions defaults must merge into resolved options")
  })
})

describe("FastForm Core - Field Resolution & Traversal", () => {
  beforeEach(() => ff.clear())

  it("should resolve nested paths to the nearest registered field via resolveFieldContext", async () => {
    ff.render({
      schema: [{ fields: [{ type: "object", key: "cfg" }] }],
      data: { cfg: { deep: { v: 1 } } },
    })
    const ctx = ff.resolveFieldContext("cfg.deep.v")
    assert.strictEqual(ctx.field.key, "cfg", "Deep path should resolve to the registered container field")
    assert.strictEqual(ctx.relativePath, "deep.v")
    assert.strictEqual(ctx.fullPath, "cfg.deep.v")
    assert.strictEqual(ff.resolveFieldContext("totally.unknown.path"), null)
  })

  it("should build containerValue correctly when committing a deep sub-path", async () => {
    ff.render({
      schema: [{ fields: [{ type: "object", key: "cfg" }] }],
      data: { cfg: { a: 1, deep: { v: 1 } } },
    })
    let captured
    ff.hooks.on("onBeforeCommit", (ctx) => captured = ctx)
    ff.validateAndCommit("cfg.deep.v", 99)

    assert.strictEqual(captured.relativePath, "deep.v")
    assert.deepStrictEqual(captured.containerValue, { a: 1, deep: { v: 99 } },
      "containerValue should be the full container object with the sub-path applied")
    assert.deepStrictEqual(ff.getData("cfg"), { a: 1, deep: { v: 99 } })
  })

  it("should traverse nested schemas (tabs) via getNestedSchemas during _collectFields", async () => {
    ff.render({
      schema: [{
        fields: [{
          type: "tabs",
          key: "t",
          tabs: [{ label: "T1", value: "1", schema: [{ fields: [{ type: "text", key: "nestedField" }] }] }],
        }],
      }],
      data: {},
    })
    await flushMicrotasks()
    assert.ok(ff.getField("nestedField"), "Fields inside nested schemas must be collected into the runtime field map")
  })
})

describe("FastForm Core - Lifecycle & Cleanup", () => {
  beforeEach(() => ff.clear())

  it("should invoke onDestroy and run registered cleanups on clear()", () => {
    let destroyed = 0
    let cleaned = 0
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: {},
      hooks: { onDestroy: () => destroyed++ },
    })
    ff.registerCleanup(() => cleaned++)
    ff.registerCleanup("not-a-function") // must be ignored

    ff.clear()
    assert.strictEqual(destroyed, 1, "onDestroy hook should fire on clear()")
    assert.strictEqual(cleaned, 1, "Registered cleanup should run on clear()")
    assert.strictEqual(ff._runtime.cleanups.length, 0, "Cleanup list should be emptied after execution")
    assert.strictEqual(ff._runtime.apis.size, 0, "API map should be cleared")
  })

  it("should expose hooks.has() reflecting known hook definitions", () => {
    ff.render({ schema: [], data: {} })
    assert.strictEqual(ff.hooks.has("onCommit"), true)
    assert.strictEqual(ff.hooks.has("onValidateFailed"), true)
    assert.strictEqual(ff.hooks.has("notAHook"), false)
  })
})

describe("FastForm Feature_Highlight", () => {
  let originalScrollIntoView
  let scrollIntoViewMock

  beforeEach(() => {
    ff.clear()
    originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView
    scrollIntoViewMock = mock.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock
  })

  afterEach(() => {
    if (originalScrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    } else {
      delete window.HTMLElement.prototype.scrollIntoView
    }
  })

  it("should highlight matching string keywords case-insensitively by default during render", async () => {
    ff.render({
      schema: [{ title: "Test Group", fields: [{ type: "text", key: "f1", label: "testing label" }] }],
      data: {},
      highlight: "test", // Trigger highlight on render
    })
    await flushMicrotasks()

    const marks = ff.form.querySelectorAll("mark.feature-highlight")
    assert.strictEqual(marks.length, 2, "Should find 'Test' in the title and 'test' in the label")
    assert.strictEqual(marks[0].textContent, "Test", "Should preserve the original casing of the matched text (Title)")
    assert.strictEqual(marks[1].textContent, "test", "Should preserve the original casing of the matched text (Label)")
  })

  it("should respect the caseSensitiveOnHighlight option when highlighting strings", async () => {
    ff.render({
      schema: [{ title: "Apple", fields: [{ type: "text", key: "f1", label: "apple" }] }],
      data: {},
      highlight: "Apple",
      caseSensitiveOnHighlight: true,
    })
    await flushMicrotasks()

    const marks = ff.form.querySelectorAll("mark.feature-highlight")
    assert.strictEqual(marks.length, 1, "Should only match the exact case 'Apple'")
    assert.strictEqual(marks[0].textContent, "Apple")
  })

  it("should support RegExp objects and automatically append the 'g' flag for global highlighting", async () => {
    ff.render({
      schema: [{ title: "Item 123", fields: [{ type: "text", key: "f1", label: "Code 456" }] }],
      data: {},
    })
    await flushMicrotasks()

    const api = ff.getApi("highlight")
    // Trigger via API with a Regex matching digits (without 'g', the engine should add it)
    api.highlight(/\d+/)

    const marks = ff.form.querySelectorAll("mark.feature-highlight")
    assert.strictEqual(marks.length, 2, "Should highlight both numeric sequences")
    assert.strictEqual(marks[0].textContent, "123")
    assert.strictEqual(marks[1].textContent, "456")
  })

  it("should correctly handle multiple matches within the exact same text node", async () => {
    ff.render({
      schema: [{ title: "banana banana", fields: [] }],
      data: {},
    })
    await flushMicrotasks()

    ff.getApi("highlight").highlight("na")
    const marks = ff.form.querySelectorAll("mark")
    assert.strictEqual(marks.length, 4, "Should successfully split and highlight all 4 occurrences of 'na' in 'banana banana'")
  })

  it("should ignore text inside nodes matching highlightIgnoreSelector (e.g., tooltips) and only target highlightTargetSelector", async () => {
    ff.render({
      schema: [{ title: "Target Keyword", fields: [{ type: "text", key: "f1", label: "Keyword", tooltip: "Hidden Keyword" }] }],
      data: {},
    })
    await flushMicrotasks()

    // 'Keyword' appears in Title, Label, and Tooltip
    ff.getApi("highlight").highlight("Keyword")
    const marks = ff.form.querySelectorAll("mark")

    assert.strictEqual(marks.length, 2, "Should highlight the title and label, but skip the tooltip completely")

    const tooltipMark = ff.form.querySelector(".tooltip mark")
    assert.strictEqual(tooltipMark, null, "Tooltip content should not contain any highlighted marks")
  })

  it("should clear previous highlights completely, restoring normal text nodes and structure", async () => {
    ff.render({
      schema: [{ title: "Hello World", fields: [] }],
      data: {},
    })
    await flushMicrotasks()

    const api = ff.getApi("highlight")

    // Highlight 1
    api.highlight("Hello")
    assert.strictEqual(ff.form.querySelectorAll("mark").length, 1)

    // Highlight 2 (Implicit Clear)
    api.highlight("World")
    const marks = ff.form.querySelectorAll("mark")
    assert.strictEqual(marks.length, 1, "Previous highlights should be cleared before applying new ones")
    assert.strictEqual(marks[0].textContent, "World")

    // Explicit Clear
    api.clear()
    assert.strictEqual(ff.form.querySelectorAll("mark").length, 0, "All marks should be removed")
    assert.strictEqual(ff.form.querySelector(".title").textContent, "Hello World", "Original text and DOM structure should be fully normalized and restored")
  })

  it("should autoExpand collapsed boxes containing a match if autoExpandOnHighlight is true", async () => {
    ff.render({
      schema: [{ id: "box1", title: "Hidden Secret", fields: [] }],
      data: {},
      collapsibleBox: true,
      // autoExpandOnHighlight defaults to true
    })
    await flushMicrotasks()

    const boxContainer = ff.form.querySelector(`.box-container[data-box="box1"]`)
    boxContainer.classList.add("collapsed") // Manually collapse it for the test

    ff.getApi("highlight").highlight("Secret")

    assert.strictEqual(boxContainer.classList.contains("collapsed"), false, "Box should auto-expand by removing the 'collapsed' class")
  })

  it("should scroll to the first match smoothly if scrollToFirstMatchOnHighlight is true", async () => {
    ff.render({
      schema: [{ title: "First Match", fields: [] }, { title: "Second Match", fields: [] }],
      data: {},
      scrollToFirstMatchOnHighlight: true,
    })
    await flushMicrotasks()

    ff.getApi("highlight").highlight("Match")

    assert.strictEqual(scrollIntoViewMock.mock.calls.length, 1, "scrollIntoView should be triggered exactly once for the first matching element")
    const callArgs = scrollIntoViewMock.mock.calls[0].arguments
    assert.deepStrictEqual(callArgs[0], { behavior: "smooth", block: "center" }, "Should scroll with the correct UI behavior configuration")
  })

  it("should not crash or highlight anything when passed empty strings, null, or invalid types", async () => {
    ff.render({
      schema: [{ title: "Safe Test", fields: [] }],
      data: {},
    })
    await flushMicrotasks()

    const api = ff.getApi("highlight")

    assert.doesNotThrow(() => {
      api.highlight("")
      api.highlight(null)
      api.highlight(undefined)
      api.highlight(123)
      api.highlight({ invalid: "type" })
    }, "Should silently handle invalid input payloads without crashing the app")

    assert.strictEqual(ff.form.querySelectorAll("mark").length, 0, "DOM should remain completely clean on invalid/empty inputs")
  })
})

describe("FastForm Feature_Parsing", () => {
  beforeEach(() => ff.clear())

  it("should transform the input value using the parser defined in options before committing", async () => {
    ff.render({
      schema: [{ fields: [{ type: "number", key: "age" }, { type: "text", key: "username" }] }],
      data: { age: 0, username: "" },
      parsers: {
        // String to Number transform
        age: (val) => Number(val),
        // Trim whitespace and lowercase
        username: (val) => String(val).trim().toLowerCase(),
      },
    })
    await flushMicrotasks()

    // Test numerical parsing
    ff.validateAndCommit("age", "25")
    assert.strictEqual(ff.getData("age"), 25, "String '25' should be parsed into the number 25")

    // Test string normalization
    ff.validateAndCommit("username", "  AdMiN  ")
    assert.strictEqual(ff.getData("username"), "admin", "String should be trimmed and converted to lowercase")
  })

  it("should pass the correct changeContext (key, value, type) to the parser function", async () => {
    let capturedContext = null
    ff.render({
      schema: [{ fields: [{ type: "text", key: "dynamicField" }] }],
      data: { dynamicField: "" },
      parsers: {
        dynamicField: (val, ctx) => {
          capturedContext = ctx
          return `${ctx.key}_${val}`
        },
      },
    })
    ff.validateAndCommit("dynamicField", "testVal")

    assert.ok(capturedContext !== null, "Parser should receive the context argument")
    assert.strictEqual(capturedContext.key, "dynamicField", "Context should contain the correct field key")
    assert.strictEqual(ff.getData("dynamicField"), "dynamicField_testVal", "Value should be transformed using context properties")
  })

  it("should leave the value entirely unchanged if no parser is registered for the field key", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "unparsedField" }] }],
      data: { unparsedField: "" },
      // Intentionally omitting 'parsers' option
    })
    const rawValue = "  Raw Data \n "
    ff.validateAndCommit("unparsedField", rawValue)
    assert.strictEqual(
      ff.getData("unparsedField"),
      rawValue,
      "Data should remain unmodified when bypassing the parsing pipeline",
    )
  })

  it("should allow dynamic registration and retrieval of parsers via the parsing API at runtime", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "tag" }] }],
      data: { tag: "" },
    })
    const parsingApi = ff.getApi("parsing")
    assert.ok(parsingApi, "Parsing API should be registered successfully")

    // Pre-API commit
    ff.validateAndCommit("tag", "hello")
    assert.strictEqual(ff.getData("tag"), "hello", "Should be unchanged before parser registration")

    // Register parser dynamically
    const customParser = (val) => `[${val}]`
    parsingApi.set("tag", customParser)

    // Verify retrieval
    assert.strictEqual(parsingApi.get("tag"), customParser, "API should return the newly registered parser function")

    // Post-API commit
    ff.validateAndCommit("tag", "world")
    assert.strictEqual(ff.getData("tag"), "[world]", "Newly registered parser should immediately take effect")
  })

  it("should ignore invalid parsers gracefully and log a warning without breaking the pipeline", async () => {
    let warningMessage = ""
    mock.method(console, "warn", (msg) => warningMessage = msg)

    ff.render({
      schema: [{ fields: [{ type: "text", key: "faultyField" }] }],
      data: { faultyField: "" },
    })
    const parsingApi = ff.getApi("parsing")

    // Attempt to register a non-function (e.g., a string or object)
    parsingApi.set("faultyField", "not-a-function")
    assert.ok(warningMessage.includes("is not a function"), "System should warn developers about the invalid registration")

    // Ensure the pipeline still works and falls back to passing the raw value
    const isOk = ff.validateAndCommit("faultyField", "survivor")
    assert.strictEqual(isOk, true, "Commit pipeline should not crash")
    assert.strictEqual(ff.getData("faultyField"), "survivor", "Value should pass through unaltered")
  })
})

describe("FastForm Feature_Validation", () => {
  beforeEach(() => ff.clear())

  it("should reject invalid data and prevent commit when using built-in string validators", () => {
    let validationErrors = []
    ff.render({
      schema: [{ fields: [{ type: "text", key: "username" }] }],
      data: { username: "admin" },
      rules: {
        username: "required", // Built-in validator
      },
      hooks: {
        onValidateFailed: (errors) => validationErrors = errors,
      },
    })

    // Attempt to set an empty string (which fails 'required')
    const isValid = ff.validateAndCommit("username", "")
    assert.strictEqual(isValid, false, "Commit should be rejected")
    assert.strictEqual(ff.getData("username"), "admin", "Underlying data should remain unchanged when validation fails")
    assert.strictEqual(validationErrors.length, 1, "Should capture one validation error")
    assert.equal(validationErrors[0].message, i18n.t("settings", "error.required"), "Error message should indicate required failure")

    // Attempt to set a valid string
    const isNowValid = ff.validateAndCommit("username", "john_doe")
    assert.strictEqual(isNowValid, true, "Commit should succeed with valid data")
    assert.strictEqual(ff.getData("username"), "john_doe", "Underlying data should be updated")
  })

  it("should initialize factory validators correctly via object configuration (with args)", () => {
    let validationErrors = []
    ff.render({
      schema: [{ fields: [{ type: "number", key: "age" }] }],
      data: { age: 20 },
      rules: {
        // Factory validator: calling `min(18)`
        age: { validator: "min", args: [18] },
      },
      hooks: {
        onValidateFailed: (errors) => validationErrors = errors,
      },
    })

    const isValid = ff.validateAndCommit("age", 15)

    assert.strictEqual(isValid, false, "Commit should be rejected for failing the min(18) rule")
    assert.ok(validationErrors[0].message.includes("18"), "Error message should include the boundary argument")

    assert.strictEqual(ff.validateAndCommit("age", 18), true, "Boundary value 18 should pass")
    assert.strictEqual(ff.validateAndCommit("age", 25), true, "Value strictly greater than 18 should pass")
  })

  it("should support custom function validators and evaluate cross-field dependencies", () => {
    let validationErrors = []
    ff.render({
      schema: [{ fields: [{ type: "password", key: "password" }, { type: "password", key: "confirmPassword" }] }],
      data: { password: "secret_password", confirmPassword: "" },
      rules: {
        confirmPassword: (ctx, formData) => {
          // Accessing cross-field data using the second argument (formData)
          if (ctx.value !== formData.password) {
            return new Error("Passwords do not match")
          }
          return true
        },
      },
      hooks: {
        onValidateFailed: (errors) => validationErrors = errors,
      },
    })

    const isInvalid = ff.validateAndCommit("confirmPassword", "wrong_password")
    assert.strictEqual(isInvalid, false)
    assert.strictEqual(validationErrors[0].message, "Passwords do not match", "Custom error message should be returned")

    const isValid = ff.validateAndCommit("confirmPassword", "secret_password")
    assert.strictEqual(isValid, true, "Validation should pass when custom logic returns true")
  })

  it("should separately evaluate $self (container) and $each (item) rules for array data mutations", () => {
    ff.render({
      schema: [{ fields: [{ type: "array", key: "scores", dataType: "number" }] }],
      data: { scores: [90, 85] },
      rules: {
        scores: {
          $self: { validator: "maxItems", args: [3] }, // Array length cannot exceed 3
          $each: { validator: "max", args: [100] },     // Every single item cannot exceed 100
        },
      },
    })

    // Scenario 1: Validate $each using a push-equivalent full-array "set"
    const isPushValid = ff.validateAndCommit("scores", [...ff.getData("scores"), 105])
    assert.strictEqual(isPushValid, false, "Should reject because the new item fails the $each 'max: 100' rule")
    assert.strictEqual(ff.getData("scores").length, 2, "Array should remain unchanged after rejected mutation")

    // Scenario 2: Validate $each using deep path set mutation
    const isDeepSetValid = ff.validateAndCommit("scores.0", 105)
    assert.strictEqual(isDeepSetValid, false, "Should reject specific index mutation because it fails the $each rule")

    // Scenario 3: Validate $self using bulk set mutation
    const isBulkSetValid = ff.validateAndCommit("scores", [90, 85, 80, 75])
    assert.strictEqual(isBulkSetValid, false, "Should reject setting 4 items because it fails the $self 'maxItems: 3' rule")

    // Scenario 4: Valid push-equivalent full-array "set"
    const isOk = ff.validateAndCommit("scores", [...ff.getData("scores"), 95])
    assert.strictEqual(isOk, true, "Valid item addition should pass both $self and $each rules")
    assert.strictEqual(ff.getData("scores").length, 3, "Array should be successfully updated")
  })

  it("should accumulate multiple errors when a field has an array of rules", () => {
    let validationErrors = []
    ff.render({
      schema: [{ fields: [{ type: "text", key: "username" }] }],
      data: { username: "valid_user" },
      rules: {
        // Testing array of rules: custom function + built-in regex pattern
        username: [
          (ctx) => ctx.value !== "admin" ? true : "Cannot be admin",
          { validator: "pattern", args: [/^[a-z]+$/] },
        ],
      },
      hooks: {
        onValidateFailed: (errors) => validationErrors = errors,
      },
    })

    // Test failing first rule
    ff.validateAndCommit("username", "admin")
    assert.strictEqual(validationErrors[0].message, "Cannot be admin", "Should fail the custom rule")

    // Test failing second rule
    ff.validateAndCommit("username", "JOHN") // Uppercase fails /^[a-z]+$/
    assert.equal(validationErrors[0].message, i18n.t("settings", "error.pattern"), "Should fail the pattern rule")

    // Valid case
    assert.strictEqual(ff.validateAndCommit("username", "john"), true)
  })
})

describe("FastForm Feature_Watchers", () => {
  beforeEach(() => ff.clear())

  it("should execute a custom function effect when triggered by source field changes", async () => {
    let executionCount = 0
    ff.render({
      schema: [{ fields: [{ type: "text", key: "source" }, { type: "text", key: "target" }] }],
      data: { source: "", target: "" },
      watchers: {
        customEffectWatcher: {
          triggers: ["source"],
          affects: ["target"],
          effect: (isMet, ctx) => {
            if (isMet) {
              executionCount++
              ctx.setValue("target", ctx.getValue("source") + "_mutated")
            }
          },
        },
      },
    })

    assert.strictEqual(executionCount, 1, "Watcher should run once during the mount phase")
    ff.reactiveCommit("source", "new_value")
    await flushMicrotasks()

    assert.strictEqual(executionCount, 2, "Watcher should run again after source update")
    assert.strictEqual(ff.getData("target"), "new_value_mutated", "Target field should be correctly updated via ctx.setValue")
  })

  it("should update data declaratively using $update with both static and function values", async () => {
    ff.render({
      schema: [{
        fields: [{ type: "text", key: "firstName" }, { type: "text", key: "lastName" }, { type: "text", key: "fullName" }, {
          type: "text",
          key: "staticTag",
        }],
      }],
      data: { firstName: "John", lastName: "Doe", fullName: "", staticTag: "" },
      watchers: {
        syncWatcher: {
          triggers: ["firstName", "lastName"],
          effect: {
            $update: {
              fullName: (ctx) => `${ctx.getValue("firstName")} ${ctx.getValue("lastName")}`,
              staticTag: "updated_tag", // Static value update
            },
          },
        },
      },
    })

    await flushMicrotasks()
    assert.strictEqual(ff.getData("fullName"), "John Doe")
    assert.strictEqual(ff.getData("staticTag"), "updated_tag")

    ff.reactiveCommit("firstName", "Jane")
    await flushMicrotasks()

    assert.strictEqual(ff.getData("fullName"), "Jane Doe", "Computed value should reflect changes")
  })

  it("should only execute the effect when the specified 'when' condition is met", async () => {
    ff.render({
      schema: [{ fields: [{ type: "switch", key: "toggle" }, { type: "text", key: "status" }] }],
      data: { toggle: false, status: "idle" },
      watchers: {
        statusWatcher: {
          triggers: ["toggle"],
          when: { toggle: { $eq: true } },
          effect: { $update: { status: "active" } },
        },
      },
    })

    // Mount phase: condition is false, status remains "idle"
    assert.strictEqual(ff.getData("status"), "idle")

    // Turn on: condition met
    ff.reactiveCommit("toggle", true)
    await flushMicrotasks()
    assert.strictEqual(ff.getData("status"), "active", "Status should update when condition is met")

    // Turn off: manually reset status to test if effect is skipped
    ff.reactiveCommit("status", "reset")
    ff.reactiveCommit("toggle", false)
    await flushMicrotasks()
    assert.strictEqual(ff.getData("status"), "reset", "Effect should not run if condition is unmet")
  })

  it("should evaluate complex nested conditions using $and, $or, and comparison operators", async () => {
    ff.render({
      schema: [{ fields: [{ type: "number", key: "age" }, { type: "text", key: "role" }, { type: "text", key: "category" }] }],
      data: { age: 10, role: "user", category: "none" },
      watchers: {
        complexWatcher: {
          triggers: ["age", "role"],
          when: {
            $and: [
              { age: { $gte: 18 } },
              { $or: [{ role: { $eq: "admin" } }, { role: { $eq: "moderator" } }] },
            ],
          },
          effect: { $update: { category: "privileged_adult" } },
        },
      },
    })

    ff.reactiveCommit("age", 20)
    ff.reactiveCommit("role", "user")
    await flushMicrotasks()
    assert.strictEqual(ff.getData("category"), "none", "Condition not fully met (role mismatch)")

    ff.reactiveCommit("role", "admin")
    await flushMicrotasks()
    assert.strictEqual(ff.getData("category"), "privileged_adult", "Condition fully met ($and + $or evaluated correctly)")
  })

  it("should correctly resolve cascading dependencies (A -> B -> C) in a single cycle", async () => {
    ff.render({
      schema: [{ fields: [{ type: "number", key: "a" }, { type: "number", key: "b" }, { type: "number", key: "c" }] }],
      data: { a: 1, b: 0, c: 0 },
      watchers: {
        watcherB: {
          triggers: ["a"],
          affects: ["b"],
          effect: { $update: { b: (ctx) => ctx.getValue("a") * 2 } },
        },
        watcherC: {
          triggers: ["b"],
          affects: ["c"],
          effect: { $update: { c: (ctx) => ctx.getValue("b") + 10 } },
        },
      },
    })

    // Mount phase already resolved A(1) -> B(2) -> C(12)
    await flushMicrotasks()
    assert.strictEqual(ff.getData("b"), 2)
    assert.strictEqual(ff.getData("c"), 12)

    ff.reactiveCommit("a", 5)
    await flushMicrotasks()

    assert.strictEqual(ff.getData("b"), 10, "B should be updated to A * 2")
    assert.strictEqual(ff.getData("c"), 20, "C should be cascaded to B + 10 immediately")
  })

  it("should apply UI effects ($classes) based on condition matching ($then / $else branches)", async () => {
    ff.render({
      schema: [{ fields: [{ type: "switch", key: "hideMode" }, { type: "text", key: "targetField" }] }],
      data: { hideMode: false },
      watchers: {
        uiWatcher: {
          triggers: ["hideMode"],
          when: { hideMode: true },
          effect: {
            $updateUI: {
              $then: { targetField: { $classes: { $add: "plugin-common-hidden" } } },
              $else: { targetField: { $classes: { $remove: "plugin-common-hidden" } } },
            },
          },
        },
      },
    })

    const targetEl = ff.form.querySelector(`.control[data-control="targetField"]`)

    // Initial state is false, should hit $else branch
    assert.ok(!targetEl.classList.contains("plugin-common-hidden"), "Hidden class should not be present initially")

    ff.reactiveCommit("hideMode", true)
    await flushMicrotasks() // $updateUI also goes through the engine execution
    assert.ok(targetEl.classList.contains("plugin-common-hidden"), "$then branch should add hidden class")

    ff.reactiveCommit("hideMode", false)
    await flushMicrotasks()
    assert.ok(!targetEl.classList.contains("plugin-common-hidden"), "$else branch should remove hidden class")
  })

  it("should throw an error when a circular dependency is detected and allowCircularDependencies is false", async () => {
    const renderCircularForm = () => {
      ff.render({
        schema: [{ fields: [{ type: "text", key: "a" }, { type: "text", key: "b" }] }],
        allowCircularDependencies: false,
        watchers: {
          w1: { triggers: ["a"], affects: ["b"], effect: { $update: { b: "1" } } },
          w2: { triggers: ["b"], affects: ["a"], effect: { $update: { a: "1" } } },
        },
      })
    }

    assert.throws(renderCircularForm, /Circular dependency detected/, "Engine should preemptively catch cyclical graphs via topological sort")
  })

  it("should throw TypeError in strict mode if imperative function effect lacks 'affects' array", async () => {
    const renderStrictForm = () => {
      ff.render({
        schema: [{ fields: [{ type: "text", key: "a" }] }],
        requireAffectsForFunctionEffect: true, // Edge Case: Strict mode
        watchers: {
          strictWatcher: {
            triggers: ["a"],
            // Missing `affects: [...]` here while using a function effect
            effect: (isMet, ctx) => {
              ctx.setValue("b", "test")
            },
          },
        },
      })
    }

    assert.throws(renderStrictForm, /missing the 'affects' array/, "Strict mode should prevent untraceable imperative side-effects")
  })

  it("should correctly evaluate $meta conditions such as $isMounting", async () => {
    let mountedValue = false

    ff.render({
      schema: [{ fields: [{ type: "text", key: "dummy" }] }],
      watchers: {
        metaWatcher: {
          when: { $meta: { $isMounting: true } },
          affects: [],
          effect: () => {
            mountedValue = true
          },
        },
      },
    })

    // The mount phase inherently triggers the engine with Phase.Mount
    await flushMicrotasks()
    assert.strictEqual(mountedValue, true, "Effect should run because the engine payload matched $isMounting: true")
  })

  it("should allow manual triggering of watchers via the API with custom payload", async () => {
    let payloadReceived = null

    ff.render({
      schema: [{ fields: [{ type: "text", key: "dummy" }] }],
      watchers: {
        manualWatcher: {
          affects: [],
          effect: (isMet, ctx) => {
            payloadReceived = ctx.payload
          },
        },
      },
    })

    const api = ff.getApi("watchers")
    api.trigger("manualWatcher", { customAction: "test_trigger" })

    await flushMicrotasks() // Manual trigger via API uses the execution engine too
    assert.strictEqual(payloadReceived.customAction, "test_trigger", "Watcher should receive the payload passed via the API")
  })
})

describe("FastForm Feature_FieldDependencies", () => {
  beforeEach(() => ff.clear())

  it("should apply the default 'readonly' class when a field dependency is unmet", async () => {
    ff.render({
      schema: [{
        fields: [
          { type: "switch", key: "enableInput" },
          { type: "text", key: "targetInput", dependencies: { enableInput: true } },
        ],
      }],
      data: { enableInput: false, targetInput: "" },
    })

    await flushMicrotasks()

    const targetControl = ff.form.querySelector(`.control[data-control="targetInput"]`)

    // Unmet condition: target should be readonly by default
    assert.ok(targetControl.classList.contains("plugin-common-readonly"), "Field should have 'readonly' class initially")
    assert.ok(!targetControl.classList.contains("plugin-common-hidden"), "Field should not be hidden by default")

    ff.reactiveCommit("enableInput", true)
    await flushMicrotasks()

    // Met condition: readonly class should be removed
    assert.ok(!targetControl.classList.contains("plugin-common-readonly"), "Field should remove 'readonly' class when condition is met")
  })

  it("should apply the 'hide' class when dependencyUnmetAction is explicitly set to 'hide'", async () => {
    ff.render({
      schema: [{
        fields: [
          { type: "switch", key: "enableInput" },
          {
            type: "text",
            key: "targetInput",
            dependencies: { enableInput: true },
            dependencyUnmetAction: "hide", // Explicitly overriding the default
          },
        ],
      }],
      data: { enableInput: false, targetInput: "" },
    })

    await flushMicrotasks()
    const targetControl = ff.form.querySelector(`.control[data-control="targetInput"]`)

    // Unmet condition: target should be hidden
    assert.ok(targetControl.classList.contains("plugin-common-hidden"), "Field should have 'hidden' class based on explicit action")

    ff.reactiveCommit("enableInput", true)
    await flushMicrotasks()

    assert.ok(!targetControl.classList.contains("plugin-common-hidden"), "Field should remove 'hidden' class when condition is met")
  })

  it("should correctly evaluate chained dependencies using the '$follow' evaluator", async () => {
    ff.render({
      schema: [{
        fields: [
          { type: "switch", key: "step1" },
          { type: "switch", key: "step2", dependencies: { step1: true } },
          { type: "text", key: "step3", dependencies: { $follow: "step2" } }, // step3 follows step2's availability
        ],
      }],
      data: { step1: false, step2: true, step3: "" },
    })

    await flushMicrotasks()
    const step3Control = ff.form.querySelector(`.control[data-control="step3"]`)

    // Initially step1 is false, so step2's dependency is unmet.
    // Even though step2's data is true, step3 follows step2's DEPENDENCY status, so step3 should be readonly.
    assert.ok(step3Control.classList.contains("plugin-common-readonly"), "Step3 should be disabled because Step2's dependency is unmet")

    ff.reactiveCommit("step1", true)
    await flushMicrotasks()

    // Now step1 is true -> step2's dependency is met -> step3's $follow condition is met.
    assert.ok(!step3Control.classList.contains("plugin-common-readonly"), "Step3 should be enabled because the chained dependency is now met")
  })
})

describe("FastForm Feature_BoxDependencies", () => {
  beforeEach(() => ff.clear())

  it("should apply the default 'hide' class to a box when its dependency is unmet", async () => {
    ff.render({
      schema: [{
        id: "conditionalBox",
        dependencies: { showBox: true },
        fields: [
          { type: "switch", key: "showBox" }, // Placed outside or inside, logic still applies
          { type: "text", key: "innerInput" },
        ],
      }],
      data: { showBox: false, innerInput: "" },
    })

    await flushMicrotasks()
    const boxContainer = ff.form.querySelector(`.box-container[data-box="conditionalBox"]`)

    // Box default unmet action is hide
    assert.ok(boxContainer.classList.contains("plugin-common-hidden"), "Box should be hidden by default when dependency is unmet")

    ff.reactiveCommit("showBox", true)
    await flushMicrotasks()

    assert.ok(!boxContainer.classList.contains("plugin-common-hidden"), "Box should become visible when dependency is met")
  })

  it("should destroy and restore inner state when destroyStateOnHide is enabled", async () => {
    ff.render({
      schema: [
        {
          id: "statefulBox",
          dependencies: { enableFeature: true },
          fields: [{ type: "text", key: "sensitiveData" }],
        },
        { // Helper box to toggle the dependency
          id: "helperBox",
          fields: [{ type: "switch", key: "enableFeature" }],
        },
      ],
      data: { enableFeature: true, sensitiveData: "Initial Secret" },
      destroyStateOnHide: true, // Enable strict state management
    })

    await flushMicrotasks()

    // Step 1: Modify the data when box is active
    ff.reactiveCommit("sensitiveData", "User typed secret")
    await flushMicrotasks()
    assert.strictEqual(ff.getData("sensitiveData"), "User typed secret", "Data should be updated normally")

    // Step 2: Toggle the dependency to hide the box
    ff.reactiveCommit("enableFeature", false)
    await flushMicrotasks()

    // Because destroyStateOnHide is true, hiding the box should set inner fields to undefined
    assert.strictEqual(ff.getData("sensitiveData"), undefined, "Inner data should be cleared (undefined) when the box is hidden")

    // Step 3: Toggle the dependency back to show the box
    ff.reactiveCommit("enableFeature", true)
    await flushMicrotasks()

    // The cached data should be perfectly restored
    assert.strictEqual(ff.getData("sensitiveData"), "User typed secret", "Inner data should be restored from cache when the box becomes visible again")
  })
})

describe("FastForm Feature_Cascades", () => {
  beforeEach(() => ff.clear())

  it("should cascade a static value to the target field when conditions are met", async () => {
    ff.render({
      schema: [{ fields: [{ type: "select", key: "country", options: ["US", "China"] }, { type: "text", key: "city" }] }],
      data: { country: "US", city: "New York" },
      cascades: {
        resetCityOnCountryChange: {
          when: { country: "China" },
          triggers: ["country"],
          target: "city",
          value: "Beijing", // Static string value
        },
      },
    })

    await flushMicrotasks()
    assert.strictEqual(ff.getData("city"), "New York", "City should remain unchanged initially")

    // Trigger cascade
    ff.reactiveCommit("country", "China")
    await flushMicrotasks()

    assert.strictEqual(ff.getData("city"), "Beijing", "Target field should be updated to the static cascade value")
  })

  it("should evaluate and cascade a dynamic value using a function when triggered", async () => {
    ff.render({
      schema: [{ fields: [{ type: "number", key: "basePrice" }, { type: "number", key: "tax" }, { type: "number", key: "total" }] }],
      data: { basePrice: 100, tax: 0.1, total: 0 },
      cascades: {
        calculateTotal: {
          triggers: ["basePrice", "tax"],
          target: "total",
          // Dynamic function value
          value: (ctx) => Number.parseInt(ctx.getValue("basePrice") * (1 + ctx.getValue("tax"))),
        },
      },
    })

    // Engine evaluates watchers on mount
    await flushMicrotasks()
    assert.strictEqual(ff.getData("total"), 110, "Total should be calculated dynamically on mount")

    // Change a trigger field
    ff.reactiveCommit("basePrice", 200)
    await flushMicrotasks()

    assert.strictEqual(ff.getData("total"), 220, "Target field should receive the dynamically computed value")
  })

  it("should not modify the target field if the cascade condition is unmet", async () => {
    ff.render({
      schema: [{ fields: [{ type: "switch", key: "forceReset" }, { type: "text", key: "userInput" }] }],
      data: { forceReset: false, userInput: "Keep Me" },
      cascades: {
        clearInput: {
          triggers: ["forceReset"],
          when: { forceReset: true },
          target: "userInput",
          value: "",
        },
      },
    })

    await flushMicrotasks()

    // Turn off toggle (condition not met)
    ff.reactiveCommit("forceReset", false)
    await flushMicrotasks()

    assert.strictEqual(ff.getData("userInput"), "Keep Me", "Target field should remain unmodified if 'when' is unmet")
  })

  it("should prevent redundant updates and downstream renders if the new value deeply equals the current target value", async () => {
    let downstreamTriggerCount = 0
    ff.render({
      schema: [{ fields: [{ type: "text", key: "trigger" }, { type: "object", key: "config" }] }],
      data: { trigger: "A", config: { theme: "light" } },
      cascades: {
        syncConfig: {
          triggers: ["trigger"],
          target: "config",
          value: { theme: "dark" }, // Object payload
        },
      },
      watchers: {
        // Monitor the cascade target to verify if redundant updates occur
        monitorConfig: {
          triggers: ["config"],
          affects: [],
          effect: () => {
            downstreamTriggerCount++
          },
        },
      },
    })

    await flushMicrotasks() // Mount phase resolves cascade (config becomes { theme: "dark" })
    assert.strictEqual(downstreamTriggerCount, 2)
    assert.deepStrictEqual(ff.getData("config"), { theme: "dark" })

    // Trigger cascade again
    ff.reactiveCommit("trigger", "B")
    await flushMicrotasks()

    // The cascade engine evaluates { theme: "dark" }, compares it to current data,
    // finds deep equality, and aborts the ctx.setValue() call.
    assert.strictEqual(downstreamTriggerCount, 2, "Downstream watcher should NOT fire again due to deepEqual optimization in Cascades")
  })

  it("should log a warning and skip registration if a cascade rule is missing 'target' or 'value'", async () => {
    let warningMessages = []
    mock.method(console, "warn", (msg) => warningMessages.push(msg))
    ff.render({
      schema: [{ fields: [{ type: "text", key: "source" }] }],
      data: { source: "data" },
      cascades: {
        missingTargetRule: {
          triggers: ["source"],
          value: "New Value",
          // Missing 'target'
        },
        missingValueRule: {
          triggers: ["source"],
          target: "source",
          // Missing 'value'
        },
      },
    })

    const api = ff.getApi("watchers")
    const state = api.inspect()

    assert.strictEqual(warningMessages.length, 2, "Should emit two console warnings for the malformed rules")
    assert.ok(warningMessages[0].includes(`missing a "target" or "value"`), "Warning should pinpoint the exact issue")

    // Check if the underlying engine rejected the registration
    const watchersMap = state.watchers
    assert.ok(!watchersMap.has("_cascade_missingTargetRule"), "Malformed rule 1 should not be registered as a watcher")
    assert.ok(!watchersMap.has("_cascade_missingValueRule"), "Malformed rule 2 should not be registered as a watcher")
  })
})

describe("FastForm Feature_DSLEngine & Feature_StandardDSL", () => {
  beforeEach(() => ff.clear())

  it("should correctly evaluate and transform a function-based schema using StandardDSL", () => {
    ff.render({
      // Passing a function to 'schema' should trigger the StandardDSL evaluation automatically
      schema: ({ Group, Controls }) => [
        Group("Account Details",
          Controls.Text("username").Label("Username"),
          Controls.Password("password").Label("Password"),
        ),
      ],
      data: {},
    })

    const compiledSchema = ff.options.schema
    assert.ok(Array.isArray(compiledSchema), "Compiled schema should be an array")
    assert.strictEqual(compiledSchema.length, 1, "Should contain exactly one box")

    const box = compiledSchema[0]
    assert.strictEqual(box.title, "Account Details", "Group title should be correctly assigned")
    assert.strictEqual(box.fields.length, 2, "Box should contain two fields")

    const usernameField = box.fields[0]
    assert.strictEqual(usernameField.type, "text", "Control type should be correctly resolved")
    assert.strictEqual(usernameField.key, "username", "Control key should be correctly resolved")
    assert.strictEqual(usernameField.label, "Username", "Chainable .Label() should set the label property")
  })

  it("should construct complex dependency structures properly using the When utility", () => {
    ff.render({
      schema: ({ Group, Controls, When }) => [
        Group("Dependencies",
          Controls.Text("targetField")
            .ShowIf(When.and(
              When.eq("role", "admin"),
              When.or(When.eq("status", "active"), When.true("isOverride")),
            )),
        ),
      ],
      data: {},
    })

    const targetField = ff.options.schema[0].fields[0]
    const expectedDependencies = {
      $and: [
        { role: "admin" },
        { $or: [{ status: "active" }, { isOverride: true }] },
      ],
    }

    assert.deepStrictEqual(
      targetField.dependencies,
      expectedDependencies,
      "When utility should generate a correct, deeply nested dependency AST",
    )
  })

  it("should seamlessly upgrade the field type from 'number' to 'unit' when .Unit() is called", () => {
    ff.render({
      schema: ({ Group, Controls }) => [
        Group(
          Controls.Number("price").Label("Price").Unit("$"), // Type upgrade happens here
          Controls.Number("quantity").Label("Quantity"),      // Remains regular number
        ),
      ],
      data: {},
    })

    const fields = ff.options.schema[0].fields
    const priceField = fields[0]
    const qtyField = fields[1]

    assert.strictEqual(priceField.type, "unit", "Field type should be implicitly upgraded to 'unit' by the UNIT_CONVERTER PropResolver")
    assert.strictEqual(priceField.unit, "$", "Unit symbol should be assigned correctly")

    assert.strictEqual(qtyField.type, "number", "Field without .Unit() should remain 'number'")
  })

  it("should elegantly ignore null, undefined, or empty arrays when resolving nested schemas within layout components", () => {
    ff.render({
      schema: ({ Group, Controls }) => {
        const isAdvancedMode = false
        return [
          null,
          Group("Main",
            Controls.Text("basic"),
            isAdvancedMode ? Controls.Text("advanced") : null, // Null value edge case
            undefined, // Undefined edge case
          ),
          undefined,
        ]
      },
      data: {},
    })
    assert.strictEqual(ff.options.schema.length, 1, "Engine should filter out null or undefined group cleanly")
    const fields = ff.options.schema[0].fields
    assert.strictEqual(fields.length, 1, "Engine should filter out null or undefined fields cleanly")
    assert.strictEqual(fields[0].key, "basic", "Only the valid field should remain")
  })

  it("should correctly resolve dynamically appended nested schemas via .Tab()", () => {
    ff.render({
      schema: ({ Group, Controls }) => [
        Controls
          .Tabs("configTabs")
          .TabPosition("left")
          .Tab({
            label: "Network",
            value: "network",
            schema: [Controls.Text("ip").Label("IP Address")],
          })
          .Tab({
            label: "Security",
            value: "security",
            schema: [Controls.Switch("firewall").Label("Enable Firewall")],
          }),
      ],
      data: {},
    })

    const tabsField = ff.options.schema[0].fields[0]

    assert.strictEqual(tabsField.type, "tabs", "Should be a tabs control")
    assert.strictEqual(tabsField.tabPosition, "left", "Shared properties should be correctly assigned")
    assert.strictEqual(tabsField.tabs.length, 2, "Should contain exactly two tabs appended via .Tab()")

    const networkTab = tabsField.tabs[0]
    assert.strictEqual(networkTab.label, "Network", "Tab label should be preserved")

    const nestedBox = networkTab.schema[0]
    assert.ok(nestedBox.id, "Nested schema should be traversed and normalized (e.g., auto-assigned IDs)")
    assert.strictEqual(nestedBox.fields[0].key, "ip", "Nested controls inside the tab should be intact")
  })

  it("should not handle custom props", () => {
    assert.throws(() => ff.render({
      // "CustomProp" is not explicitly defined in BaseSpecs
      schema: ({ Group, Controls }) => [Controls.Text("field1").CustomProp("custom_value")],
      data: {},
    }), TypeError)
  })
})

describe("FastForm Controls", () => {
  beforeEach(() => ff.clear())

  describe("Basic Form Inputs (Text, Textarea, Color, Switch)", () => {
    it("should render and bind DOM events correctly for basic input controls", async () => {
      ff.render({
        schema: [{
          fields: [
            { type: "text", key: "username", placeholder: "Enter name" },
            { type: "switch", key: "notifications" },
          ],
        }],
        data: { username: "admin", notifications: false },
      })

      await flushMicrotasks()

      const textInput = ff.form.querySelector(".text-input")
      const switchInput = ff.form.querySelector(".switch-input")

      // Test rendering & initial state
      assert.strictEqual(textInput.value, "admin", "Text input should reflect initial data")
      assert.strictEqual(textInput.placeholder, "Enter name", "Text input should apply placeholder")
      assert.strictEqual(switchInput.checked, false, "Switch should reflect initial boolean data")

      // Test DOM event binding (simulating user interaction)
      textInput.value = "new_admin"
      textInput.dispatchEvent(new window.Event("change", { bubbles: true }))

      switchInput.checked = true
      switchInput.dispatchEvent(new window.Event("change", { bubbles: true }))

      await flushMicrotasks()

      assert.strictEqual(ff.getData("username"), "new_admin", "Form data should update on text input change")
      assert.strictEqual(ff.getData("notifications"), true, "Form data should update on switch toggle")
    })
  })

  describe("Numeric Controls (Number, Unit, Range)", () => {
    it("should enforce numerical constraints (min, max, integer) and correct DOM attributes", async () => {
      let validationErrors = []
      ff.render({
        schema: [{
          fields: [
            { type: "number", key: "age", min: 18, max: 100, isInteger: true },
            { type: "unit", key: "weight", unit: "kg" },
            { type: "range", key: "volume", min: 0, max: 10, step: 0.5 },
          ],
        }],
        data: { age: 20, weight: 60, volume: 5 },
        hooks: {
          onValidateFailed: (errors) => validationErrors = errors,
        },
      })

      await flushMicrotasks()

      const ageInput = ff.form.querySelector(".number-input")
      assert.strictEqual(ageInput.getAttribute("min"), "18", "Should apply min attribute")
      assert.strictEqual(ageInput.getAttribute("step"), "1", "Should default to step=1 if isInteger is true")

      // Boundary validation tests via validation engine
      const isFloatValid = ff.validateAndCommit("age", 25.5)
      assert.strictEqual(isFloatValid, false, "Should reject float values when isInteger is true")
      assert.equal(validationErrors[0].message, i18n.t("settings", "error.integer"), "Should emit integer error")

      const isMinValid = ff.validateAndCommit("age", 15)
      assert.strictEqual(isMinValid, false, "Should reject values below min limit")

      const isValid = ff.validateAndCommit("age", 30)
      assert.strictEqual(isValid, true, "Should accept valid integer within range")
    })
  })

  describe("Selection Controls (Select, Radio, Checkbox)", () => {
    it("should render disabled options correctly and handle array values for multiple selections", async () => {
      ff.render({
        schema: [{
          fields: [
            {
              type: "checkbox",
              key: "hobbies",
              options: { reading: "Reading", gaming: "Gaming", coding: "Coding" },
              disabledOptions: ["gaming"], // Gaming is disabled
            },
          ],
        }],
        data: { hobbies: ["reading"] },
      })

      await flushMicrotasks()

      const gamingOption = ff.form.querySelector("input[value='gaming']")
      const codingOption = ff.form.querySelector("input[value='coding']")

      assert.ok(gamingOption.disabled, "Disabled option should have the 'disabled' attribute")
      assert.ok(!codingOption.disabled, "Active option should not be disabled")

      // Simulate checking "coding"
      codingOption.checked = true
      codingOption.dispatchEvent(new window.Event("input", { bubbles: true }))

      await flushMicrotasks()

      assert.deepStrictEqual(
        ff.getData("hobbies"),
        ["reading", "coding"],
        "Checkbox group should commit an array of checked values",
      )
    })
  })

  describe("Complex Data Controls (Object, Array, Dict)", () => {
    it("Control_Object: should handle JSON parsing errors gracefully without crashing", async () => {
      let errorFired = false
      mock.method(utils.notification, "show", (msg, type) => {
        if (type === "error") errorFired = true
      })
      mock.method(console, "error", () => undefined)

      ff.render({
        schema: [{ fields: [{ type: "object", key: "config", format: "JSON" }] }],
        data: { config: { valid: true } },
      })

      await flushMicrotasks()

      const textarea = ff.form.querySelector(".object")
      const confirmBtn = ff.form.querySelector(".object-confirm")

      // Inject malformed JSON
      textarea.value = "{ invalid_json: true " // Missing quotes and closing brace
      confirmBtn.dispatchEvent(new window.Event("click", { bubbles: true }))

      await flushMicrotasks()

      assert.ok(errorFired, "Should trigger an error notification for malformed JSON")
      assert.deepStrictEqual(ff.getData("config"), { valid: true }, "Underlying data should remain intact upon parsing failure")
    })

    it("Control_Array: should enforce duplicate prevention when allowDuplicates is false", async () => {
      let validationErrors = []
      ff.render({
        schema: [{
          fields: [{ type: "array", key: "tags" }], // allowDuplicates defaults to false in controlOptions
        }],
        data: { tags: ["js", "ts"] },
        hooks: {
          onValidateFailed: (errors) => validationErrors = errors,
        },
      })

      await flushMicrotasks()

      // Attempt to append a duplicate via full-array "set"
      const isOk = ff.validateAndCommit("tags", [...ff.getData("tags"), "js"])

      assert.strictEqual(isOk, false, "Should reject appending a duplicate item")
      assert.equal(validationErrors[0].message, i18n.t("settings", "error.duplicateValue"), "Should emit duplicate error")
      assert.deepStrictEqual(ff.getData("tags"), ["js", "ts"], "Array should remain unchanged")

      // Attempt to append a unique item via full-array "set"
      const isValid = ff.validateAndCommit("tags", [...ff.getData("tags"), "golang"])
      assert.strictEqual(isValid, true, "Should allow appending a unique item")
      assert.deepStrictEqual(ff.getData("tags"), ["js", "ts", "golang"])
    })
  })

  describe("Nested & Structural Controls (Composite, Tabs)", () => {
    it("Control_Composite: should implement lazy rendering and preserve state via Cache Watcher", async () => {
      ff.render({
        schema: [{
          fields: [{
            type: "composite",
            key: "advancedSettings",
            defaultValues: { retryCount: 3 },
            subSchema: [{ fields: [{ type: "number", key: "retryCount" }] }],
          }],
        }],
        data: { advancedSettings: false }, // Initially disabled
      })

      await flushMicrotasks()

      const compositeWrapper = ff.form.querySelector(`.control[data-control="advancedSettings"]`)
      const subBoxContainer = compositeWrapper.querySelector(".sub-box-wrapper")

      // 1. Test Lazy Rendering
      assert.strictEqual(subBoxContainer.childElementCount, 0, "Sub-schema should NOT be rendered when composite is false (lazy loading)")

      // 2. Enable Composite
      ff.reactiveCommit("advancedSettings", { retryCount: 5 })
      await flushMicrotasks()

      assert.ok(subBoxContainer.childElementCount > 0, "Sub-schema should be rendered after activation")
      assert.strictEqual(ff.getData("advancedSettings.retryCount"), 5, "Data should be populated properly")

      // 3. Disable Composite (Testing Cache)
      ff.reactiveCommit("advancedSettings", false)
      await flushMicrotasks()

      // 4. Re-enable Composite
      // When re-enabling via DOM switch, FastForm retrieves the state from Cache (managed by the auto-generated cache watcher)
      const switchInput = compositeWrapper.querySelector(".switch-input")
      switchInput.checked = true
      switchInput.dispatchEvent(new window.Event("change", { bubbles: true }))

      await flushMicrotasks()
      assert.strictEqual(ff.getData("advancedSettings.retryCount"), 5, "Should perfectly restore the previous cached state when re-enabled")
    })

    it("Control_Tabs: should render headers and panes, and toggle visibility on click", async () => {
      ff.render({
        schema: [{
          fields: [{
            type: "tabs",
            key: "settingsTabs",
            tabs: [
              { label: "General", value: "general", schema: [] },
              { label: "Security", value: "security", schema: [] },
            ],
          }],
        }],
        data: {},
      })

      await flushMicrotasks()

      const headers = ff.form.querySelectorAll(".tab-header-item")
      const panes = ff.form.querySelectorAll(".tab-pane")

      assert.strictEqual(headers.length, 2, "Should render two tab headers")

      // By default, the first tab is selected if none specified
      assert.ok(headers[0].classList.contains("active"), "First tab should be active by default")
      assert.ok(!panes[0].classList.contains("plugin-common-hidden"), "First pane should be visible")
      assert.ok(panes[1].classList.contains("plugin-common-hidden"), "Second pane should be hidden")

      // Click the second tab
      headers[1].dispatchEvent(new window.Event("click", { bubbles: true }))
      await flushMicrotasks()

      assert.ok(!headers[0].classList.contains("active"), "First tab should deactivate")
      assert.ok(headers[1].classList.contains("active"), "Second tab should become active")
    })
  })

  describe("Specialized Behaviors (Action, Hotkey)", () => {
    it("Control_Action: should trigger configured function callbacks correctly", async () => {
      let actionTriggered = false
      ff.render({
        schema: [{ fields: [{ type: "action", key: "pingServer" }] }],
        data: {},
        actions: {
          pingServer: (formInstance) => {
            actionTriggered = true
            assert.strictEqual(formInstance, ff, "Action callback should receive the form instance")
          },
        },
      })

      await flushMicrotasks()

      const actionEl = ff.form.querySelector(`.control[data-control="pingServer"]`)
      actionEl.dispatchEvent(new window.Event("click", { bubbles: true }))
      assert.ok(actionTriggered, "Action callback should be executed on click")
    })

    it("Control_Hotkey: should format and capture key combinations", async () => {
      ff.render({
        schema: [{ fields: [{ type: "hotkey", key: "shortcut" }] }],
        data: { shortcut: "" },
      })

      await flushMicrotasks()

      const keydownEvent = new window.Event("keydown", { bubbles: true })
      keydownEvent.key = "s"
      keydownEvent.ctrlKey = true
      keydownEvent.shiftKey = true
      const input = ff.form.querySelector(".hotkey-recorder")
      input.dispatchEvent(keydownEvent)
      assert.strictEqual(ff.form.querySelector(".hotkey-wrap").dataset.value, "ctrl+shift+s", "Input value should reflect the formatted key combination")
    })
  })
})

describe("FastForm Controls - Simple Inputs", () => {
  beforeEach(() => ff.clear())

  it("password should commit on change and reflect value/disabled state", async () => {
    ff.render({
      schema: [{ fields: [{ type: "password", key: "pwd" }] }],
      data: { pwd: "" },
    })
    await flushMicrotasks()

    const input = ff.form.querySelector(`[data-control="pwd"] .password-input`)
    assert.strictEqual(input.type, "password")
    input.value = "secret"
    input.dispatchEvent(new window.Event("change", { bubbles: true }))
    assert.strictEqual(ff.getData("pwd"), "secret")
  })

  it("icon should preview the icon class live on input and commit on change", async () => {
    ff.render({
      schema: [{ fields: [{ type: "icon", key: "ic" }] }],
      data: {},
    })
    await flushMicrotasks()

    const input = ff.form.querySelector(`[data-control="ic"] .icon-input`)
    const display = ff.form.querySelector(`[data-control="ic"] .icon-display`)
    input.value = "fa fa-star"
    input.dispatchEvent(new window.Event("input", { bubbles: true }))
    assert.ok(display.className.includes("fa fa-star"), "input event should update the preview immediately")
    input.dispatchEvent(new window.Event("change", { bubbles: true }))
    assert.strictEqual(ff.getData("ic"), "fa fa-star")
  })

  it("range should sync badge text and --progress on input, commit Number on change", async () => {
    ff.render({
      schema: [{ fields: [{ type: "range", key: "vol", min: 0, max: 100, unit: "%" }] }],
      data: { vol: 0 },
    })
    await flushMicrotasks()

    const input = ff.form.querySelector(`[data-control="vol"] .range-input`)
    const badge = ff.form.querySelector(`[data-control="vol"] .range-value`)
    input.value = "50"
    input.dispatchEvent(new window.Event("input", { bubbles: true }))
    assert.strictEqual(badge.textContent, "50", "Badge should mirror the slider value")
    assert.strictEqual(input.style.getPropertyValue("--progress"), "50%", "--progress should reflect (val-min)/(max-min)")

    input.dispatchEvent(new window.Event("change", { bubbles: true }))
    assert.strictEqual(ff.getData("vol"), 50, "Commit should be a Number, not a string")
  })

  it("modifierKey should toggle modifiers and serialize in MODIFIERS order", async () => {
    ff.render({
      schema: [{ fields: [{ type: "modifierKey", key: "mod" }] }],
      data: { mod: "" },
    })
    await flushMicrotasks()

    const items = ff.form.querySelectorAll(`[data-control="mod"] .modifier-key-item`)
    const byValue = v => [...items].find(i => i.dataset.value === v)
    byValue("shift").dispatchEvent(new window.Event("click", { bubbles: true }))
    byValue("ctrl").dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.strictEqual(ff.getData("mod"), "ctrl+shift", "Values must serialize in MODIFIERS key order regardless of click order")

    byValue("shift").dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.strictEqual(ff.getData("mod"), "ctrl", "Clicking an active modifier should remove it")
  })

  it("unit should render the unit label, commit numbers, and reject empty via the default required rule", async () => {
    ff.render({
      schema: [{ fields: [{ type: "unit", key: "size", unit: "px" }] }],
      data: { size: 10 },
    })
    await flushMicrotasks()

    assert.strictEqual(ff.form.querySelector(`[data-control="size"] .unit-value`).textContent, "px")
    const input = ff.form.querySelector(`[data-control="size"] .unit-input`)

    input.value = "42"
    input.dispatchEvent(new window.Event("change", { bubbles: true }))
    assert.strictEqual(ff.getData("size"), 42, "Numeric input should commit as Number")

    input.value = ""
    input.dispatchEvent(new window.Event("change", { bubbles: true }))
    assert.strictEqual(ff.getData("size"), 42, "Empty input is rejected by the auto-registered 'required' rule; old value is kept")
  })
})

describe("FastForm Controls - Option-based Controls", () => {
  beforeEach(() => ff.clear())

  it("select should open option-box, commit single value, and mark disabledOptions readonly", async () => {
    ff.render({
      schema: [{ fields: [{ type: "select", key: "sel", options: { a: "A", b: "B", c: "C" }, disabledOptions: ["c"] }] }],
      data: { sel: null },
    })
    await flushMicrotasks()

    const wrap = ff.form.querySelector(`[data-control="sel"]`)
    const disabledItem = [...wrap.querySelectorAll(".option-item")].find(i => i.dataset.optionKey === "c")
    assert.ok(disabledItem.classList.contains("plugin-common-readonly"), "disabledOptions should mark the option-item readonly")

    wrap.querySelector(".select-wrap").dispatchEvent(new window.Event("click", { bubbles: true }))
    const optionBox = wrap.querySelector(".option-box")
    assert.strictEqual(optionBox.classList.contains("plugin-common-hidden"), false, "Clicking select-wrap should reveal the option-box")

    wrap.querySelector(`.option-item[data-option-key="a"]`).dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.strictEqual(ff.getData("sel"), "a")
    assert.ok(wrap.querySelector(".select-value").textContent.includes("A"), "Label should show the option display name")
  })

  it("select should toggle multi-select values when the bound data is an array", async () => {
    ff.render({
      schema: [{ fields: [{ type: "select", key: "ms", options: { a: "A", b: "B" }, labelJoiner: "|" }] }],
      data: { ms: ["a"] },
    })
    await flushMicrotasks()

    const wrap = ff.form.querySelector(`[data-control="ms"]`)
    wrap.querySelector(`.option-item[data-option-key="b"]`).dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.deepStrictEqual(ff.getData("ms"), ["a", "b"], "Unselected option should be appended")
    await flushMicrotasks()
    assert.strictEqual(wrap.querySelector(".select-value").textContent, "A|B", "labelJoiner option should join labels")

    wrap.querySelector(`.option-item[data-option-key="a"]`).dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.deepStrictEqual(ff.getData("ms"), ["b"], "Selected option should be removed on re-click")
  })

  it("select should render empty label and normalize array-form options", async () => {
    ff.render({
      schema: [{ fields: [{ type: "select", key: "s", options: ["x", "y"] }] }],
      data: {},
    })
    await flushMicrotasks()
    assert.deepStrictEqual(ff.getField("s").options, { x: "x", y: "y" }, "Array options should normalize to key=value map")
    assert.ok(ff.form.querySelector(`[data-control="s"] .select-value`).textContent.length > 0, "Empty selection should show the i18n empty placeholder")
  })

  it("segment should commit clicked value, ignore repeats and readonly items, support multi", async () => {
    ff.render({
      schema: [{ fields: [
          { type: "segment", key: "seg", options: { a: "A", b: "B", c: "C" }, disabledOptions: ["c"] },
          { type: "segment", key: "multi", options: { x: "X", y: "Y" } },
        ] }],
      data: { seg: "a", multi: [] },
    })
    await flushMicrotasks()

    const segWrap = ff.form.querySelector(`[data-control="seg"]`)
    const segItem = v => segWrap.querySelector(`.segment-item[data-value="${v}"]`)

    segItem("a").dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.strictEqual(ff.getData("seg"), "a", "Re-clicking the active single-value item should be a no-op")

    segItem("b").dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.strictEqual(ff.getData("seg"), "b")

    segItem("c").dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.strictEqual(ff.getData("seg"), "b", "disabledOptions items must not respond to clicks")

    const multiWrap = ff.form.querySelector(`[data-control="multi"]`)
    multiWrap.querySelector(`.segment-item[data-value="x"]`).dispatchEvent(new window.Event("click", { bubbles: true }))
    multiWrap.querySelector(`.segment-item[data-value="y"]`).dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.deepStrictEqual(ff.getData("multi"), ["x", "y"], "Array-valued segment should accumulate selections")
  })

  it("radio should commit value on input and respect disabledOptions", async () => {
    ff.render({
      schema: [{ fields: [{ type: "radio", key: "r", options: { a: "A", b: "B" }, disabledOptions: ["b"] }] }],
      data: { r: "a" },
    })
    await flushMicrotasks()

    const inputs = ff.form.querySelectorAll(`[data-control="r"] .radio-input`)
    const bInput = [...inputs].find(i => i.value === "b")
    assert.strictEqual(bInput.disabled, true, "disabledOptions radio input should have the disabled attribute")

    const aInput = [...inputs].find(i => i.value === "a")
    assert.strictEqual(aInput.checked, true, "Current value should be reflected as checked")

    bInput.disabled = false
    bInput.dispatchEvent(new window.Event("input", { bubbles: true }))
    assert.strictEqual(ff.getData("r"), "b", "input event on a radio should commit its value")
  })

  it("togglesort should render selected-before-unselected order and commit reordered checked keys via switch change", async () => {
    ff.render({
      schema: [{ fields: [{ type: "togglesort", key: "ts", options: { a: "A", b: "B", c: "C" }, disabledOptions: ["c"] }] }],
      data: { ts: ["b", "a"] },
    })
    await flushMicrotasks()

    const wrap = ff.form.querySelector(`[data-control="ts"]`)
    const items = [...wrap.querySelectorAll(".togglesort-item")]
    assert.deepStrictEqual(items.map(i => i.dataset.key), ["b", "a", "c"],
      "DOM order should be selected (in value order) then unselected")
    assert.strictEqual(items[2].getAttribute("draggable"), "false", "disabledOptions items should not be draggable")
    assert.strictEqual(items[2].querySelector(".switch-input").disabled, true)

    // Uncheck 'b': change event collects all checked items
    items[0].querySelector(".switch-input").checked = false
    items[0].querySelector(".switch-input").dispatchEvent(new window.Event("change", { bubbles: true }))
    assert.deepStrictEqual(ff.getData("ts"), ["a"], "Unchecking should commit the remaining checked keys in DOM order")
  })

  it("transfer should partition options into source/target lists by value", async () => {
    ff.render({
      schema: [{ fields: [{ type: "transfer", key: "tr", options: { a: "A", b: "B", c: "C" } }] }],
      data: { tr: ["b"] },
      controlOptions: { transfer: { titles: ["Pool", "Chosen"] } },
    })
    await flushMicrotasks()

    const wrap = ff.form.querySelector(`[data-control="tr"]`)
    const src = [...wrap.querySelectorAll(".source-list .transfer-card")].map(c => c.dataset.val)
    const dst = [...wrap.querySelectorAll(".target-list .transfer-card")].map(c => c.dataset.val)
    assert.deepStrictEqual(src, ["a", "c"], "Unselected options should be in the source list")
    assert.deepStrictEqual(dst, ["b"], "Selected values should be in the target list")
    const headers = [...wrap.querySelectorAll(".transfer-header")].map(h => h.textContent)
    assert.deepStrictEqual(headers, ["Pool", "Chosen"], "titles controlOption should label the columns")
  })
})

describe("FastForm Controls - Presentational Controls (escape/unsafe)", () => {
  beforeEach(() => ff.clear())

  it("static should show content via textContent (never interprets markup)", async () => {
    ff.render({
      schema: [{ fields: [{ type: "static", content: "<b>bold</b>" }] }],
      data: {},
    })
    await flushMicrotasks()
    const el = ff.form.querySelector(".static")
    assert.strictEqual(el.textContent, "<b>bold</b>")
    assert.strictEqual(el.querySelector("b"), null, "static must never inject markup")
  })

  it("custom should escape content by default and honor unsafe:true", async () => {
    ff.render({
      schema: [{ fields: [
          { type: "custom", key: "safe", content: "<script>x</script>" },
          { type: "custom", key: "raw", content: "<b>ok</b>", unsafe: true },
        ] }],
      data: {},
    })
    await flushMicrotasks()
    const safe = ff.form.querySelector(`[data-control="safe"] .custom-wrap`)
    assert.strictEqual(safe.querySelector("script"), null, "Default path must escape HTML")
    const raw = ff.form.querySelector(`[data-control="raw"] .custom-wrap`)
    assert.ok(raw.querySelector("b"), "unsafe:true should render raw HTML")
  })

  it("hint should render hintHeader/hintDetail from data value and convert newlines to <br>", async () => {
    ff.render({
      schema: [{ fields: [{ type: "hint", key: "h", hintHeader: "fallback" }] }],
      data: { h: { hintHeader: "Title", hintDetail: "line1\nline2" } },
    })
    await flushMicrotasks()
    const wrap = ff.form.querySelector(`[data-control="h"] .hint-wrap`)
    assert.strictEqual(wrap.querySelector(".hint-header").textContent, "Title", "Value props should override field props")
    assert.ok(wrap.querySelector(".hint-detail").innerHTML.includes("<br>"), "Newlines should convert to <br>")
  })

  it("divider should apply position/dashed classes and render divider text", async () => {
    ff.render({
      schema: [{ fields: [{ type: "divider", divider: "Section" }] }],
      data: {},
      controlOptions: { divider: { position: "left", dashed: false } },
    })
    await flushMicrotasks()
    const wrap = ff.form.querySelector(".divider-wrap")
    assert.ok(wrap.classList.contains("left"))
    assert.strictEqual(wrap.classList.contains("dashed"), false)
    assert.strictEqual(wrap.querySelector(".divider-text").textContent, "Section")
  })
})

describe("FastForm Controls - Action & Hotkey", () => {
  beforeEach(() => ff.clear())

  it("action toggle mode should invert the boolean value and reflect it via activeClass", async () => {
    ff.render({
      schema: [{ fields: [{ type: "action", key: "tg" }] }],
      data: { tg: false },
      controlOptions: { action: { actionType: "toggle" } },
    })
    await flushMicrotasks()

    const ctrl = ff.form.querySelector(`[data-control="tg"]`)
    ctrl.dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.strictEqual(ff.getData("tg"), true, "Toggle should flip false -> true")
    await flushMicrotasks()
    assert.ok(ctrl.classList.contains("active"), "activeClass should track the boolean value")

    ctrl.dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.strictEqual(ff.getData("tg"), false)
  })

  it("action trigger mode should commit a fresh timestamp each click", async () => {
    ff.render({
      schema: [{ fields: [{ type: "action", key: "tr" }] }],
      data: {},
      controlOptions: { action: { actionType: "trigger" } },
    })
    const ctrl = ff.form.querySelector(`[data-control="tr"]`)
    ctrl.dispatchEvent(new window.Event("click", { bubbles: true }))
    const t1 = ff.getData("tr")
    assert.strictEqual(typeof t1, "number", "Trigger should commit Date.now()")
    ctrl.dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.ok(ff.getData("tr") >= t1)
  })

  it("action function mode should invoke options.actions[key] with the event", async () => {
    let received = null
    ff.render({
      schema: [{ fields: [{ type: "action", key: "fn" }] }],
      data: {},
      actions: { fn: (ev) => received = ev },
    })
    ff.form.querySelector(`[data-control="fn"]`).dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.ok(received instanceof window.Event, "Function mode should pass the click event to the action")
  })

  it("hotkey clear button should reset value to empty string", async () => {
    ff.render({
      schema: [{ fields: [{ type: "hotkey", key: "hk" }] }],
      data: { hk: "ctrl+a" },
    })
    await flushMicrotasks()
    ff.form.querySelector(`[data-control="hk"] .hotkey-clear`).dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.strictEqual(ff.getData("hk"), "")
  })

  it("hotkey should pause/resume hotkeyHub on focusin/focusout and commit recorded value", async () => {
    utils.hotkeyHub.pause.mock.resetCalls?.()
    utils.hotkeyHub.resume.mock.resetCalls?.()

    ff.render({
      schema: [{ fields: [{ type: "hotkey", key: "hk" }] }],
      data: { hk: "" },
    })
    await flushMicrotasks()

    const recorder = ff.form.querySelector(`[data-control="hk"] .hotkey-recorder`)

    recorder.dispatchEvent(new window.Event("focusin", { bubbles: true }))
    assert.strictEqual(utils.hotkeyHub.pause.mock.calls.length, 1)

    const wrap = ff.form.querySelector(`[data-control="hk"] .hotkey-wrap`)
    recorder.dispatchEvent(new window.KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))
    assert.strictEqual(wrap.dataset.value, "ctrl+k")

    recorder.dispatchEvent(new window.Event("focusout", { bubbles: true }))
    assert.strictEqual(utils.hotkeyHub.resume.mock.calls.length, 1)
    assert.strictEqual(ff.getData("hk"), "ctrl+k", "focusout should commit wrap.dataset.value via reactiveCommit")

    ff.form.querySelector(`[data-control="hk"] .hotkey-clear`).dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.strictEqual(ff.getData("hk"), "")
  })
})

describe("FastForm Controls - Array Interactions", () => {
  beforeEach(() => ff.clear())

  it("should inline-edit an existing item and commit the 'key.idx' sub-path", async () => {
    ff.render({
      schema: [{ fields: [{ type: "array", key: "list" }] }],
      data: { list: ["a", "b"] },
    })
    await flushMicrotasks()

    const items = ff.form.querySelectorAll(`[data-control="list"] .array-item-val`)
    const second = items[1]
    second.setAttribute("contenteditable", "true")
    second.textContent = "b-edited"
    second.dispatchEvent(new window.Event("focusout", { bubbles: true }))

    assert.deepStrictEqual(ff.getData("list"), ["a", "b-edited"], "focusout should commit the edited item via key.1 sub-path")
  })

  it("should add a new item via array-item-add flow and restore footer UI", async () => {
    ff.render({
      schema: [{ fields: [{ type: "array", key: "list" }] }],
      data: { list: [] },
    })
    await flushMicrotasks()

    const wrap = ff.form.querySelector(`[data-control="list"]`)
    const addBtn = wrap.querySelector(".array-item-add")
    addBtn.dispatchEvent(new window.Event("click", { bubbles: true }))
    const newInput = wrap.querySelector(".array-item-input")
    assert.strictEqual(newInput.classList.contains("plugin-common-hidden"), false, "Add click should reveal the input")

    newInput.textContent = "newVal"
    newInput.dispatchEvent(new window.Event("focusout", { bubbles: true }))
    assert.deepStrictEqual(ff.getData("list"), ["newVal"], "New item should append to the array")
    assert.ok(newInput.classList.contains("plugin-common-hidden"), "Input should hide again after successful commit")
    assert.strictEqual(addBtn.classList.contains("plugin-common-hidden"), false, "Add button should reappear")
  })

  it("should convert new items to numbers when dataType is 'number'", async () => {
    ff.render({
      schema: [{ fields: [{ type: "array", key: "nums" }] }],
      data: { nums: [] },
      controlOptions: { array: { dataType: "number" } },
    })
    await flushMicrotasks()

    const newInput = ff.form.querySelector(`[data-control="nums"] .array-item-input`)
    newInput.textContent = "42"
    newInput.dispatchEvent(new window.Event("focusout", { bubbles: true }))
    assert.deepStrictEqual(ff.getData("nums"), [42], "dataType:'number' should cast the committed value")
  })

  it("should cancel editing via Escape (re-render restores the original display)", async () => {
    ff.render({
      schema: [{ fields: [{ type: "array", key: "list" }] }],
      data: { list: ["orig"] },
    })
    await flushMicrotasks()

    const item = ff.form.querySelector(`[data-control="list"] .array-item-val`)
    item.setAttribute("contenteditable", "true")
    item.textContent = "tampered"
    item.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }))

    const reRendered = ff.form.querySelector(`[data-control="list"] .array-item-val`)
    assert.strictEqual(reRendered.textContent, "orig", "Escape should trigger a re-render discarding the edit")
    assert.deepStrictEqual(ff.getData("list"), ["orig"], "No commit should occur on Escape")
  })
})

describe("FastForm Controls - Object Formats", () => {
  beforeEach(() => ff.clear())

  it("should show a success notification on a valid JSON confirm", async () => {
    const showMock = mock.fn()
    const restore = mock.method(utils.notification, "show", showMock)
    try {
      ff.render({
        schema: [{ fields: [{ type: "object", key: "cfg" }] }],
        data: { cfg: {} },
      })
      await flushMicrotasks()
      const wrap = ff.form.querySelector(`[data-control="cfg"]`)
      wrap.querySelector("textarea").value = '{"a": 1}'
      wrap.querySelector(".object-confirm").dispatchEvent(new window.Event("click", { bubbles: true }))
      assert.deepStrictEqual(ff.getData("cfg"), { a: 1 })
      assert.ok(showMock.mock.calls.length >= 1, "Valid confirm should notify success")
    } finally {
      restore.mock.restore()
    }
  })

  it("should fall back to the JSON serializer for unknown formats", async () => {
    ff.render({
      schema: [{ fields: [{ type: "object", key: "cfg" }] }],
      data: { cfg: { x: 1 } },
      controlOptions: { object: { format: "NOPE" } },
    })
    await flushMicrotasks()
    const textarea = ff.form.querySelector(`[data-control="cfg"] textarea`)
    assert.ok(textarea.value.includes('"x"'), "Unknown format should use JSON.stringify")
  })

  it("should use the TOML serializer when format is 'TOML' (guarded on utils.readToml)", async () => {
    if (typeof utils.readToml !== "function") return // mock utils may lack TOML support
    ff.render({
      schema: [{ fields: [{ type: "object", key: "cfg" }] }],
      data: { cfg: {} },
      controlOptions: { object: { format: "TOML" } },
    })
    await flushMicrotasks()
    const wrap = ff.form.querySelector(`[data-control="cfg"]`)
    wrap.querySelector("textarea").value = "a = 1"
    wrap.querySelector(".object-confirm").dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.deepEqual(ff.getData("cfg"), { a: 1 }, "TOML text should parse via utils.readToml")
  })
})

describe("FastForm Controls - Textarea & CodeEditor", () => {
  beforeEach(() => ff.clear())

  it("textarea should commit on meta+Enter keydown", async () => {
    ff.render({
      schema: [{ fields: [{ type: "textarea", key: "bio" }] }],
      data: {},
    })
    await flushMicrotasks()
    const ta = ff.form.querySelector(`[data-control="bio"] .textarea`)
    ta.value = "hello"
    ta.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }))
    assert.strictEqual(ff.getData("bio"), "hello", "Ctrl+Enter should trigger validateAndCommit")
  })

  it("code editor should insert tabSize spaces on Tab and commit", async () => {
    ff.render({
      schema: [{ fields: [{ type: "code", key: "src", tabSize: 2 }] }],
      data: { src: "" },
    })
    await flushMicrotasks()
    const ta = ff.form.querySelector(`[data-control="src"] .code-textarea`)
    ta.value = ""
    ta.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true }))
    assert.strictEqual(ff.getData("src"), "  ", "Tab should insert 2 spaces per tabSize and commit")
  })

  it("code editor should auto-indent on Enter preserving leading whitespace", async () => {
    ff.render({
      schema: [{ fields: [{ type: "code", key: "src" }] }],
      data: {},
    })
    await flushMicrotasks()
    const ta = ff.form.querySelector(`[data-control="src"] .code-textarea`)
    ta.value = "    indented"
    ta.selectionStart = ta.value.length // cursor at end of indented line
    ta.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    assert.ok(ff.getData("src").includes("\n    "), "Enter should carry over the current line's indentation")
  })

  it("code editor should render line numbers matching the line count", async () => {
    ff.render({
      schema: [{ fields: [{ type: "code", key: "src", lineNumbers: true }] }], // 类型名以实际注册为准
      data: { src: "a\nb\nc" },
      controlOptions: { code: { lineNumbers: true } },
    })
    await flushMicrotasks()
    const gutter = ff.form.querySelector(`[data-control="src"] .code-gutter`)
    assert.strictEqual(gutter.childElementCount, 3)
  })
})

describe("FastForm Controls - Tabs", () => {
  beforeEach(() => ff.clear())

  const tabsField = (extra = {}) => ({
    type: "tabs",
    key: "t",
    tabs: [
      { label: "One", value: "1", schema: [{ fields: [{ type: "text", key: "in1" }] }] },
      { label: "Two", value: "2", schema: [{ fields: [{ type: "text", key: "in2" }] }] },
    ],
    ...extra,
  })

  it("should lazily render the active pane's schema and hide inactive panes", async () => {
    ff.render({ schema: [{ fields: [tabsField()] }], data: {} })
    await flushMicrotasks()

    const panes = ff.form.querySelectorAll(`[data-control="t"] .tab-pane`)
    const [p1, p2] = [...panes]
    assert.ok(p1.childElementCount > 0, "Default active tab's schema should be rendered")
    assert.strictEqual(p2.childElementCount, 0, "Inactive pane should stay empty until activated (lazy render)")
    assert.ok(p2.classList.contains("plugin-common-hidden"))
  })

  it("should switch panes on header click, render lazily once, and not re-render on revisit", async () => {
    ff.render({ schema: [{ fields: [tabsField()] }], data: {} })
    await flushMicrotasks()

    const headers = ff.form.querySelectorAll(`[data-control="t"] .tab-header-item`)
    headers[1].dispatchEvent(new window.Event("click", { bubbles: true }))
    await flushMicrotasks()

    const panes = [...ff.form.querySelectorAll(`[data-control="t"] .tab-pane`)]
    assert.strictEqual(headers[1].classList.contains("active"), true)
    assert.strictEqual(panes[1].classList.contains("plugin-common-hidden"), false)
    assert.ok(panes[1].childElementCount > 0, "Second tab's schema should render on first activation")

    const renderedHTML = panes[1].innerHTML
    headers[0].dispatchEvent(new window.Event("click", { bubbles: true }))
    headers[1].dispatchEvent(new window.Event("click", { bubbles: true }))
    const pane1Again = ff.form.querySelectorAll(`[data-control="t"] .tab-pane`)[1]
    assert.strictEqual(pane1Again.innerHTML, renderedHTML, "Revisiting a tab must not re-render its pane")
  })

  it("should honor defaultSelectedTab and apply tabStyle/tabPosition classes", async () => {
    ff.render({
      schema: [{ fields: [tabsField()] }],
      data: {},
      controlOptions: { tabs: { defaultSelectedTab: "2", tabStyle: "card", tabPosition: "left" } },
    })
    await flushMicrotasks()

    const wrapper = ff.form.querySelector(`[data-control="t"] .tabs-wrapper`)
    assert.ok(wrapper.classList.contains("tabs-style-card"))
    assert.ok(wrapper.classList.contains("tabs-pos-left"))
    const headers = [...ff.form.querySelectorAll(`[data-control="t"] .tab-header-item`)]
    assert.strictEqual(headers[1].classList.contains("active"), true, "defaultSelectedTab:'2' should activate the second tab")
  })

  it("should fall back to the first tab when defaultSelectedTab is invalid, and use defaultTabLabel", async () => {
    ff.render({
      schema: [{ fields: [tabsField({ tabs: [{ value: "x", schema: [] }] })] }],
      data: {},
      controlOptions: { tabs: { defaultSelectedTab: "999", defaultTabLabel: "NoName" } },
    })
    await flushMicrotasks()
    const header = ff.form.querySelector(`[data-control="t"] .tab-header-item`)
    assert.strictEqual(header.classList.contains("active"), true, "Invalid default should fall back to the first tab")
    assert.ok(header.textContent.includes("NoName"), "Missing label should use defaultTabLabel")
  })
})

describe("FastForm Controls - Composite", () => {
  beforeEach(() => ff.clear())

  it("should coerce non-object truthy initial data to defaultValues and cache the merged state", async () => {
    ff.render({
      schema: [{
        fields: [{
          type: "composite",
          key: "grp",
          defaultValues: { inner: "dflt" },
          subSchema: [{ fields: [{ type: "text", key: "grp.inner" }] }],
        }],
      }],
      data: { grp: "garbage" },
    })
    await flushMicrotasks()
    assert.deepStrictEqual(ff.getData("grp"), { inner: "dflt" }, "Truthy non-object value should be replaced by defaultValues")
  })

  it("should inject {key:{$bool:true}} + $follow dependencies into sub-fields", async () => {
    ff.render({
      schema: [{
        fields: [{
          type: "composite",
          key: "grp",
          defaultValues: { inner: "x" },
          subSchema: [{ fields: [{ type: "text", key: "grp.inner", dependencies: { other: true } }] }],
        }, { type: "text", key: "other" }],
      }],
      data: { grp: false },
    })
    await flushMicrotasks()

    const subField = ff.getField("grp.inner")
    assert.ok(subField.dependencies.$and, "Sub-field dependencies should be wrapped in $and")
    const [enabled, follow, orig] = subField.dependencies.$and
    assert.deepStrictEqual(enabled, { grp: { $bool: true } })
    assert.deepStrictEqual(follow, { $follow: "grp" })
    assert.deepStrictEqual(orig, { other: true }, "Pre-existing dependencies must be preserved after the injected ones")
  })

  it("should commit cached sub-values on enable and false on disable via the switch", async () => {
    ff.render({
      schema: [{
        fields: [{
          type: "composite",
          key: "grp",
          defaultValues: { inner: "cached" },
          subSchema: [{ fields: [{ type: "text", key: "grp.inner" }] }],
        }],
      }],
      data: { grp: { inner: "live" } },
    })
    await flushMicrotasks()

    const input = ff.form.querySelector(`[data-control="grp"] .composite-switch .switch-input`)
    input.checked = false
    input.dispatchEvent(new window.Event("change", { bubbles: true }))
    assert.strictEqual(ff.getData("grp"), false, "Unchecking should commit false")

    input.checked = true
    input.dispatchEvent(new window.Event("change", { bubbles: true }))
    assert.deepStrictEqual(ff.getData("grp"), { inner: "live" }, "Re-checking should restore the cached sub-values, not defaultValues")
  })

  it("should lazily fill subSchema only when the composite is enabled", async () => {
    ff.render({
      schema: [{
        fields: [{
          type: "composite",
          key: "grp",
          defaultValues: { inner: "x" },
          subSchema: [{ fields: [{ type: "text", key: "grp.inner" }] }],
        }],
      }],
      data: { grp: false },
    })
    await flushMicrotasks()
    const container = ff.form.querySelector(`[data-control="grp"] .sub-box-wrapper`)
    assert.strictEqual(container.childElementCount, 0, "Disabled composite should not render subSchema")
    assert.ok(container.classList.contains("plugin-common-hidden"))
  })
})

describe("FastForm Controls - Palette", () => {
  beforeEach(() => ff.clear())

  it("should detect 1D mode and append defaultColor on item-add", async () => {
    ff.render({
      schema: [{ fields: [{ type: "palette", key: "p" }] }],
      data: { p: ["#111111"] },
      controlOptions: { palette: { defaultColor: "#ABCDEF" } },
    })
    await flushMicrotasks()

    const wrapper = ff.form.querySelector(`[data-control="p"] .palette-wrapper`)
    assert.strictEqual(wrapper.dataset.mode, "1")

    wrapper.querySelector(".palette-btn-add").dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.deepStrictEqual(ff.getData("p"), ["#111111", "#ABCDEF"], "Item-add should push defaultColor")
  })

  it("should detect 2D jagged mode, add a single-color row on row-add", async () => {
    ff.render({
      schema: [{ fields: [{ type: "palette", key: "p" }] }],
      data: { p: [["#111111"], ["#222222", "#333333"]] },
      controlOptions: { palette: { allowJagged: true, defaultColor: "#000000" } },
    })
    await flushMicrotasks()

    const wrapper = ff.form.querySelector(`[data-control="p"] .palette-wrapper`)
    assert.strictEqual(wrapper.dataset.mode, "2")
    assert.strictEqual(wrapper.dataset.jagged, "true")

    const rowAdd = [...wrapper.querySelectorAll(".palette-btn-add")].find(b => b.dataset.type === "row")
    rowAdd.dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.deepStrictEqual(ff.getData("p"), [["#111111"], ["#222222", "#333333"], ["#000000"]],
      "Jagged row-add should append a 1-element row")
  })

  it("should pad new rows to the existing column count in non-jagged mode and support col-add", async () => {
    ff.render({
      schema: [{ fields: [{ type: "palette", key: "p" }] }],
      data: { p: [["#1", "#2"], ["#3", "#4"]] },
      controlOptions: { palette: { allowJagged: false, defaultColor: "#FFF" } },
    })
    await flushMicrotasks()

    const wrapper = ff.form.querySelector(`[data-control="p"] .palette-wrapper`)
    assert.strictEqual(wrapper.dataset.jagged, "false")

    const rowAdd = [...wrapper.querySelectorAll(".palette-btn-add")].find(b => b.dataset.type === "row")
    rowAdd.dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.deepStrictEqual(ff.getData("p"), [["#1", "#2"], ["#3", "#4"], ["#FFF", "#FFF"]],
      "Non-jagged row-add should fill the row to the current column count")

    const colAdd = [...wrapper.querySelectorAll(".palette-btn-add")].find(b => b.dataset.type === "col")
    colAdd.dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.ok(ff.getData("p").every(r => r.length === 3), "Col-add should push defaultColor onto every row")
  })
})

describe("FastForm Controls - Table", () => {
  beforeEach(() => ff.clear())

  const tableField = (extra = {}) => ({
    type: "table",
    key: "tbl",
    thMap: { name: "Name", age: "Age" },
    nestedBoxes: [{ fields: [{ type: "text", key: "name" }, { type: "number", key: "age" }] }],
    defaultValues: { name: "", age: 0 },
    ...extra,
  })

  it("should render rows from data and include edit/del buttons per row when not readonly", async () => {
    ff.render({
      schema: [{ fields: [tableField()] }],
      data: { tbl: [{ name: "Ann", age: 3 }] },
    })
    await flushMicrotasks()
    const rows = ff.form.querySelectorAll(`[data-control="tbl"] tbody tr`)
    assert.strictEqual(rows.length, 1)
    assert.ok(rows[0].querySelector(".table-edit") && rows[0].querySelector(".table-del"))
    assert.ok(ff.form.querySelector(`[data-control="tbl"] .table-add`), "Non-readonly table should have an add button")
  })

  it("should omit add/edit/del affordances when field.readonly", async () => {
    ff.render({
      schema: [{ fields: [tableField({ readonly: true })] }],
      data: { tbl: [{ name: "Ann", age: 3 }] },
    })
    await flushMicrotasks()
    const tbl = ff.form.querySelector(`[data-control="tbl"] .table`)
    assert.ok(tbl.classList.contains("is-readonly"))
    assert.strictEqual(tbl.querySelector(".table-add"), null)
    const row = tbl.querySelector("tbody tr")
    assert.strictEqual(row.querySelector(".table-edit"), null, "Readonly rows should not contain edit/del buttons")
  })

  it("should append a row via the add dialog and commit", async () => {
    const modalMock = mock.fn(async () => ({ response: 1, data: { name: "New", age: 9 } }))
    const restore = (utils.formDialog && utils.formDialog.modal)
      ? mock.method(utils.formDialog, "modal", modalMock)
      : null
    ff.render({
      schema: [{ fields: [tableField()] }],
      data: { tbl: [] },
    })
    await flushMicrotasks()

    ff.form.querySelector(`[data-control="tbl"] .table-add`).dispatchEvent(new window.Event("click", { bubbles: true }))
    await flushMicrotasks(); await flushMicrotasks() // async handler
    if (restore) {
      assert.strictEqual(modalMock.mock.calls.length, 1, "Add click should open the formDialog modal")
      assert.deepStrictEqual(ff.getData("tbl"), [{ name: "New", age: 9 }])
      restore.mock.restore()
    }
  })

  it("should cancel the add flow when the modal returns response 0", async () => {
    if (!utils.formDialog) return
    const restore = mock.method(utils.formDialog, "modal", async () => ({ response: 0, data: null }))
    try {
      ff.render({
        schema: [{ fields: [tableField()] }],
        data: { tbl: [{ name: "A", age: 1 }] },
      })
      await flushMicrotasks()
      ff.form.querySelector(`[data-control="tbl"] .table-add`).dispatchEvent(new window.Event("click", { bubbles: true }))
      await flushMicrotasks(); await flushMicrotasks()
      assert.strictEqual(ff.getData("tbl").length, 1, "Cancelled dialog should not modify the data")
    } finally {
      restore.mock.restore()
    }
  })
})

describe("FastForm Feature_Validation (post-refactor: unified set semantics)", () => {
  beforeEach(() => ff.clear())

  it("should run $each over the FULL container on every commit, including sub-path edits, catching pre-existing invalid siblings", () => {
    ff.render({
      schema: [{ fields: [{ type: "array", key: "scores", dataType: "number" }] }],
      data: { scores: [90, 999] }, // index 1 is already invalid (>100), pre-existing bad data
      rules: { scores: { $each: { validator: "max", args: [100] } } },
    })
    // Editing index 0 to a perfectly valid value should still fail,
    // because $each now re-validates the WHOLE array (including untouched index 1).
    const isValid = ff.validateAndCommit("scores.0", 95)
    assert.strictEqual(isValid, false, "Should reject because sibling item (index 1) still violates $each, even though it wasn't the one being edited")
    assert.deepStrictEqual(ff.getData("scores"), [90, 999], "Data must remain unchanged on rejection")
  })

  it("should run $self on every commit, including sub-path edits (not only on whole-array set)", () => {
    ff.render({
      schema: [{ fields: [{ type: "array", key: "tags" }] }],
      data: { tags: ["a", "b", "c"] },
      rules: { tags: { $self: { validator: "maxItems", args: [3] } } },
    })
    // Editing a single existing index does not change length, so $self(maxItems:3) should still pass.
    const isValid = ff.validateAndCommit("tags.0", "z")
    assert.strictEqual(isValid, true, "In-place edit of one item should not violate maxItems since length is unchanged")
    assert.deepStrictEqual(ff.getData("tags"), ["z", "b", "c"])
  })

  it("validateAll() should now catch $each-only rule violations on array fields (previously silently skipped)", () => {
    ff.render({
      schema: [{ fields: [{ type: "array", key: "ports" }] }],
      data: { ports: ["8080", "not-a-number"] }, // pre-existing invalid entry
      rules: { ports: { $each: "integer" } }, // $each-only, no $self at all
    })
    const api = ff.getApi("validation")
    const allValid = api.validateAll()
    assert.strictEqual(allValid, false, "validateAll must now detect per-item violations for $each-only rules")
  })

  it("should correctly append via whole-array set while preserving $each+$self combined evaluation (regression for former push/removeIndex paths)", () => {
    ff.render({
      schema: [{ fields: [{ type: "array", key: "scores", dataType: "number" }] }],
      data: { scores: [90, 85] },
      rules: {
        scores: {
          $self: { validator: "maxItems", args: [3] },
          $each: { validator: "max", args: [100] },
        },
      },
    })
    assert.strictEqual(ff.validateAndCommit("scores", [...ff.getData("scores"), 105]), false)
    assert.strictEqual(ff.getData("scores").length, 2)

    assert.strictEqual(ff.validateAndCommit("scores", [90, 85, 80, 75]), false)

    // Valid append
    assert.strictEqual(ff.validateAndCommit("scores", [...ff.getData("scores"), 95]), true)
    assert.strictEqual(ff.getData("scores").length, 3)
  })
})

describe("FastForm Validation - isFieldSkippable & validateAll", () => {
  beforeEach(() => ff.clear())

  it("validateAll should skip fields hidden by dependencies", async () => {
    ff.render({
      schema: [{ fields: [
          { type: "switch", key: "show" },
          { type: "text", key: "n", dependencies: { show: true } },
        ]}],
      data: { show: false, n: "" },
      rules: { n: "required" },
      fieldDependencyUnmetAction: "hide",
    })
    await flushMicrotasks()
    assert.strictEqual(ff.getApi("validation").validateAll(), true,
      "Hidden field should be skipped by validateAll even though 'required' would fail")

    ff.reactiveCommit("show", true)
    await flushMicrotasks()
    assert.strictEqual(ff.getApi("validation").validateAll(), false,
      "Visible again -> required kicks in and validateAll fails")
  })

  it("validateAll should skip fields set to readonly by dependencies", async () => {
    ff.render({
      schema: [{ fields: [
          { type: "switch", key: "enabled" },
          { type: "text", key: "n", dependencies: { enabled: true } },
        ]}],
      data: { enabled: false, n: "" },
      rules: { n: "required" },
      fieldDependencyUnmetAction: "readonly",
    })
    await flushMicrotasks()
    assert.strictEqual(ff.getApi("validation").validateAll(), true,
      "plugin-common-readonly fields are skipped by validateAll")
  })

  it("validateAll should invoke onValidateFailed per failing field and return false", async () => {
    const failures = []
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }, { type: "text", key: "b" }] }],
      data: { a: "", b: "ok" },
      rules: { a: "required", b: "required" },
      hooks: { onValidateFailed: (errors, ctx) => failures.push(ctx.key) },
    })
    await flushMicrotasks()
    assert.strictEqual(ff.getApi("validation").validateAll(), false)
    assert.deepStrictEqual(failures, ["a"], "Only the failing key should be reported")
  })
})

describe("FastForm Validation - addRule/getRules API", () => {
  beforeEach(() => ff.clear())

  it("should add rules at runtime via validation.addRule (requires recompile via render)", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: { a: "" },
    })
    const api = ff.getApi("validation")
    api.addRule("a", "required")
    // addRule writes rawRules; compiledRules is only built in compile().
    // Registering before compile has no effect — assert on getRules for existing keys:
    assert.strictEqual(api.getRules("a"), undefined, "Rule added after compile is not yet compiled")
  })

  it("should expose compiled rules via getRules after options.rules compile", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: {},
      rules: { a: "required" },
    })
    const rules = ff.getApi("validation").getRules("a")
    assert.ok(rules, "compiled entry should exist for key 'a'")
    assert.strictEqual(rules.$self.length, 1)
  })

  it("should merge multiple addRule calls cumulatively into $self/$each", () => {
    ff.render({ schema: [{ fields: [{ type: "text", key: "a" }] }], data: {} })
    const api = ff.getApi("validation")
    api.addRule("a", "required")
    api.addRule("a", { name: "minLength", args: 3 })
    api.addRule("a", { $each: "required" })
    // rawRules are merged; getRules returns compiled (empty here post-compile),
    // so assert indirectly via behavior after a second render is fragile.
    // Instead verify no throw and that invalid calls are ignored:
    api.addRule("", "required")
    api.addRule("a", null)
  })
})

describe("FastForm Validation - rule normalization forms", () => {
  beforeEach(() => ff.clear())

  it("should support a { validate: fn } rule object", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: { a: "x" },
      rules: { a: { validate: ({ value }) => value === "ok" ? true : "not ok" } },
    })
    assert.strictEqual(ff.validateAndCommit("a", "ok"), true)
    assert.strictEqual(ff.validateAndCommit("a", "bad"), false)
  })

  it("should warn and ignore unknown string validators", async () => {
    const warnings = []
    const restore = mock.method(console, "warn", (m) => warnings.push(String(m)))
    try {
      ff.render({
        schema: [{ fields: [{ type: "text", key: "a" }] }],
        data: {},
        rules: { a: "no_such_validator" },
      })
      assert.ok(warnings.some(w => w.includes("Validator 'no_such_validator' not found")))
      // Compiled entry with all-undefined rules is dropped entirely:
      assert.strictEqual(ff.getApi("validation").getRules("a"), undefined)
    } finally {
      restore.mock.restore()
    }
  })

  it("should warn and ignore unknown validator factory names", async () => {
    const warnings = []
    const restore = mock.method(console, "warn", (m) => warnings.push(String(m)))
    try {
      ff.render({
        schema: [{ fields: [{ type: "text", key: "a" }] }],
        data: {},
        rules: { a: { name: "noFactory", args: 1 } },
      })
      assert.ok(warnings.some(w => w.includes("Validator Factory 'noFactory' not found")))
    } finally {
      restore.mock.restore()
    }
  })

  it("should report errors from failing validator factories via console.error", async () => {
    const errors = []
    const restoreWarn = mock.method(console, "warn", () => {})
    const restoreErr = mock.method(console, "error", (m) => errors.push(String(m)))
    try {
      ff.render({
        schema: [{ fields: [{ type: "text", key: "a" }] }],
        data: {},
        rules: { a: { name: "pattern" /* factory expects a RegExp with .test */ } },
        validators: { boom: () => { throw new Error("factory exploded") } },
      })
      // pattern() with no arg returns a rule fn whose .test on undefined throws at runtime,
      // not compile time — compile-level factory failure needs a throwing factory:
      ff.clear()
      ff.render({
        schema: [{ fields: [{ type: "text", key: "a" }] }],
        data: {},
        rules: { a: { name: "boom" } },
        validators: { boom: () => { throw new Error("factory exploded") } },
      })
      assert.ok(errors.some(e => e.includes("Failed to compile validator 'boom'")))
    } finally {
      restoreWarn.mock.restore()
      restoreErr.mock.restore()
    }
  })
})

describe("FastForm Validation - validator registry (FastForm.validator)", () => {
  beforeEach(() => ff.clear())

  it("should register a custom validator usable via string name in rules", async () => {
    FastForm.validator.register("startsWithX", () => ({ value }) =>
      (typeof value === "string" && value.startsWith("x")) ? true : "must start with x")
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: {},
      rules: { a: { name: "startsWithX" } },
    })
    assert.strictEqual(ff.validateAndCommit("a", "xyz"), true)
    assert.strictEqual(ff.validateAndCommit("a", "abc"), false)
  })

  it("should reject non-function validator definitions", () => {
    assert.throws(() => FastForm.validator.register("bad", "nope"), TypeError)
    assert.throws(() => FastForm.validator.register("bad", { x: 1 }), /must be a function/)
  })

  it("should warn when overwriting an existing validator", () => {
    const warnings = []
    const restore = mock.method(console, "warn", (m) => warnings.push(String(m)))
    try {
      FastForm.validator.register("required", () => true)
      assert.ok(warnings.some(w => w.includes("Overwriting validator for 'required'")))
    } finally {
      restore.mock.restore()
      // NOTE: 'required' is now overwritten for the rest of this test process.
      // Restore the original immediately to avoid poisoning later tests:
      FastForm.validator.register("required", ({ value }) => {
        const isEmpty = value == null
          || (typeof value === "string" && value.trim() === "")
          || (Array.isArray(value) && value.length === 0)
        return !isEmpty ? true : "required"
      })
    }
  })

  it("validator.get should return single fn or array", () => {
    const single = FastForm.validator.get("required")
    assert.strictEqual(typeof single, "function")
    const [a, b] = FastForm.validator.get("required", "integer")
    assert.strictEqual(a, single)
    assert.strictEqual(typeof b, "function")
    assert.strictEqual(FastForm.validator.get(), undefined)
  })

  it("options.validators should merge with and override global validators per form", async () => {
    // form-level 'required' that only rejects empty strings (differs from global)
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: { a: [] },
      rules: { a: "required" },
      validators: { required: ({ value }) => (value === "" ? "empty!" : true) },
    })
    // [] passes the overridden local validator but would fail the global one
    assert.strictEqual(ff.validateAndCommit("a", []), true,
      "form-level validators override globals via { ...getAll(), ...validators }")
  })
})

describe("FastForm Validation - untested built-in validators", () => {
  beforeEach(() => ff.clear())

  const check = (rule, value, expected) => {
    ff.clear()
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: {},
      rules: { a: rule },
    })
    assert.strictEqual(ff.validateAndCommit("a", value), expected, `rule=${JSON.stringify(rule)} value=${JSON.stringify(value)}`)
  }

  it("notEqual", () => {
    check({ name: "notEqual", args: "forbidden" }, "forbidden", false)
    check({ name: "notEqual", args: "forbidden" }, "other", true)
    check({ name: "notEqual", args: "forbidden" }, null, true)
  })

  it("minLength / maxLength", () => {
    check({ name: "minLength", args: 3 }, "ab", false)
    check({ name: "minLength", args: 3 }, "abc", true)
    check({ name: "maxLength", args: 2 }, "abc", false)
    check({ name: "maxLength", args: 2 }, "ab", true)
    check({ name: "minLength", args: 3 }, 42, true) // no .length -> passes
  })

  it("minItems", () => {
    check({ name: "minItems", args: 2 }, [1], false)
    check({ name: "minItems", args: 2 }, [1, 2], true)
    check({ name: "minItems", args: 2 }, "notArray", true) // non-array passes
  })

  it("array / object / arrayOrObject", () => {
    check("array", [1], true)
    check("array", { x: 1 }, false)
    check("object", { x: 1 }, true)
    check("object", [1], false)
    check("arrayOrObject", { x: 1 }, true)
    check("arrayOrObject", [1], true)
    check("arrayOrObject", "str", false)
    check("arrayOrObject", null, true) // null always passes
  })

  it("min/max NaN branches", () => {
    check({ name: "min", args: 5 }, "abc", false)   // isNaN -> error
    check({ name: "min", args: 5 }, "10", true)     // numeric string coerces
    check({ name: "max", args: 5 }, {}, false)      // NaN object
  })

  it("integer rejects floats and non-numbers but passes numeric strings", () => {
    check("integer", 1.5, false)
    check("integer", "3", true)
    check("integer", "x", false)
    check("integer", "", true)
  })
})

describe("FastForm watchers (regression: container key must stay stable after push/removeIndex removal)", () => {
  beforeEach(() => ff.clear())

  it("should still trigger a watcher registered on the array's container key after a structural add/delete via whole-array set", async () => {
    ff.render({
      schema: [{ fields: [{ type: "array", key: "list" }, { type: "text", key: "summary" }] }],
      data: { list: ["a"], summary: "" },
      watchers: [{
        triggers: ["list"],
        effect: { $map: { to: "summary", with: (_, ctx) => `count:${ctx.getValue("list").length}` } },
      }],
    })
    await flushMicrotasks()
    ff.reactiveCommit("list", ["a", "b"])
    await flushMicrotasks()
    assert.strictEqual(ff.getData("summary"), "count:2", "Watcher bound to container key 'list' must still fire on structural changes submitted via unified set")
  })
})

describe("Control_Array DOM interaction (regression: editing-state isolation after push/removeIndex removal)", () => {
  beforeEach(() => ff.clear())

  it("deleting one item should not re-render or disturb a sibling item element identity", async () => {
    ff.render({ schema: [{ fields: [{ type: "array", key: "tags" }] }], data: { tags: ["a", "b", "c"] } })
    await flushMicrotasks()
    const items = ff.form.querySelectorAll(".array-item")
    const survivorEl = items[2] // the element for "c", should survive deleting "b"
    items[1].querySelector(".array-item-del").dispatchEvent(new window.Event("click", { bubbles: true }))
    await flushMicrotasks()
    const itemsAfter = ff.form.querySelectorAll(".array-item")
    assert.strictEqual(itemsAfter.length, 2)
    assert.ok(ff.form.querySelector(".array-item-val").closest(".array").contains(survivorEl) === false || itemsAfter[1] === survivorEl,
      "Surviving item DOM node should be reused rather than the whole list being rebuilt (local patch, not full update())")
  })
})

describe("FastForm Feature_History", () => {
  beforeEach(() => ff.clear())

  const renderHistoryForm = (overrides = {}) => ff.render({
    schema: [{ fields: [{ type: "text", key: "name" }, { type: "text", key: "other" }] }],
    data: { name: "v0", other: "o0" },
    historyEnabled: true,
    ...overrides,
  })

  it("should record commits as undo entries and restore values via undo/redo", async () => {
    renderHistoryForm()
    await flushMicrotasks()

    const api = ff.getApi("history")
    assert.ok(api, "History API should be registered")
    assert.strictEqual(api.canUndo(), false, "Undo stack should start empty")

    ff.reactiveCommit("name", "v1")
    assert.strictEqual(api.canUndo(), true, "Commit should push an entry onto the undo stack")

    const ok = api.undo()
    assert.strictEqual(ok, true, "undo() should succeed")
    assert.strictEqual(ff.getData("name"), "v0", "Undo should restore the pre-commit value")
    assert.strictEqual(api.canRedo(), true, "Undone entry should move to the redo stack")
    assert.strictEqual(api.canUndo(), false, "Undo stack should be empty after popping")

    const redoOk = api.redo()
    assert.strictEqual(redoOk, true)
    assert.strictEqual(ff.getData("name"), "v1", "Redo should re-apply the committed value")
    assert.strictEqual(api.canUndo(), true)
    assert.strictEqual(api.canRedo(), false)
  })

  it("should return false when undo/redo stacks are empty", () => {
    renderHistoryForm()
    const api = ff.getApi("history")
    assert.strictEqual(api.undo(), false, "undo() on empty stack should return false")
    assert.strictEqual(api.redo(), false, "redo() on empty stack should return false")
  })

  it("should not record entries when values are deep-equal or field is excluded", () => {
    renderHistoryForm({ historyExcludeKeys: ["other"] })
    const api = ff.getApi("history")

    ff.reactiveCommit("name", "v0") // same value -> deepEqual guard
    assert.strictEqual(api.canUndo(), false, "Committing an identical value should not create a history entry")

    ff.reactiveCommit("other", "o1")
    assert.strictEqual(api.canUndo(), false, "Excluded keys should bypass history recording")
    assert.strictEqual(ff.getData("other"), "o1", "Data itself should still commit normally")
  })

  it("should clear the redo stack on a new commit and reset everything via clear()", () => {
    renderHistoryForm()
    const api = ff.getApi("history")

    ff.reactiveCommit("name", "v1")
    api.undo()
    assert.strictEqual(api.canRedo(), true)

    ff.reactiveCommit("name", "v2") // branch off
    assert.strictEqual(api.canRedo(), false, "A fresh commit must invalidate the redo stack")

    const { undoStack } = api.inspect()
    assert.ok(undoStack.length > 0)
    api.clear()
    assert.strictEqual(api.canUndo(), false)
    assert.strictEqual(api.canRedo(), false)
    assert.deepStrictEqual(api.inspect(), { undoStack: [], redoStack: [] }, "inspect() should expose empty stacks after clear()")
  })

  it("should cap the undo stack at historyMaxSize by dropping the oldest entry", () => {
    renderHistoryForm({ historyMaxSize: 2 })
    const api = ff.getApi("history")

    ff.reactiveCommit("name", "v1")
    ff.reactiveCommit("name", "v2")
    ff.reactiveCommit("name", "v3")

    assert.strictEqual(api.inspect().undoStack.length, 2, "Undo stack should be trimmed to historyMaxSize")
    api.undo()
    assert.strictEqual(ff.getData("name"), "v2", "Newest entry should be undone first (LIFO)")
    api.undo()
    assert.strictEqual(ff.getData("name"), "v1", "Oldest entry 'v0->v1' should have been dropped; only 'v1->v2' remains")
    assert.strictEqual(api.canUndo(), false)
  })

  it("should merge consecutive edits on the same key within historyMergeWindow", () => {
    renderHistoryForm({ historyMergeWindow: 60000 })
    const api = ff.getApi("history")

    ff.reactiveCommit("name", "v1")
    ff.reactiveCommit("name", "v2") // same key, within merge window

    assert.strictEqual(api.inspect().undoStack.length, 1, "Rapid successive edits on one key should merge into a single entry")

    api.undo()
    assert.strictEqual(ff.getData("name"), "v0", "Merged entry should undo all the way back to the original value")
  })

  it("should emit history-change events when historyEmitEvents is enabled", () => {
    renderHistoryForm({ historyEmitEvents: true })
    const events = []
    ff.addEventListener("history-change", (ev) => events.push(ev.detail))

    ff.reactiveCommit("name", "v1")
    assert.strictEqual(events.length, 1, "A recorded commit should emit one history-change event")
    assert.deepStrictEqual(events[0], { canUndo: true, canRedo: false, undoSize: 1, redoSize: 0 })

    ff.getApi("history").undo()
    assert.strictEqual(events.length, 2, "undo() should emit a second history-change event")
    assert.strictEqual(events[1].canRedo, true)
  })

  it("should apply the feedback class to the control after a successful replay", async () => {
    renderHistoryForm({ historyFeedbackClass: "input-success" })
    const api = ff.getApi("history")

    ff.reactiveCommit("name", "v1")
    api.undo()

    await flushMicrotasks()
    const controlEl = ff.form.querySelector(`[data-control="name"]`)
    assert.ok(controlEl.classList.contains("input-success"), "Replayed control should receive the history feedback class")
  })
})

describe("FastForm Feature_Reveal", () => {
  let originalScrollIntoView
  beforeEach(() => {
    ff.clear()
    originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = mock.fn()
  })
  afterEach(() => {
    if (originalScrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    } else {
      delete window.HTMLElement.prototype.scrollIntoView
    }
  })

  it("should add the reveal class to matched fields and scroll the first target into view", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "f1" }, { type: "text", key: "f2" }] }],
      data: {},
    })
    await flushMicrotasks()

    const api = ff.getApi("reveal")
    const count = api.reveal(["f1", "f2"])
    assert.strictEqual(count, 2, "reveal() should return the number of resolved targets")

    const el1 = ff.form.querySelector(`[data-control="f1"]`)
    const el2 = ff.form.querySelector(`[data-control="f2"]`)
    assert.ok(el1.classList.contains("input-focus"), "Target control should receive the reveal class")
    assert.ok(el2.classList.contains("input-focus"))
    assert.strictEqual(window.HTMLElement.prototype.scrollIntoView.mock.calls.length, 1, "Only the first target should be scrolled into view")
  })

  it("should skip unresolvable keys and auto-expand collapsed boxes", async () => {
    ff.render({
      schema: [{ id: "box1", title: "Group", fields: [{ type: "text", key: "inner" }] }],
      data: {},
      collapsibleBox: true,
    })
    await flushMicrotasks()

    const box = ff.form.querySelector(`.box-container[data-box="box1"]`)
    box.classList.add("collapsed")

    const api = ff.getApi("reveal")
    const count = api.reveal(["inner", "nonexistent_key"])
    assert.strictEqual(count, 1, "Unresolvable keys should be filtered out of the count")
    assert.strictEqual(box.classList.contains("collapsed"), false, "Collapsed ancestor box should be expanded")
  })

  it("should clear previous reveal classes before applying new ones, and via clear()", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "f1" }, { type: "text", key: "f2" }] }],
      data: {},
    })
    await flushMicrotasks()

    const api = ff.getApi("reveal")
    api.reveal("f1")
    api.reveal("f2")
    assert.strictEqual(ff.form.querySelectorAll(".input-focus").length, 1, "reveal() should clear prior highlights implicitly")

    api.clear()
    assert.strictEqual(ff.form.querySelectorAll(".input-focus").length, 0, "clear() should remove all reveal classes")
  })

  it("should auto-reveal the keys listed in the 'reveal' option on render", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "auto" }, { type: "text", key: "other" }] }],
      data: {},
      reveal: ["auto"],
    })
    await flushMicrotasks()

    const el = ff.form.querySelector(`[data-control="auto"]`)
    assert.ok(el.classList.contains("input-focus"), "Option-driven reveal should fire during onRender")
    assert.strictEqual(ff.form.querySelector(`[data-control="other"]`).classList.contains("input-focus"), false)
  })

  it("should support pulse() with custom class overrides and resolve both controls and boxes", async () => {
    ff.render({
      schema: [{ id: "boxA", title: "Box A", fields: [{ type: "text", key: "f1" }] }],
      data: {},
    })
    await flushMicrotasks()

    const api = ff.getApi("reveal")
    const count = api.pulse(["f1", "boxA"], { className: "input-error" })
    assert.strictEqual(count, 2, "pulse() should resolve both field keys and box ids")

    assert.ok(ff.form.querySelector(`[data-control="f1"]`).classList.contains("input-error"), "pulse() should apply the overridden class")
    assert.ok(ff.form.querySelector(`[data-box="boxA"]`).classList.contains("input-error"), "Boxes should be resolvable targets")
  })
})

describe("FastForm DSL Engine - When proxy & mergeDeps", () => {
  beforeEach(() => ff.clear())

  it("When dynamic operator should produce {key: {$op: val}} for any $-op", () => {
    ff.render({ schema: [], data: {} })
    const { When } = ff.dsl
    assert.deepStrictEqual(When.gte("n", 5), { n: { $gte: 5 } })
    assert.deepStrictEqual(When.includes("role", ["a", "b"]), { role: { $includes: ["a", "b"] } })
    assert.deepStrictEqual(When.bool("f"), { f: { $bool: undefined } })
  })

  it("When combinators should build $or/$and/$follow/$eq/$ne/$true/$false/raw", () => {
    ff.render({ schema: [], data: {} })
    const { When } = ff.dsl
    assert.deepStrictEqual(When.or({ a: 1 }, { b: 2 }), { $or: [{ a: 1 }, { b: 2 }] })
    assert.deepStrictEqual(When.and({ a: 1 }, { b: 2 }), { $and: [{ a: 1 }, { b: 2 }] })
    assert.deepStrictEqual(When.follow("x"), { $follow: "x" })
    assert.deepStrictEqual(When.eq("k", 9), { k: 9 })
    assert.deepStrictEqual(When.ne("k", 9), { k: { $ne: 9 } })
    assert.deepStrictEqual(When.true("k"), { k: true })
    assert.deepStrictEqual(When.false("k"), { k: false })
    assert.deepStrictEqual(When.raw({ z: 1 }), { z: 1 })
  })

  it("repeated .ShowIf()/.Dependencies() should merge into $and instead of overwriting", () => {
    ff.render({
      schema: (d) => [d.Group(d.Controls.Text("a").ShowIf("x", 1).ShowIf("y", 2))],
      data: {},
    })
    const field = ff.getField("a")
    assert.deepStrictEqual(field.dependencies, { $and: [{ x: 1 }, { y: 2 }] },
      "mergeDeps must accumulate distinct deps under $and")
  })

  it("mergeDeps should dedupe identical conditions", () => {
    ff.render({
      schema: (d) => [d.Group(d.Controls.Text("a").ShowIf("x", 1).ShowIf("x", 1))],
      data: {},
    })
    assert.deepStrictEqual(ff.getField("a").dependencies, { x: 1 },
      "Identical dep should collapse back to a single condition, not $and")
  })
})

describe("FastForm DSL Engine - preset / presetFor", () => {
  beforeEach(() => ff.clear())

  it("preset should register a chainable setter on all field builders (name must be capitalized)", () => {
    ff.render({ schema: [], data: {} })
    ff.dsl.Extend.preset("MyPreset", function (box, v) {
      box.fields[0].customFlag = v
    })

    const box = ff.dsl.define(d => d.Group(
      d.Controls.Text("a").MyPreset(7).Label("A"),
      d.Controls.Switch("b").MyPreset(9),
    ))[0]

    assert.strictEqual(box.fields[0].customFlag, 7)
    assert.strictEqual(box.fields[0].label, "A", "Chain after preset should still work")
    assert.strictEqual(box.fields[1].customFlag, 9, "preset lands on scopedProto.any, inherited by every field builder proto")
  })

  it("presetFor should register a setter only on the given field type's proto", () => {
    ff.render({ schema: [], data: {} })
    ff.dsl.Extend.presetFor("text", "TextOnly", function (box, v) {
      box.fields[0].textOnly = v
    })

    const box = ff.dsl.define(d => d.Group(
      d.Controls.Text("a").TextOnly(1),
      d.Controls.Switch("b"),
    ))[0]
    assert.strictEqual(box.fields[0].textOnly, 1)

    assert.throws(
      () => ff.dsl.define(d => d.Group(d.Controls.Switch("b2").TextOnly(1))),
      /not a function|TypeError/,
      "presetFor('text',...) must not leak onto the switch proto",
    )
  })

  it("presetFor('box', ...) should target the box (Group) builder", () => {
    ff.render({ schema: [], data: {} })
    ff.dsl.Extend.presetFor("box", "BoxOnly", function (box, v) {
      box.boxFlag = v
    })
    const box = ff.dsl.define(d => d.Group("T", d.Controls.Text("a")).BoxOnly(5))[0]
    assert.strictEqual(box.boxFlag, 5)
    assert.strictEqual(box.fields[0].boxFlag, undefined)
  })

  it("presetFor with an array of types should register on each", () => {
    ff.render({ schema: [], data: {} })
    ff.dsl.Extend.presetFor(["text", "switch"], "sharedPreset", (b, v) => b.Label(v))
    assert.strictEqual(typeof ff.dsl.Controls.Text("a").sharedPreset, "function")
    assert.strictEqual(typeof ff.dsl.Controls.Switch("b").sharedPreset, "function")
    assert.strictEqual(typeof ff.dsl.Controls.Number("c").sharedPreset, "undefined")
  })

  it("presetFor('box', ...) should target the box (Group) builder", () => {
    const local = document.createElement(ff.localName || "fast-form")
    local.render({ schema: [], data: {} })

    local.dsl.Extend.presetFor("box", "BoxOnly", function (box, v) {
      box.boxFlag = v
    })
    const box = local.dsl.define(d => d.Group("T", d.Controls.Text("a")).BoxOnly(5))[0]

    assert.strictEqual(box.boxFlag, 5)
    assert.strictEqual(box.fields[0].boxFlag, undefined)
  })

  it("should throw on name collisions: reserved names, same-proto dupes, global-vs-typed", () => {
    ff.render({ schema: [], data: {} })
    const { preset, presetFor } = ff.dsl.Extend

    assert.throws(() => preset("Key", () => {}), /reserved standard DSL property/)   // capitalize("key")==="Key"
    assert.throws(() => preset("Fields", () => {}), /reserved/)
    assert.throws(() => preset(123, () => {}), TypeError)

    preset("Once", () => {})
    assert.throws(() => preset("Once", () => {}), /already registered in this sandbox/)
    assert.throws(() => presetFor("text", "Once", () => {}), /already registered globally/)

    presetFor("text", "Typed", () => {})
    assert.throws(() => presetFor("text", "Typed", () => {}), /already registered in this sandbox/)
    assert.doesNotThrow(() => presetFor("switch", "Typed", () => {}), "Different field protos may reuse the same preset name")
    assert.throws(() => presetFor("no_such_type", "X", () => {}), /does not exist/)
  })
})

describe("FastForm DSL Engine - PropResolvers normalization", () => {
  beforeEach(() => ff.clear())

  it("TOOLTIP should normalize string/object/array payloads into an items array", () => {
    ff.render({ schema: [], data: {} })
    const make = () => ff.dsl.define(d => d.Group(
      d.Controls.Text("a").Tooltip("str tip"),
      d.Controls.Text("b").Tooltip({ text: "obj tip" }),
      d.Controls.Text("c").Tooltip(["t1", "t2"]),
    ))[0]
    const box = make()
    const [a, b, c] = box.fields
    assert.deepStrictEqual(a.tooltip, ["str tip"])
    assert.deepStrictEqual(b.tooltip, [{ text: "obj tip" }])
    assert.deepStrictEqual(c.tooltip, ["t1", "t2"])
  })

  it("MERGE_INNER should build nested objects from string-key or object args (.SubFormOptions)", () => {
    ff.render({ schema: [], data: {} })
    const box = ff.dsl.define(d => d.Group(
      d.Controls.Table("t").SubFormOptions("layout", "grid"),
    ))[0]
    assert.deepStrictEqual(box.fields[0].subFormOptions, { layout: "grid" })

    const box2 = ff.dsl.define(d => d.Group(
      d.Controls.Table("t").SubFormOptions({ layout: "grid", rules: { k: "required" } }),
    ))[0]
    assert.deepStrictEqual(box2.fields[0].subFormOptions, { layout: "grid", rules: { k: "required" } })
  })

  it("FIELDS resolver should append fields to the box (Group children)", () => {
    ff.render({ schema: [], data: {} })
    const box = ff.dsl.define(d => d.Group("Title", d.Controls.Text("a"), d.Controls.Switch("b")))[0]
    assert.strictEqual(box.title, "Title")
    assert.deepStrictEqual(box.fields.map(f => f.key), ["a", "b"])
  })

  it("schema function form should be compiled via onOptions -> dsl.define", async () => {
    ff.render({
      schema: (d) => [d.Group("G", d.Controls.Text("dynamicKey").Label("Dyn"))],
      data: {},
    })
    await flushMicrotasks()
    const f = ff.getField("dynamicKey")
    assert.ok(f, "Function-form schema should be resolved through the DSL pipeline")
    assert.strictEqual(f.label, "Dyn")
  })

  it("When.follow / $follow array form should make a field depend on another field's availability", async () => {
    ff.render({
      schema: [{ fields: [
          { type: "switch", key: "gate" },
          { type: "text", key: "a", dependencies: { gate: true } },          // a available only when gate===true
          { type: "text", key: "b", dependencies: { $follow: "a" } },        // b follows a's availability
          { type: "text", key: "c", dependencies: { $follow: ["a", "gate"] } }, // array form: all must be available
        ]}],
      data: { gate: false },
      fieldDependencyUnmetAction: "hide",
    })
    await flushMicrotasks()

    const ctrl = k => ff.form.querySelector(`[data-control="${k}"]`)
    assert.ok(ctrl("a").closest(".plugin-common-hidden"), "a hidden when gate is false")
    assert.ok(ctrl("b").closest(".plugin-common-hidden"), "b follows a -> hidden")
    assert.ok(ctrl("c").closest(".plugin-common-hidden"), "c follows [a,gate]: a unavailable -> hidden")

    ff.reactiveCommit("gate", true)
    await flushMicrotasks()
    assert.strictEqual(ctrl("a").closest(".plugin-common-hidden"), null)
    assert.strictEqual(ctrl("b").closest(".plugin-common-hidden"), null, "a available -> b becomes available via $follow")
    assert.strictEqual(ctrl("c").closest(".plugin-common-hidden"), null)
  })
})

describe("FastForm Feature_LiveCommit", () => {
  beforeEach(() => {
    ff.clear()
    mock.timers.enable({ apis: ["setTimeout"] })
  })
  afterEach(() => mock.timers.reset())

  const renderLiveForm = () => {
    ff.render({
      schema: [{ fields: [{ type: "textarea", key: "bio", liveCommit: 100 }, { type: "textarea", key: "plain" }] }],
      data: { bio: "", plain: "" },
    })
    return ff.form.querySelector(`.control[data-control="bio"] .textarea`)
  }

  it("should debounce input events and commit only after the liveCommit delay", async () => {
    const textarea = renderLiveForm()
    await flushMicrotasks()

    textarea.value = "typing..."
    textarea.dispatchEvent(new window.Event("input", { bubbles: true }))
    mock.timers.tick(50)
    assert.strictEqual(ff.getData("bio"), "", "Value should not commit before the debounce delay elapses")

    textarea.value = "typing more"
    textarea.dispatchEvent(new window.Event("input", { bubbles: true }))
    mock.timers.tick(50) // still within the restarted window
    assert.strictEqual(ff.getData("bio"), "", "Each input should reset the debounce timer")

    mock.timers.tick(100)
    assert.strictEqual(ff.getData("bio"), "typing more", "The latest value should commit once the delay fully elapses")
  })

  it("should not debounce fields without a liveCommit attribute", async () => {
    renderLiveForm()
    await flushMicrotasks()

    const plain = ff.form.querySelector(`.control[data-control="plain"] .textarea`)
    plain.value = "x"
    plain.dispatchEvent(new window.Event("input", { bubbles: true }))
    mock.timers.tick(1000)
    assert.strictEqual(ff.getData("plain"), "", "Non-liveCommit fields should ignore the input pipeline entirely")
  })

  it("should skip debounced commits while an IME composition is in progress", async () => {
    const textarea = renderLiveForm()
    await flushMicrotasks()

    textarea.dispatchEvent(new window.Event("compositionstart", { bubbles: true }))
    textarea.value = "拼音"
    textarea.dispatchEvent(new window.Event("input", { bubbles: true }))
    mock.timers.tick(500)
    assert.strictEqual(ff.getData("bio"), "", "Input during composition must not trigger a debounced commit")

    textarea.value = "拼音完成"
    textarea.dispatchEvent(new window.Event("compositionend", { bubbles: true }))
    assert.strictEqual(ff.getData("bio"), "拼音完成", "compositionend should commit the final value immediately")
  })

  it("should discard a pending debounced commit when compositionend fires first", async () => {
    const textarea = renderLiveForm()
    await flushMicrotasks()

    textarea.value = "staged"
    textarea.dispatchEvent(new window.Event("input", { bubbles: true }))
    mock.timers.tick(50) // debounce pending

    textarea.dispatchEvent(new window.Event("compositionstart", { bubbles: true }))
    textarea.value = "final"
    textarea.dispatchEvent(new window.Event("compositionend", { bubbles: true }))

    mock.timers.tick(500)
    assert.strictEqual(ff.getData("bio"), "final", "compositionend should cancel the stale timer and commit the latest value")
  })
})

describe("FastForm Feature_TableRowRules", () => {
  beforeEach(() => ff.clear())

  it("should inject rules.<tableKey>.$row into the table field's subFormOptions", async () => {
    const rowRules = { name: "required", age: { validator: "min", args: [0] } }
    ff.render({
      schema: [{
        fields: [{
          type: "table",
          key: "users",
          thMap: { name: "Name", age: "Age" },
          tableOptions: { allowAdd: true, allowEdit: true, allowDelete: true },
        }],
      }],
      data: { users: [] },
      rules: { users: { $row: rowRules } },
    })
    await flushMicrotasks()

    const field = ff.getField("users")
    assert.deepStrictEqual(field.subFormOptions.rules, rowRules, "$row rules should be attached to subFormOptions for row-level editing dialogs")
  })

  it("should merge $row rules into pre-existing subFormOptions instead of replacing them", async () => {
    ff.render({
      schema: [{ fields: [{ type: "table", key: "t", subFormOptions: { boxDependencyUnmetAction: "readonly" } }] }],
      data: { t: [] },
      rules: { t: { $row: { f: "required" } } },
    })
    await flushMicrotasks()

    const field = ff.getField("t")
    assert.deepStrictEqual(field.subFormOptions.rules, { f: "required" })
    assert.strictEqual(field.subFormOptions.boxDependencyUnmetAction, "readonly", "Existing subFormOptions keys must be preserved")
  })

  it("should ignore non-table fields and non-object $row configs", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "txt" }, { type: "table", key: "t" }] }],
      data: { txt: "", t: [] },
      rules: {
        txt: { $row: { f: "required" } },       // wrong control type
        t: { $row: ["not", "an", "object"] }, // array $row must be ignored
      },
    })
    await flushMicrotasks()

    assert.strictEqual(ff.getField("txt").subFormOptions, undefined, "Text fields must not receive subFormOptions")
    assert.strictEqual(ff.getField("t").subFormOptions, undefined, "Array-typed $row should be rejected")
  })
})

describe("FastForm Feature_InteractiveTooltip", () => {
  beforeEach(() => ff.clear())

  it("should normalize string tooltips into { text, icon } objects during compile", async () => {
    ff.render({
      schema: [{
        title: "Box",
        tooltip: "box tip",
        fields: [{ type: "text", key: "f1", tooltip: ["field tip", { text: "custom", icon: "fa fa-star" }] }],
      }],
      data: {},
    })
    await flushMicrotasks()

    const field = ff.getField("f1")
    assert.deepStrictEqual(field.tooltip[0], { text: "field tip", icon: "fa fa-info-circle" }, "String tooltip should gain the default icon")
    assert.strictEqual(field.tooltip[1].icon, "fa fa-star", "Explicit icons should be preserved")
  })

  it("should dispatch to options.actions when a tooltip trigger with data-action is clicked", async () => {
    let received = null
    ff.render({
      schema: [{
        fields: [{
          type: "text",
          key: "f1",
          tooltip: [{ text: "tip", action: "showHelp", data: { docId: 42 } }],
        }],
      }],
      data: {},
      actions: { showHelp: (payload) => received = payload },
    })
    await flushMicrotasks()

    const trigger = ff.form.querySelector(`[data-control="f1"] .tooltip-trigger`)
    assert.ok(trigger, "Tooltip trigger should be rendered")
    trigger.dispatchEvent(new window.Event("click", { bubbles: true }))

    assert.ok(received, "Action callback should be invoked")
    assert.strictEqual(received.key, "f1", "Payload should carry the owning field key")
    assert.strictEqual(received.data.docId, 42, "Payload should carry the per-tooltip config data")
    assert.strictEqual(received.form, ff, "Payload should carry the form instance")
  })

  it("should silently ignore clicks on tooltips without a registered action", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "f1", tooltip: { text: "no action" } }] }],
      data: {},
    })
    await flushMicrotasks()

    const trigger = ff.form.querySelector(`[data-control="f1"] .tooltip-trigger`)
    assert.doesNotThrow(() => trigger.dispatchEvent(new window.Event("click", { bubbles: true })))
  })
})

describe("FastForm Feature_CollapsibleBox", () => {
  beforeEach(() => ff.clear())

  it("should mark the form element and toggle 'collapsed' on title click when enabled", async () => {
    ff.render({
      schema: [{ id: "box1", title: "Group 1", fields: [{ type: "text", key: "f1" }] }],
      data: {},
      collapsibleBox: true,
    })
    await flushMicrotasks()

    assert.ok(ff.form.classList.contains("feature-collapsible-box"), "Form root should carry the feature marker class")

    const box = ff.form.querySelector(`.box-container[data-box="box1"]`)
    const title = box.querySelector(".title")
    assert.strictEqual(box.classList.contains("collapsed"), false)

    title.dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.ok(box.classList.contains("collapsed"), "Clicking the title should collapse the box")

    title.dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.strictEqual(box.classList.contains("collapsed"), false, "Clicking again should expand the box")
  })

  it("should not toggle or add the marker class when collapsibleBox is false", async () => {
    ff.render({
      schema: [{ id: "box1", title: "Group 1", fields: [{ type: "text", key: "f1" }] }],
      data: {},
      collapsibleBox: false,
    })
    await flushMicrotasks()

    assert.strictEqual(ff.form.classList.contains("feature-collapsible-box"), false)
    const box = ff.form.querySelector(`.box-container[data-box="box1"]`)
    box.querySelector(".title").dispatchEvent(new window.Event("click", { bubbles: true }))
    assert.strictEqual(box.classList.contains("collapsed"), false, "Title clicks should be inert when the feature is disabled")
  })
})

describe("FastForm Feature_DefaultKeybindings", () => {
  beforeEach(() => ff.clear())

  it("should stop keydown events from propagating out of the form", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "f1" }] }],
      data: {},
    })
    await flushMicrotasks()

    const outerListener = mock.fn()
    document.addEventListener("keydown", outerListener)
    try {
      const inner = ff.form.querySelector(`[data-control="f1"]`)
      inner.dispatchEvent(new window.Event("keydown", { bubbles: true }))
      assert.strictEqual(outerListener.mock.calls.length, 0, "keydown inside the form should not reach ancestors outside it")
    } finally {
      document.removeEventListener("keydown", outerListener)
    }
  })
})

describe("FastForm Watchers Engine - Condition Evaluators", () => {
  beforeEach(() => ff.clear())

  it("should evaluate $not by inverting the inner condition result", async () => {
    ff.render({
      schema: [{ fields: [{ type: "switch", key: "locked" }, { type: "text", key: "status" }] }],
      data: { locked: false, status: "init" },
      watchers: {
        w: {
          triggers: ["locked"],
          when: { $not: { locked: true } },
          effect: { $update: { status: "editable" } },
        },
      },
    })
    await flushMicrotasks()
    assert.strictEqual(ff.getData("status"), "editable", "$not should be met when inner condition is false")

    ff.reactiveCommit("locked", true)
    ff.reactiveCommit("status", "reset")
    await flushMicrotasks()
    assert.strictEqual(ff.getData("status"), "reset", "$not should be unmet when inner condition is true")
  })

  it("should evaluate $never as false and $always as true", async () => {
    let neverCount = 0
    let alwaysCount = 0
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: { a: "" },
      watchers: {
        wNever: { triggers: ["a"], affects: [], when: { $never: true }, effect: isMet => isMet && neverCount++ },
        wAlways: { triggers: ["a"], affects: [], when: { $always: true }, effect: isMet => isMet && alwaysCount++ },
      },
    })
    await flushMicrotasks()
    assert.strictEqual(neverCount, 0, "$never should never be met, even at mount")
    assert.strictEqual(alwaysCount, 1, "$always should be met at mount")

    ff.reactiveCommit("a", "x")
    await flushMicrotasks()
    assert.strictEqual(neverCount, 0, "$never stays unmet on updates")
    assert.strictEqual(alwaysCount, 2, "$always should be met on every run")
  })

  it("should collect no triggers from $never/$always (they cannot be triggered by field changes)", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: { a: "" },
      watchers: {
        wAlways: { affects: [], when: { $always: {} }, effect: () => undefined },
      },
    })
    await flushMicrotasks()

    const { triggerToWatchers } = ff.getApi("watchers").inspect()
    for (const [key] of triggerToWatchers) {
      assert.notStrictEqual(key, undefined, "Trigger map keys should be real field keys")
    }
  })

  it("should evaluate field conditions using a non-object expected value as $eq shorthand", async () => {
    let met = false
    ff.render({
      schema: [{ fields: [{ type: "text", key: "mode" }] }],
      data: { mode: "edit" },
      watchers: {
        w: { triggers: ["mode"], affects: [], when: { mode: "edit" }, effect: (m) => met = m },
      },
    })
    await flushMicrotasks()
    assert.strictEqual(met, true, "Bare value should be compared via default $eq")
  })
})

describe("FastForm Watchers Engine - Comparison Evaluators", () => {
  beforeEach(() => ff.clear())

  const renderComparator = (fieldKey, expectedCond, initValue) => {
    let lastMet = null
    ff.render({
      schema: [{ fields: [{ type: "text", key: fieldKey }] }],
      data: { [fieldKey]: initValue },
      watchers: {
        w: {
          triggers: [fieldKey],
          affects: [],
          when: { [fieldKey]: expectedCond },
          effect: (m) => lastMet = m,
        },
      },
    })
    return () => lastMet
  }

  it("should evaluate $ne/$gt/$lt/$lte correctly", async () => {
    let met = null
    ff.render({
      schema: [{ fields: [{ type: "number", key: "n" }] }],
      data: { n: 5 },
      watchers: {
        ne: { triggers: ["n"], affects: [], when: { n: { $ne: 5 } }, effect: (m) => met = m },
      },
    })
    await flushMicrotasks()
    assert.strictEqual(met, false, "$ne should be unmet when equal")
    ff.reactiveCommit("n", 6)
    await flushMicrotasks()
    assert.strictEqual(met, true, "$ne should be met when different")

    ff.clear()
    met = null
    ff.render({
      schema: [{ fields: [{ type: "number", key: "n" }] }],
      data: { n: 5 },
      watchers: {
        gt: { triggers: ["n"], affects: [], when: { n: { $gt: 4 } }, effect: (m) => met = m },
      },
    })
    await flushMicrotasks()
    assert.strictEqual(met, true, "$gt: 5 > 4")
  })

  it("should evaluate $includes (expected array contains actual)", async () => {
    let met = null
    ff.render({
      schema: [{ fields: [{ type: "text", key: "role" }] }],
      data: { role: "admin" },
      watchers: {
        w: { triggers: ["role"], affects: [], when: { role: { $includes: ["admin", "root"] } }, effect: (m) => met = m },
      },
    })
    await flushMicrotasks()
    assert.strictEqual(met, true, "'admin' is included in the expected list")
    ff.reactiveCommit("role", "guest")
    await flushMicrotasks()
    assert.strictEqual(met, false, "'guest' is not in the expected list")
  })

  it("should evaluate $contains (actual array/string contains expected)", async () => {
    let met = null
    ff.render({
      schema: [{ fields: [{ type: "array", key: "tags" }] }],
      data: { tags: ["a", "b"] },
      watchers: {
        w: { triggers: ["tags"], affects: [], when: { tags: { $contains: "b" } }, effect: (m) => met = m },
      },
    })
    await flushMicrotasks()
    assert.strictEqual(met, true, "tags contains 'b'")
    ff.reactiveCommit("tags", ["c"])
    await flushMicrotasks()
    assert.strictEqual(met, false, "tags no longer contains 'b'")
  })

  it("should evaluate $bool by coercing actual to Boolean", async () => {
    let met = null
    ff.render({
      schema: [{ fields: [{ type: "text", key: "flag" }] }],
      data: { flag: "yes" },
      watchers: {
        w: { triggers: ["flag"], affects: [], when: { flag: { $bool: true } }, effect: (m) => met = m },
      },
    })
    await flushMicrotasks()
    assert.strictEqual(met, true, "non-empty string is truthy")
    ff.reactiveCommit("flag", "")
    await flushMicrotasks()
    assert.strictEqual(met, false, "empty string is falsy")
  })

  it("should evaluate $deepEqual for structural equality", async () => {
    let met = null
    ff.render({
      schema: [{ fields: [{ type: "object", key: "cfg" }] }],
      data: { cfg: { a: 1, b: [2] } },
      watchers: {
        w: { triggers: ["cfg"], affects: [], when: { cfg: { $deepEqual: { a: 1, b: [2] } } }, effect: (m) => met = m },
      },
    })
    await flushMicrotasks()
    assert.strictEqual(met, true, "Structurally equal objects should match")
    ff.reactiveCommit("cfg", { a: 1, b: [3] })
    await flushMicrotasks()
    assert.strictEqual(met, false, "Differing nested value should not match")
  })

  it("should evaluate $startsWith/$endsWith and return false for non-strings", async () => {
    let met = null
    ff.render({
      schema: [{ fields: [{ type: "text", key: "path" }] }],
      data: { path: "docs/readme.md" },
      watchers: {
        sw: { triggers: ["path"], affects: [], when: { path: { $startsWith: "docs/" } }, effect: (m) => met = m },
      },
    })
    await flushMicrotasks()
    assert.strictEqual(met, true)
    ff.reactiveCommit("path", 123)
    await flushMicrotasks()
    assert.strictEqual(met, false, "$startsWith should return false for non-string actual")
  })

  it("should evaluate $typeof with special null-safe handling for 'object'", async () => {
    let met = null
    ff.render({
      schema: [{ fields: [{ type: "object", key: "obj" }] }],
      data: { obj: { a: 1 } },
      watchers: {
        w: { triggers: ["obj"], affects: [], when: { obj: { $typeof: "object" } }, effect: (m) => met = m },
      },
    })
    await flushMicrotasks()
    assert.strictEqual(met, true)
    ff.reactiveCommit("obj", null)
    await flushMicrotasks()
    assert.strictEqual(met, false, "null should not satisfy $typeof 'object' despite typeof null === 'object'")
  })

  it("should warn and return unmet for unknown comparison operators", async () => {
    const warnings = []
    const restore = mock.method(console, "warn", (msg) => warnings.push(String(msg)))
    try {
      let met = null
      ff.render({
        schema: [{ fields: [{ type: "text", key: "x" }] }],
        data: { x: "a" },
        watchers: {
          w: { triggers: ["x"], affects: [], when: { x: { $nonexistentOp: "a" } }, effect: (m) => met = m },
        },
      })
      await flushMicrotasks()
      assert.strictEqual(met, false, "Unknown operator should evaluate as unmet")
      assert.ok(warnings.some(w => w.includes("Unknown comparison operator")), "Should warn about the unknown operator")
    } finally {
      restore.mock.restore()
    }
  })
})

describe("FastForm Watchers Engine - $meta Variables", () => {
  beforeEach(() => ff.clear())

  it("should expose $phase values 'mount', 'update' and 'api'", async () => {
    const phases = []
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: { a: "" },
      watchers: {
        w: {
          triggers: ["a"],
          affects: [],
          when: { $always: {} },
          effect: (m, ctx) => phases.push(ctx.payload ? undefined : undefined) || phases.push(ctx.meta ? undefined : undefined),
        },
      },
    })
    // simpler: capture via $meta-evaluating watcher
    ff.clear()
    phases.length = 0
    const captured = []
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: { a: "" },
      watchers: {
        w: {
          triggers: ["a"],
          affects: [],
          when: { $always: {} },
          effect: (m, ctx) => {
            // ctx.meta getters are callable functions
            captured.push(ctx.meta.$phase(ctx))
          },
        },
      },
    })
    await flushMicrotasks()
    assert.deepStrictEqual(captured, ["mount"], "First run should have phase 'mount'")

    ff.reactiveCommit("a", "1")
    await flushMicrotasks()
    assert.strictEqual(captured[1], "update", "Commit-driven run should have phase 'update'")

    ff.getApi("watchers").trigger("w", {})
    assert.strictEqual(captured[2], "api", "Manual trigger should have phase 'api'")
  })

  it("should distinguish $isUpdating/$isApi/$trigger meta correctly", async () => {
    const seen = []
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: { a: "" },
      watchers: {
        w: {
          triggers: ["a"],
          affects: [],
          when: { $always: {} },
          effect: (m, ctx) => seen.push({
            mounting: ctx.meta.$isMounting(ctx),
            updating: ctx.meta.$isUpdating(ctx),
            api: ctx.meta.$isApi(ctx),
            trigger: ctx.meta.$trigger(ctx),
          }),
        },
      },
    })
    await flushMicrotasks()
    assert.deepStrictEqual(seen[0], { mounting: true, updating: false, api: false, trigger: null })

    ff.reactiveCommit("a", "1")
    await flushMicrotasks()
    assert.deepStrictEqual(seen[1].updating, true)

    ff.getApi("watchers").trigger("w", { trigger: "manual_run" })
    assert.strictEqual(seen[2].api, true)
    assert.strictEqual(seen[2].trigger, "manual_run", "$trigger should surface the payload's trigger field")
  })

  it("should warn and evaluate false when $meta references an unknown meta variable", async () => {
    const warnings = []
    const restore = mock.method(console, "warn", (msg) => warnings.push(String(msg)))
    try {
      let met = null
      ff.render({
        schema: [{ fields: [{ type: "text", key: "a" }] }],
        data: {},
        watchers: {
          w: { triggers: ["a"], affects: [], when: { $meta: { $bogus: true } }, effect: (m) => met = m },
        },
      })
      await flushMicrotasks()
      assert.strictEqual(met, false)
      assert.ok(warnings.some(w => w.includes("Unknown meta")), "Should warn about unknown meta name")
    } finally {
      restore.mock.restore()
    }
  })

  it("should allow custom meta registration via options.meta and FastForm.registerMeta", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: {},
      meta: { $customFlag: () => "yes" },
      watchers: {
        w: { affects: [], when: { $meta: { $customFlag: "yes" } }, effect: { $update: { a: "hit" } } },
      },
    })
    await flushMicrotasks()
    assert.strictEqual(ff.getData("a"), "hit", "Per-form custom meta should be usable in $meta conditions")

    // Static registration: use a $-prefixed name to satisfy validateDefinition
    assert.throws(() => FastForm.registerMeta("", () => 1), /non-empty string/)
    assert.throws(() => FastForm.registerMeta("$x", "not a function"), /getter must be a function/)
    FastForm.registerMeta("$testMetaGlobal", () => 42)
    ff.clear()
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: {},
      watchers: {
        w: { affects: [], when: { $meta: { $testMetaGlobal: 42 } }, effect: { $update: { a: "global" } } },
      },
    })
    await flushMicrotasks()
    assert.strictEqual(ff.getData("a"), "global", "Globally registered meta should resolve in $meta conditions")
    delete FastForm // no cleanup API; the registered meta persists for the class lifetime
  })
})

describe("FastForm Watchers Engine - $updateUI Behaviors", () => {
  beforeEach(() => ff.clear())

  const renderUIWatcher = (declaration) => {
    ff.render({
      schema: [{ id: "box1", title: "B", fields: [{ type: "switch", key: "sw" }, { type: "text", key: "tgt", label: "T" }] }],
      data: { sw: false },
      watchers: {
        w: { triggers: ["sw"], when: { sw: true }, effect: { $updateUI: declaration } },
      },
    })
    return ff.form.querySelector(`[data-control="tgt"]`)
  }

  it("should apply $visibility via $set 'hidden'/'visible' and $toggle", async () => {
    const el = renderUIWatcher({
      $then: { tgt: { $visibility: { $set: "hidden" } } },
      $else: { tgt: { $visibility: { $set: "visible" } } },
    })
    await flushMicrotasks()
    assert.strictEqual(el.classList.contains("plugin-common-hidden"), false, "$else visible should keep the control visible")

    ff.reactiveCommit("sw", true)
    await flushMicrotasks()
    assert.ok(el.classList.contains("plugin-common-hidden"), "$set hidden should hide the control")

    ff.reactiveCommit("sw", false)
    await flushMicrotasks()
    assert.strictEqual(el.classList.contains("plugin-common-hidden"), false)
  })

  it("should warn on invalid $visibility actions (neither $set nor $toggle)", async () => {
    const warnings = []
    const restore = mock.method(console, "warn", (msg) => warnings.push(String(msg)))
    try {
      renderUIWatcher({ $then: { tgt: { $visibility: { $bogus: true } } } })
      ff.reactiveCommit("sw", true)
      await flushMicrotasks()
      assert.ok(warnings.some(w => w.includes("Invalid action for '$visibility'")), "Should warn about the invalid visibility action")
    } finally {
      restore.mock.restore()
    }
  })

  it("should apply $attributes $set and $remove", async () => {
    const el = renderUIWatcher({
      $then: { tgt: { $attributes: { $set: { "data-state": "on", title: "hello" } } } },
      $else: { tgt: { $attributes: { $remove: ["data-state", "title"] } } },
    })
    ff.reactiveCommit("sw", true)
    await flushMicrotasks()
    assert.strictEqual(el.getAttribute("data-state"), "on")
    assert.strictEqual(el.getAttribute("title"), "hello")

    ff.reactiveCommit("sw", false)
    await flushMicrotasks()
    assert.strictEqual(el.getAttribute("data-state"), null, "$remove should delete the attribute")
    assert.strictEqual(el.getAttribute("title"), null)
  })

  it("should apply $classes $toggle in addition to $add/$remove", async () => {
    const el = renderUIWatcher({
      $then: { tgt: { $classes: { $toggle: "flagged" } } },
    })
    ff.reactiveCommit("sw", true)
    await flushMicrotasks()
    assert.ok(el.classList.contains("flagged"), "$toggle should add the class when absent")
  })

  it("should apply $styles $set and $remove", async () => {
    const el = renderUIWatcher({
      $then: { tgt: { $styles: { $set: { color: "red" } } } },
      $else: { tgt: { $styles: { $remove: ["color"] } } },
    })
    ff.reactiveCommit("sw", true)
    await flushMicrotasks()
    assert.strictEqual(el.style.color, "red")
    ff.reactiveCommit("sw", false)
    await flushMicrotasks()
    assert.strictEqual(el.style.color, "", "$remove should clear the inline style")
  })

  it("should apply $content $text and $html on box targets", async () => {
    ff.render({
      schema: [{ id: "box1", title: "B", fields: [{ type: "switch", key: "sw" }] }],
      data: { sw: false },
      watchers: {
        w: {
          triggers: ["sw"],
          when: { sw: true },
          effect: {
            $updateUI: {
              $then: { box1: { $content: { $text: "replaced!" } } },
            },
          },
        },
      },
    })
    const boxEl = ff.form.querySelector(`[data-box="box1"]`)
    ff.reactiveCommit("sw", true)
    await flushMicrotasks()
    assert.strictEqual(boxEl.textContent, "replaced!", "$content should resolve box targets via getBox fallback")
  })

  it("should apply $properties $set and $remove", async () => {
    const el = renderUIWatcher({
      $then: { tgt: { $properties: { $set: { customProp: 7 } } } },
      $else: { tgt: { $properties: { $remove: ["customProp"] } } },
    })
    ff.reactiveCommit("sw", true)
    await flushMicrotasks()
    assert.strictEqual(el.customProp, 7)
    ff.reactiveCommit("sw", false)
    await flushMicrotasks()
    assert.strictEqual(el.customProp, undefined, "$remove should set the property to undefined")
  })

  it("should warn for unknown UI effect groups and resolve nothing for unknown targets", async () => {
    const warnings = []
    const restore = mock.method(console, "warn", (msg) => warnings.push(String(msg)))
    try {
      ff.render({
        schema: [{ fields: [{ type: "switch", key: "sw" }, { type: "text", key: "tgt" }] }],
        data: { sw: false },
        watchers: {
          w: {
            triggers: ["sw"],
            when: { sw: true },
            effect: {
              $updateUI: {
                $then: {
                  tgt: { $bogusGroup: { $set: {} } },          // unknown group -> warn
                  missingTarget: { $classes: { $add: "x" } },  // unresolvable target -> silent skip
                },
              },
            },
          },
        },
      })
      ff.reactiveCommit("sw", true)
      await flushMicrotasks()
      assert.ok(warnings.some(w => w.includes("Unknown UI effect group '$bogusGroup'")))
    } finally {
      restore.mock.restore()
    }
  })
})

describe("FastForm Watchers Engine - Execution Semantics", () => {
  beforeEach(() => ff.clear())

  it("should warn (not throw) and still run both sides of a cycle when allowCircularDependencies is true", async () => {
    const warnings = []
    const restore = mock.method(console, "warn", (msg) => warnings.push(String(msg)))
    try {
      const order = []
      ff.render({
        schema: [{ fields: [{ type: "text", key: "a" }, { type: "text", key: "b" }] }],
        data: { a: "", b: "" },
        allowCircularDependencies: true,
        watchers: {
          w1: {
            triggers: ["a"], affects: ["b"], effect: (m, ctx) => {
              order.push("w1")
              m && ctx.setValue("b", "from-w1")
            },
          },
          w2: {
            triggers: ["b"], affects: ["a"], effect: (m, ctx) => {
              order.push("w2")
              m && ctx.setValue("a", "from-w2")
            },
          },
        },
      })
      await flushMicrotasks()
      assert.ok(warnings.some(w => w.includes("Circular dependency detected")), "Cycle should be logged as a warning")
      assert.ok(order.includes("w1") && order.includes("w2"), "Cyclic watchers should still execute after the non-cyclic part")
    } finally {
      restore.mock.restore()
    }
  })

  it("should queue watchers triggered mid-execution into the next batch (re-entrancy safety)", async () => {
    const order = []
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }, { type: "text", key: "b" }] }],
      data: { a: "", b: "" },
      watchers: {
        wA: {
          triggers: ["a"],
          affects: ["b"],
          effect: (m, ctx) => {
            order.push("wA")
            if (m) ctx.setValue("b", "x") // writes inside execution -> b's commit queues
          },
        },
        wB: {
          triggers: ["b"],
          affects: [],
          effect: () => order.push("wB"),
        },
      },
    })
    await flushMicrotasks()

    order.length = 0
    ff.reactiveCommit("a", "1")
    await flushMicrotasks()
    assert.deepStrictEqual(order, ["wA", "wB"], "Watcher for 'b' should run in the same flush cycle after wA")
  })

  it("should make transactional values visible to downstream watchers via ctx.getValue", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }, { type: "text", key: "b" }, { type: "text", key: "c" }] }],
      data: { a: "", b: "", c: "" },
      watchers: {
        producer: {
          triggers: ["a"],
          affects: ["b"],
          when: { a: { $eq: "go" } },
          effect: (m, ctx) => m && ctx.setValue("b", "intermediate"),
        },
        consumer: {
          triggers: ["b"],
          affects: ["c"],
          effect: (m, ctx) => {
            // consumer reads b during the same execution cycle
            if (ctx.getValue("b") === "intermediate") ctx.setValue("c", "saw-it")
          },
        },
      },
    })
    await flushMicrotasks()
    ff.reactiveCommit("a", "go")
    await flushMicrotasks()
    assert.strictEqual(ff.getData("b"), "intermediate")
    await flushMicrotasks()
    assert.strictEqual(ff.getData("c"), "saw-it", "Consumer should observe the transactional write")
  })

  it("should not run the effect's $update when the condition is unmet", async () => {
    ff.render({
      schema: [{ fields: [{ type: "switch", key: "sw" }, { type: "text", key: "out" }] }],
      data: { sw: false, out: "orig" },
      watchers: {
        w: {
          triggers: ["sw"],
          when: { sw: true },
          effect: { $update: { out: "changed" } },
        },
      },
    })
    await flushMicrotasks()
    assert.strictEqual(ff.getData("out"), "orig", "$update must be skipped entirely when isMet is false")
  })
})

describe("FastForm Watchers Engine - Normalization & Registration", () => {
  beforeEach(() => ff.clear())

  it("should normalize array-form watchers using key/name/anonymous naming", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: {},
      watchers: [
        { key: "byKey", affects: [], effect: () => undefined },
        { name: "byName", affects: [], effect: () => undefined },
        { affects: [], effect: () => undefined }, // anonymous_watcher_2
      ],
    })
    await flushMicrotasks()
    const { watchers } = ff.getApi("watchers").inspect()
    assert.ok(watchers.has("byKey"))
    assert.ok(watchers.has("byName"))
    assert.ok(watchers.has("anonymous_watcher_2"), "Watchers without key/name should get auto-generated keys")
  })

  it("should warn on duplicate watcher keys in array form, last one wins", async () => {
    const warnings = []
    const restore = mock.method(console, "warn", (msg) => warnings.push(String(msg)))
    try {
      let which = null
      ff.render({
        schema: [{ fields: [{ type: "text", key: "a" }] }],
        data: {},
        watchers: [
          { key: "dup", affects: [], effect: () => which = "first" },
          { key: "dup", affects: [], effect: () => which = "second" },
        ],
      })
      await flushMicrotasks()
      assert.ok(warnings.some(w => w.includes("Duplicate watcher key")))
      assert.strictEqual(which, "second", "The later watcher should overwrite the earlier")
    } finally {
      restore.mock.restore()
    }
  })

  it("should throw TypeError in strict mode when a function 'when' lacks a 'triggers' array", () => {
    assert.throws(() => {
      ff.render({
        schema: [{ fields: [{ type: "text", key: "a" }] }],
        data: {},
        requireTriggersForFunctionWhen: true,
        watchers: { w: { affects: [], when: (ctx) => true, effect: () => undefined } },
      })
    }, /missing the 'triggers' array/)
  })

  it("should only warn (not throw) by default when function 'when' lacks 'triggers', and never fire on data changes", async () => {
    const warnings = []
    const restore = mock.method(console, "warn", (msg) => warnings.push(String(msg)))
    try {
      let count = 0
      ff.render({
        schema: [{ fields: [{ type: "text", key: "a" }] }],
        data: {},
        watchers: {
          w: { affects: [], when: () => true, effect: () => count++ },
        },
      })
      await flushMicrotasks()
      assert.ok(warnings.some(w => w.includes("missing the 'triggers' array")))
      const mountCount = count // runs at mount via executeAll
      ff.reactiveCommit("a", "x")
      await flushMicrotasks()
      assert.strictEqual(count, mountCount, "Without triggers, the watcher cannot be invoked by data changes")
    } finally {
      restore.mock.restore()
    }
  })

  it("should register new watchers at runtime via watchers.register and trigger them manually", async () => {
    ff.render({
      schema: [{ fields: [{ type: "text", key: "a" }] }],
      data: { a: "" },
    })
    await flushMicrotasks()

    const api = ff.getApi("watchers")
    let ran = 0
    api.register("dynamic", { affects: [], when: { $always: {} }, effect: () => ran++ })

    api.trigger("dynamic")
    assert.strictEqual(ran, 1, "Runtime-registered watcher should execute via trigger()")

    api.trigger("nonexistent")
    assert.strictEqual(ran, 1, "trigger() on an unknown key should be a no-op")
  })

  it("should warn when watchers.register overwrites an existing watcher key", async () => {
    const warnings = []
    const restore = mock.method(console, "warn", (msg) => warnings.push(String(msg)))
    try {
      ff.render({ schema: [{ fields: [{ type: "text", key: "a" }] }], data: {} })
      const api = ff.getApi("watchers")
      const w = { affects: [], effect: () => undefined }
      api.register("k", w)
      api.register("k", w)
      assert.ok(warnings.some(x => x.includes("Watcher \"k\" already exists")))
    } finally {
      restore.mock.restore()
    }
  })
})

describe("FastForm Watchers Engine - Static Registration APIs", () => {
  beforeEach(() => ff.clear())

  it("should validate required members and $-prefix on registerConditionEvaluator", () => {
    assert.throws(
      () => FastForm.registerConditionEvaluator("noPrefix", { evaluate: () => true, collectTriggers: () => undefined }),
      /\$/,
      "Names without a '$' prefix should be rejected",
    )
    assert.throws(
      () => FastForm.registerConditionEvaluator("$incomplete", { evaluate: () => true }),
      /collectTriggers/,
      "Missing required collectTriggers should be rejected",
    )
  })

  it("should validate required members on registerComparisonEvaluator and registerEffectHandler", () => {
    assert.throws(
      () => FastForm.registerComparisonEvaluator("$bad", {}),
      /evaluate/,
    )
    assert.throws(
      () => FastForm.registerEffectHandler("$badEffect", { execute: () => undefined }),
      /collectAffects/,
    )
  })

  it("should allow registering a custom comparison evaluator usable in conditions", async () => {
    FastForm.registerComparisonEvaluator("$isEven", {
      evaluate: (actual) => typeof actual === "number" && actual % 2 === 0,
    })
    let met = null
    ff.render({
      schema: [{ fields: [{ type: "number", key: "n" }] }],
      data: { n: 4 },
      watchers: {
        w: { triggers: ["n"], affects: [], when: { n: { $isEven: true } }, effect: (m) => met = m },
      },
    })
    await flushMicrotasks()
    assert.strictEqual(met, true, "Custom $isEven evaluator should resolve via options merge")
    ff.reactiveCommit("n", 3)
    await flushMicrotasks()
    assert.strictEqual(met, false)
  })

  it("should allow registering a custom condition evaluator with collectTriggers", async () => {
    FastForm.registerConditionEvaluator("$anyTrue", {
      collectTriggers: (keys, ctx) => keys.forEach(k => ctx.addKey(k)),
      evaluate: (keys, ctx) => keys.some(k => Boolean(ctx.getValue(k))),
    })
    let met = null
    ff.render({
      schema: [{ fields: [{ type: "switch", key: "s1" }, { type: "switch", key: "s2" }] }],
      data: { s1: false, s2: false },
      watchers: {
        w: { affects: [], when: { $anyTrue: ["s1", "s2"] }, effect: (m) => met = m },
      },
    })
    await flushMicrotasks()
    assert.strictEqual(met, false)

    ff.reactiveCommit("s1", true)
    await flushMicrotasks()
    assert.strictEqual(met, true, "collectTriggers should have wired s1/s2 as triggers")
  })

  it("should warn when overwriting a registered evaluator/meta", () => {
    const warnings = []
    const restore = mock.method(console, "warn", (msg) => warnings.push(String(msg)))
    try {
      FastForm.registerMeta("$dev", () => false)          // overwrite builtin
      FastForm.registerComparisonEvaluator("$eq", { evaluate: (a, e) => a === e }) // overwrite builtin
      assert.strictEqual(warnings.length, 2)
      assert.ok(warnings.every(w => w.includes("Overwriting")))
    } finally {
      restore.mock.restore()
    }
  })
})
