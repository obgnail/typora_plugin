const { sharedSheets } = require("../common")
const utils = require("../../utils")
const { uniqueNum, revealElement, validateDefinition } = require("./helpers")

class FastForm extends HTMLElement {
  static style = `<link rel="stylesheet" href="./plugin/global/core/components/fast-form/index.css" crossorigin="anonymous">`
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
    if (Object.hasOwn(this.controls, name)) {
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
    if (Object.hasOwn(this.features, name)) {
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
    if (Object.hasOwn(this.layouts, name)) {
      console.warn(`FastForm Warning: Overwriting layout for '${name}'.`)
    }
    this.layouts[name] = definition
  }

  constructor() {
    super()
    const root = this.attachShadow({ mode: "open" })
    root.adoptedStyleSheets = sharedSheets
    root.innerHTML = this.constructor.style + `<div id="form"></div>`

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
    const notifyError = (errors) => {
      const err = errors[0]  // show first error only
      const msg = (typeof err.message === "string")
        ? err.message || err.toString()
        : typeof err === "string" ? err : "Verification Failed"
      utils.notification.show(msg, "error")
    }
    const errorHighlightTimers = new Map()
    const highlightError = (changeContext) => {
      const context = this.resolveFieldContext(changeContext.key)
      if (!context) return
      const el = this.options.layout.findControl(context.field.key, this.form)
      const op = { key: context.field.key, duration: 3000, className: "input-error", timers: errorHighlightTimers }
      revealElement(el, op)
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
        notifyError(errors)
        highlightError(changeContext)
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
      if (Object.hasOwn(options._instanceFeatures, name) && typeof feature.install === "function") {
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
  _temporaries = new Map()
  _overrides = new Map()

  constructor(defaultImpls, strategies, staticSubscribers = []) {
    this._definitions = new Map(
      Object.entries(defaultImpls).map(([hookName, impl]) => {
        const strategy = strategies[hookName] || {}
        return [hookName, { impl, ...strategy }]
      }),
    )
    this._statics = new Map(
      [...this._definitions.keys()]
        .map(hookName => {
          const impls = staticSubscribers.map(sub => sub?.[hookName]).filter(fn => typeof fn === "function")
          return [hookName, new Set(impls)]
        })
        .filter(([_, set]) => set.size > 0),
    )
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
      //   for (const fn of allImpls) {
      //     const ret = fn(...initialArgs)
      //     if (ret !== undefined) return ret
      //   }
      //   return
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

module.exports = {
  FastForm,
  LifecycleHooks,
  States,
}
