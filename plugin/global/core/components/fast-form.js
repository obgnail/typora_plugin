const { sharedSheets } = require("./common")
const { utils } = require("../utils")
const { i18n } = require("../i18n")

class FastForm extends HTMLElement {
    static template = `<link rel="stylesheet" href="./plugin/global/styles/plugin-fast-form.css" crossorigin="anonymous"><div id="form"></div>`
    static controls = {}
    static controlOptions = {}
    static features = {}
    static featureOptions = {}
    static hooks = {
        onSchemaReady: (schema, form) => schema,
        onRender: (form) => void 0,
        onProcessValue: (changeContext) => changeContext.value,
        onBeforeValidate: (changeContext) => void 0,         // return true or [] for success; return Error or [Error, ...] for failure
        onValidate: (changeContext) => void 0,               // return true or [] for success; return Error or [Error, ...] for failure
        onAfterValidate: (changeContext, errors) => void 0,  // return true or [] for success; return Error or [Error, ...] for failure
        onValidateFailed: (changeContext, errors) => {
            if (!Array.isArray(errors) || errors.length === 0) return
            const err = errors[0]  // show first error only
            const msg = (typeof err.message === "string")
                ? err.message || err.toString()
                : typeof err === "string"
                    ? err
                    : "Verification Failed"  // fallback
            utils.notification.show(msg, "error")
        },
        onBeforeCommit: (changeContext, form) => void 0,
        onCommit: (changeContext, form) => form.dispatchEvent(new CustomEvent("form-crud", { detail: changeContext })),
        onAfterCommit: (changeContext, form) => void 0,
    }

    static registerControl(name, definition) {
        if (!definition || typeof definition !== "object") {
            throw new Error(`Control Error: The definition for control '${name}' must be a non-null object.`)
        }
        if (typeof definition.create !== "function") {
            throw new Error(`Control Error: control '${name}' must have a 'create' function.`)
        }
        const optionalFunctions = ["update", "bindEvents", "setup", "onFormInit", "onMount"]
        for (const funcName of optionalFunctions) {
            if (definition.hasOwnProperty(funcName) && typeof definition[funcName] !== "function") {
                throw new Error(`Control Error: The '${funcName}' property for control '${name}' must be a function.`)
            }
        }
        if (definition.hasOwnProperty("controlOptions")) {
            if (typeof definition.controlOptions !== "object" || definition.controlOptions === null || Array.isArray(definition.controlOptions)) {
                throw new Error(`Control Error: The 'controlOptions' property for control '${name}' must be a plain object.`)
            }
        }
        if (this.controls.hasOwnProperty(name)) {
            console.warn(`FastForm Warning: Overwriting control definition for type '${name}'.`)
        }
        this.controls[name] = definition
        if (definition.controlOptions) {
            this.controlOptions[name] = definition.controlOptions
        }
    }

    static registerFeature(name, definition) {
        if (!definition) {
            throw new Error(`Feature Error: feature '${name}' must be non-null.`)
        }
        if (definition.hasOwnProperty("normalize") && typeof definition.normalize !== "function") {
            throw new Error(`Feature Error: 'normalize' for '${name}' must be a function.`)
        }
        if (this.features.hasOwnProperty(name)) {
            console.warn(`FastForm Warning: Overwriting feature definition for '${name}'.`)
        }
        this.features[name] = definition
        if (definition.featureOptions && typeof definition.featureOptions === "object") {
            Object.assign(this.featureOptions, definition.featureOptions)
        }
        if (typeof definition.install === "function") {
            definition.install(this)
        }
    }

    constructor() {
        super()
        const root = this.attachShadow({ mode: "open" })
        root.adoptedStyleSheets = sharedSheets
        root.innerHTML = this.constructor.template

        this.form = root.querySelector("#form")
        this.space = {}
        this.options = {}
        this._runtime = {
            fields: {},
            cleanups: [],
            pendingChanges: new Map(),
            isTaskQueued: false,
        }
    }

    disconnectedCallback() {
        this._runAllCleanups()
    }

    render = (options) => {
        this._runAllCleanups()

        this.space = {}
        this.options = this._initOptions(options)
        this._normalizeControls(this.options)
        this._normalizeFeatures(this.options)
        this._initInternalState(this.options)

        this.options.schema = this._invokeHook("onSchemaReady", this.options.schema, this) || this.options.schema

        this._fillForm(this.options.schema, this.form)
        this._bindAllEvents(this.options.controls)
        this._invokeHook("onRender", this)
    }

    _initOptions(options) {
        const {
            schema = [],
            data = {},
            actions = {},
            hooks = {},
            controls = {},
            controlOptions = {},
            ...rest
        } = options

        const fixed = {
            schema: utils.naiveCloneDeep(schema),
            data: utils.naiveCloneDeep(data),
            actions: { ...actions },
            hooks: { ...this.constructor.hooks, ...hooks },
            controls: { ...this.constructor.controls, ...controls },
            controlOptions: { ...this.constructor.controlOptions, ...controlOptions },
        }

        return { ...this.constructor.featureOptions, ...fixed, ...rest }
    }

    registerCleanup = (cleanup) => {
        if (typeof cleanup === "function") {
            this._runtime.cleanups.push(cleanup)
        }
    }

    traverseFields = (visitorFn, schema = this.options.schema, parentField = null) => {
        for (const box of schema) {
            for (const field of box.fields || []) {
                visitorFn(field, parentField, box)
                if (Array.isArray(field.subSchema)) {
                    this.traverseFields(visitorFn, field.subSchema, field)
                }
            }
        }
    }

    getControlOptions = (field) => {
        if (!field) return {}
        const defaults = this.constructor.controlOptions[field.type] || {}
        const formLevel = this.options.controlOptions[field.type] || {}
        const instanceLevel = defaults ? utils.pick(field, Object.keys(defaults)) : {}
        return { ...defaults, ...formLevel, ...instanceLevel }
    }

    getControlOptionsFromKey = (key) => this.getControlOptions(this.getField(key))

    getField = (key) => this._runtime.fields[key]

    getData = (key) => utils.nestedPropertyHelpers.get(this.options.data, key)
    setData = (key, value, type = "set") => utils.nestedPropertyHelpers[type](this.options.data, key, value)

    // type: set/push/removeIndex
    setFieldValue = (key, value, type = "set") => {
        this._runtime.pendingChanges.set(key, { key, value, type })
        // Ensures that multiple synchronous calls to `setFieldValue` result in only one batch update.
        if (this._runtime.isTaskQueued) return

        this._runtime.isTaskQueued = true

        // Processes all pending changes in a single batch.
        queueMicrotask(() => {
            const changesToProcess = new Map(this._runtime.pendingChanges)
            this._runtime.pendingChanges.clear()
            // Reset the flag to allow new tasks to be queued for the next event loop tick.
            this._runtime.isTaskQueued = false

            if (changesToProcess.size === 0) return

            const successfullyChangedKeys = new Set()
            for (const changeContext of changesToProcess.values()) {
                const isValid = this._processSingleChange(changeContext)
                if (isValid) {
                    successfullyChangedKeys.add(changeContext.key)
                }
            }
            successfullyChangedKeys.forEach(key => this.forceUpdateControl(key))
        })
    }

    _processSingleChange(changeContext) {
        if (changeContext.type !== "removeIndex") {
            changeContext.value = this._invokeHook("onProcessValue", changeContext)
        }
        const errors = (changeContext.type !== "removeIndex") ? this._validate(changeContext) : []
        const isValid = Array.isArray(errors) && errors.length === 0
        if (isValid) {
            this._invokeHook("onBeforeCommit", changeContext, this)
            this.setData(changeContext.key, changeContext.value, changeContext.type)
            this._invokeHook("onCommit", changeContext, this)
            this._invokeHook("onAfterCommit", changeContext, this)
        } else {
            this._invokeHook("onValidateFailed", changeContext, errors)
        }
        return isValid
    }

    _validate(changeContext) {
        const beforeHookResult = this._invokeHook("onBeforeValidate", changeContext)
        if (beforeHookResult === true || (Array.isArray(beforeHookResult) && beforeHookResult.length === 0)) return []
        if (beforeHookResult instanceof Error) return [beforeHookResult]
        if (Array.isArray(beforeHookResult) && beforeHookResult.length > 0) return beforeHookResult
        const errors = this._invokeHook("onValidate", changeContext) || []
        const afterHookResult = this._invokeHook("onAfterValidate", changeContext, errors)
        if (afterHookResult === true || (Array.isArray(afterHookResult) && afterHookResult.length === 0)) return []
        if (afterHookResult instanceof Error) return [afterHookResult]
        if (Array.isArray(afterHookResult) && afterHookResult.length > 0) return afterHookResult

        return errors
    }

    validateAndCommit = (key, value, type = "set") => {
        const changeContext = { key, value, type }
        const oldValue = this.getData(key)
        const isValid = this._processSingleChange(changeContext)
        if (!isValid) {
            this.forceUpdateControl(key, oldValue)
        }
        return isValid
    }

    // Synchronized version function of `setFieldValue`
    reactiveCommit = (key, value, type = "set") => {
        const isValid = this.validateAndCommit(key, value, type)
        if (isValid) {
            this.forceUpdateControl(key)
        }
        return isValid
    }

    forceUpdateControl = (key, value) => {
        if (!key) return
        const field = this.getField(key)
        if (!field) return

        const controlDef = this.options.controls[field.type]
        if (!controlDef || typeof controlDef.update !== "function") return

        const element = this.options.layout.findControl(key, this.form)
        if (!element) return

        const updateContext = {
            element,
            field,
            form: this,
            data: this.options.data,
            value: (value === undefined) ? this.getData(key) : value,
            controlOptions: this.getControlOptions(field),
        }
        controlDef.update(updateContext)
    }

    controlOnMount = (field) => {
        if (!field.key) return

        const controlDef = this.options.controls[field.type]
        if (controlDef && typeof controlDef.onMount === "function") {
            const element = this.options.layout.findControl(field.key, this.form)
            if (element) {
                const mountContext = { element, field, form: this }
                controlDef.onMount(mountContext)
            }
        }
    }

    getFormElement = () => this.form

    _fillForm(schema, container, updateControl = true) {
        const layout = this.options.layout
        const createControl = (field) => {
            const controlDef = this.options.controls[field.type]
            if (!controlDef) {
                console.warn(`FastForm Warning: No control registered for type "${field.type}".`)
                return ""
            }
            const controlOptions = this.getControlOptions(field)
            const controlContext = { field, controlOptions, form: this }
            const controlHTML = controlDef.create(controlContext)
            return layout.createControlContainer(field, controlHTML, controlOptions.className)
        }
        const createBoxContainer = (box, idx) => {
            const titleHTML = layout.createTitle(box)
            const controlHTMLs = (box.fields || []).map(createControl)
            const boxHTML = layout.createBox(controlHTMLs)
            const containerId = layout.genBoxContainerId(box, idx)
            return layout.createBoxContainer(containerId, titleHTML, boxHTML)
        }
        container.innerHTML = schema.map(createBoxContainer).join("")

        if (updateControl) {
            this.traverseFields(field => this.forceUpdateControl(field.key), schema)
            this.traverseFields(field => this.controlOnMount(field), schema)
        }
    }

    _runAllCleanups() {
        this._runtime.cleanups.forEach(cleanup => cleanup())
        this._runtime.cleanups = []
    }

    _bindAllEvents(controls) {
        for (const control of Object.values(controls)) {
            if (typeof control.bindEvents === "function") {
                control.bindEvents({ form: this, space: this.space })
            }
        }
    }

    _normalizeControls = (options) => {
        this.traverseFields(field => {
            const control = options.controls[field.type]
            if (control && typeof control.setup === "function") {
                control.setup({ field, options, form: this })
            }
        })
        for (const control of Object.values(options.controls)) {
            if (typeof control.onFormInit === "function") {
                control.onFormInit({ options, form: this, space: this.space })
            }
        }
    }

    _normalizeFeatures = (options) => {
        const featureContext = { form: this, options }
        for (const feature of Object.values(this.constructor.features)) {
            if (typeof feature.normalize === "function") {
                feature.normalize(featureContext)
            }
        }
    }

    _initInternalState = (options) => {
        const collectFields = () => {
            const fields = {}
            this.traverseFields(field => {
                if (field.key) {
                    fields[field.key] = field
                }
            }, options.schema)
            return fields
        }
        this._runtime.fields = collectFields()
    }

    _invokeHook(hookName, ...args) {
        const fn = this.options.hooks[hookName]
        if (typeof fn === "function") {
            return fn(...args)
        }
    }
}

function defineFeature(feature) {
    return feature
}

function defineConditionEvaluator(evaluator) {
    return evaluator
}

function defineComparisonEvaluator(evaluator) {
    return evaluator
}

function defineEffectHandler(handler) {
    return handler
}

function defineValidator(validator) {
    return validator
}

function defineControl(control) {
    return control
}

function compileMatchers({ source, strategy, processValue, errorContext }) {
    if (!source || typeof source !== "object") {
        return []
    }
    const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return Object.entries(source).map(([key, rawValue]) => {
        const payload = processValue(rawValue, key)
        if (payload == null) return
        try {
            const exp = (strategy === "regex")
                ? key
                : (strategy === "wildcard")
                    ? `^${escapeRegex(key).replace(/\\\*/g, ".*")}$`
                    : `^${escapeRegex(key)}$`
            const regex = new RegExp(exp)
            return { key, regex, ...payload }
        } catch (e) {
            throw new Error(`Invalid ${errorContext} pattern for '${strategy}' mode: '${key}'.`)
        }
    }).filter(Boolean)
}

const Feature_EventDelegation = defineFeature({
    install: (FastFormClass) => {
        /**
         * onEvent(events, handler, [options])                 -- onEvent("click", Fn)
         * onEvent(events, selector, handler, [options])       -- onEvent("click", ".my-button", Fn)
         * onEvent(events, selector, data, handler, [options]) -- onEvent("click", ".my-button", { id: 123 }, Fn)
         * onEvent(eventsMap, [options])                       -- onEvent({ click: Fn1, mouseenter: Fn2 })
         * onEvent(eventsMap, selector, [options])             -- onEvent({ click: Fn1, mouseenter: Fn2 }, ".my-button")
         * onEvent(eventsMap, selector, data, [options])       -- onEvent({ click: Fn1, mouseenter: Fn2 }, ".my-button", { id: 456 })
         */
        FastFormClass.prototype.onEvent = function (...args) {
            const form = this.getFormElement()
            if (!form) return this

            let events, selector, data, handler, options

            const lastArg = args[args.length - 1]
            if (lastArg == null || typeof lastArg === "boolean" || typeof lastArg === "object") {
                options = args.pop() // The last parameter is `options`
            }
            handler = args.pop() // The second to last parameter is `handler`
            events = args.shift()
            if (args.length > 0) {
                selector = (typeof args[0] === "string") ? args.shift() : null
            }
            if (args.length > 0) {
                data = args.shift()
            }

            // EventsMap
            if (typeof events === "object" && events !== null) {
                for (const type of Object.keys(events)) {
                    this.onEvent(type, selector, data, events[type], options)
                }
                return this
            }

            if (!events || typeof events !== "string") {
                throw new Error(`event must be a string/object: ${events}`)
            }

            const eventTypes = events.split(" ").filter(Boolean) // Multiple event string: "click mouseover"
            for (const eventType of eventTypes) {
                const listener = (ev) => {
                    if (data) {
                        ev.data = data
                    }
                    if (!selector) {
                        handler.call(ev.currentTarget, ev)
                    } else {
                        const target = ev.target.closest(selector)
                        if (target) {
                            handler.call(target, ev)
                        }
                    }
                }

                form.addEventListener(eventType, listener, options)
                this.registerCleanup(() => form.removeEventListener(eventType, listener, options))
            }
            return this
        }
    }
})

const Feature_DefaultKeybindings = defineFeature({
    normalize: ({ options }) => {
        const originalOnRender = options.hooks.onRender
        options.hooks.onRender = (formInstance) => {
            formInstance.onEvent("keydown", "input:not(.hotkey-input), textarea", function (ev) {
                if (ev.key === "a" && utils.metaKeyPressed(ev)) {
                    this.select()
                    ev.stopPropagation()
                    ev.preventDefault()
                }
            })
            originalOnRender(formInstance)
        }
    }
})

const Feature_Watchers = (() => {
    const instanceStates = new WeakMap()

    const getState = (form) => {
        if (!instanceStates.has(form)) {
            instanceStates.set(form, { watchers: new Map(), watchTriggerMap: {}, watcherTriggerCache: new Map() })
        }
        return instanceStates.get(form)
    }

    const clearState = (form) => {
        const state = getState(form)
        state.watchers.clear()
        state.watchTriggerMap = {}
        state.watcherTriggerCache.clear()
    }

    const _conditionEvaluators = {
        $and: {
            collectTriggers: (cond, ctx) => cond.forEach(subCond => ctx.collectTriggers(subCond)),
            evaluate: (cond, ctx) => cond.every(subCond => ctx.evaluate(subCond)),
        },
        $or: {
            collectTriggers: (cond, ctx) => cond.forEach(subCond => ctx.collectTriggers(subCond)),
            evaluate: (cond, ctx) => cond.some(subCond => ctx.evaluate(subCond)),
        },
        $not: {
            collectTriggers: (cond, ctx) => ctx.collectTriggers(cond),
            evaluate: (cond, ctx) => !ctx.evaluate(cond),
        },
        $never: {
            collectTriggers: (cond, ctx) => void 0,
            evaluate: (cond, ctx) => false,
        },
        $always: {
            collectTriggers: (cond, ctx) => void 0,
            evaluate: (cond, ctx) => true,
        },
    }

    const _comparisonEvaluators = {
        $eq: { evaluate: (actual, expected) => actual === expected },
        $ne: { evaluate: (actual, expected) => actual !== expected },
        $gt: { evaluate: (actual, expected) => actual > expected },
        $gte: { evaluate: (actual, expected) => actual >= expected },
        $lt: { evaluate: (actual, expected) => actual < expected },
        $lte: { evaluate: (actual, expected) => actual <= expected },
        $in: { evaluate: (actual, expected) => Array.isArray(expected) && expected.includes(actual) },
        $bool: { evaluate: (actual, expected) => Boolean(actual) === expected },
        $deepEqual: { evaluate: (actual, expected) => utils.deepEqual(actual, expected) },
    }

    const _effectHandlers = {
        $set: {
            collectAffects: (fieldKeys) => Object.keys(fieldKeys || {}),
            execute: (isConditionMet, value, context) => {
                if (!isConditionMet) return
                Object.entries(value).forEach(([key, val]) => {
                    const resolvedValue = (typeof val === "function") ? val(context) : val
                    if (!utils.deepEqual(resolvedValue, context.getValue(key))) {
                        context.setValue(key, resolvedValue)
                    }
                })
            }
        },
        $ui: {
            collectAffects: (keys) => Object.keys(keys).map(key => `@ui/${key}`),
            execute: (isConditionMet, value, context) => {
                Object.entries(value).forEach(([targetKey, actions]) => {
                    const el = context.getControl(targetKey) || context.getBox(targetKey)
                    if (!el) return
                    const fns = {
                        toggleClass: (params) => el.classList.toggle(params, isConditionMet),
                        addClass: (params) => isConditionMet && el.classList.add(params),
                        removeClass: (params) => isConditionMet && el.classList.remove(params),
                        setAttribute: (params) => isConditionMet ? el.setAttribute(params[0], params[1]) : el.removeAttribute(params[0]),
                        setProperty: (params) => isConditionMet && (el[params[0]] = params[1]),
                        toggleInvisible: () => utils.toggleInvisible(el, !isConditionMet),
                    }
                    Object.entries(actions).forEach(([action, params]) => {
                        const fn = fns[action]
                        if (fn) fn(params)
                    })
                })
            }
        },
    }

    function evaluateCondition(form, cond) {
        const context = {
            comparisonEvaluators: form.options.comparisonEvaluators,
            evaluate: (subCond) => evaluateCondition(form, subCond),
            getValue: (key) => form.getData(key),
            getField: (key) => form.getField(key),
            compare: (actual, finalCond, defaultOperator = "$eq") => {
                if (finalCond == null || typeof finalCond !== "object") {
                    finalCond = { [defaultOperator]: finalCond }
                }
                return Object.entries(finalCond).every(([operator, expected]) => {
                    const handler = form.options.comparisonEvaluators[operator]
                    if (handler && typeof handler.evaluate === "function") {
                        return handler.evaluate(actual, expected)
                    } else {
                        console.warn(`FastForm Warning: Unknown comparison operator "${operator}".`)
                        return false
                    }
                })
            },
        }

        for (const [evaluatorName, handler] of Object.entries(form.options.conditionEvaluators)) {
            if (cond.hasOwnProperty(evaluatorName)) {
                let value = cond[evaluatorName]
                if (typeof handler.beforeEvaluate === "function") {
                    value = handler.beforeEvaluate(value, context)
                }
                return handler.evaluate(value, context)
            }
        }

        return Object.entries(cond).every(([key, expectedCond]) => {
            let actualValue = context.getValue(key)
            if (typeof expectedCond !== "object" || expectedCond === null) {
                return context.compare(actualValue, expectedCond)
            }
            return Object.entries(expectedCond).every(([operator, expectedValue]) => {
                const handler = form.options.comparisonEvaluators[operator]
                if (!handler) {
                    console.warn(`FastForm Warning: Unknown comparison operator "${operator}".`)
                    return false
                }
                if (typeof handler.beforeEvaluate === "function") {
                    [actualValue, expectedValue] = handler.beforeEvaluate(actualValue, expectedValue, context)
                }
                return handler.evaluate(actualValue, expectedValue)
            })
        })
    }

    function collectConditionTriggers(form, cond, keys = new Set()) {
        const context = {
            collectTriggers: (subCond) => collectConditionTriggers(form, subCond, keys),
            getField: (key) => form.getField(key),
            addKey: (key) => keys.add(key)
        }
        for (const [evaluatorName, handler] of Object.entries(form.options.conditionEvaluators)) {
            if (cond.hasOwnProperty(evaluatorName)) {
                let value = cond[evaluatorName]
                if (typeof handler.beforeEvaluate === "function") {
                    value = handler.beforeEvaluate(value, context)
                }
                handler.collectTriggers(value, context)
                return keys
            }
        }
        Object.keys(cond).forEach(context.addKey)
        return keys
    }

    function buildTriggerMap(form) {
        const state = getState(form)
        const triggerMap = {}
        state.watchers.forEach(watcher => {
            if (!watcher.when) return
            const triggerKeys = collectConditionTriggers(form, watcher.when)
            state.watcherTriggerCache.set(watcher, triggerKeys)
            triggerKeys.forEach(key => {
                if (!triggerMap.hasOwnProperty(key)) {
                    triggerMap[key] = new Set()
                }
                triggerMap[key].add(watcher)
            })
        })
        state.watchTriggerMap = triggerMap
    }

    function inferAffects(effectObject, effectHandlers) {
        const affectSet = new Set()
        for (const [effectName, value] of Object.entries(effectObject)) {
            const handler = effectHandlers[effectName]
            if (handler) {
                const collected = handler.collectAffects(value) || []
                collected.forEach(key => affectSet.add(key))
            } else {
                console.warn(`FastForm Warning: Unknown effect type "${effectName}" in watcher.`)
            }
        }
        return [...affectSet]
    }

    function getAffects(node, effectHandlers) {
        let affectArr = []
        if (typeof node.effect === "function") {
            if (!Array.isArray(node.affects)) {
                console.warn("FastForm Warning: A watcher with an imperative function `effect` is missing the required `affects` array. Dependency analysis may be incorrect.", node)
            }
            affectArr = node.affects || []
        } else if (typeof node.effect === "object" && node.effect !== null) {
            node._inferredAffects = node._inferredAffects || inferAffects(node.effect, effectHandlers)
            affectArr = node._inferredAffects
        }
        return affectArr
    }

    // Topological Sorting
    function executeWatchers(form, initialWatchers) {
        if (initialWatchers.size === 0) return

        const { watcherTriggerCache } = getState(form)
        const nodes = [...initialWatchers]
        const graph = new Map(nodes.map(node => [node, []])) // watcher => [dependent1, dependent2] (Watchers that can only be executed after it)
        const inDegree = new Map(nodes.map(node => [node, 0])) // watcher => count of dependencies (How many watchers must be executed before it)

        for (const producer of nodes) {
            for (const consumer of nodes) {
                if (producer === consumer) continue

                const producerAffects = getAffects(producer, form.options.effectHandlers)
                if (producerAffects.length === 0) continue

                const consumerTriggerKeys = watcherTriggerCache.get(consumer) || new Set()
                const hasDependency = producerAffects.some(affectKey => consumerTriggerKeys.has(affectKey))
                if (hasDependency) {
                    graph.get(producer).push(consumer) // producer -> consumer
                    inDegree.set(consumer, inDegree.get(consumer) + 1)
                }
            }
        }

        const queue = nodes.filter(node => inDegree.get(node) === 0)
        const sortedWatchers = []

        while (queue.length > 0) {
            const currentWatcher = queue.shift()
            sortedWatchers.push(currentWatcher)

            const dependents = graph.get(currentWatcher) || []
            for (const dependent of dependents) {
                inDegree.set(dependent, inDegree.get(dependent) - 1)
                if (inDegree.get(dependent) === 0) {
                    queue.push(dependent)
                }
            }
        }

        if (sortedWatchers.length !== nodes.length) {
            const cycleNodeKeys = nodes
                .filter(node => inDegree.get(node) > 0)
                .map(w => {
                    const state = getState(form)
                    for (const [key, watcher] of state.watchers.entries()) {
                        if (watcher === w) return key
                    }
                    return "unknown watcher"
                })
                .join(", ")
            throw new Error(`FastForm Error: Circular dependency detected in watchers. Involved watchers might be: ${cycleNodeKeys}`)
        }

        const effectContext = {
            dispatchEvent: (event) => form.form.dispatchEvent(event),
            getBox: (boxId) => form.form.querySelector(`[data-box="${CSS.escape(boxId)}"]`),
            getControl: (key) => form.form.querySelector(`[data-control="${CSS.escape(key)}"]`),
            getValue: (key) => form.getData(key),
            setValue: (key, value, type) => form.setFieldValue(key, value, type),
        }

        for (const watcher of sortedWatchers) {
            const isConditionMet = evaluateCondition(form, watcher.when || {})
            const effect = watcher.effect
            if (typeof effect === "function") {
                effect(isConditionMet, effectContext)
            } else if (typeof effect === "object" && effect !== null) {
                for (const [effectName, value] of Object.entries(effect)) {
                    const handler = form.options.effectHandlers[effectName]
                    if (handler) {
                        handler.execute(isConditionMet, value, effectContext)
                    }
                }
            }
        }
    }

    function executeWatchersForKeys(form, keys) {
        const state = getState(form)
        const watchersToRun = new Set()
        keys.forEach(key => {
            const triggeredWatchers = state.watchTriggerMap[key]
            if (triggeredWatchers) {
                triggeredWatchers.forEach(watcher => watchersToRun.add(watcher))
            }
        })
        if (watchersToRun.size > 0) {
            executeWatchers(form, watchersToRun)
        }
    }

    function executeAllWatchers(form) {
        const state = getState(form)
        const allWatchers = new Set(state.watchers.values())
        if (allWatchers.size > 0) {
            executeWatchers(form, allWatchers)
        }
    }

    return defineFeature({
        featureOptions: {
            watchers: {},
            conditionEvaluators: {},
            comparisonEvaluators: {},
            effectHandlers: {},
        },
        normalize: ({ form, options }) => {
            options.conditionEvaluators = { ..._conditionEvaluators, ...options.conditionEvaluators }
            options.comparisonEvaluators = { ..._comparisonEvaluators, ...options.comparisonEvaluators }
            options.effectHandlers = { ..._effectHandlers, ...options.effectHandlers }

            clearState(form)

            const addWatcher = (key, watcher) => {
                const state = getState(form)
                if (state.watchers.has(key)) {
                    console.warn(`FastForm Warning: Watcher with key "${key}" already exists. It will not be overwritten.`)
                    return
                }
                state.watchers.set(key, watcher)
            }
            Object.entries((options.watchers || {})).forEach(([key, watcher]) => addWatcher(key, watcher))

            form.addWatcher = addWatcher
            form.getWatcherState = function () {
                const state = getState(this)
                return {
                    watchers: new Map(state.watchers),
                    watchTriggerMap: { ...state.watchTriggerMap },
                    watcherTriggerCache: new Map(state.watcherTriggerCache)
                }
            }

            const originalOnRender = options.hooks.onRender
            options.hooks.onRender = (formInstance) => {
                buildTriggerMap(formInstance)
                executeAllWatchers(formInstance)
                originalOnRender(formInstance)
            }
            const originalOnAfterCommit = options.hooks.onAfterCommit
            options.hooks.onAfterCommit = (changeContext, formInstance) => {
                originalOnAfterCommit(changeContext, formInstance)
                executeWatchersForKeys(form, [changeContext.key])
            }
        },
        install: (FastFormClass) => {
            FastFormClass.registerConditionEvaluator = function (name, definition) {
                if (!name.startsWith("$")) {
                    throw new Error(`Condition Evaluator Error: handler for '${name}' must start with '$'.`)
                }
                if (typeof definition.evaluate !== "function" || typeof definition.collectTriggers !== "function") {
                    throw new Error(`Condition Evaluator Error: '${name}' must be an object with 'evaluate' and 'collectTriggers' functions.`)
                }
                if (definition.hasOwnProperty("beforeEvaluate") && typeof definition.beforeEvaluate !== "function") {
                    throw new Error(`Condition Evaluator Error: 'beforeEvaluate' for '${name}' must be a function.`)
                }
                if (_conditionEvaluators.hasOwnProperty(name)) {
                    console.warn(`FastForm Warning: Overwriting Condition evaluator definition for '${name}'.`)
                }
                _conditionEvaluators[name] = definition
            }
            FastFormClass.registerComparisonEvaluator = function (name, definition) {
                if (!name.startsWith("$")) {
                    throw new Error(`Comparison Evaluator Error: handler for '${name}' must start with '$'.`)
                }
                if (typeof definition.evaluate !== "function") {
                    throw new Error(`Comparison Evaluator Error: '${name}' must be an object with an 'evaluate' function.`)
                }
                if (definition.hasOwnProperty("beforeEvaluate") && typeof definition.beforeEvaluate !== "function") {
                    throw new Error(`Comparison Evaluator Error: 'beforeEvaluate' for '${name}' must be a function.`)
                }
                if (_comparisonEvaluators.hasOwnProperty(name)) {
                    console.warn(`FastForm Warning: Overwriting comparison evaluator definition for '${name}'.`)
                }
                _comparisonEvaluators[name] = definition
            }
            FastFormClass.registerEffectHandler = function (name, definition) {
                if (!name.startsWith("$")) {
                    throw new Error(`Effect Handler Error: handler name '${name}' must start with '$'.`)
                }
                if (!definition || typeof definition !== "object") {
                    throw new Error(`Effect Handler Error: The definition for handler '${name}' must be a non-null object.`)
                }
                if (typeof definition.collectAffects !== "function" || typeof definition.execute !== "function") {
                    throw new Error(`Effect Handler Error: handler '${name}' must provide 'collectAffects' and 'execute' methods.`)
                }
                if (_effectHandlers.hasOwnProperty(name)) {
                    console.warn(`FastForm Warning: Overwriting effect handler definition for '${name}'.`)
                }
                _effectHandlers[name] = definition
            }
        },
    })
})()

const Feature_Layout = defineFeature({
    featureOptions: {
        layout: {
            createTitle(box) {
                return box.title
                    ? `<div class="title">${box.title}${this.createTooltip(box)}</div>`
                    : ""
            },
            createTooltip(item) {
                return item.tooltip
                    ? `<span class="tooltip"><span class="fa fa-info-circle"></span><span>${utils.escape(item.tooltip).replace("\n", "<br>")}</span></span>`
                    : ""
            },
            createExplain(field) {
                return `<div class="explain">${utils.escape(field.explain)}</div>`
            },
            createLabel(field) {
                return field.explain
                    ? `<div><div>${field.label}${this.createTooltip(field)}</div>${this.createExplain(field)}</div>`
                    : field.label + this.createTooltip(field)
            },
            createControlContainer(field, controlHTML, className) {
                const isBlockLayout = field.isBlockLayout || false
                const label = isBlockLayout ? "" : `<div class="control-left">${this.createLabel(field)}</div>`
                const control = isBlockLayout ? controlHTML : `<div class="control-right">${controlHTML}</div>`
                const cls = "control" + (isBlockLayout ? " control-block" : "") + (className ? ` ${className}` : "")
                return `<div class="${cls}" data-type="${field.type}" data-control="${field.key}">${label}${control}</div>`
            },
            createBox(controlHTMLs) {
                return `<div class="box">${controlHTMLs.join("")}</div>`
            },
            genBoxContainerId(box, idx) {
                return box.id || `box_${idx}`
            },
            createBoxContainer(id, titleHTML, boxHTML) {
                return `<div class="box-container" data-box="${id}">${titleHTML}${boxHTML}</div>`
            },
            findBox(key, form) {
                return form.querySelector(`[data-box="${CSS.escape(key)}"]`)
            },
            findControl(key, form) {
                return form.querySelector(`[data-control="${CSS.escape(key)}"]`)
            },
        }
    },
    install: (FastFormClass) => {
        FastFormClass.layout = {
            set: (definition) => {
                const defaultLayout = Feature_Layout.featureOptions.layout
                for (const [api, val] of Object.entries(defaultLayout)) {
                    if (!definition[api] || typeof definition[api] !== typeof val) {
                        throw new Error(`Control Layout Error: '${api}' must be a ${typeof val}.`)
                    }
                }
                Object.assign(defaultLayout, definition)
            }
        }
    }
})

const Feature_Parsing = defineFeature({
    featureOptions: {
        parsers: {},
        parserMatchStrategy: "exact", // "exact", "wildcard", "regex"
    },
    normalize: ({ form, options }) => {
        const { parsers, parserMatchStrategy } = options
        if (!parsers || typeof parsers !== "object" || Object.keys(parsers).length === 0) return

        const compiledParsers = compileMatchers({
            source: parsers,
            strategy: parserMatchStrategy,
            errorContext: "parser",
            processValue: (parser, key) => {
                if (typeof parser !== "function") {
                    console.warn(`FastForm Warning: Parser for key '${key}' is not a function.`)
                    return
                }
                return { parser }
            }
        })
        if (compiledParsers.length === 0) return

        const originalOnProcessValue = options.hooks.onProcessValue
        options.hooks.onProcessValue = (changeContext) => {
            const processedValue = originalOnProcessValue(changeContext)
            const newChangeContext = { ...changeContext, value: processedValue }
            const matchedParsers = compiledParsers.filter(p => p.regex.test(newChangeContext.key))
            if (matchedParsers.length === 0) {
                return newChangeContext.value
            }
            if (matchedParsers.length > 1) {
                matchedParsers.sort((a, b) => b.key.length - a.key.length)
            }
            return matchedParsers[0].parser(newChangeContext.value, newChangeContext)
        }
    }
})

const Feature_Validation = defineFeature({
    featureOptions: {
        rules: {},
        validators: {},
        ruleMatchStrategy: "exact", // "exact", "wildcard", "regex"
    },
    normalize: ({ form, options }) => {
        const { rules, validators, ruleMatchStrategy } = options
        const allValidators = { ...form.constructor.validator.getAll(), ...validators }
        if (!rules || typeof rules !== "object" || Object.keys(rules).length === 0) return

        const compiledRules = compileMatchers({
            source: rules,
            strategy: ruleMatchStrategy,
            errorContext: "rule",
            processValue: (rawValidators, key) => {
                rawValidators = Array.isArray(rawValidators) ? rawValidators : [rawValidators]
                const validators = rawValidators.map(validator => {
                    switch (typeof validator) {
                        case "function":
                            return validator
                        case "string":
                            const builtin = allValidators[validator]
                            if (builtin) {
                                return builtin
                            }
                            break
                        case "object":
                            if (validator && typeof validator.validate === "function") {
                                return validator.validate
                            }
                            const factory = allValidators[validator.name]
                            if (factory) {
                                const args = validator.args || []
                                return factory(...args)
                            }
                            break
                    }
                    throw new Error(`Invalid rule type for '${JSON.stringify(validator)}': '${key}'.`)
                })
                return { validators }
            }
        })
        if (compiledRules.length === 0) return

        const originalOnValidate = options.hooks.onValidate
        options.hooks.onValidate = (changeContext) => {
            const previousErrors = originalOnValidate(changeContext) || []

            const matchedValidators = compiledRules
                .filter(rule => rule.regex.test(changeContext.key))
                .flatMap(rule => rule.validators)

            if (matchedValidators.length === 0) {
                return previousErrors
            }

            const currentErrors = matchedValidators
                .map(validator => {
                    try {
                        return validator(changeContext, form.options.data)
                    } catch (err) {
                        return new Error(err)
                    }
                })
                .filter(ret => ret !== true && ret != null)
                .map(err => (err instanceof Error) ? err : new Error(String(err)))
            return [...previousErrors, ...currentErrors]
        }
    },
    install: (FastFormClass) => {
        FastFormClass.validator = {
            get: (...names) => {
                if (names.length === 0) return
                const validators = names.map(name => Feature_Validation._validators[name])
                return (names.length === 1) ? validators[0] : validators
            },
            getAll: () => Feature_Validation._validators,
            register: (name, definition) => {
                if (typeof definition !== "function") {
                    throw new Error(`Validator Error: validator '${name}' must be a function.`)
                }
                if (Feature_Validation._validators.hasOwnProperty(name)) {
                    console.warn(`FastForm Warning: Overwriting validator definition for type '${name}'.`)
                }
                Feature_Validation._validators[name] = definition
            }
        }
    },
    _validators: {
        required: ({ value }, allData) => {
            const isEmpty = value == null
                || (typeof value === "string" && value.trim() === "")
                || (Array.isArray(value) && value.length === 0)
            return !isEmpty ? true : i18n.t("global", "error.required")
        },
        pattern: (pattern) => ({ value }, allData) => {
            if (!value) return true
            return pattern.test(value) ? true : i18n.t("global", "error.pattern")
        },
        notEqual: (target) => ({ value }, allData) => {
            if (value == null) return true
            return value !== target ? true : i18n.t("global", "error.invalid", { value: target })
        },
        min: (min) => ({ value }, allData) => {
            if (value == null || value === "") return true
            if ((typeof value !== "string" && typeof value !== "number") || isNaN(value)) {
                return i18n.t("global", "error.isNaN")
            }
            return Number(value) >= min ? true : i18n.t("global", "error.min", { min })
        },
        max: (max) => ({ value }, allData) => {
            if (value == null || value === "") return true
            if (isNaN(value)) return i18n.t("global", "error.isNaN")
            return Number(value) <= max ? true : i18n.t("global", "error.max", { max })
        },
        isArray: ({ value }) => {
            if (value == null) return true
            return Array.isArray(value) ? true : i18n.t("global", "error.pattern")
        },
        isObject: ({ value }, allData) => {
            if (value == null) return true
            return (!Array.isArray(value) && typeof value === "object") ? true : i18n.t("global", "error.pattern")
        },
    }
})

const Feature_Dependencies = defineFeature({
    featureOptions: {
        dependencies: {},
        disableEffect: "readonly", // "hide" or "readonly"
    },
    normalize: ({ form, options }) => {
        const allDependencies = { ...options.dependencies }
        form.traverseFields(field => {
            if (!field.dependencies) return
            if (allDependencies.hasOwnProperty(field.key)) {
                console.warn(`FastForm Warning: Dependency for '${field.key}' is defined both inline and in top-level options. The inline definition will be used.`)
            }
            allDependencies[field.key] = field.dependencies
        })
        Object.entries(allDependencies).forEach(([fieldKey, whenCondition]) => {
            if (!whenCondition) return
            const watcherKey = `_dependency_${fieldKey}`
            form.addWatcher(watcherKey, {
                when: { $not: whenCondition },
                effect: {
                    $ui: {
                        [fieldKey]: {
                            toggleClass: options.disableEffect === "hide" ? "plugin-common-hidden" : "plugin-common-readonly"
                        }
                    }
                },
                isDependency: true, // Special property to identify it as an auto-generated watcher
            })
        })
    }
})

const Feature_Cascades = defineFeature({
    featureOptions: {
        cascades: {},
    },
    normalize: ({ form, options }) => {
        if (!options.cascades || typeof options.cascades !== "object") return

        Object.entries(options.cascades).forEach(([cascadeKey, rule]) => {
            const watcherKey = `_cascade_${cascadeKey}`
            if (!rule || !rule.hasOwnProperty("target") || !rule.hasOwnProperty("value")) {
                console.warn(`FastForm Warning: Cascade rule "${cascadeKey}" is missing a "target" or "value".`)
                return
            }
            form.addWatcher(watcherKey, {
                when: rule.when,
                affects: [rule.target],
                effect: (isConditionMet, context) => {
                    if (!isConditionMet) return
                    const oldValue = context.getValue(rule.target)
                    const newValue = (typeof rule.value === "function") ? rule.value(context) : rule.value
                    if (!utils.deepEqual(newValue, oldValue)) {
                        context.setValue(rule.target, newValue)
                    }
                },
                isCascade: true, // Special property to identify it as a cascade
            })
        })
    }
})

const Feature_ConditionalBoxes = (() => {
    const instanceStates = new WeakMap()

    const getState = (form) => {
        if (!instanceStates.has(form)) {
            instanceStates.set(form, { cachedData: {}, boxSchemaMap: {} })
        }
        return instanceStates.get(form)
    }
    const clearState = (form) => {
        const state = getState(form)
        state.cachedData = {}
        state.boxSchemaMap = {}
    }
    const initState = (form, schema) => {
        const state = getState(form)
        traverseBoxes(box => {
            if (box.id) {
                state.boxSchemaMap[box.id] = box
            }
        }, schema)
        return state
    }
    const traverseBoxes = (visitorFn, schema) => {
        for (const box of schema) {
            visitorFn(box)
            for (const field of box.fields || []) {
                if (Array.isArray(field.subSchema)) {
                    traverseBoxes(visitorFn, field.subSchema)
                }
            }
        }
    }

    return defineFeature({
        featureOptions: {
            conditionalBoxes: {},
            destroyStateOnHide: false,
        },
        normalize: ({ form, options }) => {
            clearState(form)

            const conditionalBoxes = options.conditionalBoxes
            if (!conditionalBoxes || typeof conditionalBoxes !== "object" || Object.keys(conditionalBoxes).length === 0) return

            const state = initState(form, options.schema)
            Object.entries(conditionalBoxes).forEach(([boxId, whenCondition]) => {
                if (!whenCondition) return
                if (!state.boxSchemaMap[boxId]) {
                    console.warn(`FastForm Warning: Conditional box with id '${boxId}' is defined, but not found in any schema level.`)
                    return
                }

                const watcherKey = `_conditional_box_${boxId}`
                form.addWatcher(watcherKey, {
                    when: whenCondition,
                    affects: [`@ui/${boxId}`],
                    effect: (isConditionMet, context) => {
                        const container = context.getBox(boxId)
                        if (!container) return

                        const wantToHide = !isConditionMet
                        const wasHidden = utils.isHidden(container)
                        if (wantToHide === wasHidden) return

                        utils.toggleInvisible(container, wantToHide)
                        if (!options.destroyStateOnHide) return

                        if (wantToHide) {
                            const boxSchema = state.boxSchemaMap[boxId]
                            if (boxSchema) {
                                const cache = {}
                                form.traverseFields(field => {
                                    if (field.key) {
                                        cache[field.key] = form.getData(field.key)
                                        form.setData(field.key, undefined)
                                    }
                                }, [boxSchema])
                                state.cachedData[boxId] = cache
                            }
                        } else {
                            const dataToRestore = state.cachedData[boxId]
                            if (dataToRestore) {
                                Object.entries(dataToRestore).forEach(([fieldKey, value]) => context.setValue(fieldKey, value))
                                delete state.cachedData[boxId]
                            }
                        }
                    },
                    isConditionalBox: true, // Special property to identify it as an auto-generated watcher
                })
            })
        }
    })
})()

FastForm.registerFeature("eventDelegation", Feature_EventDelegation)
FastForm.registerFeature("defaultKeybindings", Feature_DefaultKeybindings)
FastForm.registerFeature("watchers", Feature_Watchers)
FastForm.registerFeature("layout", Feature_Layout)
FastForm.registerFeature("parsing", Feature_Parsing)
FastForm.registerFeature("validation", Feature_Validation)
FastForm.registerFeature("dependencies", Feature_Dependencies)
FastForm.registerFeature("cascades", Feature_Cascades)
FastForm.registerFeature("conditionalBoxes", Feature_ConditionalBoxes)

// usage:
//  $compareFields: { left: "fieldKeyA", operator: "$lt", right: "fieldKeyB" }
const Condition_CompareFields = defineConditionEvaluator({
    collectTriggers: (cond, ctx) => {
        if (cond && typeof cond.left === "string") ctx.addKey(cond.left)
        if (cond && typeof cond.right === "string") ctx.addKey(cond.right)
    },
    evaluate: (cond, ctx) => {
        if (!cond || typeof cond.left !== "string" || typeof cond.right !== "string") {
            console.warn(`FastForm Warning: $compactFields requires that the 'left' and 'right' attributes must be strings.`, cond)
            return false
        }
        const leftValue = ctx.getValue(cond.left)
        const rightValue = ctx.getValue(cond.right)
        const operator = cond.operator || "$eq"
        const handler = ctx.comparisonEvaluators[operator]
        if (handler && typeof handler.evaluate === "function") {
            return handler.evaluate(leftValue, rightValue)
        } else {
            console.warn(`FastForm Warning: Unknown comparison operator used in $compactFields "${operator}"。`)
            return false
        }
    },
})

// usage:
//  $follow: "fieldKey1"
//  $follow: ["fieldKey1", "fieldKey2"]
const Condition_Follow = defineConditionEvaluator({
    collectTriggers: (fieldKeyOrKeys, ctx) => {
        const keys = Array.isArray(fieldKeyOrKeys) ? fieldKeyOrKeys : [fieldKeyOrKeys]
        keys.filter(key => typeof key === "string").forEach(key => {
            const targetField = ctx.getField(key)
            if (targetField && targetField.dependencies) {
                ctx.collectTriggers(targetField.dependencies)
            }
        })
    },
    evaluate: (fieldKeyOrKeys, ctx) => {
        if (typeof fieldKeyOrKeys === "string") {
            return Condition_Follow.isFieldEnabled(ctx, fieldKeyOrKeys)
        } else if (Array.isArray(fieldKeyOrKeys)) {
            return fieldKeyOrKeys.every(key => typeof key === "string" && Condition_Follow.isFieldEnabled(ctx, key))
        }
        return false
    },
    isFieldEnabled: (ctx, key) => {
        const field = ctx.getField(key)
        return field
            ? (field.dependencies ? ctx.evaluate(field.dependencies) : true)
            : false
    },
})

// usage:
//   $length: { fieldKey1: 3, fieldKey2: 4 }
//   $length: { fieldKey1: { $gt: 1 }, fieldKey2: { $eq: 4 } }
const Condition_Length = defineConditionEvaluator({
    collectTriggers: (cond, ctx) => ctx.collectTriggers(cond),
    evaluate: (cond, ctx) => {
        if (Array.isArray(cond) || typeof cond !== "object") {
            console.warn(`FastForm Warning: $length supports objects only: ${JSON.stringify(cond)}`)
            return false
        }
        return Object.entries(cond).every(([key, subCond]) => {
            const fieldValue = ctx.getValue(key)
            const actualLength = Array.isArray(fieldValue)
                ? fieldValue.length
                : (typeof fieldValue === "string" ? fieldValue.length : 0)
            return ctx.compare(actualLength, subCond)
        })
    },
})

const Comparison_Regex = defineComparisonEvaluator({
    beforeEvaluate: (actual, expected, ctx) => {
        let pattern, flags
        if (typeof expected === "object" && expected !== null) {
            pattern = expected.pattern
            flags = expected.flags
        } else {
            pattern = expected
        }
        if (typeof pattern !== "string") {
            console.error("FastForm Error: '$regex' pattern must be a string.", pattern)
            return [actual, null]  // return null indicates preprocessing failure
        }
        try {
            const regex = new RegExp(pattern, flags)
            return [actual, regex]
        } catch (e) {
            console.error(`FastForm Error: Invalid regex provided to '$regex'.`, { pattern, flags }, e)
            return [actual, null]
        }
    },
    evaluate: (processedActual, processedExpected_Regex) => {
        if (processedExpected_Regex === null) {
            return false
        }
        if (!processedActual) {
            return true
        }
        return processedExpected_Regex.test(processedActual)
    },
})

const Effect_Map = defineEffectHandler({
    collectAffects: (value) => {
        if (!value || typeof value.to !== "string") {
            console.warn(`FastForm Warning: $map effect is missing a valid 'to' property.`, value)
            return []
        }
        return [value.to]
    },
    execute: (isConditionMet, value, context) => {
        if (!isConditionMet) return
        if (!value || typeof value.to !== "string") {
            console.error(`FastForm Error: $map effect requires 'from' and 'to' string properties to execute.`, value)
            return
        }
        if (typeof value.with !== "function" && typeof value.from !== "string") {
            console.error(`FastForm Error: $map effect requires a 'from' property when 'with' is not a function.`, value)
            return
        }
        const sourceValue = (typeof value.from === "string") ? context.getValue(value.from) : undefined
        const finalValue = (typeof value.with === "function") ? value.with(sourceValue, context) : sourceValue
        const currentTargetValue = context.getValue(value.to)
        if (!utils.deepEqual(currentTargetValue, finalValue)) {
            context.setValue(value.to, finalValue)
        }
    }
})

const Effect_Dispatch = defineEffectHandler({
    collectAffects: () => [],
    execute: (isConditionMet, value, context) => {
        if (!isConditionMet) return
        Object.entries(value).forEach(([eventName, eventConfig]) => {
            const detail = (typeof eventConfig.detail === "function") ? eventConfig.detail(context) : eventConfig.detail
            context.dispatchEvent(new CustomEvent(eventName, { ...eventConfig, detail }))
        })
    }
})

FastForm.registerConditionEvaluator("$compareFields", Condition_CompareFields)
FastForm.registerConditionEvaluator("$follow", Condition_Follow)
FastForm.registerConditionEvaluator("$length", Condition_Length)
FastForm.registerComparisonEvaluator("$regex", Comparison_Regex)
FastForm.registerEffectHandler("$map", Effect_Map)
FastForm.registerEffectHandler("$dispatch", Effect_Dispatch)

function Try(fn, buildErr = utils.identity) {
    try {
        fn()
    } catch (err) {
        return new Error(buildErr(err))
    }
}

const Validator_Url = defineValidator(({ value }) => {
    if (!value) return true
    const pattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/
    return pattern.test(value) ? true : i18n.t("global", "error.invalidURL")
})

const Validator_Regex = defineValidator(({ value }) => {
    return Try(() => value && new RegExp(value), () => `Error Regex: ${value}`)
})

const Validator_Path = defineValidator(({ value }) => {
    return Try(() => value && utils.Package.Fs.accessSync(utils.Package.Path.resolve(value)), () => `No such path: ${utils.Package.Path.resolve(value)}`)
})

FastForm.validator.register("url", Validator_Url)
FastForm.validator.register("regex", Validator_Regex)
FastForm.validator.register("path", Validator_Path)

function getCommonHTMLAttrs(field, allowEmpty) {
    return {
        key: `data-key="${field.key}"`,
        placeholder: (field.placeholder || allowEmpty) ? `placeholder="${field.placeholder || ""}"` : "",
    }
}

function getNumericalHTMLAttr(field) {
    return [
        typeof field.min === "number" ? `min=${field.min}` : "",
        typeof field.max === "number" ? `max=${field.max}` : "",
        typeof field.step === "number" ? `step=${field.step}` : "",
    ].join(" ")
}

function updateInputNumericalAttr(input, field) {
    input.min = typeof field.min === "number" ? field.min : ""
    input.max = typeof field.max === "number" ? field.max : ""
    input.step = typeof field.step === "number" ? field.step : ""
}

function updateInputState(input, field, value) {
    input.value = value
    input.disabled = !!field.disabled
    input.readOnly = !!field.readonly
}

function normalizeOptionsAttr(field) {
    if (field.options && Array.isArray(field.options) && field.options.every(op => typeof op === "string")) {
        field.options = Object.fromEntries(field.options.map(op => [op, op]))
    }
}

function defaultBlockLayout(field) {
    if (!field.hasOwnProperty("isBlockLayout")) {
        field.isBlockLayout = true
    }
}

function registerRules(options, key, rules) {
    const toAdd = Array.isArray(rules) ? rules : [rules]
    const origin = options.rules[key] || []
    options.rules[key] = [origin, ...toAdd].flat()
}

function registerNumericalDefaultRules({ field, options, form }) {
    const { key, min, max } = field
    const [required, minFactory, maxFactory] = form.constructor.validator.get("required", "min", "max")
    const rules = [required]
    if (typeof min === "number") {
        rules.push(minFactory(min))
    }
    if (typeof max === "number") {
        rules.push(maxFactory(max))
    }
    registerRules(options, key, rules)
}

function registerItemLengthLimitRule({ field, options, form }) {
    registerRules(options, field.key, ({ key, value, type }) => {
        const currentValue = form.getData(key)
        if (!Array.isArray(currentValue)) return

        const { minItems, maxItems } = field
        const tooLittle = typeof minItems === "number" && type === "set" && value.length < minItems
        const tooMuch = typeof maxItems === "number" && type === "set" && value.length > maxItems
        if (tooLittle) return new Error(i18n.t("global", "error.minItems", { minItems }))
        if (tooMuch) return new Error(i18n.t("global", "error.maxItems", { maxItems }))
    })
}

const setRandomKey = (() => {
    let num = 0
    return (field) => field.key = field.key || `_random_key_${num++}`
})()

const Control_Switch = defineControl({
    controlOptions: {
        className: "native-switch",
    },
    create: ({ field }) => {
        const { key } = getCommonHTMLAttrs(field)
        return `<input class="switch-input" type="checkbox" ${key}/>`
    },
    update: ({ element, value, field }) => {
        const input = element.querySelector(".switch-input")
        if (input) {
            input.checked = !!value
            input.disabled = !!field.disabled
            input.readOnly = !!field.readonly
        }
    },
    bindEvents: ({ form }) => {
        form.onEvent("change", ".native-switch .switch-input", function () {
            form.validateAndCommit(this.dataset.key, this.checked)
        })
    },
})

const Control_Text = defineControl({
    create: ({ field }) => {
        const { key, placeholder } = getCommonHTMLAttrs(field)
        return `<input class="text-input" type="text" ${key} ${placeholder}>`
    },
    update: ({ element, value, field }) => {
        const input = element.querySelector(".text-input")
        if (input) {
            updateInputState(input, field, value || "")
        }
    },
    bindEvents: ({ form }) => {
        form.onEvent("change", ".text-input", function () {
            form.validateAndCommit(this.dataset.key, this.value)
        })
    },
})

const Control_Color = defineControl({
    create: ({ field }) => {
        const { key, placeholder } = getCommonHTMLAttrs(field)
        return `<input class="color-input" type="color" ${key} ${placeholder}>`
    },
    update: ({ element, value, field }) => {
        const input = element.querySelector(".color-input")
        if (input) {
            updateInputState(input, field, value || "#000000")
        }
    },
    bindEvents: ({ form }) => {
        form.onEvent("change", ".color-input", function () {
            form.validateAndCommit(this.dataset.key, this.value)
        })
    },
})

const Control_Number = defineControl({
    setup: registerNumericalDefaultRules,
    create: ({ field }) => {
        const { key, placeholder } = getCommonHTMLAttrs(field)
        return `<input class="number-input" type="number" ${key} ${placeholder} ${getNumericalHTMLAttr(field)}>`
    },
    update: ({ element, value, field }) => {
        const input = element.querySelector(".number-input")
        if (input) {
            updateInputState(input, field, value)
            updateInputNumericalAttr(input, field)
        }
    },
    bindEvents: ({ form }) => {
        form.onEvent("change", ".number-input", function () {
            const value = this.value === "" ? null : Number(this.value)
            form.validateAndCommit(this.dataset.key, value)
        })
    },
})

const Control_Unit = defineControl({
    setup: registerNumericalDefaultRules,
    create: ({ field }) => {
        const { key, placeholder } = getCommonHTMLAttrs(field)
        const input = `<input class="unit-input" type="number" ${key} ${placeholder} ${getNumericalHTMLAttr(field)}>`
        return `<div class="unit-wrap">${input}<div class="unit-value">${field.unit}</div></div>`
    },
    update: ({ element, value, field }) => {
        const input = element.querySelector(".unit-input")
        if (input) {
            updateInputState(input, field, value)
            updateInputNumericalAttr(input, field)
        }
    },
    bindEvents: ({ form }) => {
        form.onEvent("change", ".unit-input", function () {
            const value = this.value === "" ? null : Number(this.value)
            form.validateAndCommit(this.dataset.key, value)
        })
    },
})

const Control_Range = defineControl({
    setup: registerNumericalDefaultRules,
    create: ({ field }) => {
        const { key } = getCommonHTMLAttrs(field)
        return `<div class="range-wrap">
                    <input class="range-input" type="range" ${key} ${getNumericalHTMLAttr(field)}>
                    <div class="range-value"></div>
                </div>`
    },
    update: ({ element, value = field.min, field }) => {
        const resolvedValue = value != null ? value : 0
        const input = element.querySelector(".range-input")
        const valueDisplay = element.querySelector(".range-value")
        if (input && valueDisplay) {
            updateInputState(input, field, resolvedValue)
            updateInputNumericalAttr(input, field)
            valueDisplay.textContent = Control_Range._toFixed2(resolvedValue)
        }
    },
    bindEvents: ({ form }) => {
        form.onEvent("input", ".range-input", function () {
            this.nextElementSibling.textContent = Control_Range._toFixed2(Number(this.value))
        }).onEvent("change", ".range-input", function () {
            form.validateAndCommit(this.dataset.key, Number(this.value))
        })
    },
    _toFixed2: (num) => {
        return Number.isInteger(num) ? num : num.toFixed(2)
    },
})

const Control_Action = defineControl({
    setup: ({ field, options }) => {
        const handler = options.actions[field.key]
        if (typeof handler !== "function") {
            options.actions[field.key] = () => console.warn(`No such action: ${field.key}`)
        }
    },
    create: ({ field }) => `<div class="action fa fa-angle-right" data-action="${field.key}"></div>`,
    bindEvents: ({ form }) => {
        form.onEvent("mousedown", '.control[data-type="action"]', function (ev) {
            const ripple = document.createElement("span")
            ripple.classList.add("ripple")
            const diameter = Math.max(this.clientWidth, this.clientHeight) * 2
            const radius = diameter / 2
            const rect = this.getBoundingClientRect()
            const x = ev.clientX - rect.left - radius
            const y = ev.clientY - rect.top - radius
            ripple.style.width = `${diameter}px`
            ripple.style.height = `${diameter}px`
            ripple.style.left = `${x}px`
            ripple.style.top = `${y}px`
            this.appendChild(ripple)
            ripple.addEventListener("animationend", () => ripple.remove(), { once: true })
        }).onEvent("click", '.control[data-type="action"]', function () {
            const actKey = this.querySelector(".action").dataset.action
            const fn = form.options.actions[actKey]
            if (typeof fn === "function") {
                return fn(form.options)
            }
        })
    },
})

const Control_Static = defineControl({
    create: () => `<div class="static"></div>`,
    update: ({ element, value }) => {
        const staticEl = element.querySelector(".static")
        if (staticEl) {
            staticEl.textContent = utils.escape(value)
        }
    },
})

const Control_Custom = defineControl({
    setup: ({ field }) => {
        defaultBlockLayout(field)
        setRandomKey(field)
    },
    create: ({ field }) => {
        const content = field.unsafe ? field.content : utils.escape(field.content)
        return `<div class="custom-wrap">${content}</div>`
    },
})

const Control_Hint = defineControl({
    setup: ({ field }) => {
        defaultBlockLayout(field)
        setRandomKey(field)
    },
    create: ({ field }) => {
        const getUnsafeAttr = (attr) => (field.unsafe === true) ? field[attr] : utils.escape(field[attr])
        const header = field.hintHeader ? `<div class="hint-header">${getUnsafeAttr("hintHeader")}</div>` : ""
        const detail = field.hintDetail ? `<div class="hint-detail">${getUnsafeAttr("hintDetail").replace(/\n/g, "<br>")}</div>` : ""
        return `<div class="hint-wrap">${header}${detail}</div>`
    },
})

const Control_Hotkey = defineControl({
    create: ({ field }) => {
        const { key, placeholder } = getCommonHTMLAttrs(field, true)
        return `<div class="hotkey-wrap">
                    <input type="text" class="hotkey-input" ${key} ${placeholder}>
                      <div class="hotkey-btn">
                        <div class="hotkey-reset">×</div>
                      </div>
                </div>`
    },
    update: ({ element, value, field }) => {
        const input = element.querySelector(".hotkey-input")
        if (input) {
            updateInputState(input, field, value || "")
        }
    },
    bindEvents: ({ form }) => {
        const ignoreKeys = ["control", "alt", "shift", "meta"]
        const updateHotkey = utils.debounce(hk => form.validateAndCommit(hk.dataset.key, hk.value), 500)

        form.onEvent("click", ".hotkey-reset", function () {
            const input = this.closest(".hotkey-wrap").querySelector("input")
            const ok = form.validateAndCommit(input.dataset.key, "")
            if (ok) {
                utils.hotkeyHub.unregister(input.value)
                input.value = ""
            }
        }).onEvent("keydown", ".hotkey-input", function (ev) {
            if (ev.key === undefined) return
            if (ev.key !== "Process") {
                const key = ev.key.toLowerCase()
                const keyCombination = [
                    utils.metaKeyPressed(ev) ? "ctrl" : undefined,
                    utils.shiftKeyPressed(ev) ? "shift" : undefined,
                    utils.altKeyPressed(ev) ? "alt" : undefined,
                    ignoreKeys.includes(key) ? undefined : key,
                ]
                this.value = keyCombination.filter(Boolean).join("+")
                updateHotkey(this)
            }
            ev.stopPropagation()
            ev.preventDefault()
        }, true)
    },
})

const Control_Textarea = defineControl({
    controlOptions: {
        rows: 3,
        noResize: false,
    },
    setup: ({ field }) => defaultBlockLayout(field),
    create: ({ field, controlOptions }) => {
        const { key, placeholder } = getCommonHTMLAttrs(field)
        const rows = controlOptions.rows
        const cls = "textarea" + (controlOptions.noResize ? " no-resize" : "")
        return `<textarea class="${cls}" rows="${rows}" ${key} ${placeholder}></textarea>`
    },
    update: ({ element, value, field }) => {
        const textarea = element.querySelector(".textarea")
        if (textarea) {
            updateInputState(textarea, field, value || "")
        }
    },
    bindEvents: ({ form }) => {
        form.onEvent("change", ".textarea", function () {
            form.validateAndCommit(this.dataset.key, this.value)
        })
    },
})

const Control_Object = defineControl({
    controlOptions: {
        format: "JSON",
        rows: 3,
        noResize: false,
    },
    setup: ({ field, options }) => {
        defaultBlockLayout(field)
        registerRules(options, field.key, "isObject")
    },
    create: ({ field, controlOptions }) => {
        const { key, placeholder } = getCommonHTMLAttrs(field)
        const rows = controlOptions.rows
        const cls = "object" + (controlOptions.noResize ? " no-resize" : "")
        const textarea = `<textarea class="${cls}" rows="${rows}" ${key} ${placeholder}></textarea>`
        return `<div class="object-wrap">${textarea}<button class="object-confirm">${i18n.t("global", "confirm")}</button></div>`
    },
    update: ({ element, value, field, controlOptions }) => {
        const textarea = element.querySelector("textarea")
        if (textarea) {
            const serializer = Control_Object._getSerializer(controlOptions.format)
            updateInputState(textarea, field, serializer.stringify(value))
        }
    },
    bindEvents: ({ form }) => {
        form.onEvent("click", ".object-confirm", function () {
            const textarea = this.closest(".object-wrap").querySelector("textarea")
            const key = textarea.dataset.key
            const controlOptions = form.getControlOptionsFromKey(key)
            const serializer = Control_Object._getSerializer(controlOptions.format)

            let parsedValue
            try {
                parsedValue = serializer.parse(textarea.value || "{}")
            } catch (e) {
                console.error(e)
                const msg = i18n.t("global", "error.IncorrectFormatContent", { format: controlOptions.format })
                utils.notification.show(msg, "error")
                return
            }
            const ok = form.validateAndCommit(key, parsedValue)
            if (ok) {
                utils.notification.show(i18n.t("global", "success.submit"))
            }
        })
    },
    _getSerializer: (format) => Control_Object._serializers[format] || Control_Object._serializers.JSON,
    _serializers: {
        JSON: {
            parse: (str) => JSON.parse(str),
            stringify: (obj) => JSON.stringify(obj, null, "\t"),
        },
        TOML: {
            parse: (str) => utils.readToml(str),
            stringify: (obj) => utils.stringifyToml(obj),
        },
        YAML: {
            parse: (str) => utils.readYaml(str),
            stringify: (obj) => utils.stringifyYaml(obj),
        },
    },
})

const Control_Array = defineControl({
    controlOptions: {
        allowDuplicates: false,
        dataType: "string",  // number or string
    },
    setup: ({ field, options, form }) => {
        defaultBlockLayout(field)
        const correctType = ({ value, type }) => {
            const { dataType } = form.getControlOptions(field)
            const arr = (type === "push") ? [value] : value
            if (!Array.isArray(arr) || !arr.every(e => typeof e === dataType)) {
                return i18n.t("global", "error.pattern")
            }
        }
        const repeatable = ({ key, value, type }) => {
            const { allowDuplicates } = form.getControlOptions(field)
            if (allowDuplicates) return
            const duplication = (
                type === "push" && form.getData(key).includes(value)
                || type === "set" && new Set(value).size !== value.length
            )
            if (duplication) return new Error(i18n.t("global", "error.duplicateValue"))
        }
        registerRules(options, field.key, [correctType, repeatable])
    },
    create: ({ field }) => {
        const { key } = getCommonHTMLAttrs(field)
        return `<div class="array" ${key}>
                    <div class="array-item-input plugin-common-hidden" contenteditable="true"></div>
                    <div class="array-item-add">+ ${i18n.t("global", "add")}</div>
                </div>`
    },
    update: ({ element, value }) => {
        const arrayEl = element.querySelector(".array")
        if (arrayEl) {
            const inputEl = arrayEl.querySelector(".array-item-input")
            arrayEl.querySelectorAll(".array-item").forEach(item => item.remove())
            const itemsHtml = Control_Array._createItems(value)
            if (inputEl) {
                inputEl.insertAdjacentHTML("beforebegin", itemsHtml)
                inputEl.textContent = ""
            }
        }
    },
    bindEvents: ({ form }) => {
        form.onEvent("keydown", ".array-item-input", function (ev) {
            if (ev.key === "Enter" || ev.key === "Escape") {
                if (ev.key === "Enter") {
                    this.blur()
                } else {
                    this.textContent = ""
                    utils.hide(this)
                    utils.show(this.nextElementSibling)
                }
                ev.stopPropagation()
                ev.preventDefault()
            }
        }).onEvent("click", ".array-item-delete", function () {
            const itemEl = this.parentElement
            const arrayEl = this.closest(".array")
            const idx = [...arrayEl.children].indexOf(itemEl)
            const ok = form.validateAndCommit(arrayEl.dataset.key, idx, "removeIndex")
            if (ok) {
                itemEl.remove()
            }
        }).onEvent("click", ".array-item-add", function () {
            const addEl = this
            const inputEl = addEl.previousElementSibling
            utils.hide(addEl)
            utils.show(inputEl)
            inputEl.focus()
        }).onEvent("focusout", ".array-item-input", function () {
            const input = this
            if (utils.isHidden(input)) return
            const displayEl = input.parentElement
            const addEl = input.nextElementSibling
            const value = input.textContent
            const key = displayEl.dataset.key
            const controlOptions = form.getControlOptionsFromKey(key)
            const resolvedValue = (controlOptions.dataType === "number") ? Number(value) : value
            form.reactiveCommit(key, resolvedValue, "push")
            utils.hide(input)
            utils.show(addEl)
        })
    },
    _createItem: (value) => `
        <div class="array-item">
            <div class="array-item-value">${utils.escape(value.toString())}</div>
            <div class="array-item-delete">×</div>
        </div>
    `,
    _createItems: (items) => (Array.isArray(items) ? items : []).map(Control_Array._createItem).join(""),
})

const Control_Select = defineControl({
    controlOptions: {
        labelJoiner: ", ",
    },
    setup: ({ field, options, form }) => {
        normalizeOptionsAttr(field)
        registerItemLengthLimitRule({ field, options, form })
    },
    create: ({ field }) => {
        const toOptionItem = ([optionKey, optionShowName]) => {
            return `<div class="option-item" data-option-key="${optionKey}">${utils.escape(optionShowName)}</div>`
        }
        const selectOptions = Object.entries(field.options).map(toOptionItem).join("")
        const { key } = getCommonHTMLAttrs(field)
        return `<div class="select" ${key}>
                    <div class="select-wrap"><span class="select-value"></span><span class="select-icon fa fa-caret-down"></span></div>
                    <div class="option-box plugin-common-hidden">${selectOptions}</div>
                </div>`
    },
    update: ({ element, value, field, controlOptions }) => {
        const selectEl = element.querySelector(".select")
        const selectValueEl = element.querySelector(".select-value")
        const optionItems = element.querySelectorAll(".option-item")

        if (!selectEl || !selectValueEl) return

        const isMulti = Array.isArray(value)
        const selectedKeys = isMulti ? (value || []) : (value != null ? [String(value)] : [])
        optionItems.forEach(item => {
            item.dataset.choose = selectedKeys.includes(item.dataset.optionKey) ? "true" : "false"
        })
        const validSelectedLabels = selectedKeys.map(key => field.options[key]).filter(op => op != null)
        selectValueEl.textContent = validSelectedLabels.length > 0
            ? (isMulti ? Control_Select._joinSelected(validSelectedLabels, controlOptions.labelJoiner) : validSelectedLabels[0])
            : i18n.t("global", "empty")
    },
    bindEvents: ({ form, space }) => {
        form.onEvent("click", function () {
            if (space.select_shownOption) {
                utils.hide(space.select_shownOption)
            }
            space.select_shownOption = null
        }).onEvent("click", ".select-wrap", function (ev) {
            ev.stopPropagation()
            ev.preventDefault()
            const optionBox = this.nextElementSibling
            const boxes = [...form.getFormElement().querySelectorAll(".option-box")]
            boxes.filter(box => box !== optionBox).forEach(utils.hide)
            utils.toggleInvisible(optionBox)
            const isShown = utils.isShow(optionBox)
            if (isShown) {
                optionBox.scrollIntoView({ block: "nearest" })
            }
            space.select_shownOption = isShown ? optionBox : null
        }, true).onEvent("click", ".option-item", function () {
            const optionEl = this
            const toggleOptionKey = optionEl.dataset.optionKey

            const fieldKey = optionEl.closest(".select").dataset.key
            const value = form.getData(fieldKey)
            let commitValue = toggleOptionKey
            if (Array.isArray(value)) {
                if (optionEl.dataset.choose === "true") {
                    const idx = value.indexOf(toggleOptionKey)
                    commitValue = [...value.slice(0, idx), ...value.slice(idx + 1)]
                } else {
                    commitValue = [...value, toggleOptionKey]
                }
            }
            form.reactiveCommit(fieldKey, commitValue)
            utils.hide(optionEl.closest(".option-box"))
        })
    },
    _joinSelected: (labels, labelJoiner) => {
        return labels.length ? labels.join(labelJoiner) : i18n.t("global", "empty")
    },
})

const Control_Radio = defineControl({
    setup: ({ field }) => {
        normalizeOptionsAttr(field)
        defaultBlockLayout(field)
    },
    create: ({ field }) => {
        const prefix = utils.randomString()
        const toItem = ([k, v], idx) => {
            const id = `${prefix}_${idx}`
            return `
                <div class="radio-option">
                    <div class="radio-wrapper">
                        <input class="radio-input" type="radio" id="${id}" name="${field.key}" value="${k}">
                        <div class="radio-disc"></div>
                    </div>
                    <label class="radio-label" for="${id}">${v}</label>
                </div>
            `
        }
        const options = Object.entries(field.options).map(toItem).join("")
        const { key } = getCommonHTMLAttrs(field)
        return `<div class="radio" ${key}>${options}</div>`
    },
    update: ({ element, value }) => {
        const radioInputs = element.querySelectorAll(".radio-input")
        radioInputs.forEach(input => {
            input.checked = (input.value === String(value))
        })
    },
    bindEvents: ({ form }) => {
        form.onEvent("input", ".radio-input", function () {
            const name = this.getAttribute("name")
            form.validateAndCommit(name, this.value)
        })
    },
})

const Control_Checkbox = defineControl({
    setup: ({ field, options, form }) => {
        normalizeOptionsAttr(field)
        defaultBlockLayout(field)
        registerItemLengthLimitRule({ field, options, form })
    },
    create: ({ field }) => {
        const prefix = utils.randomString()
        const toItem = ([key, label], idx) => {
            const id = `${prefix}_${idx}`
            return `
                <div class="checkbox-option">
                    <div class="checkbox-wrapper">
                        <input class="checkbox-input" type="checkbox" id="${id}" name="${field.key}" value="${key}">
                        <div class="checkbox-square"></div>
                    </div>
                    <label class="checkbox-label" for="${id}">${label}</label>
                </div>
            `
        }
        const options = Object.entries(field.options).map(toItem).join("")
        const { key } = getCommonHTMLAttrs(field)
        return `<div class="checkbox" ${key}>${options}</div>`
    },
    update: ({ element, value }) => {
        const inputs = element.querySelectorAll(".checkbox-input")
        const selectedValues = Array.isArray(value) ? value.map(String) : []
        inputs.forEach(input => {
            input.checked = selectedValues.includes(input.value)
        })
    },
    bindEvents: ({ form }) => {
        form.onEvent("input", ".checkbox-input", function () {
            const checkboxEl = this.closest(".checkbox")
            const checkboxValues = [...checkboxEl.querySelectorAll(".checkbox-input:checked")].map(e => e.value)
            form.validateAndCommit(checkboxEl.dataset.key, checkboxValues)
        })
    },
})

const Control_Table = defineControl({
    setup: ({ field }) => defaultBlockLayout(field),
    create: ({ field }) => {
        const addButton = '<div class="table-add fa fa-plus"></div>'
        const th = [...Object.values(field.thMap), addButton]
        const table = utils.buildTable([th])
        const { key } = getCommonHTMLAttrs(field)
        return `<div class="table" ${key}>${table}</div>`
    },
    update: ({ element, value, field }) => {
        const tableEl = element.querySelector("table")
        if (!tableEl) return

        let tbody = tableEl.querySelector("tbody")
        if (tbody) {
            tbody.innerHTML = ""
        } else {
            tbody = document.createElement("tbody")
            tableEl.appendChild(tbody)
        }
        tbody.innerHTML = (value || [])
            .map(item => `<tr>${Control_Table._createTableRow(field.thMap, item).map(e => `<td>${e}</td>`).join("")}</tr>`)
            .join("")
    },
    bindEvents: ({ form }) => {
        form.onEvent("click", ".table-add", async function () {
            const tableEl = this.closest(".table")
            const key = tableEl.dataset.key
            const { nestedBoxes, defaultValues, thMap } = form.getField(key)
            const op = { title: i18n.t("global", "add"), schema: nestedBoxes, data: defaultValues }
            const { response, data } = await utils.formDialog.modal(op)
            if (response === 0) return
            const ok = form.validateAndCommit(key, data, "push")
            if (ok) {
                const row = Control_Table._createTableRow(thMap, data).map(e => `<td>${e}</td>`).join("")
                tableEl.querySelector("tbody").insertAdjacentHTML("beforeend", `<tr>${row}</tr>`)
                utils.notification.show(i18n.t("global", "success.add"))
            }
        }).onEvent("click", ".table-edit", async function () {
            const trEl = this.closest("tr")
            const tableEl = trEl.closest(".table")
            const idx = [...tableEl.querySelectorAll("tbody tr")].indexOf(trEl)
            const key = tableEl.dataset.key
            const rowValue = form.options.data[key][idx]
            const { nestedBoxes, defaultValues, thMap } = form.getField(key)
            const modalValues = utils.merge(defaultValues, rowValue)  // rowValue may be missing certain attributes
            const op = { title: i18n.t("global", "edit"), schema: nestedBoxes, data: modalValues }
            const { response, data } = await utils.formDialog.modal(op)
            if (response === 0) return
            const ok = form.validateAndCommit(`${key}.${idx}`, data, "set")
            if (ok) {
                const row = Control_Table._createTableRow(thMap, data)
                const tds = trEl.querySelectorAll("td")
                utils.zip(row, tds).slice(0, -1).forEach(([val, td]) => td.textContent = val)
                utils.notification.show(i18n.t("global", "success.edit"))
            }
        }).onEvent("click", ".table-delete", utils.createConsecutiveAction({
            threshold: 2,
            timeWindow: 3000,
            getIdentifier: (ev) => ev.target,
            onConfirmed: (ev) => {
                const trEl = ev.target.closest("tr")
                const tableEl = trEl.closest(".table")
                const idx = [...tableEl.querySelectorAll("tbody tr")].indexOf(trEl)
                const ok = form.validateAndCommit(tableEl.dataset.key, idx, "removeIndex")
                if (ok) {
                    trEl.remove()
                    utils.notification.show(i18n.t("global", "success.deleted"))
                }
            }
        }))
    },
    _createTableRow: (thMap, item) => {
        const header = utils.pick(item, [...Object.keys(thMap)])
        const headerValues = [...Object.values(header)].map(headerValue => typeof headerValue === "string" ? utils.escape(headerValue) : headerValue)
        const editButtons = '<div class="table-edit fa fa-pencil"></div><div class="table-delete fa fa-trash-o"></div>'
        return [...headerValues, editButtons]
    },
})

const Control_Composite = defineControl({
    onFormInit: ({ form, space }) => {
        space.composite_cache = {}
        form.traverseFields(field => {
            if (field.type !== "composite") return
            const val = form.getData(field.key)
            const values = utils.naiveCloneDeep({ ...field.defaultValues, ...(typeof val === "object" && val) })
            if (val) {
                form.setData(field.key, values)
            }
            space.composite_cache[field.key] = values
        }, form.options.schema)
    },
    setup: ({ field, form }) => {
        defaultBlockLayout(field)
        const currentValue = form.getData(field.key)
        if (currentValue === false || currentValue == null) {
            form.setData(field.key, false)
        } else if (typeof currentValue !== "object") {
            form.setData(field.key, field.defaultValues)
        }

        const parentEnabled = { [field.key]: { $bool: true } }
        const parentDependencies = field.dependencies ? [field.dependencies] : []
        for (const box of field.subSchema || []) {
            for (const subField of box.fields || []) {
                const subFieldDependencies = subField.dependencies ? [subField.dependencies] : []
                const allDeps = [...parentDependencies, parentEnabled, ...subFieldDependencies]
                subField.dependencies = { $and: allDeps }
            }
        }
    },
    create: ({ field, form }) => {
        const layout = form.options.layout
        const switchControlDef = form.options.controls["switch"]

        const newSwitchField = { ...field, type: "switch", isBlockLayout: false }
        const newSwitchControlOptions = { ...switchControlDef.controlOptions, className: "composite-switch" }
        const newSwitchFieldContext = { form, field: newSwitchField, controlOptions: newSwitchControlOptions }

        const toggleControlHtml = switchControlDef.create(newSwitchFieldContext)
        const fullToggleHtml = layout.createControlContainer(newSwitchField, toggleControlHtml, newSwitchControlOptions.className)
        const subBoxWrapper = `<div class="sub-box-wrapper" data-parent-key="${field.key}"></div>`
        return fullToggleHtml + subBoxWrapper
    },
    update: ({ element, value, field, form }) => {
        const input = element.querySelector(".composite-switch .switch-input")
        const container = element.querySelector(".sub-box-wrapper")
        if (input && container) {
            input.checked = typeof value === "object" && value != null
            input.disabled = !!field.disabled
            input.readOnly = !!field.readonly
        }
        const isChecked = typeof value === "object" && value != null
        utils.toggleInvisible(container, !isChecked)
        if (isChecked && container.childElementCount === 0) {
            form._fillForm(field.subSchema, container)
        }
    },
    bindEvents: ({ form, space }) => {
        form.onEvent("change", ".composite-switch .switch-input", function () {
            const input = this
            const key = input.dataset.key
            const isChecked = input.checked
            const cache = space.composite_cache[key] || {}
            const valueToCommit = isChecked ? cache : false
            form.reactiveCommit(key, valueToCommit)
        })
    },
})

FastForm.registerControl("switch", Control_Switch)
FastForm.registerControl("text", Control_Text)
FastForm.registerControl("color", Control_Color)
FastForm.registerControl("number", Control_Number)
FastForm.registerControl("unit", Control_Unit)
FastForm.registerControl("range", Control_Range)
FastForm.registerControl("action", Control_Action)
FastForm.registerControl("static", Control_Static)
FastForm.registerControl("custom", Control_Custom)
FastForm.registerControl("hint", Control_Hint)
FastForm.registerControl("hotkey", Control_Hotkey)
FastForm.registerControl("textarea", Control_Textarea)
FastForm.registerControl("object", Control_Object)
FastForm.registerControl("array", Control_Array)
FastForm.registerControl("select", Control_Select)
FastForm.registerControl("radio", Control_Radio)
FastForm.registerControl("checkbox", Control_Checkbox)
FastForm.registerControl("table", Control_Table)
FastForm.registerControl("composite", Control_Composite)

customElements.define("fast-form", FastForm)
