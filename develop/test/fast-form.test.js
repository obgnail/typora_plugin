const { describe, it, mock, before, beforeEach, after, afterEach } = require("node:test")
const assert = require("node:assert")
const proxyquire = require("proxyquire")
const { JSDOM } = require("jsdom")

let i18n, utils
let dom, container
let FastForm, ff

function mockUtils() {
    return utils = {
        ...require("./mocks/utils.mock.js"),
        notification: { show: mock.fn((msg, type) => `notification.${type}: ${msg}`) },
        hotkeyHub: { unregister: mock.fn((hotkey) => `hotkeyHub.unregister: ${hotkey}`) },
        formDialog: { modal: mock.fn(async (op) => ({ response: 1, data: op.data })) },
    }
}

async function mockI18N() {
    return i18n = await require("./fixtures/i18n.js").get("en")
}

function mockDom() {
    const root = `<!DOCTYPE html><html><body><div id="test-container"></div></body></html>`
    dom = new JSDOM(root, { url: "http://localhost/", runScripts: "dangerously" })

    // setupGlobalVars
    global.window = dom.window
    global.document = dom.window.document
    global.navigator = { userAgent: "node.js" }
    const globalsToForceOverwrite = ["Event", "CustomEvent", "HTMLElement", "customElements", "Node"]
    globalsToForceOverwrite.forEach(key => {
        global[key] = dom.window[key]
    })
    Object.getOwnPropertyNames(dom.window).forEach((key) => {
        if (typeof global[key] === "undefined") {
            global[key] = dom.window[key]
        }
    })

    return dom
}

before(async () => {
    await mockI18N()
    mockUtils()
    mockDom()

    proxyquire("../../plugin/global/core/components/fast-form.js", {
        "./common": { sharedSheets: [new CSSStyleSheet()], "@noCallThru": true },
        "../utils": { ...utils, "@noCallThru": true },
        "../i18n": { ...i18n, "@noCallThru": true },
    })

    FastForm = customElements.get("fast-form")
    ff = new FastForm()
    container = document.getElementById("test-container")
    container.appendChild(ff)
})

const flushMicrotasks = () => Promise.resolve()

describe("Browser env", () => {
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
                controlOptions: { defaultSize: "large" }
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
                featureOptions: { enable: true }
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
                username: (val) => String(val).trim().toLowerCase()
            }
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
                    return `${ctx.key}_${ctx.type}_${val}`
                }
            }
        })
        ff.validateAndCommit("dynamicField", "testVal", "set")

        assert.ok(capturedContext !== null, "Parser should receive the context argument")
        assert.strictEqual(capturedContext.key, "dynamicField", "Context should contain the correct field key")
        assert.strictEqual(capturedContext.type, "set", "Context should contain the correct commit type")
        assert.strictEqual(ff.getData("dynamicField"), "dynamicField_set_testVal", "Value should be transformed using context properties")
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
            "Data should remain unmodified when bypassing the parsing pipeline"
        )
    })

    it("should allow dynamic registration and retrieval of parsers via the parsing API at runtime", async () => {
        ff.render({
            schema: [{ fields: [{ type: "text", key: "tag" }] }],
            data: { tag: "" }
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
            data: { faultyField: "" }
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
                username: "required" // Built-in validator
            },
            hooks: {
                onValidateFailed: (errors) => validationErrors = errors
            }
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
                age: { validator: "min", args: [18] }
            },
            hooks: {
                onValidateFailed: (errors) => validationErrors = errors
            }
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
                }
            },
            hooks: {
                onValidateFailed: (errors) => validationErrors = errors
            }
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
                    $each: { validator: "max", args: [100] }     // Every single item cannot exceed 100
                }
            },
        })

        // Scenario 1: Validate $each using push mutation
        const isPushValid = ff.validateAndCommit("scores", 105, "push")
        assert.strictEqual(isPushValid, false, "Should reject push mutation because the new item fails the $each 'max: 100' rule")
        assert.strictEqual(ff.getData("scores").length, 2, "Array should remain unchanged after rejected push")

        // Scenario 2: Validate $each using deep path set mutation
        const isDeepSetValid = ff.validateAndCommit("scores.0", 105, "set")
        assert.strictEqual(isDeepSetValid, false, "Should reject specific index mutation because it fails the $each rule")

        // Scenario 3: Validate $self using bulk set mutation
        const isBulkSetValid = ff.validateAndCommit("scores", [90, 85, 80, 75], "set")
        assert.strictEqual(isBulkSetValid, false, "Should reject setting 4 items because it fails the $self 'maxItems: 3' rule")

        // Scenario 4: Valid push
        const isOk = ff.validateAndCommit("scores", 95, "push")
        assert.strictEqual(isOk, true, "Valid item push should pass both $self and $each rules")
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
                    { validator: "pattern", args: [/^[a-z]+$/] }
                ]
            },
            hooks: {
                onValidateFailed: (errors) => validationErrors = errors
            }
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
                    }
                }
            }
        })

        assert.strictEqual(executionCount, 1, "Watcher should run once during the mount phase")
        ff.reactiveCommit("source", "new_value")
        await flushMicrotasks()

        assert.strictEqual(executionCount, 2, "Watcher should run again after source update")
        assert.strictEqual(ff.getData("target"), "new_value_mutated", "Target field should be correctly updated via ctx.setValue")
    })

    it("should update data declaratively using $update with both static and function values", async () => {
        ff.render({
            schema: [{ fields: [{ type: "text", key: "firstName" }, { type: "text", key: "lastName" }, { type: "text", key: "fullName" }, { type: "text", key: "staticTag" }] }],
            data: { firstName: "John", lastName: "Doe", fullName: "", staticTag: "" },
            watchers: {
                syncWatcher: {
                    triggers: ["firstName", "lastName"],
                    effect: {
                        $update: {
                            fullName: (ctx) => `${ctx.getValue("firstName")} ${ctx.getValue("lastName")}`,
                            staticTag: "updated_tag" // Static value update
                        }
                    }
                }
            }
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
                    effect: { $update: { status: "active" } }
                }
            }
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
                            { $or: [{ role: { $eq: "admin" } }, { role: { $eq: "moderator" } }] }
                        ]
                    },
                    effect: { $update: { category: "privileged_adult" } }
                }
            }
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
                    effect: { $update: { b: (ctx) => ctx.getValue("a") * 2 } }
                },
                watcherC: {
                    triggers: ["b"],
                    affects: ["c"],
                    effect: { $update: { c: (ctx) => ctx.getValue("b") + 10 } }
                }
            }
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
                            $else: { targetField: { $classes: { $remove: "plugin-common-hidden" } } }
                        }
                    }
                }
            }
        })

        const targetEl = ff.form.querySelector('.control[data-control="targetField"]')

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
                    w2: { triggers: ["b"], affects: ["a"], effect: { $update: { a: "1" } } }
                }
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
                        }
                    }
                }
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
                    }
                }
            }
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
                    }
                }
            }
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
                    { type: "text", key: "targetInput", dependencies: { enableInput: true } }
                ]
            }],
            data: { enableInput: false, targetInput: "" }
        })

        await flushMicrotasks()

        const targetControl = ff.form.querySelector('.control[data-control="targetInput"]')

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
                        dependencyUnmetAction: "hide" // Explicitly overriding the default
                    }
                ]
            }],
            data: { enableInput: false, targetInput: "" }
        })

        await flushMicrotasks()
        const targetControl = ff.form.querySelector('.control[data-control="targetInput"]')

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
                    { type: "text", key: "step3", dependencies: { $follow: "step2" } } // step3 follows step2's availability
                ]
            }],
            data: { step1: false, step2: true, step3: "" }
        })

        await flushMicrotasks()
        const step3Control = ff.form.querySelector('.control[data-control="step3"]')

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
                    { type: "text", key: "innerInput" }
                ]
            }],
            data: { showBox: false, innerInput: "" }
        })

        await flushMicrotasks()
        const boxContainer = ff.form.querySelector('.box-container[data-box="conditionalBox"]')

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
                    fields: [{ type: "text", key: "sensitiveData" }]
                },
                { // Helper box to toggle the dependency
                    id: "helperBox",
                    fields: [{ type: "switch", key: "enableFeature" }]
                }
            ],
            data: { enableFeature: true, sensitiveData: "Initial Secret" },
            destroyStateOnHide: true // Enable strict state management
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
                    value: "Beijing" // Static string value
                }
            }
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
                    value: (ctx) => Number.parseInt(ctx.getValue("basePrice") * (1 + ctx.getValue("tax")))
                }
            }
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
                    value: ""
                }
            }
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
                    value: { theme: "dark" } // Object payload
                }
            },
            watchers: {
                // Monitor the cascade target to verify if redundant updates occur
                monitorConfig: {
                    triggers: ["config"],
                    affects: [],
                    effect: () => {
                        downstreamTriggerCount++
                    }
                }
            }
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
                    value: "New Value"
                    // Missing 'target'
                },
                missingValueRule: {
                    triggers: ["source"],
                    target: "source"
                    // Missing 'value'
                }
            }
        })

        const api = ff.getApi("watchers")
        const state = api.inspect()

        assert.strictEqual(warningMessages.length, 2, "Should emit two console warnings for the malformed rules")
        assert.ok(warningMessages[0].includes('missing a "target" or "value"'), "Warning should pinpoint the exact issue")

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
                    Controls.Password("password").Label("Password")
                )
            ],
            data: {}
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

    it("should construct complex dependency structures properly using the Dep utility", () => {
        ff.render({
            schema: ({ Group, Controls, Dep }) => [
                Group("Dependencies",
                    Controls.Text("targetField")
                        .ShowIf(Dep.and(
                            Dep.eq("role", "admin"),
                            Dep.or(Dep.eq("status", "active"), Dep.true("isOverride"))
                        ))
                )
            ],
            data: {}
        })

        const targetField = ff.options.schema[0].fields[0]
        const expectedDependencies = {
            $and: [
                { role: "admin" },
                { $or: [{ status: "active" }, { isOverride: true }] }
            ]
        }

        assert.deepStrictEqual(
            targetField.dependencies,
            expectedDependencies,
            "Dep utility should generate a correct, deeply nested dependency AST"
        )
    })

    it("should seamlessly upgrade the field type from 'number' to 'unit' when .Unit() is called", () => {
        ff.render({
            schema: ({ Group, Controls }) => [
                Group(
                    Controls.Number("price").Label("Price").Unit("$"), // Type upgrade happens here
                    Controls.Number("quantity").Label("Quantity")      // Remains regular number
                )
            ],
            data: {}
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
                        undefined // Undefined edge case
                    ),
                    undefined,
                ]
            },
            data: {}
        })
        assert.strictEqual(ff.options.schema.length, 1, "Engine should filter out null or undefined group cleanly")
        const fields = ff.options.schema[0].fields
        assert.strictEqual(fields.length, 1, "Engine should filter out null or undefined fields cleanly")
        assert.strictEqual(fields[0].key, "basic", "Only the valid field should remain")
    })

    it("should correctly resolve dynamically appended nested schemas via .Tab()", () => {
        ff.render({
            schema: ({ Group, Controls }) => [
                Group(
                    Controls.Tabs("configTabs")
                        .TabPosition("left")
                        .Tab({
                            label: "Network",
                            value: "network",
                            schema: [Group(Controls.Text("ip").Label("IP Address"))]
                        })
                        .Tab({
                            label: "Security",
                            value: "security",
                            schema: [Group(Controls.Switch("firewall").Label("Enable Firewall"))]
                        })
                )
            ],
            data: {}
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
            schema: ({ Group, Controls }) => [Group(Controls.Text("field1").CustomProp("custom_value"))],
            data: {}
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
                        { type: "switch", key: "notifications" }
                    ]
                }],
                data: { username: "admin", notifications: false }
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
                        { type: "range", key: "volume", min: 0, max: 10, step: 0.5 }
                    ]
                }],
                data: { age: 20, weight: 60, volume: 5 },
                hooks: {
                    onValidateFailed: (errors) => validationErrors = errors
                }
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
                            disabledOptions: ["gaming"] // Gaming is disabled
                        }
                    ]
                }],
                data: { hobbies: ["reading"] }
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
                "Checkbox group should commit an array of checked values"
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
                data: { config: { valid: true } }
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
                    fields: [{ type: "array", key: "tags" }] // allowDuplicates defaults to false in controlOptions
                }],
                data: { tags: ["js", "ts"] },
                hooks: {
                    onValidateFailed: (errors) => validationErrors = errors
                }
            })

            await flushMicrotasks()

            // Attempt to push a duplicate
            const isOk = ff.validateAndCommit("tags", "js", "push")

            assert.strictEqual(isOk, false, "Should reject pushing a duplicate item")
            assert.equal(validationErrors[0].message, i18n.t("settings", "error.duplicateValue"), "Should emit duplicate error")
            assert.deepStrictEqual(ff.getData("tags"), ["js", "ts"], "Array should remain unchanged")

            // Attempt to push a unique item
            const isValid = ff.validateAndCommit("tags", "golang", "push")
            assert.strictEqual(isValid, true, "Should allow pushing a unique item")
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
                        subSchema: [{ fields: [{ type: "number", key: "retryCount" }] }]
                    }]
                }],
                data: { advancedSettings: false } // Initially disabled
            })

            await flushMicrotasks()

            const compositeWrapper = ff.form.querySelector('.control[data-control="advancedSettings"]')
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
                            { label: "Security", value: "security", schema: [] }
                        ]
                    }]
                }],
                data: {}
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
                    }
                }
            })

            await flushMicrotasks()

            const actionEl = ff.form.querySelector('.control[data-control="pingServer"]')
            actionEl.dispatchEvent(new window.Event("click", { bubbles: true }))
            assert.ok(actionTriggered, "Action callback should be executed on click")
        })

        it("Control_Hotkey: should format and capture key combinations", async () => {
            ff.render({
                schema: [{ fields: [{ type: "hotkey", key: "shortcut" }] }],
                data: { shortcut: "" }
            })

            await flushMicrotasks()

            const hotkeyInput = ff.form.querySelector(".hotkey-input")

            // Simulate pressing Ctrl+Shift+S
            const keydownEvent = new window.Event("keydown", { bubbles: true })
            keydownEvent.key = "s"
            keydownEvent.ctrlKey = true
            keydownEvent.shiftKey = true

            hotkeyInput.dispatchEvent(keydownEvent)
            await flushMicrotasks() // Wait for the debounce logic defined in Control_Hotkey (if any) or normal cycles

            assert.strictEqual(hotkeyInput.value, "ctrl+shift+s", "Input value should reflect the formatted key combination")
        })
    })
})
