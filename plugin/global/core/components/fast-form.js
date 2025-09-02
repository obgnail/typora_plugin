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
        onRender: (form) => void 0,
        onParseValue: (changeContext) => changeContext.value,
        onBeforeValidate: (changeContext) => void 0,         // return true or [] for success; return Error or [Error, ...] for failure
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
        onBeforeCommit: (changeContext, currentData) => void 0,
        onCommit: (changeContext, form) => form.dispatchEvent(new CustomEvent("form-crud", { detail: changeContext })),
        onAfterCommit: (changeContext, newData, oldData) => void 0,
    }
    static validators = {
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
    static conditionEvaluators = {
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
    static comparisonEvaluators = {
        $eq: { evaluate: (actual, expected) => actual === expected },
        $ne: { evaluate: (actual, expected) => actual !== expected },
        $gt: { evaluate: (actual, expected) => actual > expected },
        $gte: { evaluate: (actual, expected) => actual >= expected },
        $lt: { evaluate: (actual, expected) => actual < expected },
        $lte: { evaluate: (actual, expected) => actual <= expected },
        $in: { evaluate: (actual, expected) => Array.isArray(expected) && expected.includes(actual) },
        $bool: { evaluate: (actual, expected) => Boolean(actual) === expected },
    }
    static controlLayout = {
        createControlWrapper: (field, controlHtml, className) => {
            const isBlockLayout = field.isBlockLayout || false
            const label = isBlockLayout ? "" : `<div class="control-left">${field.label}${this.controlLayout.createTooltip(field)}</div>`
            const control = isBlockLayout ? controlHtml : `<div class="control-right">${controlHtml}</div>`
            const cls = "control" + (isBlockLayout ? " control-block" : "") + (className ? ` ${className}` : "")
            return `<div class="${cls}" data-type="${field.type}" data-control="${field.key}">${label}${control}</div>`
        },
        createTooltip: (field) => {
            return field.tooltip
                ? `<span class="tooltip"><span class="fa fa-info-circle"></span><span>${utils.escape(field.tooltip).replace("\n", "<br>")}</span></span>`
                : ""
        },
        findControl: (key, form) => {
            return form.querySelector(`[data-control="${CSS.escape(key)}"]`)
        }
    }

    static registerControl(name, definition) {
        if (!definition || typeof definition.create !== "function") {
            throw new Error(`Control Error: control '${name}' must be an object with 'create' function.`)
        }
        if (this.controls.hasOwnProperty(name)) {
            console.warn(`FastForm Warning: Overwriting control definition for type '${name}'.`)
        }
        this.controls[name] = definition
        if (definition.controlOptions && typeof definition.controlOptions === "object") {
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
    }

    static registerValidator(name, definition) {
        if (typeof definition !== "function") {
            throw new Error(`Validator Error: validator '${name}' must be a function.`)
        }
        if (this.validators.hasOwnProperty(name)) {
            console.warn(`FastForm Warning: Overwriting validator definition for type '${name}'.`)
        }
        this.validators[name] = definition
    }

    static registerConditionEvaluator(name, definition) {
        if (!name.startsWith("$")) {
            throw new Error(`Condition Evaluator Error: handler for '${name}' must start with '$'.`)
        }
        if (typeof definition.evaluate !== "function" || typeof definition.collectTriggers !== "function") {
            throw new Error(`Condition Evaluator Error: '${name}' must be an object with 'evaluate' and 'collectTriggers' functions.`)
        }
        if (definition.hasOwnProperty("beforeEvaluate") && typeof definition.beforeEvaluate !== "function") {
            throw new Error(`Condition Evaluator Error: 'beforeEvaluate' for '${name}' must be a function.`)
        }
        if (this.conditionEvaluators.hasOwnProperty(name)) {
            console.warn(`FastForm Warning: Overwriting Condition evaluator definition for '${name}'.`)
        }
        this.conditionEvaluators[name] = definition
    }

    static registerComparisonEvaluator(name, definition) {
        if (!name.startsWith("$")) {
            throw new Error(`Comparison Evaluator Error: handler for '${name}' must start with '$'.`)
        }
        if (typeof definition.evaluate !== "function") {
            throw new Error(`Comparison Evaluator Error: '${name}' must be an object with an 'evaluate' function.`)
        }
        if (definition.hasOwnProperty("beforeEvaluate") && typeof definition.beforeEvaluate !== "function") {
            throw new Error(`Comparison Evaluator Error: 'beforeEvaluate' for '${name}' must be a function.`)
        }
        if (this.comparisonEvaluators.hasOwnProperty(name)) {
            console.warn(`FastForm Warning: Overwriting comparison evaluator definition for '${name}'.`)
        }
        this.comparisonEvaluators[name] = definition
    }

    static setControlLayout = (definition) => {
        for (const [api, val] of Object.entries(this.controlLayout)) {
            if (!definition[api] || typeof definition[api] !== typeof val) {
                throw new Error(`Control Layout Error: '${api}' must be a ${typeof val}.`)
            }
        }
        this.controlLayout = definition
    }

    constructor() {
        super()
        const root = this.attachShadow({ mode: "open" })
        root.adoptedStyleSheets = sharedSheets
        root.innerHTML = this.constructor.template

        this.form = root.querySelector("#form")
        this.space = {}
        this.options = {
            ...this.constructor.featureOptions,
            hooks: this.constructor.hooks,
            validators: this.constructor.validators,
            conditionEvaluators: this.constructor.conditionEvaluators,
            comparisonEvaluators: this.constructor.comparisonEvaluators,
            controls: this.constructor.controls,
            controlOptions: this.constructor.controlOptions,

            schema: [],
            data: {},
            rules: {},
            watchers: {},
            cascades: {},
        }
        this.helper = {
            fields: {},
            watchTriggerMap: {},
            cleanupFunctions: [],
            updateQueue: new Map(),
            isUpdateTaskQueued: false,
        }
    }

    disconnectedCallback() {
        this._unbindAllEvents()
    }

    render = (options) => {
        this._unbindAllEvents()

        this.space = {}
        this.options = this._initOptions(options)
        this._normalize(this.options)
        this._initHelper(this.options)

        this._fillFields(this.options.schema, this.form)
        this._bindAllEvents(this.options.controls)
        this._executeWatchers(Object.values(this.options.watchers))
        this._invokeHook("onRender", this)
    }

    _initOptions(options) {
        return {
            ...this.options,
            schema: utils.naiveCloneDeep(options.schema || []),
            data: utils.naiveCloneDeep(options.data || {}),
            rules: { ...options.rules },
            watchers: { ...options.watchers },
            actions: { ...options.actions },
            hooks: { ...this.constructor.hooks, ...options.hooks },
            validators: { ...this.constructor.validators, ...options.validators },
            conditionEvaluators: { ...this.constructor.conditionEvaluators, ...options.conditionEvaluators },
            comparisonEvaluators: { ...this.constructor.comparisonEvaluators, ...options.comparisonEvaluators },
            controls: { ...this.constructor.controls, ...options.controls },
            controlOptions: { ...this.constructor.controlOptions, ...options.controlOptions },
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

    getField = (key) => this.helper.fields[key]

    getFieldValue = (key) => utils.nestedPropertyHelpers.get(this.options.data, key)

    // type: set/push/removeIndex
    setFieldValue = (key, value, type = "set") => {
        this.helper.updateQueue.set(key, { value, type })
        // If an update task is not already scheduled, schedule one.
        // This ensures that multiple synchronous calls to setFieldValue result in only one batch update.
        if (!this.helper.isUpdateTaskQueued) {
            this.helper.isUpdateTaskQueued = true
            queueMicrotask(() => this._processUpdateQueue())
        }
    }

    // Processes all pending field value changes in a single batch.
    _processUpdateQueue() {
        const changesToProcess = new Map(this.helper.updateQueue)
        this.helper.updateQueue.clear()
        // Reset the flag to allow new tasks to be queued for the next event loop tick.
        this.helper.isUpdateTaskQueued = false

        if (changesToProcess.size === 0) return

        const successfullyChangedKeys = new Set()
        const watchersToRun = new Set()

        // Step 1: Validate and commit all changes without triggering watchers inside the loop.
        for (const [key, { value, type }] of changesToProcess.entries()) {
            const changeContext = { key, value, type }
            const isValid = this._processSingleChange(changeContext)
            if (isValid) {
                successfullyChangedKeys.add(key)
            }
        }

        // Step 2: After all data is updated, update all affected UI controls in one go.
        successfullyChangedKeys.forEach(key => {
            const newValue = this.getFieldValue(key)
            this.forceUpdateControl(key, newValue)
        })

        // Step 3: Collect all relevant watchers based on successful changes and run them only once.
        successfullyChangedKeys.forEach(key => {
            const triggeredWatchers = this.helper.watchTriggerMap[key]
            if (triggeredWatchers) {
                triggeredWatchers.forEach(watcher => watchersToRun.add(watcher))
            }
        })
        if (watchersToRun.size > 0) {
            this._executeWatchers(watchersToRun)
        }
    }

    _processSingleChange(changeContext) {
        if (changeContext.type !== "removeIndex") {
            changeContext.value = this._invokeHook("onParseValue", changeContext)
        }
        const errors = (changeContext.type !== "removeIndex") ? this._validate(changeContext) : []
        const isValid = Array.isArray(errors) && errors.length === 0
        if (isValid) {
            this._commit(changeContext)
        } else {
            this._invokeHook("onValidateFailed", changeContext, errors)
        }
        return isValid
    }

    validateAndCommit = (key, value, type = "set") => {
        const changeContext = { key, value, type }
        const oldValue = this.getFieldValue(key)
        const isValid = this._processSingleChange(changeContext)
        if (isValid) {
            const watchers = this.helper.watchTriggerMap[changeContext.key] || []
            this._executeWatchers(watchers)
        } else {
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

    /**
     * onEvent(events, handler, [options])                 -- onEvent("click", Fn)
     * onEvent(events, selector, handler, [options])       -- onEvent("click", ".my-button", Fn)
     * onEvent(events, selector, data, handler, [options]) -- onEvent("click", ".my-button", { id: 123 }, Fn)
     * onEvent(eventsMap, [options])                       -- onEvent({ click: Fn1, mouseenter: Fn2 })
     * onEvent(eventsMap, selector, [options])             -- onEvent({ click: Fn1, mouseenter: Fn2 }, ".my-button")
     * onEvent(eventsMap, selector, data, [options])       -- onEvent({ click: Fn1, mouseenter: Fn2 }, ".my-button", { id: 456 })
     */
    onEvent = (...args) => {
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
            this.form.addEventListener(eventType, listener, options)
            this.helper.cleanupFunctions.push(() => this.form.removeEventListener(eventType, listener, options))
        }
        return this
    }

    forceUpdateControl = (key, value = this.getFieldValue(key)) => {
        const field = this.getField(key)
        if (!field) return

        const controlDef = this.options.controls[field.type]
        if (!controlDef || typeof controlDef.update !== "function") return

        const element = this.constructor.controlLayout.findControl(key, this.form)
        if (!element) return

        controlDef.update({
            element,
            value,
            field,
            form: this,
            controlOptions: this.getControlOptions(field),
            data: this.options.data
        })
    }

    _fillFields(schema, container, updateControl = true) {
        const createField = (field) => {
            const controlDef = this.options.controls[field.type]
            if (!controlDef) {
                console.warn(`FastForm Warning: No control registered for type "${field.type}".`)
                return ""
            }
            const controlOptions = this.getControlOptions(field)
            const controlContext = { field, controlOptions, form: this }
            const controlHtml = controlDef.create(controlContext)
            return this.constructor.controlLayout.createControlWrapper(field, controlHtml, controlOptions.className)
        }
        const createBox = ({ title, fields = [] }) => {
            const title_ = title ? `<div class="title">${title}</div>` : ""
            const items = fields.map(createField).join("")
            return title_ + `<div class="box">${items}</div>`
        }
        container.innerHTML = schema.map(createBox).join("")
        if (updateControl) {
            this.traverseFields(field => {
                if (field.key) {
                    const value = utils.nestedPropertyHelpers.get(this.options.data, field.key)
                    this.forceUpdateControl(field.key, value)
                }
            }, schema)
        }
    }

    _unbindAllEvents() {
        this.helper.cleanupFunctions.forEach(cleanup => cleanup())
        this.helper.cleanupFunctions = []
    }

    _bindAllEvents(controls) {
        this.onEvent("keydown", "input:not(.hotkey-input), textarea", function (ev) {
            if (ev.key === "a" && utils.metaKeyPressed(ev)) {
                this.select()
                ev.stopPropagation()
                ev.preventDefault()
            }
        })
        for (const control of Object.values(controls)) {
            if (typeof control.bindEvents === "function") {
                control.bindEvents({ form: this, space: this.space })
            }
        }
    }

    _normalize = (options) => {
        const normalizeControls = () => {
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

        const normalizeFeatures = () => {
            const addWatcher = (key, watcher) => {
                if (options.watchers.hasOwnProperty(key)) {
                    console.warn(`FastForm Warning: A feature tried to add a watcher with a conflicting key: ${key}. The original watcher will be kept.`)
                    return
                }
                options.watchers[key] = watcher
            }
            const featureContext = { form: this, options, addWatcher }
            for (const feature of Object.values(this.constructor.features)) {
                if (typeof feature.normalize === "function") {
                    feature.normalize(featureContext)
                }
            }
        }

        const normalizeRules = () => {
            const rules = {}
            Object.entries(options.rules).forEach(([key, validators]) => {
                validators = Array.isArray(validators) ? validators : [validators]
                rules[key] = validators.map(validator => {
                    switch (typeof validator) {
                        case "function":
                            return validator
                        case "string":
                            const builtinValidator = options.validators[validator]
                            if (builtinValidator) {
                                return builtinValidator
                            }
                            break
                        case "object":
                            if (typeof validator.validate === "function") {
                                return validator.validate
                            }
                            const builtinValidatorFactory = options.validators[validator.name]
                            if (builtinValidatorFactory) {
                                return builtinValidatorFactory(...validator.args)
                            }
                            break
                    }
                    const msg = typeof validator === "object" ? JSON.stringify(validator) : validator
                    throw new Error(`Invalid Rule: ${msg}`)
                })
            })
            options.rules = rules
        }

        normalizeControls()
        normalizeFeatures()
        normalizeRules()
    }

    _initHelper = (options) => {
        const collectFields = () => {
            const fields = {}
            this.traverseFields(field => {
                if (field.key) {
                    fields[field.key] = field
                }
            }, options.schema)
            return fields
        }

        const buildWatchTriggerMap = () => {
            const triggerMap = {}
            Object.values(options.watchers).forEach(watcher => {
                if (!watcher.when) return
                const triggerKeys = collectConditionTriggers(watcher.when)
                triggerKeys.forEach(key => {
                    if (!triggerMap.hasOwnProperty(key)) {
                        triggerMap[key] = new Set()
                    }
                    triggerMap[key].add(watcher)
                })
            })
            return triggerMap
        }

        const collectConditionTriggers = (cond, keys = new Set()) => {
            const context = {
                collectTriggers: (subCond) => collectConditionTriggers(subCond, keys),
                getField: (key) => this.helper.fields[key],
                addKey: (key) => keys.add(key)
            }
            for (const [evaluatorName, handler] of Object.entries(options.conditionEvaluators)) {
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

        this.helper.fields = collectFields()
        this.helper.watchTriggerMap = buildWatchTriggerMap()
    }

    _invokeHook(hookName, ...args) {
        const fn = this.options.hooks[hookName]
        if (typeof fn === "function") {
            return fn(...args)
        }
    }

    _validate(changeContext) {
        const beforeHookResult = this._invokeHook("onBeforeValidate", changeContext)
        if (beforeHookResult === true) return []
        if (beforeHookResult instanceof Error) return [beforeHookResult]
        if (Array.isArray(beforeHookResult)) return beforeHookResult

        let errors = this._invokeRules(changeContext)

        const afterHookResult = this._invokeHook("onAfterValidate", changeContext, errors)
        if (afterHookResult === true) return []
        if (afterHookResult instanceof Error) return [afterHookResult]
        if (Array.isArray(afterHookResult)) return afterHookResult

        return errors
    }

    _invokeRules(changeContext) {
        const validators = this.options.rules[changeContext.key]
        if (!validators) return []

        return validators
            .map(validator => {
                try {
                    return validator(changeContext, this.options.data)
                } catch (err) {
                    return new Error(err)
                }
            })
            .filter(ret => ret !== true && ret != null)
            .map(err => (typeof err.message === "string") ? err : new Error(err.toString()))
    }

    _commit(changeContext) {
        let oldData, newData
        const hasBeforeCommitHook = this.options.hooks.onBeforeCommit !== this.constructor.hooks.onBeforeCommit
        const hasAfterCommitHook = this.options.hooks.onAfterCommit !== this.constructor.hooks.onAfterCommit

        if (hasBeforeCommitHook || hasAfterCommitHook) {
            oldData = utils.naiveCloneDeep(this.options.data)
        }

        if (hasBeforeCommitHook) {
            this._invokeHook("onBeforeCommit", changeContext, oldData)
        }

        utils.nestedPropertyHelpers[changeContext.type](this.options.data, changeContext.key, changeContext.value)

        this._invokeHook("onCommit", changeContext, this)

        if (hasAfterCommitHook) {
            newData = this.options.data
            this._invokeHook("onAfterCommit", changeContext, newData, oldData)
        }
    }

    _executeWatchers(initialWatchers) {
        const watcherQueue = new Set(initialWatchers)
        const processedWatcher = new Set() // Prevent infinite loops within a single run

        const effectContext = {
            getControl: (key) => this.form.querySelector(`[data-control="${key}"]`),
            getValue: (key) => this.getFieldValue(key),
            setValue: (key, value, type) => this.setFieldValue(key, value, type),
        }

        while (watcherQueue.size > 0) {
            const watcher = watcherQueue.values().next().value
            watcherQueue.delete(watcher)

            // A->B->A check within a single synchronous run
            if (processedWatcher.has(watcher)) continue

            if (typeof watcher.effect === "function") {
                const isConditionMet = this._evaluateCondition(watcher.when)
                watcher.effect(isConditionMet, effectContext)
            }
            processedWatcher.add(watcher)
        }
    }

    _evaluateCondition(cond) {
        const context = {
            comparisonEvaluators: this.options.comparisonEvaluators,
            getValue: (key) => this.getFieldValue(key),
            evaluate: (subCond) => this._evaluateCondition(subCond, context),
            getField: (key) => this.helper.fields[key],
            isFieldEnabled: (key) => {
                const field = this.helper.fields[key]
                return field
                    ? field.dependencies ? this._evaluateCondition(field.dependencies) : true
                    : false
            },
            compare: (actual, finalCond, defaultOperator = "$eq") => {
                if (finalCond == null || typeof finalCond !== "object") {
                    finalCond = { [defaultOperator]: finalCond }
                }
                return Object.entries(finalCond).every(([operator, expected]) => {
                    const handler = this.options.comparisonEvaluators[operator]
                    if (handler && typeof handler.evaluate === "function") {
                        return handler.evaluate(actual, expected)
                    } else {
                        console.warn(`FastForm Warning: Unknown comparison operator "${operator}".`)
                        return false
                    }
                })
            },
        }

        for (const [evaluatorName, handler] of Object.entries(this.options.conditionEvaluators)) {
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
                const handler = this.options.comparisonEvaluators[operator]
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
}

FastForm.registerFeature("dependencies", {
    featureOptions: {
        dependencies: {},
        disableEffect: "readonly", // "hide" or "readonly"
    },
    normalize: ({ form, options, addWatcher }) => {
        const allDependencies = {}
        if (options.dependencies && typeof options.dependencies === "object") {
            Object.assign(allDependencies, options.dependencies)
        }
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
            const watcher = {
                when: whenCondition,
                effect: (isConditionMet, context) => {
                    const control = context.getControl(fieldKey)
                    if (control) {
                        const disabledCls = (options.disableEffect === "hide") ? "plugin-common-hidden" : "plugin-common-readonly"
                        control.classList.toggle(disabledCls, !isConditionMet)
                    }
                },
                isDependency: true, // Special property to identify it as an auto-generated watcher
                targetKey: fieldKey,
            }
            addWatcher(watcherKey, watcher)
        })
    }
})

FastForm.registerFeature("cascades", {
    featureOptions: {
        cascades: {},
    },
    normalize: ({ options, addWatcher }) => {
        if (!options.cascades || typeof options.cascades !== "object") return

        Object.entries(options.cascades).forEach(([cascadeKey, rule]) => {
            const watcherKey = `_cascade_${cascadeKey}`
            if (!rule || !rule.hasOwnProperty("target") || !rule.hasOwnProperty("value")) {
                console.warn(`FastForm Warning: Cascade rule "${cascadeKey}" is missing a "target" or "value".`)
                return
            }
            const watcher = {
                when: rule.when,
                effect: (isConditionMet, context) => {
                    if (!isConditionMet) return
                    const oldValue = context.getValue(rule.target)
                    const newValue = (typeof rule.value === "function") ? rule.value(context) : rule.value
                    if (!utils.deepEqual(newValue, oldValue)) {
                        context.setValue(rule.target, newValue)
                    }
                },
                isCascade: true, // Special property to identify it as a cascade
                targetKey: rule.target,
            }
            addWatcher(watcherKey, watcher)
        })
    }
})

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
    const { validators } = form.constructor
    const rules = [validators.required]
    if (typeof min === "number") {
        rules.push(validators.min(min))
    }
    if (typeof max === "number") {
        rules.push(validators.max(max))
    }
    registerRules(options, key, rules)
}

function registerItemLengthLimitRule({ field, options, form }) {
    registerRules(options, field.key, ({ key, value, type }) => {
        const currentValue = form.getFieldValue(key)
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

// `control` is a static, stateless configuration object
function defineControl(control) {
    return control
}

const Switch_Control = defineControl({
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
    }
})

const Text_Control = defineControl({
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
    }
})

const Number_Control = defineControl({
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
    }
})

const Unit_Control = defineControl({
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
    }
})

const Range_Control = defineControl({
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
            valueDisplay.textContent = Range_Control._toFixed2(resolvedValue)
        }
    },
    bindEvents: ({ form }) => {
        form.onEvent("input", ".range-input", function () {
            this.nextElementSibling.textContent = Range_Control._toFixed2(Number(this.value))
        }).onEvent("change", ".range-input", function () {
            const value = Number(this.value)
            form.validateAndCommit(this.dataset.key, value)
        })
    },
    _toFixed2: (num) => {
        return Number.isInteger(num) ? num : num.toFixed(2)
    },
})

const Action_Control = defineControl({
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

const Static_Control = defineControl({
    create: () => `<div class="static"></div>`,
    update: ({ element, value }) => {
        const staticEl = element.querySelector(".static")
        if (staticEl) {
            staticEl.textContent = utils.escape(value)
        }
    },
})

const Custom_Control = defineControl({
    setup: ({ field }) => {
        defaultBlockLayout(field)
        setRandomKey(field)
    },
    create: ({ field }) => {
        const content = field.unsafe ? field.content : utils.escape(field.content)
        return `<div class="custom-wrap">${content}</div>`
    },
})

const Hint_Control = defineControl({
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

const Hotkey_Control = defineControl({
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
    }
})

const Textarea_Control = defineControl({
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
    }
})

const Object_Control = defineControl({
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
            const serializer = Object_Control._getSerializer(controlOptions.format)
            updateInputState(textarea, field, serializer.stringify(value))
        }
    },
    bindEvents: ({ form }) => {
        form.onEvent("click", ".object-confirm", function () {
            const textarea = this.closest(".object-wrap").querySelector("textarea")
            const key = textarea.dataset.key
            const controlOptions = form.getControlOptionsFromKey(key)
            const serializer = Object_Control._getSerializer(controlOptions.format)

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
    _getSerializer: (format) => Object_Control._serializers[format] || Object_Control._serializers.JSON,
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

const Array_Control = defineControl({
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
                type === "push" && form.getFieldValue(key).includes(value)
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
            const itemsHtml = Array_Control._createItems(value)
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
    _createItems: (items) => (Array.isArray(items) ? items : []).map(Array_Control._createItem).join("")
})

const Select_Control = defineControl({
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
            ? (isMulti ? Select_Control._joinSelected(validSelectedLabels, controlOptions.labelJoiner) : validSelectedLabels[0])
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
            const boxes = [...form.form.querySelectorAll(".option-box")]
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
            const value = form.getFieldValue(fieldKey)
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

const Radio_Control = defineControl({
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
    }
})

const Checkbox_Control = defineControl({
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
    }
})

const Table_Control = defineControl({
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
            .map(item => `<tr>${Table_Control._createTableRow(field.thMap, item).map(e => `<td>${e}</td>`).join("")}</tr>`)
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
                const row = Table_Control._createTableRow(thMap, data).map(e => `<td>${e}</td>`).join("")
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
            const ok = form.validateAndCommit(`${key}.${idx}`, data)
            if (ok) {
                const row = Table_Control._createTableRow(thMap, data)
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

const Composite_Control = defineControl({
    onFormInit: ({ form, space }) => {
        space.composite_cache = {}
        form.traverseFields(field => {
            if (field.type !== "composite") return
            const val = utils.nestedPropertyHelpers.get(form.options.data, field.key)
            const values = utils.naiveCloneDeep({ ...field.defaultValues, ...(typeof val === "object" && val) })
            if (val) {
                utils.nestedPropertyHelpers.set(form.options.data, field.key, values)
            }
            space.composite_cache[field.key] = values
        }, form.options.schema)
    },
    setup: ({ field, form }) => {
        defaultBlockLayout(field)

        const currentValue = utils.nestedPropertyHelpers.get(form.options.data, field.key)
        if (currentValue === false || currentValue == null) {
            utils.nestedPropertyHelpers.set(form.options.data, field.key, false)
        } else if (typeof currentValue !== "object") {
            utils.nestedPropertyHelpers.set(form.options.data, field.key, field.defaultValues)
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
        const layout = form.constructor.controlLayout
        const switchControlDef = form.options.controls["switch"]

        const newSwitchField = { ...field, type: "switch", isBlockLayout: false }
        const newSwitchControlOptions = { ...switchControlDef.controlOptions, className: "composite-switch" }
        const newSwitchFieldContext = { form, field: newSwitchField, controlOptions: newSwitchControlOptions }

        const toggleControlHtml = switchControlDef.create(newSwitchFieldContext)
        const fullToggleHtml = layout.createControlWrapper(newSwitchField, toggleControlHtml, newSwitchControlOptions.className)
        const subBoxWrapper = `<div class="sub-box-wrapper" data-parent-key="${field.key}"></div>`
        return fullToggleHtml + subBoxWrapper
    },
    update: ({ element, value, field, form }) => {
        const input = element.querySelector(".composite-switch .switch-input")
        const container = element.querySelector(".sub-box-wrapper")
        if (input && container) {
            input.checked = typeof value === "object" && value != null
            input.disabled = !!field.disabled
        }
        const isChecked = typeof value === "object" && value != null
        utils.toggleInvisible(container, !isChecked)
        if (isChecked && container.childElementCount === 0) {
            form._fillFields(field.subSchema, container)
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

FastForm.registerControl("switch", Switch_Control)
FastForm.registerControl("text", Text_Control)
FastForm.registerControl("number", Number_Control)
FastForm.registerControl("unit", Unit_Control)
FastForm.registerControl("range", Range_Control)
FastForm.registerControl("action", Action_Control)
FastForm.registerControl("static", Static_Control)
FastForm.registerControl("custom", Custom_Control)
FastForm.registerControl("hint", Hint_Control)
FastForm.registerControl("hotkey", Hotkey_Control)
FastForm.registerControl("textarea", Textarea_Control)
FastForm.registerControl("object", Object_Control)
FastForm.registerControl("array", Array_Control)
FastForm.registerControl("select", Select_Control)
FastForm.registerControl("radio", Radio_Control)
FastForm.registerControl("checkbox", Checkbox_Control)
FastForm.registerControl("table", Table_Control)
FastForm.registerControl("composite", Composite_Control)

// usage:
//  $follow: "fieldKey1"
//  $follow: ["fieldKey1", "fieldKey2"]
FastForm.registerConditionEvaluator("$follow", {
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
            return ctx.isFieldEnabled(fieldKeyOrKeys)
        } else if (Array.isArray(fieldKeyOrKeys)) {
            return fieldKeyOrKeys.every(key => typeof key === "string" && ctx.isFieldEnabled(key))
        }
        return false
    },
})

// usage:
//   $length: { fieldKey1: 3, fieldKey2: 4 }
//   $length: { fieldKey1: { $gt: 1 }, fieldKey2: { $eq: 4 } }
FastForm.registerConditionEvaluator("$length", {
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
    }
})

FastForm.registerComparisonEvaluator("$regex", {
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
    }
})

function Try(fn, buildErr = utils.identity) {
    try {
        fn()
    } catch (err) {
        return new Error(buildErr(err))
    }
}

FastForm.registerValidator("url", ({ value }) => {
    if (!value) return true
    const pattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/
    return pattern.test(value) ? true : i18n.t("global", "error.invalidURL")
})

FastForm.registerValidator("regex", ({ value }) => Try(
    () => value && new RegExp(value),
    () => `Error Regex: ${value}`,
))

FastForm.registerValidator("path", ({ value }) => Try(
    () => value && utils.Package.Fs.accessSync(utils.Package.Path.resolve(value)),
    () => `No such path: ${utils.Package.Path.resolve(value)}`,
))

customElements.define("fast-form", FastForm)
