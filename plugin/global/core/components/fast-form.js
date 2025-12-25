const { sharedSheets } = require("./common")
const utils = require("../utils")
const i18n = require("../i18n")

class FastForm extends HTMLElement {
    static style = '<link rel="stylesheet" href="./plugin/global/styles/plugin-fast-form.css" crossorigin="anonymous">'
    static controls = {}
    static features = {}
    static layouts = {}

    static registerControl = (name, definition) => {
        validateDefinition(name, definition, {
            create: { required: true, type: "function" },
            update: { type: "function" },
            bindEvents: { type: "function" },
            setup: { type: "function" },
            setupType: { type: "function" },
            onMount: { type: "function" },
            controlOptions: { type: "plainObject" },
        })
        if (this.controls.hasOwnProperty(name)) {
            console.warn(`FastForm Warning: Overwriting control for '${name}'.`)
        }
        this.controls[name] = definition
    }

    static registerFeature = (name, definition) => {
        validateDefinition(name, definition, {
            configure: { type: "function" },
            compile: { type: "function" },
            install: { type: "function" },
            featureOptions: { type: "plainObject" },
        })
        if (this.features.hasOwnProperty(name)) {
            console.warn(`FastForm Warning: Overwriting feature for '${name}'.`)
        }
        this.features[name] = definition
        if (typeof definition.install === "function") {
            definition.install(this)
        }
    }

    static registerLayout = (name, definition) => {
        validateDefinition(name, definition, {
            render: { required: true, type: "function" },
            findBox: { required: true, type: "function" },
            findControl: { required: true, type: "function" },
        })
        if (this.layouts.hasOwnProperty(name)) {
            console.warn(`FastForm Warning: Overwriting layout for '${name}'.`)
        }
        this.layouts[name] = definition
    }

    constructor() {
        super()
        const root = this.attachShadow({ mode: "open" })
        root.adoptedStyleSheets = sharedSheets
        root.innerHTML = this.constructor.style + '<div id="form"></div>'

        this.form = root.querySelector("#form")
        this.options = {}
        this.states = new States()
        this.hooks = this._createHooksManager()
        this._runtime = {
            fields: {},
            cleanups: [],
            apis: new Map(),
            pendingChanges: new Map(),
            isTaskQueued: false,
        }
    }

    disconnectedCallback() {
        this.clear()
    }

    render = (options) => {
        this.clear()

        this.options = this._initOptions(options)
        this._normalizeSchema(this.options.schema)
        this._configureFeatures(this.options)  // register feature APIs and hooks
        this._normalizeControls(this.options)  // init control and expand options
        this._compileFeatures(this.options)    // compile features base on the final options
        this._applyUserHooks(this.options.hooks)
        this._collectFields(this.options)

        this.options.schema = this.hooks.invoke("onSchemaReady", this.options.schema, this) || this.options.schema

        this.fillForm(this.options.schema, this.form)
        this._bindAllEvents(this.options.controls)
        this.hooks.invoke("onRender", this)
    }

    _createHooksManager = () => {
        const getValidationResult = (result) => {
            return result instanceof Error
                ? [result]
                : Array.isArray(result) ? result : []
        }
        const defaultHooks = {
            onSchemaReady: (schema, form) => schema,
            onRender: (form) => void 0,
            onProcessValue: (value, changeContext) => value,
            onBeforeValidate: (changeContext) => [],             // return true or [] for success; return Error or [Error, ...] for failure
            onValidate: (changeContext) => [],                   // return true or [] for success; return Error or [Error, ...] for failure
            onAfterValidate: (errors, changeContext) => errors,  // return true or [] for success; return Error or [Error, ...] for failure
            onValidateFailed: (errors, changeContext) => {
                if (!Array.isArray(errors) || errors.length === 0) return
                const err = errors[0]  // show first error only
                const msg = (typeof err.message === "string")
                    ? err.message || err.toString()
                    : typeof err === "string" ? err : "Verification Failed"
                utils.notification.show(msg, "error")
            },
            onBeforeCommit: (changeContext, form) => void 0,
            onCommit: (changeContext, form) => form.dispatchEvent(new CustomEvent("form-crud", { detail: changeContext })),
            onAfterCommit: (changeContext, form) => void 0,
        }
        const hookStrategies = {
            onSchemaReady: { strategy: "pipeline" },
            onProcessValue: { strategy: "pipeline" },
            onAfterValidate: { strategy: "pipeline" },
            onBeforeValidate: { strategy: "aggregate", getResult: getValidationResult },
            onValidate: { strategy: "aggregate", getResult: getValidationResult },
        }
        return new LifecycleHooks(defaultHooks, hookStrategies)
    }

    _initOptions(options) {
        const {
            schema = [],
            data = {},
            actions = {},
            hooks = {},
            features = {},
            controls = {},
            controlOptions = {},
            layout = null,
            ...rest
        } = options
        const fixed = {
            schema: utils.naiveCloneDeep(schema),
            data: utils.naiveCloneDeep(data),
            actions: { ...actions },
            hooks: { ...hooks },
            features: { ...this.constructor.features, ...features },
            controls: { ...this.constructor.controls, ...controls },
            controlOptions: { ...controlOptions },
            layout: this._resolveLayout(layout),
        }
        const temp = { _instanceFeatures: features, _instanceControls: controls }
        const featureDefaults = Object.assign({}, ...Object.values(fixed.features).map(def => def.featureOptions))
        return { ...featureDefaults, ...fixed, ...temp, ...rest }
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

    traverseBoxes = (visitorFn, schema = this.options.schema, parentBox = null) => {
        for (const box of schema) {
            visitorFn(box, parentBox)
            for (const field of box.fields || []) {
                if (Array.isArray(field.subSchema)) {
                    this.traverseBoxes(visitorFn, field.subSchema, box)
                }
            }
        }
    }

    getControlOptions = (field) => {
        if (!field) return {}
        const defaults = this.constructor.controls[field.type]?.controlOptions || {}
        const formLevel = this.options.controlOptions[field.type] || {}
        const instanceLevel = defaults ? utils.pick(field, Object.keys(defaults)) : {}
        return { ...defaults, ...formLevel, ...instanceLevel }
    }

    getControlOptionsFromKey = (key) => this.getControlOptions(this.getField(key))

    getField = (key) => this._runtime.fields[key]
    getData = (key) => utils.nestedPropertyHelpers.get(this.options.data, key)
    setData = (key, value, type = "set") => utils.nestedPropertyHelpers[type](this.options.data, key, value)

    // type: set/push/removeIndex
    queueFieldValueUpdate = (key, value, type = "set") => {
        this._runtime.pendingChanges.set(key, { key, value, type })
        if (!this._runtime.isTaskQueued) {
            this._runtime.isTaskQueued = true
            queueMicrotask(this._processPendingChanges)
        }
    }

    _processPendingChanges = () => {
        const changesToProcess = new Map(this._runtime.pendingChanges)
        this._runtime.pendingChanges.clear()
        this._runtime.isTaskQueued = false

        if (changesToProcess.size === 0) return

        const successfullyChangedKeys = new Set()
        for (const changeContext of changesToProcess.values()) {
            const isValid = this._processSingleChange(changeContext)
            if (isValid) {
                successfullyChangedKeys.add(changeContext.key)
            }
        }
        successfullyChangedKeys.forEach(key => this._updateControl(key))
    }

    _processSingleChange(changeContext) {
        if (changeContext.type !== "removeIndex") {
            changeContext.value = this.hooks.invoke("onProcessValue", changeContext.value, changeContext)
        }
        const errors = (changeContext.type !== "removeIndex") ? this._validate(changeContext) : []
        const isValid = Array.isArray(errors) && errors.length === 0
        if (isValid) {
            this.hooks.invoke("onBeforeCommit", changeContext, this)
            this.setData(changeContext.key, changeContext.value, changeContext.type)
            this.hooks.invoke("onCommit", changeContext, this)
            this.hooks.invoke("onAfterCommit", changeContext, this)
        } else {
            this.hooks.invoke("onValidateFailed", errors, changeContext)
        }
        return isValid
    }

    _validate(changeContext) {
        let errors = this.hooks.invoke("onBeforeValidate", changeContext)
        if (errors.length > 0) return errors
        errors = this.hooks.invoke("onValidate", changeContext)
        return this.hooks.invoke("onAfterValidate", errors, changeContext)
    }

    validateAndCommit = (key, value, type = "set") => {
        // Flush any pending async changes to prevent race conditions and ensure this synchronous commit operates on the latest state.
        this._processPendingChanges()

        const changeContext = { key, value, type }
        const oldValue = this.getData(key)
        const isValid = this._processSingleChange(changeContext)
        if (!isValid) {
            this._updateControl(key, oldValue)
        }
        return isValid
    }

    // Synchronized version function of `queueFieldValueUpdate`
    reactiveCommit = (key, value, type = "set") => {
        const isValid = this.validateAndCommit(key, value, type)
        if (isValid) {
            this._updateControl(key)
        }
        return isValid
    }

    getFormEl = () => this.form

    fillForm(schema, container) {
        const layout = this.options.layout
        if (!layout || typeof layout.render !== "function") {
            throw new TypeError("FastForm Error: Layout must have a 'render' method.")
        }
        layout.render({ schema, container, form: this })
        this.traverseFields(field => this._updateControl(field.key), schema)
        this.traverseFields(field => this._mountControl(field), schema)
    }

    clear = () => {
        this._runtime.cleanups.forEach(cleanup => cleanup())
        this._runtime.cleanups = []
        this._runtime.apis.clear()
        this.states.clear()
        this.hooks.clear()
    }

    _bindAllEvents(controls) {
        for (const [name, control] of Object.entries(controls)) {
            if (typeof control.bindEvents === "function") {
                const bindEventContext = { form: this, state: this.states.get(name) }
                control.bindEvents(bindEventContext)
            }
        }
    }

    _updateControl = (key, value) => {
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
            state: this.states.get(field.type),
            controlOptions: this.getControlOptions(field),
        }
        controlDef.update(updateContext)
    }

    _mountControl = (field) => {
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

    _normalizeControls = (options) => {
        for (const [name, control] of Object.entries(options.controls)) {
            if (typeof control.setupType === "function") {
                const setupTypeContext = {
                    options,
                    form: this,
                    initState: (initialState, clear) => {
                        const state = this.states.init(name, initialState)
                        if (typeof clear !== "function") {
                            clear = state && typeof state.values === "function"
                                ? () => Array.from(state.values()).forEach(val => val && typeof val.clear === "function" && val.clear())
                                : () => void 0
                        }
                        this.registerCleanup(() => clear(state))
                        return state
                    },
                }
                control.setupType(setupTypeContext)
            }
        }
        this.traverseFields(field => {
            const control = options.controls[field.type]
            if (control && typeof control.setup === "function") {
                const setupContext = { field, options, form: this, state: this.states.get(field.type) }
                control.setup(setupContext)
            }
        })
    }

    _normalizeSchema = (schema) => {
        this.traverseBoxes(box => {
            if (!box.id) box.id = `box_${utils.randomString()}`
        }, schema)
    }

    _configureFeatures = (options) => {
        for (const [name, feature] of Object.entries(options.features)) {
            const configureContext = {
                options,
                form: this,
                hooks: { on: this.hooks.on, override: this.hooks.override },
                registerApi: this._registerApi,
                initState: (initialState, clear) => {
                    const state = this.states.init(name, initialState)
                    if (typeof clear !== "function") {
                        clear = (state && typeof state.values === "function")
                            ? () => Array.from(state.values()).forEach(val => val && typeof val.clear === "function" && val.clear())
                            : () => void 0
                    }
                    this.registerCleanup(() => clear(state))
                    return state
                },
            }
            if (options._instanceFeatures.hasOwnProperty(name) && typeof feature.install === "function") {
                console.warn(`FastForm Warning: The 'install' method of the feature '${name}' will be ignored. For instance-specific logic, use 'configure'.`)
            }
            if (typeof feature.configure === "function") {
                feature.configure(configureContext)
            }
        }
    }

    _compileFeatures = (options) => {
        for (const [name, feature] of Object.entries(options.features)) {
            if (typeof feature.compile === "function") {
                const compileContext = {
                    options,
                    form: this,
                    hooks: { on: this.hooks.on, override: this.hooks.override },
                    state: this.states.get(name),
                }
                feature.compile(compileContext)
            }
        }
    }

    _applyUserHooks = (userHooks) => {
        for (const [name, config] of Object.entries(userHooks)) {
            if (typeof config === "function") {
                this.hooks.on(name, config)
            } else if (config && typeof config === "object") {
                if (typeof config.on === "function") {
                    this.hooks.on(name, config.on)
                }
                if (typeof config.override === "function") {
                    this.hooks.override(name, config.override)
                }
            }
        }
    }

    _resolveLayout(layout) {
        const { layouts } = this.constructor
        if (!layout) {
            return layouts.default || {}
        }

        const inheritances = new Set()
        let current = layout
        while (current) {
            const currentDef = (typeof current === "string") ? layouts[current] : current
            if (!currentDef || typeof currentDef !== "object") break
            if (inheritances.has(currentDef)) {
                console.warn("FastForm Warning: Circular layout inheritance detected.")
                break
            }
            inheritances.add(currentDef)
            current = currentDef.base
        }
        return Object.assign({}, layouts.default, ...[...inheritances].reverse())
    }

    _registerApi = (namespace, api, destroy) => {
        if (typeof namespace !== "string" || !namespace) {
            throw new TypeError("API registration error: namespace must be a non-empty string.")
        }
        const apis = this._runtime.apis
        if (apis.has(namespace)) {
            console.warn(`FastForm Warning: Overwriting API for '${namespace}'.`)
        }
        apis.set(namespace, api)
        if (typeof destroy === "function") {
            this.registerCleanup(destroy)
        }
    }

    getApi = (namespace) => this._runtime.apis.get(namespace)

    _collectFields = (options) => {
        const fields = {}
        this.traverseFields(field => field.key && (fields[field.key] = field), options.schema)
        this._runtime.fields = fields
    }
}

class LifecycleHooks {
    constructor(defaultImplementations, strategies) {
        this._listeners = new Map()
        this._overrides = new Map()
        this._definitions = new Map(
            Object.entries(defaultImplementations).map(([hookName, impl]) => {
                const strategy = strategies[hookName] || {}
                return [hookName, { impl, ...strategy }]
            })
        )
    }

    on = (hookName, listener) => {
        if (!this._definitions.has(hookName)) {
            console.warn(`Attempting to subscribe to an unknown hook "${hookName}".`)
            return
        }
        if (!this._listeners.has(hookName)) {
            this._listeners.set(hookName, new Set())
        }
        if (typeof listener === "function") {
            this._listeners.get(hookName).add(listener)
        }
    }
    override = (hookName, listener) => {
        if (!this._definitions.has(hookName)) {
            console.warn(`Attempting to override an unknown hook "${hookName}".`)
            return
        }
        if (typeof listener === "function") {
            this._overrides.set(hookName, listener)
        }
    }
    invoke = (hookName, ...initialArgs) => {
        if (!this._definitions.has(hookName)) return

        const overrideFn = this._overrides.get(hookName)
        if (overrideFn) {
            return overrideFn(...initialArgs)
        }

        const { strategy, impl, getResult } = this._definitions.get(hookName)
        const userImpl = this._listeners.get(hookName) || []
        const allFns = [...userImpl, impl]
        if (allFns.length === 0) return
        switch (strategy) {
            case "pipeline":
                const [initialValue, ...otherArgs] = initialArgs
                return allFns.reduce((currentValue, fn) => fn(currentValue, ...otherArgs), initialValue)
            case "aggregate":
                if (typeof getResult !== "function") {
                    console.error(`FastForm Error: Hook "${hookName}" uses 'aggregate' strategy but is missing a 'getResult' function.`)
                    return []
                }
                return allFns.flatMap(fn => getResult(fn(...initialArgs)))
            case "broadcast":
            default:
                return allFns.reduce((_, fn) => fn(...initialArgs), undefined)
        }
    }
    clear = () => {
        this._listeners.clear()
        this._overrides.clear()
    }
}

class States {
    modules = new Map()
    init = (moduleKey, initialState) => {
        if (!this.modules.has(moduleKey)) {
            this.modules.set(moduleKey, initialState)
        }
        return this.modules.get(moduleKey)
    }
    get = (moduleKey) => this.modules.get(moduleKey)
    set = (moduleKey, state) => this.modules.set(moduleKey, state)
    clear = () => this.modules.clear()
}

function validateDefinition(name, definition, checks, options = {}) {
    const { prefix } = options
    if (prefix && (typeof name !== "string" || !name.startsWith(prefix))) {
        throw new TypeError(`Name '${name}' must be a string and start with '${prefix}'.`)
    }
    if (!definition || typeof definition !== "object") {
        throw new TypeError(`The definition for '${name}' must be a non-null object.`)
    }
    for (const [key, rule] of Object.entries(checks)) {
        const value = definition[key]
        if (rule.required && (value === undefined || value === null)) {
            throw new TypeError(`'${name}' must have a '${key}' of type '${rule.type}'.`)
        }
        if (definition.hasOwnProperty(key)) {
            if (rule.type === "function" && typeof value !== "function") {
                throw new TypeError(`The '${key}' property for '${name}' must be a function.`)
            }
            if (rule.type === "plainObject" && (typeof value !== "object" || value === null || Array.isArray(value))) {
                throw new TypeError(`The '${key}' property for '${name}' must be a plain object.`)
            }
        }
    }
}

const Layout_Default = {
    base: null,
    render({ schema, container, form }) {
        const createControl = (field) => {
            const controlDef = form.options.controls[field.type]
            if (!controlDef) {
                console.warn(`FastForm Warning: No control registered for type "${field.type}".`)
                return ""
            }
            const controlOptions = form.getControlOptions(field)
            const controlContext = { field, controlOptions, form }
            const controlHTML = controlDef.create(controlContext)
            return this.createControlContainer(field, controlHTML, controlOptions.className)
        }
        const createBox = (box) => {
            const titleHTML = this.createTitle(box)
            const controlHTMLs = (box.fields || []).map(createControl)
            const boxHTML = this.createBoxContent(controlHTMLs)
            return this.createBoxContainer(box.id, titleHTML, boxHTML)
        }
        container.innerHTML = schema.map(createBox).join("")
    },
    findBox(key, formEl) {
        return formEl.querySelector(`[data-box="${CSS.escape(key)}"]`)
    },
    findControl(key, formEl) {
        return formEl.querySelector(`[data-control="${CSS.escape(key)}"]`)
    },
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
        const cls = "control" + (isBlockLayout ? " control-block" : "") + (className ? ` ${className}` : "") + (field.hidden ? " plugin-common-hidden" : "")
        return `<div class="${cls}" data-type="${field.type}" data-control="${field.key}">${label}${control}</div>`
    },
    createBoxContent(controlHTMLs) {
        return `<div class="box">${controlHTMLs.join("")}</div>`
    },
    createBoxContainer(id, titleHTML, boxHTML) {
        return `<div class="box-container" data-box="${id}">${titleHTML}${boxHTML}</div>`
    },
}

FastForm.registerLayout("default", Layout_Default)

const Feature_EventDelegation = {
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
            const formEl = this.getFormEl()
            if (!formEl) return this

            let events, selector, data, handler, options

            const lastArg = args[args.length - 1]
            if (lastArg == null || typeof lastArg === "boolean" || typeof lastArg === "object") {
                options = args.pop() // The last parameter is `options`
            }
            handler = args.pop() // The second to last parameter is `handler`
            events = args.shift()
            if (typeof handler !== "function" && (events == null || typeof events !== "object")) {
                throw new TypeError(`The handler for event '${events}' must be a function.`)
            }
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
                throw new TypeError(`event must be a string/object: ${events}.`)
            }

            const eventTypes = events.split(" ").filter(Boolean) // Multiple event string: "click mouseover"
            for (const eventType of eventTypes) {
                const listener = (ev) => {
                    if (data) {
                        ev.data = data
                    }
                    let ret
                    if (!selector) {
                        ret = handler.call(ev.currentTarget, ev)
                    } else {
                        const target = ev.target.closest(selector)
                        if (target) {
                            ret = handler.call(target, ev)
                        }
                    }
                    if (ret === false) {
                        ev.preventDefault()
                        ev.stopPropagation()
                    }
                }

                formEl.addEventListener(eventType, listener, options)
                this.registerCleanup(() => formEl.removeEventListener(eventType, listener, options))
            }
            return this
        }
    }
}

const Feature_DefaultKeybindings = {
    configure: ({ hooks }) => {
        hooks.on("onRender", (form) => form.onEvent("keydown", ev => ev.stopPropagation(), true))
    }
}

const Feature_Watchers = (() => {
    const ApiKey = "watchers"
    const StateKey = {
        Watchers: "Watchers",
        TriggerToWatchers: "TriggerToWatchers",
        WatcherToTriggers: "WatcherToTriggers",
        IsExecuting: "IsExecuting",
        PendingQueue: "PendingQueue",
    }
    const InternalToken = {
        Phase: Symbol("meta:phase"),
    }
    const Phase = {
        Mount: "mount",
        Update: "update",
        Api: "api",
        Unknown: "unknown",
    }

    const normalizeWatchers = (userWatchers) => {
        if (!userWatchers) return {}
        if (!Array.isArray(userWatchers)) return userWatchers || {}
        const normalized = {}
        userWatchers.forEach((watcher, index) => {
            if (!watcher) return
            const key = watcher.key || watcher.name || `anonymous_watcher_${index}`
            if (normalized.hasOwnProperty(key)) {
                console.warn(`FastForm Warning: Duplicate watcher key detected: '${key}'.`)
            }
            normalized[key] = watcher
        })
        return normalized
    }

    const Registries = (() => {
        const meta = {
            $dev: (ctx) => process.env.NODE_ENV === "development",
            $phase: (ctx) => ctx.payload[InternalToken.Phase] || Phase.Unknown,
            $isMounting: (ctx) => ctx.payload[InternalToken.Phase] === Phase.Mount,
            $isUpdating: (ctx) => ctx.payload[InternalToken.Phase] === Phase.Update,
            $isApi: (ctx) => ctx.payload[InternalToken.Phase] === Phase.Api,
            $trigger: (ctx) => ctx.payload.trigger || null,  // Used to distinguish specific manual invocations (via API) from automatic dependency updates.
        }

        const conditionEvaluators = {
            $and: {
                collectTriggers: (conditions, ctx) => conditions.forEach(subCond => ctx.collectTriggers(subCond)),
                evaluate: (conditions, ctx) => conditions.every(subCond => ctx.evaluate(subCond)),
            },
            $or: {
                collectTriggers: (conditions, ctx) => conditions.forEach(subCond => ctx.collectTriggers(subCond)),
                evaluate: (conditions, ctx) => conditions.some(subCond => ctx.evaluate(subCond)),
            },
            $not: {
                collectTriggers: (condition, ctx) => ctx.collectTriggers(condition),
                evaluate: (condition, ctx) => !ctx.evaluate(condition),
            },
            $never: {
                collectTriggers: () => void 0,
                evaluate: () => false,
            },
            $always: {
                collectTriggers: () => void 0,
                evaluate: () => true,
            },
            $meta: {
                collectTriggers: () => void 0,
                evaluate: (condition, ctx) => {
                    return Object.entries(condition).every(([varName, expected]) => {
                        const getter = ctx.meta[varName]
                        if (typeof getter !== "function") {
                            console.warn(`FastForm Warning: Unknown meta '${varName}' used in $meta condition.`)
                            return false
                        }
                        const actual = getter(ctx)
                        return ctx.compare(actual, expected)
                    })
                }
            },
            /**
             * A condition that queries the state of a UI element (e.g., visibility, class)
             * at the moment a watcher is evaluated. Its behavior as a trigger depends on the
             * form's `reactiveUiEffects` option.
             *
             * NOTE: UI is a function of state. Try NOT to use this.
             *
             * BEHAVIOR with `reactiveUiEffects: false` (Default):
             * It acts as a read-only check. The watcher will NOT be re-triggered by UI state changes,
             * enforcing a strict, one-way data flow from data to UI.
             *
             * BEHAVIOR with `reactiveUiEffects: true`:
             * It establishes a reactive dependency. The watcher WILL be re-triggered if the checked UI
             * property is modified by another watcher's `$updateUI` effect.
             * This enables UI-driven logic but requires caution to avoid infinite loops.
             */
            $checkUI: {
                collectTriggers: (declaration, ctx) => {
                    Object.entries(declaration).forEach(([target, evaluators]) => {
                        Object.keys(evaluators).forEach(assertionKey => {
                            const property = uiAssertionToPropertyMap.get(assertionKey)
                            if (property) {
                                ctx.addKey(ctx.createUiStateKey({ target, property }))
                            } else {
                                console.warn(`FastForm Warning: Unknown assertion '${assertionKey}' in $checkUI trigger collection.`)
                            }
                        })
                    })
                },
                beforeEvaluate: (declaration, ctx) => {
                    ctx._flushUI()
                    return declaration
                },
                evaluate: (declaration, ctx) => {
                    return Object.entries(declaration).every(([target, evaluators]) => {
                        const el = ctx.getControl(target) || ctx.getBox(target)
                        if (!el) {
                            console.warn(`FastForm Warning: $checkUI could not find element for target '${target}'.`)
                            return false
                        }
                        return Object.entries(evaluators).every(([assertionKey, expected]) => {
                            const property = uiAssertionToPropertyMap.get(assertionKey)
                            if (!property) return false
                            const evaluator = uiBehaviors[property].uiStateEvaluators[assertionKey]
                            return evaluator(el, expected, ctx)
                        })
                    })
                }
            },
        }

        const comparisonEvaluators = {
            $eq: { evaluate: (actual, expected) => actual === expected },
            $ne: { evaluate: (actual, expected) => actual !== expected },
            $gt: { evaluate: (actual, expected) => actual > expected },
            $gte: { evaluate: (actual, expected) => actual >= expected },
            $lt: { evaluate: (actual, expected) => actual < expected },
            $lte: { evaluate: (actual, expected) => actual <= expected },
            $includes: { evaluate: (actual, expected) => expected.includes(actual) },
            $contains: { evaluate: (actual, expected) => actual.includes(expected) },
            $bool: { evaluate: (actual, expected) => Boolean(actual) === expected },
            $deepEqual: { evaluate: (actual, expected) => utils.deepEqual(actual, expected) },
            $startsWith: { evaluate: (actual, expected) => typeof actual === "string" && typeof expected === "string" && actual.startsWith(expected) },
            $endsWith: { evaluate: (actual, expected) => typeof actual === "string" && typeof expected === "string" && actual.endsWith(expected) },
            $typeof: { evaluate: (actual, expected) => (expected === "object") ? (typeof actual === "object" && actual != null) : (typeof actual === expected) }
        }

        const effectHandlers = {
            $update: {
                collectAffects: (fieldKeys) => Object.keys(fieldKeys || {}),
                execute: (isMet, value, ctx) => {
                    if (!isMet) return
                    Object.entries(value).forEach(([key, val]) => {
                        const resolvedValue = (typeof val === "function") ? val(ctx) : val
                        if (!utils.deepEqual(resolvedValue, ctx.getValue(key))) {
                            ctx.setValue(key, resolvedValue)
                        }
                    })
                }
            },
            $updateUI: {
                collectAffects: (declaration) => {
                    if (declaration && (declaration.$then || declaration.$else)) {
                        const thenAffects = declaration.$then ? DependencyAnalyzer.collectUIAffects(declaration.$then) : []
                        const elseAffects = declaration.$else ? DependencyAnalyzer.collectUIAffects(declaration.$else) : []
                        return [...new Set([...thenAffects, ...elseAffects])]
                    }
                    return DependencyAnalyzer.collectUIAffects(declaration)
                },
                execute: (isMet, declaration, ctx) => {
                    const branch = isMet ? declaration.$then : declaration.$else
                    if (branch) {
                        DependencyAnalyzer.applyUiEffects(branch, ctx)
                    } else if (isMet) {
                        DependencyAnalyzer.applyUiEffects(declaration, ctx)
                    }
                }
            },
        }

        const uiBehaviors = {
            visibility: {
                uiStateEvaluators: {
                    $isVisible: (el, expected, ctx) => utils.isHidden(el) !== expected,
                },
                uiEffect: (el, actions, ctx) => {
                    if (actions.hasOwnProperty("$toggle")) {
                        utils.toggleInvisible(el)
                    } else if (actions.hasOwnProperty("$set")) {
                        utils.toggleInvisible(el, actions.$set === "hidden")
                    } else {
                        console.warn("FastForm Warning: Invalid action for '$visibility' effect. Use '$set' or '$toggle'.", actions)
                    }
                },
            },
            attributes: {
                uiStateEvaluators: {
                    $hasAttribute: (el, expected, ctx) => {
                        const attributes = Array.isArray(expected) ? expected : [expected]
                        return attributes.every(attr => typeof attr === "string" && el.hasAttribute(attr))
                    },
                    $attributes: (el, expected, ctx) => {
                        return Object.entries(expected).every(([attrName, cond]) => {
                            const actualValue = el.getAttribute(attrName)
                            return ctx.compare(actualValue, cond)
                        })
                    },
                },
                uiEffect: (el, actions, ctx) => {
                    if (actions.$set) {
                        Object.entries(actions.$set).forEach(([name, value]) => el.setAttribute(name, value))
                    }
                    if (actions.$remove) {
                        actions.$remove.forEach(name => el.removeAttribute(name))
                    }
                },
            },
            classes: {
                uiStateEvaluators: {
                    $hasClasses: (el, expected, ctx) => {
                        return (typeof expected === "string")
                            ? expected.split(" ").filter(Boolean).every(cls => el.classList.contains(cls))
                            : false
                    },
                },
                uiEffect: (el, actions, ctx) => {
                    if (actions.$add) el.classList.add(...actions.$add.split(" ").filter(Boolean))
                    if (actions.$remove) el.classList.remove(...actions.$remove.split(" ").filter(Boolean))
                    if (actions.$toggle) el.classList.toggle(actions.$toggle)
                },
            },
            styles: {
                uiStateEvaluators: {
                    $styles: (el, expected, ctx) => {
                        return Object.entries(expected).every(([styleProp, cond]) => {
                            const actualValue = window.getComputedStyle(el)[styleProp]
                            return ctx.compare(actualValue, cond)
                        })
                    },
                },
                uiEffect: (el, actions, ctx) => {
                    if (actions.$set) Object.entries(actions.$set).forEach(([prop, value]) => el.style[prop] = value)
                    if (actions.$remove) actions.$remove.forEach(prop => el.style[prop] = "")
                },
            },
            content: {
                uiStateEvaluators: {
                    $content: (el, expected, ctx) => ctx.compare(el.textContent, expected),
                },
                uiEffect: (el, actions, ctx) => {
                    if (actions.$text !== undefined) el.textContent = actions.$text
                    if (actions.$html !== undefined) el.innerHTML = actions.$html
                },
            },
            properties: {
                uiStateEvaluators: {
                    $properties: (el, expected, ctx) => {
                        return Object.entries(expected).every(([propName, cond]) => {
                            const actualValue = el[propName]
                            return ctx.compare(actualValue, cond)
                        })
                    }
                },
                uiEffect: (el, actions, ctx) => {
                    if (actions.$set) Object.entries(actions.$set).forEach(([prop, value]) => el[prop] = value)
                    if (actions.$remove) actions.$remove.forEach(prop => el[prop] = undefined)
                },
            },
        }

        const uiAssertionToPropertyMap = new Map()
        const uiEffectToHandlerMap = new Map()
        Object.entries(uiBehaviors).forEach(([property, handler]) => {
            Object.keys(handler.uiStateEvaluators || {}).forEach(key => uiAssertionToPropertyMap.set(key, property))
            uiEffectToHandlerMap.set(`$${property}`, handler)
        })

        return { uiBehaviors, uiAssertionToPropertyMap, uiEffectToHandlerMap, meta, conditionEvaluators, comparisonEvaluators, effectHandlers }
    })()

    const DependencyAnalyzer = (() => {
        const createUiStateKey = (uiState) => ["@ui", uiState.target, uiState.property].join("\u001F")

        const collectUIAffects = (declaration) => {
            const affectedProperties = new Set()
            Object.entries(declaration).forEach(([target, groups]) => {
                Object.keys(groups).forEach($property => {
                    const handler = Registries.uiEffectToHandlerMap.get($property)
                    if (handler) {
                        const property = Object.keys(Registries.uiBehaviors).find(p => Registries.uiBehaviors[p] === handler)
                        affectedProperties.add(createUiStateKey({ target, property }))
                    } else {
                        console.warn(`FastForm Warning: Unknown UI effect group '${$property}' during affect collection.`)
                    }
                })
            })
            return [...affectedProperties]
        }

        /**
         * Applies a declarative set of UI state changes to the corresponding DOM elements.
         * The reactivity of this function is controlled by a form-level option.
         *
         * IMPORTANT: This function's behavior changes based on the 'reactiveUiEffects' option.
         *
         * - By default (`reactiveUiEffects: false`): This is a TERMINAL operation.
         * Applying UI effects does NOT trigger a new watcher cycle. This enforces a strict
         * unidirectional data flow, making the application predictable and free from infinite loops.
         *
         * - When enabled (`reactiveUiEffects: true`): This operation becomes REACTIVE.
         * It will trigger a new evaluation cycle for any watchers that depend on the UI properties
         * being modified. This allows for powerful UI-driven logic but must be used with
         * caution to prevent infinite loops.
         */
        const applyUiEffects = (declaration, ctx) => {
            Object.entries(declaration).forEach(([targetKey, groups]) => {
                const el = ctx.getControl(targetKey) || ctx.getBox(targetKey)
                if (!el) return

                Object.entries(groups).forEach(([groupName, actions]) => {
                    const handler = Registries.uiEffectToHandlerMap.get(groupName)
                    if (handler && typeof handler.uiEffect === "function") {
                        handler.uiEffect(el, actions, ctx)
                    } else {
                        console.warn(`FastForm Warning: Unknown UI effect group '${groupName}'.`)
                    }
                })
            })

            ctx.propagateUiEffects(declaration)
        }

        const _collectConditionTriggers = (form, condition, keys) => {
            const context = {
                collectTriggers: (subCond) => _collectConditionTriggers(form, subCond, keys),
                getField: (key) => form.getField(key),
                addKey: (key) => keys.add(key),
                createUiStateKey,
            }
            for (const [name, handler] of Object.entries(form.options.conditionEvaluators)) {
                if (condition.hasOwnProperty(name)) {
                    let value = condition[name]
                    if (typeof handler.beforeEvaluate === "function") value = handler.beforeEvaluate(value, context)
                    handler.collectTriggers(value, context)
                    return keys
                }
            }
            Object.keys(condition).forEach(context.addKey)
            return keys
        }

        const _inferDeclarativeAffects = (effectObject, effectHandlers) => {
            const affectSet = new Set()
            for (const [effectName, value] of Object.entries(effectObject)) {
                const handler = effectHandlers[effectName]
                if (handler) {
                    (handler.collectAffects(value) || []).forEach(key => affectSet.add(key))
                } else {
                    console.warn(`FastForm Warning: Unknown effect type "${effectName}" in watcher.`)
                }
            }
            return [...affectSet]
        }

        const collectAffects = (watcher, options) => {
            const affectSet = new Set()
            if (typeof watcher.effect === "function" && !Array.isArray(watcher.affects)) {
                const msg = "A watcher with an imperative 'effect' is missing the 'affects' array. Dependency analysis may be incorrect."
                if (options.requireAffectsForFunctionEffect) throw new TypeError(`FastForm Error: ${msg}`)
                else console.warn(`FastForm Warning: ${msg}`, watcher)
            }
            if (Array.isArray(watcher.affects)) {
                watcher.affects.forEach(item => {
                    if (typeof item === "string") affectSet.add(item)
                })
            }
            if (watcher.effect !== null && typeof watcher.effect === "object") {
                if (!watcher._inferredAffects) {
                    watcher._inferredAffects = _inferDeclarativeAffects(watcher.effect, options.effectHandlers)
                }
                watcher._inferredAffects.forEach(key => affectSet.add(key))
            }
            return affectSet
        }

        const buildTriggerMap = (state, form) => {
            const watchers = state.get(StateKey.Watchers)
            const watcherToTriggers = state.get(StateKey.WatcherToTriggers)

            const triggerMap = new Map()
            watchers.forEach(watcher => {
                const triggerKeys = new Set()
                if (typeof watcher.when === "function" && !Array.isArray(watcher.triggers)) {
                    const msg = "Watcher with a function 'when' is missing the 'triggers' array. It will not be triggered by data changes."
                    if (form.options.requireTriggersForFunctionWhen) throw new TypeError(`FastForm Error: ${msg}`)
                    else console.warn(`FastForm Warning: ${msg}`, watcher)
                }
                if (Array.isArray(watcher.triggers)) {
                    watcher.triggers.forEach(key => triggerKeys.add(key))
                }
                if (watcher.when != null && typeof watcher.when === "object") {
                    _collectConditionTriggers(form, watcher.when, triggerKeys)
                }

                watcherToTriggers.set(watcher, triggerKeys)
                triggerKeys.forEach(key => {
                    if (!triggerMap.has(key)) {
                        triggerMap.set(key, new Set())
                    }
                    triggerMap.get(key).add(watcher)
                })
            })
            state.set(StateKey.TriggerToWatchers, triggerMap)
        }

        return { createUiStateKey, collectUIAffects, applyUiEffects, collectAffects, buildTriggerMap }
    })()

    const ExecutionEngine = (() => {
        const _evaluateCondition = (condition, context = {}) => {
            if (typeof condition === "function") {
                return condition(context)
            } else if (!condition || typeof condition !== "object") {
                return true
            }

            // Handle logical evaluators like $and, $or, $checkUI
            for (const [name, handler] of Object.entries(context.conditionEvaluators)) {
                if (condition.hasOwnProperty(name)) {
                    let value = condition[name]
                    if (typeof handler.beforeEvaluate === "function") {
                        value = handler.beforeEvaluate(value, context)
                    }
                    return handler.evaluate(value, context)
                }
            }

            // Handle default field-based conditions
            return Object.entries(condition).every(([key, expectedCond]) => {
                const actualValue = context.getValue(key)
                if (typeof expectedCond !== "object" || expectedCond === null) {
                    return context.compare(actualValue, expectedCond)
                }
                return Object.entries(expectedCond).every(([operator, expectedValue]) => {
                    const handler = context.comparisonEvaluators[operator]
                    if (!handler) {
                        console.warn(`FastForm Warning: Unknown comparison operator "${operator}".`)
                        return false
                    }
                    const [finalActual, finalExpected] = typeof handler.beforeEvaluate === "function"
                        ? handler.beforeEvaluate(actualValue, expectedValue, context)
                        : [actualValue, expectedValue]
                    return handler.evaluate(finalActual, finalExpected)
                })
            })
        }

        const _doSingleEffect = (form, watcher, isConditionMet, context) => {
            const { effect } = watcher
            if (typeof effect === "function") {
                effect(isConditionMet, context)
            } else if (typeof effect === "object" && effect !== null) {
                for (const [name, value] of Object.entries(effect)) {
                    form.options.effectHandlers[name]?.execute(isConditionMet, value, context)
                }
            }
        }

        const getAllWatchers = (state) => new Set(state.get(StateKey.Watchers).values())

        const getWatchersForKeys = (state, keys) => {
            const triggerToWatchers = state.get(StateKey.TriggerToWatchers)
            const watchers = keys.flatMap(key => {
                const triggered = triggerToWatchers.get(key)
                return triggered ? [...triggered] : []
            })
            return new Set(watchers)
        }

        const _execute = (state, form, initialWatchers, payload) => {
            const transactionalData = new Map()
            const watchersToProcess = new Set(initialWatchers)
            const watchers = state.get(StateKey.Watchers)
            const pendingWatchers = state.get(StateKey.PendingQueue)
            const watcherToTriggers = state.get(StateKey.WatcherToTriggers)

            while (watchersToProcess.size > 0) {
                const nodes = [...watchersToProcess]
                watchersToProcess.clear()

                const graph = new Map(nodes.map(node => [node, []])) // producer -> [consumers]
                const inDegree = new Map(nodes.map(node => [node, 0])) // consumer -> dependency count

                // Step 1: Build the dependency graph.
                // An edge from Watcher A to Watcher B means A's `affect` matches B's `trigger`, so A must be executed before B.
                for (const producer of nodes) {
                    const producerAffects = DependencyAnalyzer.collectAffects(producer, form.options)
                    if (producerAffects.size === 0) continue

                    for (const consumer of nodes) {
                        if (producer === consumer) continue
                        const consumerTriggers = watcherToTriggers.get(consumer) || new Set()
                        const hasDependency = [...producerAffects].some(affect => consumerTriggers.has(affect))

                        if (hasDependency) {
                            graph.get(producer).push(consumer) // Edge A -> B
                            inDegree.set(consumer, inDegree.get(consumer) + 1)
                        }
                    }
                }

                // Step 2: Initialize a queue with all nodes that have an in-degree of 0 (no dependencies).
                const queue = nodes.filter(node => inDegree.get(node) === 0)
                const sortedWatchers = []

                // Step 3: Process the queue using Kahn's algorithm.
                while (queue.length > 0) {
                    const current = queue.shift()
                    sortedWatchers.push(current)
                    for (const dependent of graph.get(current) || []) {
                        inDegree.set(dependent, inDegree.get(dependent) - 1)
                        if (inDegree.get(dependent) === 0) {
                            queue.push(dependent)
                        }
                    }
                }

                // Step 4: Execute watchers.
                const run = (watchers) => {
                    const evaluateContext = {
                        payload: payload ?? {},
                        meta: form.options.meta,
                        conditionEvaluators: form.options.conditionEvaluators,
                        comparisonEvaluators: form.options.comparisonEvaluators,
                        getBox: (boxId) => form.options.layout.findBox(boxId, form.form),
                        getControl: (key) => form.options.layout.findControl(key, form.form),
                        getValue: (key) => transactionalData.has(key) ? transactionalData.get(key) : form.getData(key),
                        getField: (key) => form.getField(key),
                        _flushUI: () => transactionalData.forEach((val, key) => form._updateControl(key, val)),
                        createUiStateKey: DependencyAnalyzer.createUiStateKey,
                        evaluate: (condition) => _evaluateCondition(condition, evaluateContext),
                        compare: (actual, conditionObject, defaultOperator = "$eq") => {
                            const finalCond = (conditionObject == null || typeof conditionObject !== "object")
                                ? { [defaultOperator]: conditionObject }
                                : conditionObject
                            return Object.entries(finalCond).every(([operator, expected]) => {
                                const handler = form.options.comparisonEvaluators[operator]
                                if (!handler || typeof handler.evaluate !== "function") {
                                    console.warn(`FastForm Warning: Unknown comparison operator "${operator}".`)
                                    return false
                                }
                                return handler.evaluate(actual, expected)
                            })
                        },
                    }
                    const effectContext = {
                        ...evaluateContext,
                        setValue: (key, value, type) => {
                            transactionalData.set(key, value)
                            form.queueFieldValueUpdate(key, value, type)
                        },
                        updateUI: (declaration, customContext) => DependencyAnalyzer.applyUiEffects(declaration, customContext || effectContext),
                        propagateUiEffects: (declaration) => {
                            if (!form.options.reactiveUiEffects) return
                            const affectedUiKeys = new Set(DependencyAnalyzer.collectUIAffects(declaration))
                            if (affectedUiKeys.size > 0) {
                                ExecutionEngine.executeForKeys(state, form, [...affectedUiKeys], evaluateContext.payload)
                            }
                        },
                    }

                    for (const watcher of watchers) {
                        const isMet = _evaluateCondition(watcher.when, evaluateContext)
                        _doSingleEffect(form, watcher, isMet, effectContext)
                    }
                }

                if (sortedWatchers.length === nodes.length) {
                    run(sortedWatchers) // No cycle detected.
                } else {
                    // Cycle detected.
                    const cycleNodes = nodes.filter(node => inDegree.get(node) > 0)
                    const cycleKeys = cycleNodes.map(w => [...watchers.entries()].find(([k, v]) => v === w)?.[0] || "unknown").join(", ")
                    const msg = `Circular dependency detected in watchers: ${cycleKeys}`
                    if (!form.options.allowCircularDependencies) throw new TypeError(`FastForm Error: ${msg}`)
                    else console.warn(`FastForm Warning: ${msg}`)
                    run([...sortedWatchers, ...cycleNodes])  // Run the non-cyclic part first, then the cyclic part.
                }

                // If new watchers were queued during execution, add them to the next batch.
                if (pendingWatchers.size > 0) {
                    pendingWatchers.forEach(w => watchersToProcess.add(w))
                    pendingWatchers.clear()
                }
            }
        }

        const execute = (state, form, initialWatchers, payload) => {
            if (initialWatchers.size === 0) return
            // If execution is already in progress, queue these watchers for the next batch.
            // This prevents re-entrancy issues and ensures atomicity of a full execution cycle.
            if (state.get(StateKey.IsExecuting)) {
                const pendingWatchers = state.get(StateKey.PendingQueue)
                initialWatchers.forEach(watcher => pendingWatchers.add(watcher))
                return
            }

            state.set(StateKey.IsExecuting, true)
            try {
                _execute(state, form, initialWatchers, payload)
            } finally {
                state.set(StateKey.IsExecuting, false)
            }
        }

        const executeForKeys = (state, form, keys, payload) => execute(state, form, getWatchersForKeys(state, keys), payload)

        const executeAll = (state, form, payload) => execute(state, form, getAllWatchers(state), payload)

        return { getWatchersForKeys, getAllWatchers, execute, executeForKeys, executeAll }
    })()

    const Lifecycle = (() => {
        const registerWatcher = (state, form, watcherKey, watcher) => {
            const watchers = state.get(StateKey.Watchers)
            if (watchers.has(watcherKey)) console.warn(`FastForm Warning: Watcher "${watcherKey}" already exists and will be overwritten.`)
            watchers.set(watcherKey, watcher)
        }

        const initWatcher = (state, form, registerApi) => {
            registerApi(ApiKey, {
                register: (key, watcher) => registerWatcher(state, form, key, watcher),
                inspect: () => ({
                    watchers: new Map(state.get(StateKey.Watchers)),
                    triggerToWatchers: new Map(state.get(StateKey.TriggerToWatchers)),
                    watcherToTriggers: new Map(state.get(StateKey.WatcherToTriggers)),
                }),
                trigger: (watcherName, payload = {}) => {
                    const watcher = state.get(StateKey.Watchers).get(watcherName)
                    if (watcher) {
                        ExecutionEngine.execute(state, form, new Set([watcher]), { ...payload, [InternalToken.Phase]: Phase.Api })
                    }
                },
            })
        }
        return { initWatcher, registerWatcher }
    })()

    return {
        featureOptions: {
            watchers: {},
            meta: {},
            conditionEvaluators: {},
            comparisonEvaluators: {},
            effectHandlers: {},
            allowCircularDependencies: false,
            requireTriggersForFunctionWhen: false,
            requireAffectsForFunctionEffect: false,
            reactiveUiEffects: false, // Violating the principle of the Single Source of Truth. Do NOT edit this option unless you know what you are doing.
        },
        configure: ({ form, options, registerApi, initState, hooks }) => {
            options.watchers = normalizeWatchers(options.watchers)
            options.meta = { ...Registries.meta, ...options.meta }
            options.conditionEvaluators = { ...Registries.conditionEvaluators, ...options.conditionEvaluators }
            options.comparisonEvaluators = { ...Registries.comparisonEvaluators, ...options.comparisonEvaluators }
            options.effectHandlers = { ...Registries.effectHandlers, ...options.effectHandlers }

            const state = initState(new Map([
                [StateKey.Watchers, new Map()],           // watcherKey -> watcher definition
                [StateKey.TriggerToWatchers, new Map()],  // triggerKey -> Set<watcher>
                [StateKey.WatcherToTriggers, new Map()],  // watcher -> Set<triggerKey>
                [StateKey.PendingQueue, new Set()],
                [StateKey.IsExecuting, false],
            ]))

            Lifecycle.initWatcher(state, form, registerApi)
            hooks.on("onAfterCommit", (changeContext, form) => ExecutionEngine.executeForKeys(state, form, [changeContext.key], { [InternalToken.Phase]: Phase.Update }))
            hooks.on("onRender", () => {
                Object.entries(options.watchers || {}).forEach(([key, watcher]) => Lifecycle.registerWatcher(state, form, key, watcher))
                DependencyAnalyzer.buildTriggerMap(state, form)
                ExecutionEngine.executeAll(state, form, { [InternalToken.Phase]: Phase.Mount })
            })
        },
        install: (FastFormClass) => {
            const validationOptions = { prefix: "$" }
            FastFormClass.registerMeta = (name, getterFn) => {
                if (typeof name !== "string" || !name) throw new TypeError("Meta name must be a non-empty string.")
                if (typeof getterFn !== "function") throw new TypeError("Meta getter must be a function.")
                if (Registries.meta.hasOwnProperty(name)) console.warn(`FastForm Warning: Overwriting meta '${name}'.`)
                Registries.meta[name] = getterFn
            }
            FastFormClass.registerConditionEvaluator = (name, definition) => {
                const checks = { evaluate: { required: true, type: "function" }, collectTriggers: { required: true, type: "function" }, beforeEvaluate: { type: "function" } }
                validateDefinition(name, definition, checks, validationOptions)
                if (Registries.conditionEvaluators.hasOwnProperty(name)) console.warn(`FastForm Warning: Overwriting Condition Evaluator for '${name}'.`)
                Registries.conditionEvaluators[name] = definition
            }
            FastFormClass.registerComparisonEvaluator = (name, definition) => {
                const checks = { evaluate: { required: true, type: "function" }, beforeEvaluate: { type: "function" } }
                validateDefinition(name, definition, checks, validationOptions)
                if (Registries.comparisonEvaluators.hasOwnProperty(name)) console.warn(`FastForm Warning: Overwriting Comparison Evaluator for '${name}'.`)
                Registries.comparisonEvaluators[name] = definition
            }
            FastFormClass.registerEffectHandler = (name, definition) => {
                const checks = { collectAffects: { required: true, type: "function" }, execute: { required: true, type: "function" } }
                validateDefinition(name, definition, checks, validationOptions)
                if (Registries.effectHandlers.hasOwnProperty(name)) console.warn(`FastForm Warning: Overwriting Effect Handler for '${name}'.`)
                Registries.effectHandlers[name] = definition
            }
            FastFormClass.createUiStateKey = DependencyAnalyzer.createUiStateKey
        },
    }
})()

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
            throw new TypeError(`Invalid ${errorContext} pattern for '${strategy}' mode: '${key}'.`)
        }
    }).filter(Boolean)
}

const Feature_Parsing = {
    featureOptions: {
        parsers: {},
        parserMatchStrategy: "exact", // "exact", "wildcard", "regex"
    },
    configure: ({ hooks, initState, registerApi }) => {
        const state = initState(
            { rawParsers: new Map(), compiledParsers: [] },
            state => {
                state.rawParsers.clear()
                state.compiledParsers = []
            },
        )
        registerApi("parsing", {
            setParser: (key, parserToAdd) => {
                if (key && typeof parserToAdd === "function") {
                    state.rawParsers.set(key, parserToAdd)
                } else {
                    console.warn(`FastForm Warning: Parser for key '${key}' is not a function.`)
                }
            }
        })
        hooks.on("onProcessValue", (value, changeContext) => {
            const newChangeContext = { ...changeContext, value }
            const matchedParsers = state.compiledParsers.filter(p => p.regex.test(newChangeContext.key))
            if (matchedParsers.length === 0) {
                return value
            }
            if (matchedParsers.length > 1) {
                matchedParsers.sort((a, b) => b.key.length - a.key.length)
            }
            return matchedParsers[0].parser(value, newChangeContext)
        })
    },
    compile: ({ state, options, form }) => {
        const { parsers, parserMatchStrategy } = options

        const api = form.getApi("parsing")
        Object.entries(parsers).forEach(([key, rule]) => api.setParser(key, rule))

        state.compiledParsers = compileMatchers({
            source: Object.fromEntries(state.rawParsers),
            strategy: parserMatchStrategy,
            errorContext: "parser",
            processValue: (parser) => ({ parser })
        })
    },
}

const Feature_Validation = {
    featureOptions: {
        rules: {},
        validators: {},
        ruleMatchStrategy: "exact", // "exact", "wildcard", "regex"
    },
    configure: ({ initState, hooks, registerApi, form }) => {
        const state = initState(
            { rawRules: new Map(), compiledRules: [] },
            state => {
                state.rawRules.clear()
                state.compiledRules = []
            }
        )
        registerApi("validation", {
            addRule: (key, rulesToAdd) => {
                if (!key || !rulesToAdd) return
                const existingRules = state.rawRules.get(key) || []
                const newRules = existingRules.concat(rulesToAdd).flat()
                state.rawRules.set(key, newRules)
            }
        })
        hooks.on("onValidate", (changeContext) => {
            const matchedValidators = state.compiledRules
                .filter(rule => rule.regex.test(changeContext.key))
                .flatMap(rule => rule.validators)
            if (matchedValidators.length === 0) return []
            return matchedValidators
                .map(validator => {
                    try {
                        return validator(changeContext, form.options.data)
                    } catch (err) {
                        return new Error(err)
                    }
                })
                .filter(ret => ret !== true && ret != null)
                .map(err => (err instanceof Error) ? err : new Error(String(err)))
        })
    },
    compile: ({ state, form, options }) => {
        const { rules, validators, ruleMatchStrategy } = options
        const allValidators = { ...form.constructor.validator.getAll(), ...validators }

        const validationApi = form.getApi("validation")
        Object.entries(rules).forEach(([key, rule]) => validationApi.addRule(key, rule))

        state.compiledRules = compileMatchers({
            source: Object.fromEntries(state.rawRules),
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
                    throw new TypeError(`Invalid rule type for '${JSON.stringify(validator)}': '${key}'.`)
                })
                return { validators }
            }
        })
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
                    throw new TypeError(`Validator Error: validator '${name}' must be a function.`)
                }
                if (Feature_Validation._validators.hasOwnProperty(name)) {
                    console.warn(`FastForm Warning: Overwriting validator for '${name}'.`)
                }
                Feature_Validation._validators[name] = definition
            }
        }
    },
    _validators: {
        required: ({ value }) => {
            const isEmpty = value == null
                || (typeof value === "string" && value.trim() === "")
                || (Array.isArray(value) && value.length === 0)
            return !isEmpty ? true : i18n.t("global", "error.required")
        },
        integer: ({ value }) => {
            if (value == null || value === "") return true
            if ((typeof value !== "string" && typeof value !== "number") || isNaN(value)) {
                return i18n.t("global", "error.isNaN")
            }
            return Number.isInteger(Number(value)) ? true : (i18n.t("global", "error.integer"))
        },
        pattern: (pattern) => ({ value }) => {
            if (!value) return true
            return pattern.test(value) ? true : i18n.t("global", "error.pattern")
        },
        notEqual: (target) => ({ value }) => {
            if (value == null) return true
            return value !== target ? true : i18n.t("global", "error.invalid", { value: target })
        },
        min: (min) => ({ value }) => {
            if (value == null || value === "") return true
            if ((typeof value !== "string" && typeof value !== "number") || isNaN(value)) {
                return i18n.t("global", "error.isNaN")
            }
            return Number(value) >= min ? true : i18n.t("global", "error.min", { min })
        },
        max: (max) => ({ value }) => {
            if (value == null || value === "") return true
            if (isNaN(value)) return i18n.t("global", "error.isNaN")
            return Number(value) <= max ? true : i18n.t("global", "error.max", { max })
        },
        array: ({ value }) => {
            if (value == null) return true
            return Array.isArray(value) ? true : i18n.t("global", "error.pattern")
        },
        object: ({ value }) => {
            if (value == null) return true
            return (!Array.isArray(value) && typeof value === "object") ? true : i18n.t("global", "error.pattern")
        },
        arrayOrObject: ({ value }) => {
            if (value == null) return true
            return (Array.isArray(value) || typeof value === "object") ? true : i18n.t("global", "error.pattern")
        },
    }
}

function normalizeWatcherOptions(rule) {
    const isFullDefinition = ["when", "triggers"].some(key => rule.hasOwnProperty(key))
    let when, triggers
    if (isFullDefinition) {
        when = rule.when
        triggers = rule.triggers
    } else {
        when = rule
    }
    return { when, triggers }
}

const Feature_FieldDependencies = {
    featureOptions: {
        fieldDependencies: {},
        fieldDependencyUnmetAction: "readonly", // hide | readonly
    },
    compile: ({ form, options }) => {
        const allActions = {}
        const allDependencies = { ...options.fieldDependencies }
        form.traverseFields(field => {
            if (!field.dependencies) return
            if (allDependencies.hasOwnProperty(field.key)) {
                console.warn(`FastForm Warning: Dependency for '${field.key}' is defined both inline and in top-level options. The inline definition will be used.`)
            }
            allDependencies[field.key] = field.dependencies
            allActions[field.key] = field.dependencyUnmetAction || options.fieldDependencyUnmetAction || "readonly"
        })
        const { register } = form.getApi("watchers")
        Object.entries(allDependencies).forEach(([fieldKey, rule]) => {
            if (!rule) return

            const watcherKey = `_field_dependency_${fieldKey}`
            const { when, triggers } = normalizeWatcherOptions(rule)
            const className = (allActions[fieldKey] === "hide") ? "plugin-common-hidden" : "plugin-common-readonly"
            register(watcherKey, {
                when: when,
                triggers: triggers,
                effect: {
                    $updateUI: {
                        $then: { [fieldKey]: { $classes: { $remove: className } } },
                        $else: { [fieldKey]: { $classes: { $add: className } } },
                    },
                },
                isFieldDependency: true, // Special property to identify it as an auto-generated watcher
            })
        })
    },
    install: (FastFormClass) => {
        // usage:
        //  $follow: "fieldKey1"
        //  $follow: ["fieldKey1", "fieldKey2"]
        const Condition_Follow = {
            collectTriggers: (fieldKeyOrKeys, ctx) => {
                const keys = Array.isArray(fieldKeyOrKeys) ? fieldKeyOrKeys : [fieldKeyOrKeys]
                keys.filter(key => typeof key === "string").forEach(key => {
                    const dep = ctx.getField(key)?.dependencies
                    if (dep) ctx.collectTriggers(dep)
                })
            },
            evaluate: (fieldKeyOrKeys, ctx) => {
                if (typeof fieldKeyOrKeys === "string") {
                    return Condition_Follow._isFieldAvailable(ctx, fieldKeyOrKeys)
                } else if (Array.isArray(fieldKeyOrKeys)) {
                    return fieldKeyOrKeys.every(key => (typeof key === "string") && Condition_Follow._isFieldAvailable(ctx, key))
                }
                return false
            },
            _isFieldAvailable: (ctx, key) => {
                const field = ctx.getField(key)
                return field ? (field.dependencies ? ctx.evaluate(field.dependencies) : true) : false
            },
        }
        FastFormClass.registerConditionEvaluator("$follow", Condition_Follow)
    }
}

const Feature_BoxDependencies = {
    featureOptions: {
        boxDependencies: {},
        boxDependencyUnmetAction: "hide", // hide | readonly
        destroyStateOnHide: false,
    },
    configure: ({ initState }) => initState(new Map()),
    compile: ({ form, options, state }) => {
        const allBoxes = {}
        const allActions = {}
        const allRules = { ...options.boxDependencies }
        form.traverseBoxes((box) => {
            allBoxes[box.id] = box
            if (box.dependencies) {
                if (allRules.hasOwnProperty(box.id)) {
                    console.warn(`FastForm Warning: Box for '${box.id}' is defined both inline and in top-level options. The inline definition will be used.`)
                }
                allRules[box.id] = box.dependencies
                allActions[box.id] = box.dependencyUnmetAction || options.boxDependencyUnmetAction || "hide"
            }
        }, options.schema)

        if (Object.keys(allRules).length === 0) return

        const { register } = form.getApi("watchers")
        Object.entries(allRules).forEach(([boxId, rule]) => {
            if (!rule) return
            if (!allBoxes[boxId]) {
                console.warn(`FastForm Warning: Box with id '${boxId}' rule is defined, but box is not found in schema.`)
                return
            }

            const watcherKey = `_box_dependency_${boxId}`
            const { when, triggers } = normalizeWatcherOptions(rule)
            const affects = [form.constructor.createUiStateKey({ target: boxId, property: "classes" })]
            register(watcherKey, {
                when: when,
                triggers: triggers,
                affects: affects,
                effect: (isConditionMet, context) => {
                    const box = context.getBox(boxId)
                    if (!box) return

                    const wantHide = !isConditionMet && allActions[boxId] === "hide"
                    const wantReadonly = !isConditionMet && allActions[boxId] === "readonly"
                    const wasHidden = box.classList.contains("plugin-common-hidden")
                    box.classList.toggle("plugin-common-hidden", wantHide)
                    box.classList.toggle("plugin-common-readonly", wantReadonly)

                    if (!options.destroyStateOnHide) return
                    if (wantHide && !wasHidden) {
                        const boxSchema = allBoxes[boxId]
                        if (boxSchema) {
                            const cache = {}
                            form.traverseFields(field => {
                                if (field.key) {
                                    cache[field.key] = form.getData(field.key)
                                    context.setValue(field.key, undefined)
                                }
                            }, [boxSchema])
                            state.set(boxId, cache)
                        }
                    } else if (!wantHide && wasHidden) {
                        const dataToRestore = state.get(boxId)
                        if (dataToRestore) {
                            Object.entries(dataToRestore).forEach(([fieldKey, value]) => context.setValue(fieldKey, value))
                            state.delete(boxId)
                        }
                    }
                },
                isBoxDependency: true, // Special property to identify it as an auto-generated watcher
            })
        })
    }
}

const Feature_Cascades = {
    featureOptions: {
        cascades: {},
    },
    compile: ({ form, options }) => {
        if (!options.cascades || typeof options.cascades !== "object") return

        const { register } = form.getApi("watchers")
        Object.entries(options.cascades).forEach(([cascadeKey, rule]) => {
            const watcherKey = `_cascade_${cascadeKey}`
            if (!rule || !rule.hasOwnProperty("target") || !rule.hasOwnProperty("value")) {
                console.warn(`FastForm Warning: Cascade rule "${cascadeKey}" is missing a "target" or "value".`)
                return
            }
            register(watcherKey, {
                when: rule.when,
                triggers: rule.triggers,
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
}

FastForm.registerFeature("eventDelegation", Feature_EventDelegation)
FastForm.registerFeature("defaultKeybindings", Feature_DefaultKeybindings)
FastForm.registerFeature("watchers", Feature_Watchers)
FastForm.registerFeature("parsing", Feature_Parsing)
FastForm.registerFeature("validation", Feature_Validation)
FastForm.registerFeature("fieldDependencies", Feature_FieldDependencies)
FastForm.registerFeature("boxDependencies", Feature_BoxDependencies)
FastForm.registerFeature("cascades", Feature_Cascades)

// usage:
//  $compareFields: { left: "fieldKey1", operator: "$lt", right: "fieldKey2" }
const Condition_CompareFields = {
    collectTriggers: (cond, ctx) => {
        if (cond && typeof cond.left === "string") ctx.addKey(cond.left)
        if (cond && typeof cond.right === "string") ctx.addKey(cond.right)
    },
    evaluate: (cond, ctx) => {
        if (!cond || typeof cond.left !== "string" || typeof cond.right !== "string") {
            console.warn("FastForm Warning: $compactFields requires that the 'left' and 'right' attributes must be strings.", cond)
            return false
        }
        const leftValue = ctx.getValue(cond.left)
        const rightValue = ctx.getValue(cond.right)
        const operator = cond.operator || "$eq"
        const handler = ctx.comparisonEvaluators[operator]
        if (handler && typeof handler.evaluate === "function") {
            return handler.evaluate(leftValue, rightValue)
        } else {
            console.warn(`FastForm Warning: Unknown comparison operator used in $compactFields "${operator}".`)
            return false
        }
    },
}

// usage:
//   $length: { fieldKey1: 3, fieldKey2: 4 }
//   $length: { fieldKey1: { $gt: 1 }, fieldKey2: { $eq: 4 } }
const Condition_Length = {
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
}

// usage:
//   $regex: "^\\d{3}(\\d{2})?$"
//   $regex: { pattern: ”^pid-\\d+$“, flags: 'i' }
const Comparison_Regex = {
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
            console.error("FastForm Error: Invalid regex provided to '$regex'.", { pattern, flags }, e)
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
}

// usage:
//   $map: { to: "fullName", with: (context) => context.getValue("lastName").trim() }
//   $map: { from: "firstName", to: "fullName", with: (firstName, context) => `${firstName} ${context.getValue("lastName").trim()}` }
const Effect_Map = {
    collectAffects: (value) => {
        if (!value || typeof value.to !== "string") {
            console.warn("FastForm Warning: $map effect is missing a valid 'to' property.", value)
            return []
        }
        return [value.to]
    },
    execute: (isConditionMet, value, context) => {
        if (!isConditionMet) return
        if (!value || typeof value.to !== "string") {
            console.error("FastForm Error: $map effect requires 'from' and 'to' string properties to execute.", value)
            return
        }
        if (typeof value.with !== "function" && typeof value.from !== "string") {
            console.error("FastForm Error: $map effect requires a 'from' property when 'with' is not a function.", value)
            return
        }
        const sourceValue = (typeof value.from === "string") ? context.getValue(value.from) : undefined
        const finalValue = (typeof value.with === "function") ? value.with(sourceValue, context) : sourceValue
        const currentTargetValue = context.getValue(value.to)
        if (!utils.deepEqual(currentTargetValue, finalValue)) {
            context.setValue(value.to, finalValue)
        }
    }
}

FastForm.registerConditionEvaluator("$compareFields", Condition_CompareFields)
FastForm.registerConditionEvaluator("$length", Condition_Length)
FastForm.registerComparisonEvaluator("$regex", Comparison_Regex)
FastForm.registerEffectHandler("$map", Effect_Map)

function Try(fn, buildErr = utils.identity) {
    try {
        fn()
    } catch (err) {
        return new Error(buildErr(err))
    }
}

const Validator_Url = ({ value }) => {
    if (!value) return true
    const pattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/
    return pattern.test(value) ? true : i18n.t("global", "error.invalidURL")
}

const Validator_Regex = ({ value }) => {
    return Try(() => value && new RegExp(value), () => `Error Regex: ${value}`)
}

const Validator_Path = ({ value }) => {
    const base = utils.resolvePath(value)
    return Try(() => value && utils.Package.Fs.accessSync(base), () => `No such path: ${base}`)
}

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
    const step = (field.step === undefined && field.isInteger) ? 1 : field.step
    return [
        typeof field.min === "number" ? `min=${field.min}` : "",
        typeof field.max === "number" ? `max=${field.max}` : "",
        typeof step === "number" ? `step=${step}` : "",
    ].join(" ")
}

function updateInputNumericalAttr(input, field) {
    const step = (field.step === undefined && field.isInteger) ? 1 : field.step
    input.min = typeof field.min === "number" ? field.min : ""
    input.max = typeof field.max === "number" ? field.max : ""
    input.step = typeof step === "number" ? step : ""
}

function updateInputState(input, field, value) {
    input.value = value
    input.disabled = !!field.disabled
    input.readOnly = !!field.readonly
}

function normalizeOptionsAttr(field) {
    if (Array.isArray(field.options) && field.options.every(op => typeof op === "string")) {
        field.options = Object.fromEntries(field.options.map(op => [op, op]))
    }
}

function defaultBlockLayout(field) {
    if (!field.hasOwnProperty("isBlockLayout")) {
        field.isBlockLayout = true
    }
}

function registerRules({ form, field }, rules) {
    form.getApi("validation")?.addRule(field.key, rules)
}

function registerNumericalDefaultRules({ field, form }) {
    const { min, max, isInteger } = field
    const [required, integer, minFactory, maxFactory] = form.constructor.validator.get("required", "integer", "min", "max")
    const rules = [required]
    if (isInteger === true) {
        rules.push(integer)
    }
    if (typeof min === "number") {
        rules.push(minFactory(min))
    }
    if (typeof max === "number") {
        rules.push(maxFactory(max))
    }
    registerRules({ field, form }, rules)
}

function registerItemLengthLimitRule({ field, form }) {
    registerRules({ field, form }, ({ key, value, type }) => {
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

const Control_Switch = {
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
}

const Control_Text = {
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
}

const Control_Password = {
    create: ({ field }) => {
        const { key, placeholder } = getCommonHTMLAttrs(field)
        return `<input class="password-input" type="password" ${key} ${placeholder}>`
    },
    update: ({ element, value, field }) => {
        const input = element.querySelector(".password-input")
        if (input) {
            updateInputState(input, field, value || "")
        }
    },
    bindEvents: ({ form }) => {
        form.onEvent("change", ".password-input", function () {
            form.validateAndCommit(this.dataset.key, this.value)
        })
    },
}

const Control_Color = {
    create: ({ field }) => {
        const { key, placeholder } = getCommonHTMLAttrs(field)
        const input = `<input class="color-input" type="color" ${key} ${placeholder}>`
        return `<div class="color-wrap"><div class="color-display"></div>${input}</div>`
    },
    update: ({ element, value, field }) => {
        const input = element.querySelector(".color-input")
        const display = element.querySelector(".color-display")
        if (input && display) {
            value = value || "#000000"
            updateInputState(input, field, value)
            display.textContent = value.toUpperCase()
        }
    },
    bindEvents: ({ form }) => {
        form.onEvent("input", ".color-input", function () {
            this.previousElementSibling.textContent = this.value.toUpperCase()
        }).onEvent("change", ".color-input", function () {
            form.validateAndCommit(this.dataset.key, this.value)
        })
    },
}

const Control_Number = {
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
}

const Control_Unit = {
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
}

const Control_Icon = {
    controlOptions: {
        placeholder: "fa fa-home",
    },
    create: ({ field, controlOptions }) => {
        const { key } = getCommonHTMLAttrs(field)
        const placeholderText = field.placeholder || controlOptions.placeholder
        const input = `<input class="icon-input" type="text" ${key} placeholder="${placeholderText}">`
        const preview = '<div class="icon-preview"><i class="icon-display"></i></div>'
        return `<div class="icon-wrap">${input}${preview}</div>`
    },
    update: ({ element, value, field }) => {
        const input = element.querySelector(".icon-input")
        const display = element.querySelector(".icon-display")
        if (input && display) {
            value = value || ""
            updateInputState(input, field, value)
            Control_Icon._syncIcon(display, value)
        }
    },
    bindEvents: ({ form }) => {
        form.onEvent("input", ".icon-input", function () {
            const display = this.nextElementSibling.querySelector(".icon-display")
            Control_Icon._syncIcon(display, this.value)
        }).onEvent("change", ".icon-input", function () {
            form.validateAndCommit(this.dataset.key, this.value)
        })
    },
    _syncIcon: (display, value) => display.className = `icon-display ${value}`,
}

const Control_Range = {
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
}

const Control_Action = {
    controlOptions: {
        actionType: "function", // function | toggle | trigger
        activeClass: "active",  // Style class name activated in toggle mode
    },
    create: ({ field }) => `<div class="action fa fa-angle-right" data-action="${field.key}"></div>`,
    update: ({ element, value, controlOptions }) => {
        if (controlOptions.actionType === "toggle") {
            element.classList.toggle(controlOptions.activeClass, !!value)
        }
    },
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
            const key = this.querySelector(".action").dataset.action
            const actionType = form.getControlOptionsFromKey(key).actionType || "function"
            if (actionType === "toggle") {
                form.reactiveCommit(key, !form.getData(key))  // Toggle mode: reverse the current value, submit data
            } else if (actionType === "trigger") {
                form.reactiveCommit(key, Date.now())  // Trigger mode: Update to timestamp to signal watchers
            } else {
                form.options.actions[key]?.(form)  // Function mode: Execute callbacks
            }
        })
    },
}

const Control_Static = {
    create: () => `<div class="static"></div>`,
    update: ({ element, value, field }) => {
        const wrap = element.querySelector(".static")
        if (wrap) {
            wrap.textContent = value ?? field.content ?? ""
        }
    },
}

const Control_Custom = {
    setup: ({ field }) => {
        defaultBlockLayout(field)
        setRandomKey(field)
    },
    create: () => `<div class="custom-wrap"></div>`,
    update: ({ element, value, field }) => {
        const wrap = element.querySelector(".custom-wrap")
        if (wrap) {
            const val = value ?? field.content ?? ""
            wrap.innerHTML = (field.unsafe === true) ? val : utils.escape(val)
        }
    },
}

const Control_Hint = {
    setup: ({ field }) => {
        defaultBlockLayout(field)
        setRandomKey(field)
    },
    create: () => `<div class="hint-wrap"></div>`,
    update: ({ element, value, field }) => {
        const wrap = element.querySelector(".hint-wrap")
        if (wrap) {
            const getData = (prop) => {
                const val = value?.[prop] ?? field[prop] ?? ""
                return (field.unsafe === true) ? val : utils.escape(val)
            }
            const hintHeader = getData("hintHeader")
            const hintDetail = getData("hintDetail").replace(/\n/g, "<br>")
            const headerHTML = hintHeader ? `<div class="hint-header">${hintHeader}</div>` : ""
            const detailHTML = hintDetail ? `<div class="hint-detail">${hintDetail}</div>` : ""
            wrap.innerHTML = headerHTML + detailHTML
        }
    },
}

const Control_Hotkey = {
    create: ({ field }) => {
        const { key, placeholder } = getCommonHTMLAttrs(field, true)
        return `<div class="hotkey-wrap">
                    <input type="text" class="hotkey-input" ${key} ${placeholder}>
                      <div class="hotkey-btn">
                        <div class="hotkey-reset plugin-common-close"></div>
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
}

const Control_Textarea = {
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
        form.onEvent("keydown", ".textarea", function (ev) {
            if (utils.metaKeyPressed(ev) && ev.key === "Enter") {
                form.validateAndCommit(this.dataset.key, this.value)
                ev.preventDefault()
            }
        }, true).onEvent("change", ".textarea", function () {
            form.validateAndCommit(this.dataset.key, this.value)
        })
    },
}

const Control_Object = {
    controlOptions: {
        format: "JSON",
        rows: 3,
        noResize: false,
    },
    setup: (context) => {
        defaultBlockLayout(context.field)
        registerRules(context, "arrayOrObject")
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
}

const Control_Array = {
    controlOptions: {
        allowDuplicates: false,
        dataType: "string",  // number or string
    },
    setup: ({ field, form }) => {
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
            if (duplication) {
                return new Error(i18n.t("global", "error.duplicateValue"))
            }
        }
        registerRules({ form, field }, [correctType, repeatable])
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
        }, true).onEvent("click", ".array-item-delete", function () {
            const itemEl = this.parentElement
            const arrayEl = this.closest(".array")
            const idx = [...arrayEl.querySelectorAll(".array-item")].indexOf(itemEl)
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
            <div class="array-item-delete plugin-common-close"></div>
        </div>
    `,
    _createItems: (items) => (Array.isArray(items) ? items : []).map(Control_Array._createItem).join(""),
}

const Control_Select = {
    setupType: ({ initState }) => initState(new Map()),
    controlOptions: {
        labelJoiner: ", ",
    },
    setup: (context) => {
        normalizeOptionsAttr(context.field)
        registerItemLengthLimitRule(context)
    },
    create: ({ field }) => {
        const toOptionItem = ([optionKey, optionShowName]) => {
            const readonlyCls = field.disabledOptions?.includes(optionKey) ? "plugin-common-readonly" : ""
            const cls = `option-item${readonlyCls ? ' ' + readonlyCls : ''}`
            return `<div class="${cls}" data-option-key="${optionKey}">${utils.escape(optionShowName)}</div>`
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
    bindEvents: ({ form, state }) => {
        const SHOWN_OPTION_BOX = "shownOptionBox"
        form.onEvent("click", function () {
            const shownOptionBox = state.get(SHOWN_OPTION_BOX)
            if (shownOptionBox) {
                utils.hide(shownOptionBox)
            }
            state.set(SHOWN_OPTION_BOX, null)
        }).onEvent("click", ".select-wrap", function (ev) {
            ev.stopPropagation()
            ev.preventDefault()
            const optionBox = this.nextElementSibling
            const boxes = [...form.getFormEl().querySelectorAll(".option-box")]
            boxes.filter(box => box !== optionBox).forEach(utils.hide)
            utils.toggleInvisible(optionBox)
            const isShown = utils.isShow(optionBox)
            if (isShown) {
                optionBox.scrollIntoView({ block: "nearest" })
            }
            state.set(SHOWN_OPTION_BOX, isShown ? optionBox : null)
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
}

const Control_Radio = {
    controlOptions: {
        columns: 1,
    },
    setup: ({ field }) => {
        normalizeOptionsAttr(field)
        defaultBlockLayout(field)
    },
    create: ({ field, controlOptions }) => {
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
                </div>`
        }
        const options = Object.entries(field.options).map(toItem).join("")
        const { key } = getCommonHTMLAttrs(field)
        const style = controlOptions.columns > 1 ? `style="display: grid; grid-template-columns: repeat(${controlOptions.columns}, 1fr);"` : ""
        return `<div class="radio" ${key} ${style}>${options}</div>`
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
}

const Control_Checkbox = {
    controlOptions: {
        columns: 1,
    },
    setup: (context) => {
        normalizeOptionsAttr(context.field)
        defaultBlockLayout(context.field)
        registerItemLengthLimitRule(context)
    },
    create: ({ field, controlOptions }) => {
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
                </div>`
        }
        const options = Object.entries(field.options).map(toItem).join("")
        const { key } = getCommonHTMLAttrs(field)
        const style = controlOptions.columns > 1 ? `style="display: grid; grid-template-columns: repeat(${controlOptions.columns}, 1fr);"` : ""
        return `<div class="checkbox" ${key} ${style}>${options}</div>`
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
}

const Control_Dict = {
    controlOptions: {
        keyPlaceholder: "Key",
        valuePlaceholder: "Value",
        allowAddItem: true,
    },
    setup: ({ field }) => defaultBlockLayout(field),
    create: ({ field, controlOptions }) => {
        const { key } = getCommonHTMLAttrs(field)
        const list = '<div class="dict-list"></div>'
        const add = controlOptions.allowAddItem ? `<div class="dict-btn-add">+ ${i18n.t("global", "add")}</div>` : ""
        return `<div class="dict-wrap" ${key}>${list}${add}</div>`
    },
    update: ({ element, value, controlOptions }) => {
        const listEl = element.querySelector(".dict-list")
        if (!listEl) return
        listEl.innerHTML = Object.entries(value || {}).map(([k, v]) => Control_Dict._createRow(k, v, controlOptions)).join("")
    },
    bindEvents: ({ form }) => {
        const closeAllMenus = () => form.getFormEl().querySelectorAll(".dict-type-menu.show").forEach(el => el.classList.remove("show"))
        form.onEvent("click", function (ev) {
            if (!ev.target.closest(".dict-type-wrap")) {
                closeAllMenus()
            }
        }).onEvent("click", ".dict-type-badge", function (ev) {
            ev.stopPropagation()
            const menu = this.nextElementSibling
            const isShown = menu.classList.contains("show")
            closeAllMenus()
            if (!isShown) menu.classList.add("show")
        }).onEvent("click", ".dict-type-option", function (ev) {
            ev.stopPropagation()
            const targetType = this.dataset.type
            const wrapEl = this.closest(".dict-type-wrap")
            const badgeEl = wrapEl.querySelector(".dict-type-badge")
            const valInput = wrapEl.closest(".dict-row").querySelector(".dict-val")
            const typeHandler = Control_Dict._types[targetType]
            if (!typeHandler.validate(valInput.value)) {
                valInput.classList.add("input-error")
                setTimeout(() => valInput.classList.remove("input-error"), 500)
                closeAllMenus()
                return
            }
            badgeEl.dataset.type = targetType
            badgeEl.textContent = typeHandler.label
            closeAllMenus()
            Control_Dict._collectAndCommit(wrapEl, form)
        }).onEvent("change", ".dict-input", function () {
            Control_Dict._collectAndCommit(this, form)
        }).onEvent("click", ".dict-btn-del", utils.createConsecutiveAction({
            threshold: 2,
            timeWindow: 3000,
            getIdentifier: (ev) => ev.target,
            onConfirmed: (ev) => {
                const row = ev.target.closest(".dict-row")
                const wrap = ev.target.closest(".dict-wrap")
                row.remove()
                Control_Dict._collectAndCommit(wrap, form)
            }
        })).onEvent("click", ".dict-btn-add", function () {
            const wrap = this.parentElement
            const listEl = wrap.querySelector(".dict-list")
            const fieldKey = wrap.getAttribute("data-key")
            const controlOptions = form.getControlOptionsFromKey(fieldKey)
            const row = Control_Dict._createRow("", "", controlOptions)
            listEl.insertAdjacentHTML("beforeend", row)
            listEl.lastElementChild.querySelector(".dict-key")?.focus()
        })
    },
    _createRow: (key, val, options) => {
        let currentType = "string"
        if (typeof val === "number") currentType = "number"
        else if (typeof val === "boolean") currentType = "boolean"
        else if (typeof val === "object" && val !== null) currentType = "json"

        let displayVal
        if (currentType === "json") displayVal = JSON.stringify(val)
        else if (val == null) displayVal = ""
        else displayVal = String(val)

        const k = utils.escape(String(key || ""))
        const v = utils.escape(displayVal)
        const typeConfig = Control_Dict._types
        const currentLabel = typeConfig[currentType].label
        const toOption = ([key, def]) => `<div class="dict-type-option ${key === currentType ? "active" : ""}" data-type="${key}">${def.label}</div>`
        const menuItems = Object.entries(typeConfig).map(toOption).join("")
        return `
            <div class="dict-row">
                <input class="dict-input dict-key" type="text" value="${k}" placeholder="${options.keyPlaceholder}">
                <div class="dict-val-wrapper">
                    <input class="dict-input dict-val" type="text" value="${v}" placeholder="${options.valuePlaceholder}">
                    <div class="dict-type-wrap">
                        <div class="dict-type-badge" data-type="${currentType}">${currentLabel}</div>
                        <div class="dict-type-menu">${menuItems}</div>
                    </div>
                </div>
                <div class="dict-actions"><i class="dict-btn-del fa fa-trash-o"></i></div>
            </div>`
    },
    _collectAndCommit: (targetEl, form) => {
        const wrap = targetEl.closest(".dict-wrap")
        if (!wrap) return
        const result = {}
        const typeConfig = Control_Dict._types
        wrap.querySelectorAll(".dict-row").forEach(row => {
            const k = row.querySelector(".dict-key").value.trim()
            if (!k) return

            const valInput = row.querySelector(".dict-val")
            const badgeEl = row.querySelector(".dict-type-badge")

            const rawVal = valInput.value
            let handler = typeConfig[badgeEl.dataset.type || "string"]
            if (!handler.validate(rawVal)) {
                handler = typeConfig.string

                badgeEl.dataset.type = "string"
                badgeEl.textContent = handler.label

                valInput.classList.add("input-warn")
                setTimeout(() => valInput.classList.remove("input-warn"), 500)
            }
            result[k] = handler.parse(rawVal)
        })
        form.validateAndCommit(wrap.getAttribute("data-key"), result)
    },
    _types: {
        string: { label: "STR", validate: () => true, parse: String },
        number: { label: "NUM", validate: (v) => !isNaN(Number(v)) && v.trim() !== "", parse: Number },
        boolean: { label: "BOOL", validate: (v) => v === "true" || v === "false", parse: (v) => v === "true" },
        json: {
            label: "JSON",
            validate: (v) => {
                try {
                    JSON.parse(v)
                    return true
                } catch (e) {
                    return false
                }
            },
            parse: JSON.parse
        },
    },
}

const Control_Table = {
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
            const { nestedBoxes, defaultValues, thMap, ...rest } = form.getField(key)
            const op = { title: i18n.t("global", "add"), schema: nestedBoxes, data: defaultValues, ...rest }
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
            const { nestedBoxes, defaultValues, thMap, ...rest } = form.getField(key)
            const modalValues = utils.merge(defaultValues, rowValue)  // rowValue may be missing some attributes
            const op = { title: i18n.t("global", "edit"), schema: nestedBoxes, data: modalValues, ...rest }
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
}

const Control_Composite = {
    setupType: ({ initState }) => initState(new Map()),
    setup: ({ field, form, options, state }) => {
        defaultBlockLayout(field)

        const originValue = form.getData(field.key)
        const fixedValue = (originValue === false || originValue == null)
            ? false
            : typeof originValue !== "object"
                ? field.defaultValues
                : { ...field.defaultValues, ...originValue }

        form.setData(field.key, fixedValue)  // Fix data
        state.set(field.key, { ...field.defaultValues, ...fixedValue })  // Set cache

        Control_Composite._setCacheWatcher(options, field, state)
        Control_Composite._setDependencies(field)
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
            form.fillForm(field.subSchema, container)  // Lazy rendering
        }
    },
    bindEvents: ({ form, state }) => {
        form.onEvent("change", ".composite-switch .switch-input", function () {
            const key = this.dataset.key
            const valueToCommit = this.checked ? state.get(key) : false
            form.reactiveCommit(key, valueToCommit)
        })
    },
    _setDependencies: (field) => {
        const fieldDeps = { $follow: field.key }
        const fieldEnabled = { [field.key]: { $bool: true } }
        for (const box of field.subSchema || []) {
            for (const subField of box.fields || []) {
                const subFieldDeps = subField.dependencies ? [subField.dependencies] : []
                subField.dependencies = { $and: [fieldEnabled, fieldDeps, ...subFieldDeps] }
            }
        }
    },
    _setCacheWatcher: (options, field, state) => {
        const subFieldKeys = Control_Composite._collectAllKeys(field.subSchema)
        if (subFieldKeys.length === 0) return
        if (!options.watchers) options.watchers = {}
        const watcherKey = `_composite_cache_sync_${field.key}`
        options.watchers[watcherKey] = {
            triggers: subFieldKeys,
            when: { [field.key]: { $typeof: "object" } },
            affects: [],
            effect: (isMet, ctx) => {
                if (isMet) state.set(field.key, { ...field.defaultValues, ...ctx.getValue(field.key) })
            }
        }
    },
    _collectAllKeys: (schema, prefix) => {
        const keys = []
        for (const box of schema || []) {
            for (const field of (box.fields || [])) {
                if (!field.key) continue
                const fullKey = prefix ? `${prefix}.${field.key}` : field.key
                keys.push(fullKey)
                if (field.type === "composite" && Array.isArray(field.subSchema)) {
                    keys.push(...Control_Composite._collectAllKeys(field.subSchema, fullKey))
                }
            }
        }
        return keys
    },
}

FastForm.registerControl("switch", Control_Switch)
FastForm.registerControl("text", Control_Text)
FastForm.registerControl("password", Control_Password)
FastForm.registerControl("color", Control_Color)
FastForm.registerControl("number", Control_Number)
FastForm.registerControl("unit", Control_Unit)
FastForm.registerControl("icon", Control_Icon)
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
FastForm.registerControl("dict", Control_Dict)
FastForm.registerControl("table", Control_Table)
FastForm.registerControl("composite", Control_Composite)

customElements.define("fast-form", FastForm)
