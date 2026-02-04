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
            getNestedSchemas: { type: "function" },
            controlOptions: { type: "plainObject" },
        })
        if (this.controls.hasOwnProperty(name)) {
            console.warn(`FastForm Warning: Overwriting control for '${name}'.`)
        }
        this.controls[name] = definition
    }

    static registerFeature = (name, definition) => {
        validateDefinition(name, definition, {
            install: { type: "function" },
            configure: { type: "function" },
            compile: { type: "function" },
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
        if (!definition || typeof definition !== "object") {
            throw new TypeError("Layout definition must be an object.")
        }
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
        this._runtime = {
            fields: {},
            cleanups: [],
            apis: new Map(),
            pendingChanges: new Map(),
            isTaskQueued: false,
        }
        this.hooks = this._createHooksManager()
        this.hooks.invoke("onConstruct", this)
    }

    disconnectedCallback() {
        this.clear()
    }

    render = (options) => {
        this.clear()

        this.options = this._initOptions(this.hooks.invoke("onOptions", options, this))
        this._normalizeSchema(this.options.schema)
        this._configureFeatures(this.options)  // register feature APIs and hooks
        this._normalizeControls(this.options)  // init controls and expand options
        this._compileFeatures(this.options)    // compile features base on the final options

        this.hooks.invoke("onOptionsReady", this)
        this._applyUserHooks(this.options.hooks)
        this._collectFields(this.options.schema)

        this.fillForm(this.options.schema, this.form)
        this._bindAllEvents(this.options.controls)
        this.hooks.invoke("onRender", this)
    }

    _createHooksManager(staticSubscribers = Object.values(this.constructor.features)) {
        const getValidationResult = (result) => {
            return result instanceof Error
                ? [result]
                : Array.isArray(result) ? result : []
        }
        const defaultHooks = {
            onConstruct: (form) => void 0,
            onOptions: (options, form) => options,
            onOptionsReady: (form) => void 0,
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
            onDestroy: (form) => void 0,
        }
        const hookStrategies = {
            onOptions: { strategy: "pipeline" },
            onProcessValue: { strategy: "pipeline" },
            onAfterValidate: { strategy: "pipeline" },
            onBeforeValidate: { strategy: "aggregate", getResult: getValidationResult },
            onValidate: { strategy: "aggregate", getResult: getValidationResult },
        }
        return new LifecycleHooks(defaultHooks, hookStrategies, staticSubscribers)
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
                const nestedSchemas = this._getControlNestedSchemas(field)
                nestedSchemas.forEach(schema => this.traverseFields(visitorFn, schema, field))
            }
        }
    }

    traverseBoxes = (visitorFn, schema = this.options.schema, parentBox = null) => {
        for (const box of schema) {
            visitorFn(box, parentBox)
            for (const field of box.fields || []) {
                const nestedSchemas = this._getControlNestedSchemas(field)
                nestedSchemas.forEach(schema => this.traverseBoxes(visitorFn, schema, box))
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
        this.options.layout.render({ schema, container, form: this })
        this.traverseFields(field => this._updateControl(field.key), schema)
        this.traverseFields(field => this._mountControl(field), schema)
    }

    clear = () => {
        this.hooks.invoke("onDestroy", this)
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

    resolveFieldContext(key) {
        if (!key) return null
        if (this._runtime.fields[key]) {
            return { field: this._runtime.fields[key], fullPath: key, relativePath: "" }
        }
        const parts = key.split(".")
        while (parts.length > 0) {
            parts.pop()
            const currentKey = parts.join(".")
            const field = this._runtime.fields[currentKey]
            if (field) {
                return { field, fullPath: key, relativePath: key.slice(currentKey.length + 1) }
            }
        }
        return null
    }

    _getControlNestedSchemas(field) {
        const controlDef = this.constructor.controls[field.type]
        if (controlDef && typeof controlDef.getNestedSchemas === "function") {
            const schemas = controlDef.getNestedSchemas(field)
            return Array.isArray(schemas) ? schemas : []
        }
        return []
    }

    _updateControl = (key, value) => {
        const context = this.resolveFieldContext(key)
        if (!context) return

        const { field, fullPath, relativePath } = context
        const controlDef = this.options.controls[field.type]
        if (!controlDef || typeof controlDef.update !== "function") return

        const element = this.options.layout.findControl(field.key, this.form)
        if (!element) return

        const updateContext = {
            element,
            field,
            form: this,
            data: this.options.data,
            value: this.getData(field.key),
            trigger: {
                fullPath,
                relativePath,
                value: (key !== field.key || value === undefined) ? this.getData(fullPath) : value,
            },
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
            if (!box.id) box.id = `_box_${uniqueNum()}`
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
                            ? () => Array.from(state.values()).forEach(s => s && typeof s.clear === "function" && s.clear())
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
        for (const [name, impl] of Object.entries(userHooks)) {
            if (typeof impl === "function") {
                this.hooks.on(name, impl)
            } else if (impl && typeof impl === "object") {
                if (typeof impl.on === "function") {
                    this.hooks.on(name, impl.on)
                }
                if (typeof impl.override === "function") {
                    this.hooks.override(name, impl.override)
                }
            }
        }
    }

    /**
     * _resolveLayout("gird")
     * _resolveLayout({ base: "grid", defaultCol: 12 })
     * _resolveLayout({ base: "grid", defaultCol: 12, setup: (base) => ({ render: (ctx) => {} }) })
     */
    _resolveLayout(rawInput) {
        const resolve = (nameOrDef) => {
            let def = nameOrDef
            if (typeof nameOrDef === "string") {
                def = this.constructor.layouts[nameOrDef]
                if (!def) {
                    throw new Error(`FastForm Layout Error: Layout '${nameOrDef}' not found.`)
                }
            } else if (!def || typeof def !== "object") {
                return resolve("default")
            }

            const { base, setup, ...currentConfig } = def
            const baseName = base || (nameOrDef === "default" ? null : "default")
            const { instance: baseInstance, config: baseConfig } = baseName ? resolve(baseName) : { instance: null, config: {} }
            const mergedConfig = { ...baseConfig, ...currentConfig }
            const methods = (typeof setup === "function") ? setup(baseInstance, mergedConfig) : void 0
            const proto = baseInstance || Object.prototype
            const instance = Object.assign(Object.create(proto), currentConfig, methods)
            return { instance, config: mergedConfig }
        }

        const { instance } = resolve(rawInput)
        if (typeof instance.render !== "function") {
            throw new Error(`FastForm Layout Error: The resolved layout is missing a 'render' method.`)
        }
        return instance
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

    _collectFields = (schema) => {
        const fields = {}
        this.traverseFields(field => field.key && (fields[field.key] = field), schema)
        this._runtime.fields = fields
    }
}

class LifecycleHooks {
    constructor(defaultImpls, strategies, staticSubscribers = []) {
        this._definitions = new Map(
            Object.entries(defaultImpls).map(([hookName, impl]) => {
                const strategy = strategies[hookName] || {}
                return [hookName, { impl, ...strategy }]
            })
        )
        this._statics = new Map(
            [...this._definitions.keys()]
                .map(hookName => {
                    const impls = staticSubscribers.map(sub => sub?.[hookName]).filter(fn => typeof fn === "function")
                    return [hookName, new Set(impls)]
                })
                .filter(([_, set]) => set.size > 0)
        )
        this._temporaries = new Map()
        this._overrides = new Map()
    }

    on = (hookName, listener) => {
        if (!this._definitions.has(hookName)) {
            console.warn(`Attempting to subscribe to an unknown hook "${hookName}".`)
            return
        }
        if (!this._temporaries.has(hookName)) {
            this._temporaries.set(hookName, new Set())
        }
        if (typeof listener === "function") {
            this._temporaries.get(hookName).add(listener)
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
        const staticImpls = this._statics.get(hookName) || []
        const tempImpls = this._temporaries.get(hookName) || []
        const allImpls = [...staticImpls, ...tempImpls, impl]
        if (allImpls.length === 0) return
        switch (strategy) {
            case "pipeline":
                const [initialValue, ...otherArgs] = initialArgs
                return allImpls.reduce((currentValue, fn) => fn(currentValue, ...otherArgs), initialValue)
            case "aggregate":
                if (typeof getResult !== "function") {
                    console.error(`Hook "${hookName}" uses 'aggregate' strategy but is missing a 'getResult' function.`)
                    return []
                }
                return allImpls.flatMap(fn => getResult(fn(...initialArgs)))
            // case "bail":
            //     for (const fn of allImpls) {
            //         const ret = fn(...initialArgs)
            //         if (ret !== undefined) return ret
            //     }
            //     return
            case "broadcast":
            default:
                return allImpls.forEach(fn => fn(...initialArgs))
        }
    }
    clear = () => {
        this._temporaries.clear()
        this._overrides.clear()
    }
    has = (hookName) => this._definitions.has(hookName)
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
    containerClass: "",
    setup(base, config) {
        return {
            findBox(key, formEl) {
                return formEl.querySelector(`.box-container[data-box="${CSS.escape(key)}"]`)
            },
            findControl(key, formEl) {
                return formEl.querySelector(`.control[data-control="${CSS.escape(key)}"]`)
            },
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
                    return this.renderFieldWrapper(field, controlHTML, controlOptions.className)
                }
                const createBox = (box) => {
                    const titleHTML = this.renderBoxTitle(box)
                    const controlHTMLs = (box.fields || []).map(createControl).join("")
                    const boxHTML = this.renderBoxContent(controlHTMLs, box)
                    return this.renderBoxWrapper(box, titleHTML, boxHTML)
                }
                this.updateRootContainer(container)
                container.innerHTML = schema.map(createBox).join("")
            },
            updateRootContainer(container) {
                const cls = config.containerClass
                if (cls) container.className = cls
            },
            renderBoxWrapper(box, titleHTML, contentHTML, extraClass = "") {
                const userClass = box.className || ""
                const cls = ["box-container", userClass, extraClass].filter(Boolean).join(" ")
                return `<div class="${cls}" data-box="${box.id}">${titleHTML}${contentHTML}</div>`
            },
            renderBoxContent(fieldsHTML, box, extraClass = "") {
                const cls = ["box", extraClass].filter(Boolean).join(" ")
                return `<div class="${cls}">${fieldsHTML}</div>`
            },
            renderBoxTitle(box) {
                return box.title ? `<div class="title">${box.title}${this.renderTooltip(box)}</div>` : ""
            },
            renderFieldWrapper(field, controlHTML, extraClass = "") {
                const isBlock = field.isBlockLayout || false
                const labelHTML = isBlock ? "" : `<div class="control-left">${this.renderLabel(field)}</div>`
                const inputWrapHTML = isBlock ? controlHTML : `<div class="control-right">${controlHTML}</div>`
                const clsList = ["control"]
                if (isBlock) clsList.push("control-block")
                if (field.hidden) clsList.push("plugin-common-hidden")
                if (extraClass) clsList.push(extraClass)
                return `<div class="${clsList.join(" ")}" data-type="${field.type}" data-control="${field.key}">${labelHTML}${inputWrapHTML}</div>`
            },
            renderLabel(field) {
                const label = field.label || ""
                return field.explain
                    ? `<div><div>${label}${this.renderTooltip(field)}</div>${this.renderExplain(field)}</div>`
                    : label + this.renderTooltip(field)
            },
            renderExplain(field) {
                return `<div class="explain">${utils.escape(field.explain)}</div>`
            },
            renderTooltip(item) {
                if (!item.tooltip) return ""
                const tips = Array.isArray(item.tooltip) ? item.tooltip : [item.tooltip]
                const toHTML = (tip, idx) => {
                    if (!tip) return ""
                    const cfg = typeof tip === "string" ? { text: tip } : tip
                    cfg.icon = cfg.icon || "fa fa-info-circle"
                    const cls = cfg.action ? "tooltip has-action" : "tooltip"
                    const actionAttrs = cfg.action ? `data-action="${cfg.action}" data-trigger-id="${item.key || item.id}" data-index="${idx}"` : ""
                    const triggerHTML = `<div class="tooltip-trigger"><i class="${cfg.icon}"></i></div>`
                    const contentHTML = cfg.text ? `<div class="tooltip-content">${utils.escape(cfg.text).replace(/\n/g, "<br>")}</div>` : ""
                    return `<div class="${cls}" ${actionAttrs}>${triggerHTML}${contentHTML}</div>`
                }
                return tips.map(toHTML).join("")
            },
        }
    }
}

const Layout_Grid = {
    base: "default",
    defaultCol: 12,
    setup(base, config) {
        return {
            updateRootContainer(container) {
                base.updateRootContainer.call(this, container)
                container.classList.add("ff-row")
            },
            renderBoxContent(fieldsHTML, box) {
                return base.renderBoxContent.call(this, fieldsHTML, box, "ff-row")
            },
            renderBoxWrapper(box, titleHTML, contentHTML) {
                const col = box.col || config.defaultCol
                const colClass = `ff-col-${col}`
                return base.renderBoxWrapper.call(this, box, titleHTML, contentHTML, colClass)
            },
            renderFieldWrapper(field, controlHTML, extraClass = "") {
                const col = field.col || config.defaultCol
                const colClass = `ff-col-${col}`
                const combinedClass = `${extraClass} ${colClass}`.trim()
                return base.renderFieldWrapper.call(this, field, controlHTML, combinedClass)
            }
        }
    }
}

FastForm.registerLayout("default", Layout_Default)
FastForm.registerLayout("grid", Layout_Grid)

const Feature_EventDelegation = {
    onConstruct: (form) => {
        /**
         * onEvent(events, handler, [options])                 -- onEvent("click", Fn)
         * onEvent(events, selector, handler, [options])       -- onEvent("click", ".my-button", Fn)
         * onEvent(events, selector, data, handler, [options]) -- onEvent("click", ".my-button", { id: 123 }, Fn)
         * onEvent(eventsMap, [options])                       -- onEvent({ click: Fn1, mouseenter: Fn2 })
         * onEvent(eventsMap, selector, [options])             -- onEvent({ click: Fn1, mouseenter: Fn2 }, ".my-button")
         * onEvent(eventsMap, selector, data, [options])       -- onEvent({ click: Fn1, mouseenter: Fn2 }, ".my-button", { id: 456 })
         */
        form.onEvent = (...args) => {
            const formEl = form.getFormEl()
            if (!formEl) return form

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
                    form.onEvent(type, selector, data, events[type], options)
                }
                return form
            }

            if (!events || typeof events !== "string") {
                throw new TypeError(`Event must be a string/object: ${events}.`)
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
                form.registerCleanup(() => formEl.removeEventListener(eventType, listener, options))
            }

            return form
        }
    }
}

const Feature_DefaultKeybindings = {
    onRender: (form) => form.onEvent("keydown", ev => ev.stopPropagation(), true)
}

const Feature_CollapsibleBox = {
    featureOptions: {
        collapsibleBox: true,
    },
    configure: ({ hooks, options }) => {
        hooks.on("onRender", (form) => {
            form.getFormEl().classList.toggle("feature-collapsible-box", options.collapsibleBox)

            if (options.collapsibleBox) {
                form.onEvent("click", ".box-container .title", function () {
                    this.closest(".box-container")?.classList.toggle("collapsed")
                })
            }
        })
    }
}

const Feature_InteractiveTooltip = {
    featureOptions: {
        defaultIcon: "fa fa-info-circle",
    },
    configure: ({ hooks, options, initState }) => {
        const state = initState(new Map())
        hooks.on("onRender", (form) => {
            form.onEvent("mousedown", ".tooltip-trigger", () => false, true)
            form.onEvent("click", ".tooltip-trigger", function (event) {
                const tooltipEl = this.closest(".tooltip")
                const key = this.closest("[data-control]")?.dataset?.control ?? this.closest("[data-box]")?.dataset?.box
                const fn = options.actions?.[tooltipEl.dataset.action]
                if (typeof fn === "function") {
                    const idx = parseInt(tooltipEl.dataset.index || "0", 10)
                    const configs = state.get(tooltipEl.dataset.triggerId)
                    const data = (Array.isArray(configs) && configs[idx]) ? configs[idx].data : undefined
                    fn({ form, key, event, data })
                }
                return false
            }, true)
        })
    },
    compile: ({ form, state, options }) => {
        const defaultIcon = options.defaultIcon || "fa fa-info-circle"
        const normalize = (item) => {
            if (!item.tooltip) return
            const rawList = Array.isArray(item.tooltip) ? item.tooltip : [item.tooltip]
            const normalized = rawList.filter(Boolean).map(tip => {
                if (typeof tip === "string") {
                    return { text: tip, icon: defaultIcon }
                }
                if (typeof tip === "object") {
                    return { ...tip, icon: tip.icon || defaultIcon }
                }
                return tip
            })
            item.tooltip = normalized
            const id = item.key || item.id
            if (id) state.set(id, normalized)
        }
        form.traverseBoxes(normalize)
        form.traverseFields(normalize)
    }
}

/**
 * Uses PascalCase for chainable setters (e.g., `.Label()`) to prevent namespace collisions with the underlying camelCase data properties (e.g., `.label`).
 * This hybrid design allows the builder instance to serve directly as the final data object,
 * enabling native `JSON.stringify` serialization without a `.build()` step and ensuring a clean, transparent debugging experience.
 */
const Feature_DSLEngine = (() => {
    const RESOLVE_SYM = Symbol("schema:resolve")

    const Dep = new Proxy({
        or: (...args) => ({ $or: args }),
        and: (...args) => ({ $and: args }),
        follow: (key) => ({ $follow: key }),
        eq: (key, val) => ({ [key]: val }),
        ne: (key, val) => ({ [key]: { $ne: val } }),
        true: (key) => ({ [key]: true }),
        false: (key) => ({ [key]: false }),
        raw: (obj) => obj,
    }, {
        get: (target, prop) => {
            return prop in target
                ? target[prop]
                : (key, val) => ({ [key]: { [`$${prop}`]: val } })
        }
    })
    const Tip = {
        info: (text) => text,
        custom: (icon, text) => ({ icon, text }),
        action: (action, icon, text) => ({ action, icon, text }),
    }
    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)
    const mergeDeps = (previousDep, nextDep) => {
        if (!previousDep) return nextDep
        if (!nextDep) return previousDep
        const normalize = (d) => !d ? [] : Array.isArray(d.$and) ? d.$and : [d]
        const prevList = normalize(previousDep)
        const nextList = normalize(nextDep)
        const combined = [...prevList]
        for (const newItem of nextList) {
            if (!newItem) continue
            const isDuplicate = combined.some(existingItem => utils.deepEqual(existingItem, newItem))
            if (!isDuplicate) {
                combined.push(newItem)
            }
        }
        if (combined.length === 0) return
        if (combined.length === 1) return combined[0]
        return { $and: combined }
    }
    const resolve = (input) => {
        if (input == null) return input
        if (input[RESOLVE_SYM]) {
            return resolve(input[RESOLVE_SYM]())
        }
        if (Array.isArray(input)) {
            return input.flatMap(resolve)
        }
        return input
    }
    const normalizeBoxes = (boxes) => {
        const ret = Array.isArray(boxes) ? boxes : [boxes]
        return ret.flat(Infinity).filter(box => box && typeof box === "object")
    }
    const applyFields = (box, items) => {
        if (!items || items.length === 0) return
        if (!box.fields) box.fields = []
        box.fields.push(...resolve(items))
    }

    const PropResolvers = {
        FIELD: {
            stage: (box, innerField, propKey, propVal) => innerField[propKey] = propVal,
            commit: null,
        },
        BOX: {
            stage: (box, innerField, propKey, propVal) => box[propKey] = propVal,
            commit: null,
        },
        SHARED: {
            stage: (box, innerField, propKey, propVal) => box[propKey] = propVal,
            commit: (box, innerField, propKey) => {
                if (box[propKey] !== undefined) {  // `null` is allowed
                    innerField[propKey] = box[propKey]
                }
            },
        },
        TITLE_LABEL: {
            stage: (box, innerField, propKey, propVal) => box.title = propVal,
            commit: (box, innerField) => {
                if (box.title != null) {
                    innerField.label = box.title
                }
            },
        },
        /** Sets the unit value and implicitly upgrades the field type from 'number' to 'unit'. This enables suffix rendering without requiring an explicit control change. */
        UNIT_CONVERTER: {
            stage: (box, innerField, propKey, propVal) => {
                innerField[propKey] = propVal
                if (innerField.type === "number") {
                    innerField.type = "unit"
                }
            },
            commit: null,
        },
        DEPENDENCY: {
            stage: (box, innerField, propKey, ...deps) => {
                const [keyOrDep, value] = deps
                const newDep = (value != null) ? Dep.eq(keyOrDep, value)
                    : (typeof keyOrDep === "string") ? Dep.true(keyOrDep)
                        : keyOrDep
                box.dependencies = mergeDeps(box.dependencies, newDep)
            },
            commit: (box, innerField) => {
                if (box.dependencies != null) {
                    innerField.dependencies = mergeDeps(innerField.dependencies, box.dependencies)
                }
            },
        },
        FIELDS: {
            stage: (box, innerField, propKey, ...fields) => applyFields(box, fields),
            commit: null,
        },
        SCHEMA: {
            stage: (box, innerField, propKey, ...boxes) => innerField[propKey] = normalizeBoxes(boxes),
            commit: null,
        },
        TABS: {
            stage: (box, innerField, propKey, tabsConfig) => {
                if (!Array.isArray(tabsConfig)) return
                innerField[propKey] = tabsConfig.map(tab => tab.schema ? { ...tab, schema: normalizeBoxes(tab.schema) } : { ...tab })
            },
            commit: null,
        },
        TAB_APPEND: {
            stage: (box, innerField, propKey, tabConfig) => {
                const tab = { ...tabConfig }
                if (tab.schema) {
                    tab.schema = normalizeBoxes(tab.schema)
                }
                if (!innerField.tabs) innerField.tabs = []
                innerField.tabs.push(tab)
            },
            commit: null,
        }
    }
    const BaseSpecs = {
        FIELD: {
            key: PropResolvers.FIELD,
            type: PropResolvers.FIELD,
            label: PropResolvers.TITLE_LABEL,
            tooltip: PropResolvers.SHARED,
            explain: PropResolvers.SHARED,
            hidden: PropResolvers.SHARED,
            disabled: PropResolvers.SHARED,
            col: PropResolvers.SHARED,
            className: PropResolvers.SHARED,
            dependencyUnmetAction: PropResolvers.SHARED,
            dependencies: PropResolvers.DEPENDENCY,
            showIf: PropResolvers.DEPENDENCY,  // Alias for `dependencies`
        },
        BOX: {
            id: PropResolvers.BOX,
            title: PropResolvers.BOX,
            tooltip: PropResolvers.BOX,
            col: PropResolvers.BOX,
            className: PropResolvers.BOX,
            dependencyUnmetAction: PropResolvers.BOX,
            fields: PropResolvers.FIELDS,
            children: PropResolvers.FIELDS,  // Alias for `fields`
            dependencies: PropResolvers.DEPENDENCY,
            showIf: PropResolvers.DEPENDENCY,  // Alias for `dependencies`
        }
    }
    const BuilderFactory = {
        FIELD: {
            createSetter: (propKey, propResolver) => function (...args) {
                propResolver.stage(this, this.fields[0], propKey, ...args)
                return this
            },
            createResolver: (specs) => function () {
                const inner = { ...this.fields[0] }
                for (const [key, propResolver] of Object.entries(specs)) {
                    propResolver.commit?.(this, inner, key)
                }
                return inner
            },
        },
        BOX: {
            createSetter: (propKey, propResolver) => function (...args) {
                propResolver.stage(this, null, propKey, ...args)
                return this
            },
            createResolver: () => function () {
                return this
            },
        },
        PRESET: {
            createSetter: (handler) => function (...args) {
                handler(this, ...args)
                return this
            },
        },
    }

    return {
        onConstruct: (form) => {
            form.dslEngine = () => {
                const scopedPresetMap = new Map()
                const preset = (name, handler) => scopedPresetMap.set(name, handler)
                const buildProto = (specs, factory) => {
                    const presetMethods = [...scopedPresetMap].map(([name, handler]) => [name, BuilderFactory.PRESET.createSetter(handler)])
                    const propMethods = Object.entries(specs).map(([propKey, propResolver]) => [capitalize(propKey), factory.createSetter(propKey, propResolver)])
                    return {
                        ...Object.fromEntries(presetMethods),
                        ...Object.fromEntries(propMethods),
                        [RESOLVE_SYM]: factory.createResolver(specs),
                    }
                }
                const applyProps = (box, innerField, props, specs) => {
                    for (const prop of Object.keys(props)) {
                        const propResolver = specs[prop]
                        if (!propResolver) {
                            throw new Error(`[SchemaBuilder] Property "${prop}" is NOT defined in the specs`)
                        }
                        propResolver.stage(box, innerField, prop, props[prop])
                    }
                }
                const defineField = (type, specs = {}, defaultProps = {}) => {
                    const finalSpecs = { ...BaseSpecs.FIELD, ...specs }
                    const proto = buildProto(finalSpecs, BuilderFactory.FIELD)
                    return (key, overrideProps = {}) => {
                        const finalProps = { ...defaultProps, ...overrideProps }
                        const box = Object.create(proto)
                        const innerField = { type, key }
                        box.fields = [innerField]
                        applyProps(box, innerField, finalProps, finalSpecs)
                        return box
                    }
                }
                const defineBox = (specs = {}, defaultProps = {}) => {
                    const finalSpecs = { ...BaseSpecs.BOX, ...specs }
                    const proto = buildProto(finalSpecs, BuilderFactory.BOX)
                    return (...args) => {
                        const box = Object.create(proto)
                        applyProps(box, null, defaultProps, finalSpecs)
                        let argIdx = 0
                        if (args.length > 0 && typeof args[0] === "string") {
                            box.title = args[0]
                            argIdx++
                        }
                        applyFields(box, args.slice(argIdx))
                        return box
                    }
                }
                const createDefine = (context) => {
                    return (input) => normalizeBoxes(typeof input === "function" ? input(context) : input)
                }
                return { Dep, Tip, PropResolvers, createDefine, defineField, defineBox, preset }
            }
            form.dslEngine.statics = { resolve, normalizeBoxes, applyFields, RESOLVE_SYM, Dep, Tip, PropResolvers, BaseSpecs, BuilderFactory }
        }
    }
})()

const Feature_StandardDSL = {
    onConstruct: (form) => {
        if (!form.dslEngine) {
            console.error("FastForm Error: Feature_StandardDSL requires 'Feature_DSLEngine' feature.")
            return
        }
        const engine = form.dslEngine()
        const { createDefine, defineBox, defineField, Tip, Dep, PropResolvers } = engine
        const { FIELD: F, SCHEMA, UNIT_CONVERTER, TABS, TAB_APPEND } = PropResolvers
        const BASE = { placeholder: F, readonly: F, disabled: F, className: F, isBlockLayout: F }
        const NUM = { ...BASE, min: F, max: F, step: F, isInteger: F }
        const UNIT = { ...NUM, unit: UNIT_CONVERTER }
        const OPT = { ...BASE, options: F, disabledOptions: F }
        const LIST = { minItems: F, maxItems: F }
        const Controls = {
            Switch: defineField("switch", BASE),
            Text: defineField("text", BASE),
            Password: defineField("password", BASE),
            Color: defineField("color", BASE),
            Number: defineField("number", UNIT),
            // Unit: defineField("unit", UNIT),  // Deprecated: Use `Controls.Number().Unit()` for a fluent API experience.
            Integer: defineField("number", UNIT, { isInteger: true }),
            Float: defineField("number", UNIT, { isInteger: false }),
            Icon: defineField("icon", BASE),
            Range: defineField("range", NUM),
            Action: defineField("action", { ...BASE, actionType: F, activeClass: F }),
            Static: defineField("static", { ...BASE, content: F, unsafe: F }),
            Custom: defineField("custom", { ...BASE, content: F, unsafe: F }),
            Hint: defineField("hint", { ...BASE, hintHeader: F, hintDetail: F, unsafe: F }),
            Divider: defineField("divider", { ...BASE, divider: F, position: F, dashed: F }),
            Hotkey: defineField("hotkey", BASE),
            Textarea: defineField("textarea", { ...BASE, rows: F, cols: F, noResize: F }),
            Code: defineField("code", { ...BASE, tabSize: F, lineNumbers: F }),
            Object: defineField("object", { ...BASE, rows: F, noResize: F, format: F }),
            Array: defineField("array", { ...BASE, ...LIST, allowDuplicates: F, dataType: F }),
            Select: defineField("select", { ...OPT, ...LIST, labelJoiner: F }),
            Radio: defineField("radio", { ...OPT, columns: F }),
            Checkbox: defineField("checkbox", { ...OPT, ...LIST, columns: F }),
            Transfer: defineField("transfer", { ...OPT, ...LIST, titles: F, defaultHeight: F }),
            Dict: defineField("dict", { ...BASE, keyPlaceholder: F, valuePlaceholder: F, allowAddItem: F }),
            Palette: defineField("palette", { ...BASE, defaultColor: F, dimensions: F, allowJagged: F }),
            Table: defineField("table", { ...BASE, thMap: F, nestedBoxes: SCHEMA, defaultValues: F }),
            Composite: defineField("composite", { ...BASE, subSchema: SCHEMA, defaultValues: F }),
            Tabs: defineField("tabs", { ...BASE, tabs: TABS, tab: TAB_APPEND, tabStyle: F, tabPosition: F, defaultSelectedTab: F, defaultTabLabel: F }),
        }
        const dsl = { Group: defineBox(), Controls, Tip, Dep, Extend: engine }
        dsl.define = createDefine(dsl)
        form.dsl = dsl
    },
    onOptions: (options, form) => {
        if (options && typeof options.schema === "function") {
            options.schema = form.dsl.define(options.schema)
        }
        return options
    },
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
                collectAffects: () => [],
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
            visibility: (el, actions, ctx) => {
                if (actions.hasOwnProperty("$toggle")) {
                    utils.toggleInvisible(el)
                } else if (actions.hasOwnProperty("$set")) {
                    utils.toggleInvisible(el, actions.$set === "hidden")
                } else {
                    console.warn("FastForm Warning: Invalid action for '$visibility' effect. Use '$set' or '$toggle'.", actions)
                }
            },
            attributes: (el, actions, ctx) => {
                if (actions.$set) Object.entries(actions.$set).forEach(([name, value]) => el.setAttribute(name, value))
                if (actions.$remove) actions.$remove.forEach(name => el.removeAttribute(name))
            },
            classes: (el, actions, ctx) => {
                if (actions.$add) el.classList.add(...actions.$add.split(" ").filter(Boolean))
                if (actions.$remove) el.classList.remove(...actions.$remove.split(" ").filter(Boolean))
                if (actions.$toggle) el.classList.toggle(actions.$toggle)
            },
            styles: (el, actions, ctx) => {
                if (actions.$set) Object.entries(actions.$set).forEach(([prop, value]) => el.style[prop] = value)
                if (actions.$remove) actions.$remove.forEach(prop => el.style[prop] = "")
            },
            content: (el, actions, ctx) => {
                if (actions.$text !== undefined) el.textContent = actions.$text
                if (actions.$html !== undefined) el.innerHTML = actions.$html
            },
            properties: (el, actions, ctx) => {
                if (actions.$set) Object.entries(actions.$set).forEach(([prop, value]) => el[prop] = value)
                if (actions.$remove) actions.$remove.forEach(prop => el[prop] = undefined)
            },
        }

        const uiEffectToHandlerMap = new Map(Object.entries(uiBehaviors).map(([property, handler]) => [`$${property}`, handler]))

        return { uiBehaviors, uiEffectToHandlerMap, meta, conditionEvaluators, comparisonEvaluators, effectHandlers }
    })()

    const DependencyAnalyzer = (() => {
        const applyUiEffects = (declaration, ctx) => {
            Object.entries(declaration).forEach(([targetKey, groups]) => {
                const el = ctx.getControl(targetKey) || ctx.getBox(targetKey)
                if (!el) return

                Object.entries(groups).forEach(([groupName, actions]) => {
                    const handler = Registries.uiEffectToHandlerMap.get(groupName)
                    if (typeof handler === "function") {
                        handler(el, actions, ctx)
                    } else {
                        console.warn(`FastForm Warning: Unknown UI effect group '${groupName}'.`)
                    }
                })
            })
        }

        const _collectConditionTriggers = (form, condition, keys) => {
            const context = {
                collectTriggers: (subCond) => _collectConditionTriggers(form, subCond, keys),
                getField: (key) => form.getField(key),
                addKey: (key) => keys.add(key),
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

        return { applyUiEffects, collectAffects, buildTriggerMap }
    })()

    const ExecutionEngine = (() => {
        const _evaluateCondition = (condition, context = {}) => {
            if (typeof condition === "function") {
                return condition(context)
            } else if (!condition || typeof condition !== "object") {
                return true
            }

            // Handle logical evaluators like $and, $or
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
        },
    }
})()

const Feature_Parsing = {
    featureOptions: {
        parsers: {},
    },
    configure: ({ hooks, initState, registerApi }) => {
        const parsers = initState(new Map())
        registerApi("parsing", {
            set: (key, parserToAdd) => {
                if (key && typeof parserToAdd === "function") {
                    parsers.set(key, parserToAdd)
                } else {
                    console.warn(`FastForm Warning: Parser for key '${key}' is not a function.`)
                }
            },
            get: (key) => parsers.get(key),
        })
        hooks.on("onProcessValue", (value, changeContext) => {
            const parser = parsers.get(changeContext.key)
            return parser ? parser(value, changeContext) : value
        })
    },
    compile: ({ options, form }) => {
        const api = form.getApi("parsing")
        Object.entries(options.parsers).forEach(([key, rule]) => api.set(key, rule))
    },
}

const Feature_Validation = {
    featureOptions: {
        rules: {},
        validators: {},
    },
    _normalizeRuleEntry: (ruleConfig) => {
        const result = { $self: [], $each: [] }
        if (!ruleConfig) return result

        const normalize = (validators) => Array.isArray(validators) ? validators : [validators]
        if (Array.isArray(ruleConfig) || typeof ruleConfig === "function" || typeof ruleConfig === "string") {
            result.$self = normalize(ruleConfig)
        } else if (typeof ruleConfig === "object") {
            if (ruleConfig.name || ruleConfig.validator || typeof ruleConfig.validate === "function") {
                result.$self = [ruleConfig]
            } else {
                if (ruleConfig.$self) {
                    result.$self = normalize(ruleConfig.$self)
                }
                if (ruleConfig.$each) {
                    result.$each = normalize(ruleConfig.$each)
                }
            }
        }
        return result
    },
    _compileRules: (rawRules, validators, errorContext) => {
        if (!rawRules || rawRules.length === 0) return []

        return rawRules.map(rule => {
            if (typeof rule === "function") {
                return rule
            }
            if (typeof rule === "string") {
                const fn = validators[rule]
                if (!fn) console.warn(`FastForm Warning: Validator '${rule}' not found in ${errorContext}.`)
                return fn
            }
            if (typeof rule === "object" && rule !== null) {
                if (typeof rule.validate === "function") {
                    return rule.validate
                }
                const name = rule.name || rule.validator
                const factory = validators[name]
                if (typeof factory === "function") {
                    const args = rule.args || []
                    try {
                        const instance = factory(...args)
                        return typeof instance === "function" ? instance : factory
                    } catch (e) {
                        console.error(`FastForm Error: Failed to compile validator '${name}' with args`, args, e)
                    }
                } else {
                    console.warn(`FastForm Warning: Validator Factory '${name}' not found.`)
                }
            }
            return null
        }).filter(Boolean)
    },
    configure: ({ initState, hooks, registerApi, form }) => {
        const state = initState({ rawRules: new Map(), compiledRules: new Map() })
        registerApi("validation", {
            addRule: (key, ruleConfig) => {
                if (!key || !ruleConfig) return
                const normalized = Feature_Validation._normalizeRuleEntry(ruleConfig)
                if (!state.rawRules.has(key)) {
                    state.rawRules.set(key, { $self: [], $each: [] })
                }
                const entry = state.rawRules.get(key)
                entry.$self.push(...normalized.$self)
                entry.$each.push(...normalized.$each)
            },
            getRules: (key) => state.compiledRules.get(key)
        })
        hooks.on("onValidate", (changeContext) => {
            const { key, value, type } = changeContext

            const context = form.resolveFieldContext(key)
            if (!context) return []
            const { field, relativePath } = context
            const rules = state.compiledRules.get(field.key)
            if (!rules) return []

            const errors = []
            const exec = (fnList, targetVal, ctx) => {
                for (const fn of fnList) {
                    try {
                        const res = fn({ ...ctx, value: targetVal }, form.options.data)
                        if (res !== true && res != null) {
                            errors.push(res instanceof Error ? res : new Error(String(res)))
                        }
                    } catch (e) {
                        errors.push(e)
                    }
                }
            }

            if (type === "push" || (type === "set" && relativePath)) {
                if (rules.$each.length) exec(rules.$each, value, changeContext)
            } else if (type === "removeIndex" || (type === "set" && !relativePath)) {
                if (rules.$self.length) exec(rules.$self, value, changeContext)
            }

            return errors
        })
    },
    compile: ({ form, options, state }) => {
        const { rules, validators } = options
        const api = form.getApi("validation")
        const instanceValidators = { ...form.constructor.validator.getAll(), ...validators }
        if (rules && typeof rules === "object") {
            Object.entries(rules).forEach(([key, ruleConfig]) => api.addRule(key, ruleConfig))
        }
        state.rawRules.forEach((rawEntry, key) => {
            const compiledEntry = {
                $self: Feature_Validation._compileRules(rawEntry.$self, instanceValidators, `Field ${key} ($self)`),
                $each: Feature_Validation._compileRules(rawEntry.$each, instanceValidators, `Field ${key} ($each)`),
            }
            if (compiledEntry.$self.length > 0 || compiledEntry.$each.length > 0) {
                state.compiledRules.set(key, compiledEntry)
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
        minItems: (min) => ({ value }) => {
            if (!Array.isArray(value)) return true
            return value.length >= min ? true : i18n.t("global", "error.minItems", { minItems: min })
        },
        maxItems: (max) => ({ value }) => {
            if (!Array.isArray(value)) return true
            return value.length <= max ? true : i18n.t("global", "error.maxItems", { maxItems: max })
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
            const clsName = (allActions[fieldKey] === "hide") ? "plugin-common-hidden" : "plugin-common-readonly"
            register(watcherKey, {
                when: when,
                triggers: triggers,
                effect: {
                    $updateUI: {
                        $then: { [fieldKey]: { $classes: { $remove: clsName } } },
                        $else: { [fieldKey]: { $classes: { $add: clsName } } },
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
            register(watcherKey, {
                when: when,
                triggers: triggers,
                affects: [],
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
FastForm.registerFeature("collapsibleBox", Feature_CollapsibleBox)
FastForm.registerFeature("interactiveTooltip", Feature_InteractiveTooltip)
FastForm.registerFeature("watchers", Feature_Watchers)
FastForm.registerFeature("parsing", Feature_Parsing)
FastForm.registerFeature("validation", Feature_Validation)
FastForm.registerFeature("fieldDependencies", Feature_FieldDependencies)
FastForm.registerFeature("boxDependencies", Feature_BoxDependencies)
FastForm.registerFeature("cascades", Feature_Cascades)
FastForm.registerFeature("dslEngine", Feature_DSLEngine)
FastForm.registerFeature("standardDSL", Feature_StandardDSL)

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
            const val = ctx.getValue(key)
            const actualLength = (Array.isArray(val) || typeof val === "string")
                ? val.length
                : (val != null && typeof val[Symbol.iterator] === "function") ? [...val].length : 0
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
    return Try(() => value && utils.Package.FsExtra.accessSync(base), () => `No such path: ${base}`)
}

FastForm.validator.register("url", Validator_Url)
FastForm.validator.register("regex", Validator_Regex)
FastForm.validator.register("path", Validator_Path)

const uniqueNum = (() => {
    let n = 0
    return () => n++
})()

function setRandomKey(field) {
    field.key = field.key || `_field_${uniqueNum()}`
}

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
    registerRules({ field, form }, { $self: rules })
}

function registerItemLengthLimitRule({ field, form }) {
    const lengthRule = ({ key, value, type }) => {
        const isSelf = (key === field.key)

        let effectiveLength
        if (isSelf && type === "set") {
            effectiveLength = Array.isArray(value) ? value.length : 0
        } else {
            const containerData = form.getData(field.key)
            const currentLen = Array.isArray(containerData) ? containerData.length : 0
            const deltaMap = { push: 1, removeIndex: -1 }
            const delta = isSelf ? (deltaMap[type] || 0) : 0
            effectiveLength = Math.max(0, currentLen + delta)
        }

        const { minItems, maxItems } = field
        if (typeof minItems === "number" && effectiveLength < minItems) {
            return new Error(i18n.t("global", "error.minItems", { minItems }))
        }
        if (typeof maxItems === "number" && effectiveLength > maxItems) {
            return new Error(i18n.t("global", "error.maxItems", { maxItems }))
        }
    }
    registerRules({ field, form }, { $self: [lengthRule] })
}

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
            value = value || "#FFFFFF"
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
            Control_Action._ripple(this, ev)
        }).onEvent("click", '.control[data-type="action"]', function () {
            Control_Action._doAction(this, form)
        })
    },
    _ripple: (el, ev) => {
        let mask = el.querySelector(".action-ripple-mask")
        if (!mask) {
            mask = document.createElement("div")
            mask.classList.add("action-ripple-mask")
            el.appendChild(mask)
        }
        const ripple = document.createElement("span")
        ripple.classList.add("ripple")
        const diameter = Math.max(el.clientWidth, el.clientHeight) * 2
        const radius = diameter / 2
        const rect = el.getBoundingClientRect()
        const x = ev.clientX - rect.left - radius
        const y = ev.clientY - rect.top - radius
        ripple.style.width = `${diameter}px`
        ripple.style.height = `${diameter}px`
        ripple.style.left = `${x}px`
        ripple.style.top = `${y}px`
        mask.appendChild(ripple)
        ripple.addEventListener("animationend", () => {
            ripple.remove()
            if (mask.childNodes.length === 0) mask.remove()
        }, { once: true })
    },
    _doAction: (el, form) => {
        const key = el.querySelector(".action").dataset.action
        const actionType = form.getControlOptionsFromKey(key).actionType || "function"
        if (actionType === "toggle") {
            form.reactiveCommit(key, !form.getData(key))  // Toggle mode: reverse the current value, submit data
        } else if (actionType === "trigger") {
            form.reactiveCommit(key, Date.now())  // Trigger mode: Update to timestamp to signal watchers
        } else {
            form.options.actions[key]?.(form)  // Function mode: Execute callbacks
        }
    },
}

const Control_Static = {
    setup: ({ field }) => {
        field.isBlockLayout = false
        setRandomKey(field)
    },
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

const Control_Divider = {
    controlOptions: {
        position: "center",  // center | left | right
        dashed: true,
    },
    setup: ({ field }) => {
        field.isBlockLayout = true
        setRandomKey(field)
    },
    create: () => `<div class="divider-wrap"></div>`,
    update: ({ element, field, controlOptions }) => {
        const wrap = element.querySelector(".divider-wrap")
        if (wrap) {
            const line = '<div class="divider-line"></div>'
            wrap.classList.add(controlOptions.position, controlOptions.dashed ? "dashed" : undefined)
            wrap.innerHTML = field.divider ? `${line}<div class="divider-text">${utils.escape(field.divider)}</div>${line}` : line
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
        cols: -1,
        noResize: false,
    },
    setup: ({ field }) => defaultBlockLayout(field),
    create: ({ field, controlOptions }) => {
        const { rows, cols, noResize } = controlOptions
        const { key, placeholder } = getCommonHTMLAttrs(field)
        const rowsAttr = rows > 0 ? `rows="${rows}"` : ""
        const colsAttr = cols > 0 ? `cols="${cols}"` : ""
        const cls = "textarea" + (noResize ? " no-resize" : "")
        return `<textarea class="${cls}" ${rowsAttr} ${colsAttr} ${key} ${placeholder}></textarea>`
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

const Control_CodeEditor = {
    controlOptions: {
        tabSize: 4,
        lineNumbers: true,
    },
    setup: ({ field }) => defaultBlockLayout(field),
    create: ({ field, controlOptions }) => {
        const { lineNumbers } = controlOptions
        const { key, placeholder } = getCommonHTMLAttrs(field)
        const gutterClass = lineNumbers ? "code-gutter" : "code-gutter plugin-common-hidden"
        const textarea = `<textarea class="code-textarea" ${placeholder} spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>`
        return `<div class="code-editor-wrap" ${key}><div class="${gutterClass}"></div><div class="code-grow-wrap"><div class="code-ghost"></div>${textarea}</div></div>`
    },
    update: ({ element, value, field, controlOptions }) => {
        const textarea = element.querySelector(".code-textarea")
        if (!textarea) return
        const ghost = element.querySelector(".code-ghost")
        const gutter = element.querySelector(".code-gutter")
        const val = value || ""
        if (textarea.value !== val) textarea.value = val
        if (ghost) ghost.textContent = val + "\n"
        updateInputState(textarea, field, val)
        if (controlOptions.lineNumbers && gutter) {
            Control_CodeEditor._updateLineNumbers(textarea, gutter)
        }
    },
    bindEvents: ({ form }) => {
        const syncState = (textarea) => {
            const wrap = textarea.closest(".code-editor-wrap")
            const ghost = wrap.querySelector(".code-ghost")
            const gutter = wrap.querySelector(".code-gutter")
            ghost.textContent = textarea.value + "\n"
            if (gutter && !gutter.classList.contains("plugin-common-hidden")) {
                Control_CodeEditor._updateLineNumbers(textarea, gutter)
            }
        }

        form.onEvent("input", ".code-textarea", function () {
            syncState(this)
        }).onEvent("change", ".code-textarea", function () {
            form.validateAndCommit(this.closest(".code-editor-wrap").dataset.key, this.value)
        }).onEvent("scroll", ".code-textarea", function () {
            const gutter = this.closest(".code-editor-wrap").querySelector(".code-gutter")
            if (gutter) gutter.scrollTop = this.scrollTop
        }).onEvent("keydown", ".code-textarea", function (ev) {
            const key = this.closest(".code-editor-wrap").dataset.key
            const { tabSize } = form.getControlOptionsFromKey(key)
            if (ev.key === "Tab") {
                ev.preventDefault()
                const spaces = " ".repeat(tabSize)
                Control_CodeEditor._insertText(this, spaces)
                syncState(this)
                form.validateAndCommit(key, this.value)
            } else if (ev.key === "Enter") {
                ev.preventDefault()
                const cursor = this.selectionStart
                const currentLineStart = this.value.lastIndexOf("\n", cursor - 1) + 1
                const currentLine = this.value.substring(currentLineStart, cursor)
                const match = currentLine.match(/^\s+/)
                const indentation = match ? match[0] : ""
                Control_CodeEditor._insertText(this, "\n" + indentation)
                syncState(this)
                this.blur()
                this.focus()
                form.validateAndCommit(key, this.value)
            }
        }, true)
    },
    _updateLineNumbers: (textarea, gutter) => {
        const lineCount = textarea.value.split("\n").length
        if (gutter.childElementCount === lineCount) return
        gutter.innerHTML = Array.from({ length: lineCount }, (_, i) => `<div>${i + 1}</div>`).join("")
    },
    _insertText: (textarea, text) => {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        textarea.setRangeText(text, start, end, "end")
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
        registerRules(context, { $self: ["arrayOrObject"] })
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
        dataType: "string",  // number | string
    },
    setup: ({ field, form }) => {
        defaultBlockLayout(field)
        const correctType = ({ value }) => {
            const { dataType } = form.getControlOptions(field)
            if (typeof value !== dataType) {
                return i18n.t("global", "error.pattern")
            }
        }
        const repeatable = ({ key, value, type }) => {
            const { allowDuplicates } = form.getControlOptions(field)
            if (allowDuplicates) return

            const currentArray = form.getData(field.key) || []
            let previewArray = []
            if (type === "push") {
                previewArray = [...currentArray, value]
            } else if (type === "set") {
                if (key === field.key) {
                    previewArray = Array.isArray(value) ? value : []
                } else {
                    const parts = key.split(".")
                    const index = parseInt(parts.at(-1), 10)
                    if (!isNaN(index)) {
                        previewArray = [...currentArray]
                        previewArray[index] = value
                    } else {
                        previewArray = currentArray
                    }
                }
            } else {
                return
            }
            const count = previewArray.filter(v => v === value).length
            if (count > 1) {
                return new Error(i18n.t("global", "error.duplicateValue"))
            }
        }
        registerRules({ form, field }, { $each: [correctType, repeatable] })
    },
    create: ({ field }) => {
        const { key } = getCommonHTMLAttrs(field)
        return `
            <div class="array" ${key}>
                <div class="array-list"></div>
                <div class="array-footer">
                    <div class="array-item-input plugin-common-hidden" contenteditable="true"></div>
                    <div class="array-item-add">+ ${i18n.t("global", "add")}</div>
                </div>
            </div>`
    },
    update: ({ element, value }) => {
        const listContainer = element.querySelector(".array-list")
        if (listContainer) {
            listContainer.innerHTML = Control_Array._createItems(value)
        }
        const inputEl = element.querySelector(".array-item-input")
        const addEl = element.querySelector(".array-item-add")
        if (inputEl && addEl) {
            inputEl.textContent = ""
            utils.hide(inputEl)
            utils.show(addEl)
        }
    },
    bindEvents: ({ form }) => {
        const selector = ".array-item-val[contenteditable], .array-item-input[contenteditable]"
        form.onEvent("click", ".array-item", function (ev) {
            if (ev.target.closest(".array-item-del")) return
            const valueEl = this.querySelector(".array-item-val")
            if (valueEl.isContentEditable) return

            this.classList.add("editing")
            valueEl.contentEditable = "true"
            valueEl.focus()
            Control_Array._moveCursor(valueEl)
        }).onEvent("keydown", selector, function (ev) {
            if (ev.key === "Enter") {
                ev.preventDefault()
                ev.stopPropagation()
                this.blur()
            } else if (ev.key === "Escape") {
                ev.preventDefault()
                ev.stopPropagation()
                form._updateControl(this.closest(".array").dataset.key)
            }
        }, true).onEvent("focusout", selector, function () {
            Control_Array._commitChange(this, form)
        }).onEvent("click", ".array-item-del", function (ev) {
            ev.stopPropagation()
            const itemEl = this.parentElement
            const arrayEl = this.closest(".array")
            const idx = Array.prototype.indexOf(this.closest(".array-list").children, itemEl)
            const ok = form.validateAndCommit(arrayEl.dataset.key, idx, "removeIndex")
            if (ok) itemEl.remove()
        }).onEvent("click", ".array-item-add", function () {
            const addEl = this
            const inputEl = addEl.previousElementSibling
            utils.hide(addEl)
            utils.show(inputEl)
            inputEl.focus()
        })
    },
    _moveCursor: (node, toStart = false) => {
        const range = document.createRange()
        range.selectNodeContents(node)
        range.collapse(toStart)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
    },
    _createItem: (value) => `
        <div class="array-item">
            <div class="array-item-val">${utils.escape(String(value ?? ""))}</div>
            <div class="array-item-del plugin-common-close"></div>
        </div>`,
    _createItems: (items) => (Array.isArray(items) ? items : []).map(Control_Array._createItem).join(""),
    _commitChange: (target, form) => {
        const rawValue = target.textContent
        const isNewItem = target.classList.contains("array-item-input")
        const arrayEl = target.closest(".array")
        const key = arrayEl.dataset.key
        const controlOptions = form.getControlOptionsFromKey(key)
        const val = controlOptions.dataType === "number" ? Number(rawValue) : rawValue
        if (isNewItem) {
            const ok = form.reactiveCommit(key, val, "push")
            if (ok) {
                target.textContent = ""
                utils.hide(target)
                utils.show(target.nextElementSibling || target.parentElement.querySelector(".array-item-add"))
            }
        } else {
            const itemEl = target.closest(".array-item")
            const listContainer = arrayEl.querySelector(".array-list")
            const idx = Array.prototype.indexOf.call(listContainer.children, itemEl)
            target.removeAttribute("contenteditable")
            itemEl.classList.remove("editing")
            form.validateAndCommit(`${key}.${idx}`, val, "set")
        }
    },
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
            const isShown = utils.isShown(optionBox)
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
        const disabledOpts = Array.isArray(field.disabledOptions) ? field.disabledOptions.map(String) : []
        const toItem = ([k, v], idx) => {
            const id = `${prefix}_${idx}`
            const isDisabled = disabledOpts.includes(String(k))
            const attr = isDisabled ? "disabled" : ""
            const cls = "radio-option" + (isDisabled ? " plugin-common-readonly" : "")
            return `
                <div class="${cls}">
                    <div class="radio-wrapper">
                        <input class="radio-input" type="radio" id="${id}" name="${field.key}" value="${k}" ${attr}>
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
        const disabledOpts = Array.isArray(field.disabledOptions) ? field.disabledOptions.map(String) : []
        const toItem = ([key, label], idx) => {
            const id = `${prefix}_${idx}`
            const isDisabled = disabledOpts.includes(String(key))
            const attr = isDisabled ? "disabled" : ""
            const cls = "checkbox-option" + (isDisabled ? " plugin-common-readonly" : "")
            return `
                <div class="${cls}">
                    <div class="checkbox-wrapper">
                        <input class="checkbox-input" type="checkbox" id="${id}" name="${field.key}" value="${key}" ${attr}>
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

const Control_Transfer = {
    controlOptions: {
        titles: ["Available", "Selected"],
        defaultHeight: "300px",
    },
    setup: (context) => {
        normalizeOptionsAttr(context.field)
        defaultBlockLayout(context.field)
        registerItemLengthLimitRule(context)
    },
    create: ({ field, controlOptions }) => {
        const { key } = getCommonHTMLAttrs(field)
        const [srcTitle, dstTitle] = controlOptions.titles
        return `
            <div class="transfer-wrap" ${key}>
                <div class="transfer-container" style="height: ${controlOptions.defaultHeight}">
                    <div class="transfer-column source-column">
                        <div class="transfer-header">${srcTitle}</div>
                        <div class="transfer-list-wrapper source-list"></div>
                    </div>
                    <div class="transfer-exchange-icon"><i class="fa fa-angle-right"></i></div>
                    <div class="transfer-column target-column">
                        <div class="transfer-header">${dstTitle}</div>
                        <div class="transfer-list-wrapper target-list"></div>
                    </div>
                </div>
                <div class="transfer-resize-handle"><i class="fa fa-ellipsis-h"></i></div>
            </div>`
    },
    update: ({ element, value, field }) => {
        if (element.querySelector(".transfer-card-placeholder")) return

        const selectedKeys = Array.isArray(value) ? value.map(String) : []
        const toSelectKeys = Object.keys(field.options).filter(key => !selectedKeys.includes(key))
        const disabledOptions = Array.isArray(field.disabledOptions) ? field.disabledOptions.map(String) : []
        element.querySelector(".target-list").innerHTML = Control_Transfer._createItems(selectedKeys, field.options, disabledOptions)
        element.querySelector(".source-list").innerHTML = Control_Transfer._createItems(toSelectKeys, field.options, disabledOptions)
    },
    bindEvents: ({ form }) => {
        let activeDraggable = null
        let dragGhost = null
        let grabOffsetX = 0
        let grabOffsetY = 0
        let ghostX = 0
        let ghostY = 0

        let _transparentImg = null
        const getTransparentImg = () => {
            if (!_transparentImg) {
                _transparentImg = new Image()
                _transparentImg.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
            }
            return _transparentImg
        }

        let rafId = null
        let lastSortTime = 0
        const SORT_THROTTLE_MS = 50

        form.onEvent("dragstart", ".transfer-card", function (ev) {
            activeDraggable = this
            const rect = activeDraggable.getBoundingClientRect()

            ev.dataTransfer.setDragImage(getTransparentImg(), 0, 0)
            ev.dataTransfer.effectAllowed = "move"
            ev.dataTransfer.dropEffect = "move"
            ev.dataTransfer.setData("text/plain", this.dataset.val)

            grabOffsetX = ev.clientX - rect.left
            grabOffsetY = ev.clientY - rect.top
            ghostX = rect.left
            ghostY = rect.top

            dragGhost = Control_Transfer._createGhost(activeDraggable, ghostX, ghostY)
            document.body.appendChild(dragGhost)

            // Delay styling to keep ghost visible during drag initiation
            requestAnimationFrame(() => activeDraggable?.classList.add("transfer-card-placeholder"))
        })

        form.onEvent("dragend", ".transfer-card", function () {
            if (rafId) {
                cancelAnimationFrame(rafId)
                rafId = null
            }
            if (!activeDraggable || !dragGhost) return

            const destRect = activeDraggable.getBoundingClientRect()
            const animation = dragGhost.animate([
                { transform: `translate3d(${ghostX}px, ${ghostY}px, 0)` },
                { transform: `translate3d(${destRect.left}px, ${destRect.top}px, 0)` }
            ], { duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" })

            animation.onfinish = () => {
                dragGhost?.remove()
                dragGhost = null
                if (activeDraggable) {
                    activeDraggable.classList.remove("transfer-card-placeholder")
                    const root = activeDraggable.closest(".transfer-wrap")
                    const targetList = root.querySelector(".target-list")
                    const newOrder = [...targetList.querySelectorAll(".transfer-card")].map(item => item.dataset.val)
                    form.validateAndCommit(root.dataset.key, newOrder, "set")
                    activeDraggable = null
                }
            }
        })

        form.onEvent("dragenter", ".transfer-container", (ev) => ev.preventDefault())

        form.onEvent("dragover", ".transfer-container", function (ev) {
            ev.preventDefault()
            ev.stopPropagation()
            ev.dataTransfer.dropEffect = "move"

            if (!dragGhost || !activeDraggable) return

            if (rafId) cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(() => {
                ghostX = ev.clientX - grabOffsetX
                ghostY = ev.clientY - grabOffsetY
                dragGhost.style.transform = `translate3d(${ghostX}px, ${ghostY}px, 0)`
            })

            const now = Date.now()
            if (now < SORT_THROTTLE_MS + lastSortTime) return
            lastSortTime = now

            const hoverList = ev.target.closest(".transfer-list-wrapper")
            if (!hoverList) return

            const siblings = [...hoverList.querySelectorAll(".transfer-card")].filter(i => i !== activeDraggable)
            const insertBeforeEl = Control_Transfer._findInsertionPoint(siblings, ev.clientY)
            if (insertBeforeEl === activeDraggable.nextElementSibling) return

            const allCards = [...hoverList.closest(".transfer-wrap").querySelectorAll(".transfer-card")]
            const prevRects = new Map(allCards.map(el => [el, el.getBoundingClientRect()]))
            const hasMoved = Control_Transfer._applyDOMMove(hoverList, activeDraggable, insertBeforeEl)
            if (hasMoved) {
                Control_Transfer._animateFLIP(allCards, prevRects, activeDraggable, dragGhost)
            }
        })

        form.onEvent("drop", ".transfer-container", (ev) => {
            ev.preventDefault()
            ev.stopPropagation()
        })

        form.onEvent("mousedown", ".transfer-resize-handle", function (ev) {
            ev.preventDefault()
            const handle = this
            const container = handle.previousElementSibling
            const startY = ev.clientY
            const startHeight = container.getBoundingClientRect().height
            handle.classList.add("active")

            const onMouseMove = (moveEv) => {
                const dy = moveEv.clientY - startY
                const newHeight = Math.max(150, startHeight + dy)
                container.style.height = `${newHeight}px`
            }
            const onMouseUp = () => {
                handle.classList.remove("active")
                document.removeEventListener("mousemove", onMouseMove)
                document.removeEventListener("mouseup", onMouseUp)
            }
            document.addEventListener("mousemove", onMouseMove)
            document.addEventListener("mouseup", onMouseUp)
        })
    },
    _createItems: (keys, options, disabledOptions) => {
        return keys.map(key => {
            if (!key || !options[key]) return ""
            const isDisabled = disabledOptions.includes(key)
            const cls = `transfer-card${isDisabled ? " plugin-common-readonly" : ""}`
            return `<div class="${cls}" draggable="${!isDisabled}" data-val="${key}"><i class="fa fa-bars handle"></i><span>${utils.escape(options[key])}</span></div>`
        }).join("")
    },
    _createGhost: (sourceEl, x, y) => {
        const ghost = sourceEl.cloneNode(true)
        Control_Transfer._deepCopyStyles(sourceEl, ghost)
        Object.assign(ghost.style, {
            position: "fixed",
            zIndex: "999999",
            margin: "0",
            pointerEvents: "none",
            transition: "none",
            transform: `translate3d(${x}px, ${y}px, 0)`,
            opacity: "0.95",
            boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
            border: "1px solid var(--ff-primary, #007AFF)",
            width: `${sourceEl.offsetWidth}px`,
            height: `${sourceEl.offsetHeight}px`
        })
        return ghost
    },
    _findInsertionPoint: (siblings, mouseY) => {
        return siblings.reduce((closest, child) => {
            const box = child.getBoundingClientRect()
            const offset = mouseY - box.top - box.height / 2
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child }
            } else {
                return closest
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element
    },
    _applyDOMMove: (container, draggable, insertBeforeEl) => {
        if (insertBeforeEl) {
            if (insertBeforeEl.previousElementSibling !== draggable) {
                container.insertBefore(draggable, insertBeforeEl)
                return true
            }
        } else {
            if (container.lastElementChild !== draggable) {
                container.appendChild(draggable)
                return true
            }
        }
        return false
    },
    _animateFLIP: (allElements, prevRects, activeDraggable, dragGhost) => {
        allElements.forEach(item => {
            if (item === activeDraggable || item === dragGhost) return

            const prev = prevRects.get(item)
            if (!prev) return

            const curr = item.getBoundingClientRect()
            const dx = prev.left - curr.left
            const dy = prev.top - curr.top
            if (dx !== 0 || dy !== 0) {
                item.animate([
                    { transform: `translate(${dx}px, ${dy}px)` },
                    { transform: "translate(0, 0)" }
                ], { duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "both" })
            }
        })
    },
    _deepCopyStyles: (source, target) => {
        const computed = window.getComputedStyle(source)
        const properties = [
            "width", "height", "padding", "margin", "display", "opacity",
            "border", "borderRadius", "backgroundColor", "boxShadow",
            "font", "fontFamily", "fontSize", "fontWeight", "lineHeight", "color", "textAlign",
            "gap", "alignItems", "justifyContent", "flexDirection", "flex",
            "boxSizing", "verticalAlign", "whiteSpace", "overflow", "textOverflow",
        ]
        properties.forEach(prop => target.style[prop] = computed[prop])
        for (let i = 0; i < source.children.length; i++) {
            if (target.children[i]) Control_Transfer._deepCopyStyles(source.children[i], target.children[i])
        }
    }
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
            badgeEl.textContent = typeHandler.label || ""
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
        const currentLabel = typeConfig[currentType].label || ""
        const toOption = ([key, def]) => `<div class="dict-type-option ${key === currentType ? "active" : ""}" data-type="${key}">${def.label || ""}</div>`
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
                badgeEl.textContent = handler.label || ""

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

const Control_Palette = {
    controlOptions: {
        defaultColor: "#FFFFFF",
        dimensions: 1,
        allowJagged: true,
    },
    setup: ({ field }) => defaultBlockLayout(field),
    create: ({ field }) => {
        const { key } = getCommonHTMLAttrs(field)
        return `<div class="palette-wrapper" ${key}><div class="palette-content-layer"></div><input type="color" class="palette-shared-input" tabindex="-1"></div>`
    },
    update: ({ element, value, controlOptions }) => {
        const wrapper = element.querySelector(".palette-wrapper")
        if (!wrapper) return

        let data = value || []
        let { dimensions, defaultColor, allowJagged } = controlOptions
        if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
            dimensions = 2
        } else if (Array.isArray(data) && data.length > 0 && !Array.isArray(data[0])) {
            dimensions = 1
        }
        const isJagged = (dimensions === 1) ? true : (allowJagged !== false)

        wrapper.dataset.mode = dimensions
        wrapper.dataset.jagged = isJagged

        let html = ""
        if (dimensions === 1) {
            const items = data.map(color => Control_Palette._createItem(color || defaultColor)).join("")
            const addBtn = Control_Palette._createAddBtn("item")
            html = `<div class="palette-grid">${items}${addBtn}</div>`
        } else {
            const rows = data.map((row, rIdx) => {
                const rowData = Array.isArray(row) ? row : []
                const items = rowData.map((color, cIdx) => Control_Palette._createItem(color || defaultColor, rIdx, cIdx)).join("")
                const rowAddBtn = isJagged ? Control_Palette._createAddBtn("item", rIdx) : ""
                return `
                    <div class="palette-row-group">
                        <div class="palette-grid">${items}${rowAddBtn}</div>
                        <div class="palette-row-actions"><div class="palette-btn-del-row"><i class="fa fa-trash-o"></i></div></div>
                    </div>`
            }).join("")

            let footer = `<div class="palette-footer-item">${Control_Palette._createAddBtn("row")} <span>Add Row</span></div>`
            if (!isJagged) {
                footer += `<div class="palette-footer-item">${Control_Palette._createAddBtn("col")} <span>Add Column</span></div>`
            }
            html = `<div class="palette-stack">${rows}<div class="palette-footer">${footer}</div></div>`
        }
        wrapper.querySelector(".palette-content-layer").innerHTML = html
    },
    bindEvents: ({ form }) => {
        let activeItem = null

        form.onEvent("click", ".palette-swatch", function () {
            const item = this.closest(".palette-item")
            const wrapper = this.closest(".palette-wrapper")
            const sharedInput = wrapper.querySelector(".palette-shared-input")
            if (item && sharedInput) {
                activeItem = item
                const itemRect = item.getBoundingClientRect()
                const wrapperRect = wrapper.getBoundingClientRect()
                Object.assign(sharedInput.style, {
                    top: `${itemRect.top - wrapperRect.top}px`,
                    left: `${itemRect.left - wrapperRect.left}px`,
                    width: `${itemRect.width}px`,
                    height: `${itemRect.height}px`,
                })
                sharedInput.offsetHeight  // Force Reflow
                sharedInput.value = item.dataset.val || "#FFFFFF"
                sharedInput.click()
            }
        }).onEvent("input", ".palette-shared-input", function () {
            activeItem?.style.setProperty("--pl-color", this.value)
        }).onEvent("change", ".palette-shared-input", function () {
            if (activeItem) {
                const color = this.value
                activeItem.dataset.val = color
                activeItem.style.setProperty("--pl-color", color)
                Control_Palette._commit(this.closest(".palette-wrapper"), form)
                activeItem = null
            }
        }).onEvent("click", ".palette-del", function () {
            const item = this.closest(".palette-item")
            const wrapper = this.closest(".palette-wrapper")
            const mode = parseInt(wrapper.dataset.mode)
            const isJagged = wrapper.dataset.jagged === "true"
            if (mode === 2 && !isJagged) {
                const colIdx = parseInt(item.dataset.col)
                const currentData = utils.naiveCloneDeep(form.getData(wrapper.dataset.key))
                currentData.forEach(row => row.splice(colIdx, 1))
                form.reactiveCommit(wrapper.dataset.key, currentData)
            } else {
                item.remove()
                Control_Palette._commit(wrapper, form)
            }
        }).onEvent("click", ".palette-btn-del-row", utils.createConsecutiveAction({
            threshold: 2,
            timeWindow: 3000,
            getIdentifier: (ev) => ev.target,
            onConfirmed: (ev) => {
                const wrapper = ev.target.closest(".palette-wrapper")
                ev.target.closest(".palette-row-group").remove()
                Control_Palette._commit(wrapper, form)
            }
        })).onEvent("click", ".palette-btn-add", function () {
            const type = this.dataset.type
            const wrapper = this.closest(".palette-wrapper")
            const { defaultColor } = form.getControlOptionsFromKey(wrapper.dataset.key)
            const isJagged = wrapper.dataset.jagged === "true"
            const currentData = utils.naiveCloneDeep(form.getData(wrapper.dataset.key) || [])
            if (type === "item") {
                const mode = parseInt(wrapper.dataset.mode)
                if (mode === 1) {
                    currentData.push(defaultColor)
                } else {
                    const rowIdx = parseInt(this.dataset.row)
                    if (!currentData[rowIdx]) {
                        currentData[rowIdx] = []
                    }
                    currentData[rowIdx].push(defaultColor)
                }
            } else if (type === "row") {
                if (isJagged) {
                    currentData.push([defaultColor])
                } else {
                    const colCount = currentData.length > 0 ? currentData[0].length : 1
                    currentData.push(new Array(colCount).fill(defaultColor))
                }
            } else if (type === "col") {
                if (currentData.length === 0) {
                    currentData.push([])
                }
                currentData.forEach(row => row.push(defaultColor))
            }
            form.reactiveCommit(wrapper.dataset.key, currentData)
        })
    },
    _createItem: (color, rIdx, cIdx) => {
        const coords = (rIdx !== undefined) ? `data-row="${rIdx}" data-col="${cIdx}"` : ""
        return `
            <div class="palette-item" ${coords} data-val="${color}" style="--pl-color: ${color};">
                <div class="palette-swatch"></div>
                <div class="palette-del plugin-common-close"></div>
            </div>`
    },
    _createAddBtn: (type, rowIdx) => {
        const rowAttr = (rowIdx !== undefined) ? `data-row="${rowIdx}"` : ""
        return `<div class="palette-btn-add ${type}" data-type="${type}" ${rowAttr}><i class="fa fa-plus"></i></div>`
    },
    _commit: (wrapper, form) => {
        if (!wrapper) return
        const key = wrapper.dataset.key
        const mode = parseInt(wrapper.dataset.mode)
        const getVal = i => i.dataset.val
        const newData = (mode === 1)
            ? Array.from(wrapper.querySelectorAll(".palette-grid .palette-item"), getVal)
            : Array.from(wrapper.querySelectorAll(".palette-row-group"), row => Array.from(row.querySelectorAll(".palette-item"), getVal))
        form.validateAndCommit(key, newData)
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
        }).onEvent("click", ".table-del", utils.createConsecutiveAction({
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
        const editButtons = '<div class="table-edit fa fa-pencil"></div><div class="table-del fa fa-trash-o"></div>'
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
    getNestedSchemas: (field) => Array.isArray(field.subSchema) ? [field.subSchema] : [],
    create: ({ field, form }) => {
        const switchControlDef = form.options.controls["switch"]

        const newSwitchField = { ...field, type: "switch", isBlockLayout: false }
        const newSwitchControlOptions = { ...switchControlDef.controlOptions, className: "composite-switch" }
        const newSwitchFieldContext = { form, field: newSwitchField, controlOptions: newSwitchControlOptions }

        const toggleControlHtml = switchControlDef.create(newSwitchFieldContext)
        const fullToggleHtml = form.options.layout.renderFieldWrapper(newSwitchField, toggleControlHtml, newSwitchControlOptions.className)
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

const Control_Tabs = {
    controlOptions: {
        tabStyle: "line",  // line | card | segment
        tabPosition: "top",  // top | left
        defaultSelectedTab: "0",
        defaultTabLabel: "Untitled Tab",
    },
    setupType: ({ initState }) => initState(new Map()),  // Map<FieldKey, SelectedTabValue>
    setup: ({ field, state, form }) => {
        field.isBlockLayout = true

        const tabs = field.tabs || []
        tabs.forEach((tab, idx) => tab.value = String(tab.value ?? idx))

        let targetValue = state.get(field.key) ?? String(form.getControlOptions(field).defaultSelectedTab)
        const isValid = targetValue && tabs.some(t => t.value === targetValue)
        if (!isValid && tabs.length > 0) {
            targetValue = tabs[0].value
        }
        if (targetValue != null) {
            state.set(field.key, targetValue)
        }
    },
    getNestedSchemas: (field) => (field.tabs || []).map(tab => tab.schema).filter(schema => Array.isArray(schema)),
    create: ({ field, controlOptions }) => {
        const { key } = getCommonHTMLAttrs(field)
        const tabs = field.tabs || []

        const headers = tabs.map(tab => {
            const label = utils.escape(tab.label || controlOptions.defaultTabLabel)
            const iconHtml = tab.icon ? `<i class="${tab.icon}"></i>` : ""
            const labelHtml = `<div>${label}</div>`
            return `<div class="tab-header-item" data-tab-value="${tab.value}">${iconHtml}${labelHtml}</div>`
        })
        const panes = tabs.map(tab => `<div class="tab-pane" data-tab-value="${tab.value}"></div>`)
        const styleMap = { line: "tabs-style-line", card: "tabs-style-card", segment: "tabs-style-segment" }
        const styleClass = styleMap[controlOptions.tabStyle] || "tabs-style-line"
        const posClass = controlOptions.tabPosition === "left" ? "tabs-pos-left" : "tabs-pos-top"
        return `
            <div class="tabs-wrapper ${styleClass} ${posClass}" ${key}>
                <div class="tabs-header-list">${headers.join("")}</div>
                <div class="tabs-content-wrapper">${panes.join("")}</div>
            </div>`
    },
    update: ({ element, field, form, state }) => {
        const active = state.get(field.key)
        if (active == null) return
        const wrapper = element.querySelector(".tabs-wrapper")
        if (!wrapper) return

        wrapper.querySelectorAll(".tab-header-item").forEach(header => {
            const isActive = header.dataset.tabValue === active
            header.classList.toggle("active", isActive)
        })
        wrapper.querySelectorAll(".tab-pane").forEach(pane => {
            const val = pane.dataset.tabValue
            const isActive = val === active
            pane.classList.toggle("plugin-common-hidden", !isActive)
            if (isActive && pane.childElementCount === 0) {
                const tabConfig = (field.tabs || []).find(t => t.value === val)
                if (tabConfig && Array.isArray(tabConfig.schema)) {
                    form.fillForm(tabConfig.schema, pane)
                }
            }
        })
    },
    bindEvents: ({ form, state }) => {
        form.onEvent("click", ".tab-header-item", function () {
            if (!this.classList.contains("active")) {
                const key = this.closest(".tabs-wrapper").dataset.key
                state.set(key, this.dataset.tabValue)
                form._updateControl(key)
            }
        })
    }
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
FastForm.registerControl("divider", Control_Divider)
FastForm.registerControl("hotkey", Control_Hotkey)
FastForm.registerControl("textarea", Control_Textarea)
FastForm.registerControl("code", Control_CodeEditor)
FastForm.registerControl("object", Control_Object)
FastForm.registerControl("array", Control_Array)
FastForm.registerControl("select", Control_Select)
FastForm.registerControl("radio", Control_Radio)
FastForm.registerControl("checkbox", Control_Checkbox)
FastForm.registerControl("transfer", Control_Transfer)
FastForm.registerControl("dict", Control_Dict)
FastForm.registerControl("palette", Control_Palette)
FastForm.registerControl("table", Control_Table)
FastForm.registerControl("composite", Control_Composite)
FastForm.registerControl("tabs", Control_Tabs)

customElements.define("fast-form", FastForm)
