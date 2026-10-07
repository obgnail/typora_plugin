const utils = require("../../utils")
const i18n = require("../../i18n")
const { revealElement } = require("./helpers")

/**
 * Provides a contextual, dual-state UI Builder architecture.
 * It uses PascalCase for chainable setters to prevent namespace collisions with the underlying camelCase data properties.
 * This hybrid design allows the builder instance to serve directly as the final data object,
 * enabling native `JSON.stringify` serialization without an explicit `.build()` step.
 *
 * Contextual Resolution: `asBox` vs. `asField`
 * UI controls adapt their data structure based on their placement within the schema:
 * - `asBox`: Triggered when a control acts as a top-level layout node. It retains its outer container (Box) to manage layout-level attributes like `col` (grid span) and `title`.
 * - `asField`: Triggered when a control is embedded inside a composite container (e.g., Groups, Tabs). The outer Box wrapper is stripped, yielding a pure, inner Field object.
 *
 * Property Lifecycle: `assign` & `transfer`
 * - `assign` (Immediate Mutation): Invoked instantly when a chainable method is called. It assigns the property to either the outer Box or the inner Field depending on the strategy.
 * - `transfer` (Contextual Injection): Invoked exclusively during `asField` resolution. It migrates layout properties (e.g., `title`, `col`) that were originally assigned to the outer Box down into the inner Field (as `label`, `col`), ensuring configurations are perfectly preserved even after the layout wrapper is discarded.
 */
const Feature_DSLEngine = (() => {
  const RESOLVE_SYM = Symbol("schema:resolve")

  const When = new Proxy({
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
    },
  })
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
    if (combined.length === 0) return undefined
    if (combined.length === 1) return combined[0]
    return { $and: combined }
  }
  const createResolver = (strategy) => {
    const resolver = (input) => {
      if (input == null) return []
      if (input[RESOLVE_SYM]) {
        const result = input[RESOLVE_SYM][strategy]?.call(input)
        if (result == null) return []
        return Array.isArray(result) ? result.flatMap(resolver) : [result]
      }
      if (Array.isArray(input)) {
        return input.flatMap(resolver)
      }
      return [input]
    }
    return resolver
  }

  const resolveFields = createResolver("asField")
  const resolveBoxes = createResolver("asBox")

  const normalizeBoxes = (boxes) => {
    return resolveBoxes([boxes].flat(Infinity)).reduce((acc, box) => {
      if (box && typeof box === "object") {
        const rawFields = Array.isArray(box.fields) ? box.fields : []
        const fields = resolveFields(rawFields).filter(field => field && typeof field === "object")
        acc.push({ ...box, fields })
      }
      return acc
    }, [])
  }
  const appendFields = (box, items) => {
    if (!items || items.length === 0) return
    if (!box.fields) box.fields = []
    box.fields.push(...resolveFields(items))
  }

  const PropResolvers = {
    INNER: {
      assign: (box, innerField, propKey, propVal) => innerField[propKey] = propVal,
      transfer: null,
    },
    OUTER: {
      assign: (box, innerField, propKey, propVal) => box[propKey] = propVal,
      transfer: null,
    },
    SHARED: {
      assign: (box, innerField, propKey, propVal) => box[propKey] = propVal,
      transfer: (box, innerField, propKey) => {
        if (box[propKey] !== undefined) {  // `null` is allowed
          innerField[propKey] = box[propKey]
        }
      },
    },
    NONE: {
      assign: () => null,
      transfer: () => null,
    },
    MAP_KEYS: (outerKey, innerKey) => ({
      assign: (box, innerField, propKey, propVal) => box[outerKey] = propVal,
      transfer: (box, innerField) => {
        if (box[outerKey] !== undefined) {
          innerField[innerKey] = box[outerKey]
        }
      },
    }),
    FALLBACK_ON_TRANSFER: (defaultValue) => ({
      assign: (box, innerField, propKey, propVal) => innerField[propKey] = propVal,
      transfer: (box, innerField, propKey) => {
        if (innerField[propKey] === undefined) {
          innerField[propKey] = defaultValue
        }
      },
    }),
    WITH_SIDE_EFFECT: (effectFn) => ({
      assign: (box, innerField, propKey, ...args) => {
        innerField[propKey] = args[0]
        effectFn(box, innerField, propKey, ...args)
      },
      transfer: null,
    }),
    TOOLTIP: (strategy) => ({
      assign: (box, innerField, propKey, payload) => {
        const target = strategy === "INNER" ? innerField : box
        let items = []
        if (Array.isArray(payload)) {
          items = payload
        } else if (typeof payload === "object" && payload !== null) {
          items = [payload]
        } else if (payload != null && payload !== "") {
          items = [String(payload)]
        }
        target[propKey] = [].concat(target[propKey] ?? [], items)
      },
      transfer: strategy === "SHARED"
        ? (box, innerField, propKey) => {
          if (box[propKey] !== undefined) {
            innerField[propKey] = box[propKey]
          }
        }
        : null,
    }),
    DEPENDENCY: {
      assign: (box, innerField, propKey, ...deps) => {
        const [keyOrDep, value] = deps
        const newDep = (value != null) ? When.eq(keyOrDep, value)
          : (typeof keyOrDep === "string") ? When.true(keyOrDep) : keyOrDep
        box.dependencies = mergeDeps(box.dependencies, newDep)
      },
      transfer: (box, innerField) => {
        if (box.dependencies != null) {
          innerField.dependencies = mergeDeps(innerField.dependencies, box.dependencies)
        }
      },
    },
    FIELDS: {
      assign: (box, innerField, propKey, ...fields) => appendFields(box, fields),
      transfer: null,
    },
    SCHEMA: {
      assign: (box, innerField, propKey, ...boxes) => innerField[propKey] = normalizeBoxes(boxes),
      transfer: null,
    },
    TABS: {
      assign: (box, innerField, propKey, tabsConfig) => {
        if (!Array.isArray(tabsConfig)) return
        innerField[propKey] = tabsConfig.map(tab => tab.schema ? { ...tab, schema: normalizeBoxes(tab.schema) } : { ...tab })
      },
      transfer: null,
    },
    TAB_APPEND: {
      assign: (box, innerField, propKey, tabConfig) => {
        const tab = { ...tabConfig }
        if (tab.schema) {
          tab.schema = normalizeBoxes(tab.schema)
        }
        if (!innerField.tabs) innerField.tabs = []
        innerField.tabs.push(tab)
      },
      transfer: null,
    },
    MERGE_INNER: {
      assign: (box, innerField, propKey, keyOrObj, value) => {
        if (!innerField[propKey]) innerField[propKey] = {}
        if (typeof keyOrObj === "string") {
          innerField[propKey][keyOrObj] = value  // .SubFormOptions({ layout: "grid", boxDependencyUnmetAction: "readonly" })
        } else if (keyOrObj && typeof keyOrObj === "object") {
          Object.assign(innerField[propKey], keyOrObj)  // .SubFormOptions("boxDependencyUnmetAction", "readonly")
        }
      },
      transfer: null,
    },
  }

  const BaseSpecs = {
    FIELD: {
      key: PropResolvers.INNER,
      type: PropResolvers.INNER,
      label: PropResolvers.MAP_KEYS("title", "label"),
      tooltip: PropResolvers.TOOLTIP("SHARED"),
      explain: PropResolvers.INNER,
      hidden: PropResolvers.SHARED,
      col: PropResolvers.SHARED,
      className: PropResolvers.SHARED,
      dependencyUnmetAction: PropResolvers.SHARED,
      dependencies: PropResolvers.DEPENDENCY,
      showIf: PropResolvers.DEPENDENCY,  // Alias for `dependencies`
    },
    BOX: {
      id: PropResolvers.OUTER,
      title: PropResolvers.OUTER,
      tooltip: PropResolvers.TOOLTIP("OUTER"),
      col: PropResolvers.OUTER,
      className: PropResolvers.OUTER,
      dependencyUnmetAction: PropResolvers.OUTER,
      fields: PropResolvers.FIELDS,
      children: PropResolvers.FIELDS,  // Alias for `fields`
      dependencies: PropResolvers.DEPENDENCY,
      showIf: PropResolvers.DEPENDENCY,  // Alias for `dependencies`
    },
  }
  const BuilderFactory = {
    FIELD: {
      createSetter: (propKey, propResolver) => function (...args) {
        propResolver.assign(this, this.fields[0], propKey, ...args)
        return this
      },
      createResolver: (specs) => ({
        asField() {
          const inner = { ...this.fields[0] }
          for (const [key, propResolver] of Object.entries(specs)) {
            propResolver.transfer?.(this, inner, key)
          }
          return inner
        },
        asBox() {
          const box = { ...this }
          box.fields = [{ ...this.fields[0] }]
          return box
        },
      }),
    },
    BOX: {
      createSetter: (propKey, propResolver) => function (...args) {
        propResolver.assign(this, null, propKey, ...args)
        return this
      },
      createResolver: () => ({
        asField() {
          return null
        },
        asBox() {
          return { ...this }
        },
      }),
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
        const scopedProto = { box: null, fields: Object.create(null), any: Object.create(null) }
        const validatePresetName = (name, targetProto) => {
          if (!name || typeof name !== "string") {
            throw new TypeError(`[DSLEngine] Preset name must be a non-empty string.`)
          }
          const isReserved = Object.keys(BaseSpecs.FIELD).some(k => capitalize(k) === name)
            || Object.keys(BaseSpecs.BOX).some(k => capitalize(k) === name)
          if (isReserved) {
            throw new Error(`[DSLEngine] Preset collision: "${name}" is a reserved standard DSL property.`)
          }
          if (targetProto && Object.hasOwn(targetProto, name)) {
            throw new Error(`[DSLEngine] Preset collision: "${name}" is already registered in this sandbox.`)
          }
        }
        const preset = (name, handler) => {
          validatePresetName(name, scopedProto.any)
          scopedProto.any[name] = BuilderFactory.PRESET.createSetter(handler)
        }
        const presetFor = (targetType, name, handler) => {
          if (Array.isArray(targetType)) {
            targetType.forEach(type => presetFor(type, name, handler))
            return
          }
          const targetProto = targetType === "box" ? scopedProto.box : scopedProto.fields[targetType]
          if (!targetProto) {
            throw new Error(`[DSLEngine] Target type "${targetType}" does not exist.`)
          }
          validatePresetName(name, targetProto)
          if (Object.hasOwn(scopedProto.any, name)) {
            throw new Error(`[DSLEngine] Preset collision: "${name}" is already registered globally.`)
          }
          targetProto[name] = BuilderFactory.PRESET.createSetter(handler)
        }
        const buildPrototype = (specs, factory) => {
          const shared = Object.create(scopedProto.any)
          const methods = Object.fromEntries(Object.entries(specs).map(([propKey, propStrategy]) => [capitalize(propKey), factory.createSetter(propKey, propStrategy)]))
          const resolver = { [RESOLVE_SYM]: factory.createResolver(specs) }
          return Object.assign(shared, methods, resolver)
        }
        const assignProps = (box, innerField, props, specs) => {
          for (const [prop, value] of Object.entries(props)) {
            const propResolver = specs[prop]
            if (!propResolver) {
              throw new Error(`[DSLEngine] Property "${prop}" is NOT defined in the specs`)
            }
            propResolver.assign(box, innerField, prop, value)
          }
        }
        const defineField = (name, specs = {}, defaultProps = {}) => {
          const finalSpecs = { ...BaseSpecs.FIELD, ...specs }
          const proto = buildPrototype(finalSpecs, BuilderFactory.FIELD)
          scopedProto.fields[name] = proto
          return (key) => {
            const box = Object.create(proto)
            const innerField = { type: defaultProps.type || name, key }
            box.fields = [innerField]
            assignProps(box, innerField, defaultProps, finalSpecs)
            return box
          }
        }
        const defineBox = (specs = {}, defaultProps = {}) => {
          const finalSpecs = { ...BaseSpecs.BOX, ...specs }
          const proto = buildPrototype(finalSpecs, BuilderFactory.BOX)
          scopedProto.box = proto
          return (...args) => {
            const box = Object.create(proto)
            assignProps(box, null, defaultProps, finalSpecs)
            let idx = 0
            if (args.length > 0 && typeof args[0] === "string") {
              box.title = args[0]
              idx++
            }
            appendFields(box, args.slice(idx))
            return box
          }
        }
        const createDefine = (context) => {
          return (input) => normalizeBoxes(typeof input === "function" ? input(context) : input)
        }
        return { When, PropResolvers, createDefine, defineField, defineBox, preset, presetFor }
      }
      form.dslEngine.statics = { resolveFields, resolveBoxes, normalizeBoxes, appendFields, RESOLVE_SYM, When, PropResolvers, BaseSpecs, BuilderFactory }
    },
  }
})()

const Feature_StandardDSL = {
  onConstruct: (form) => {
    if (!form.dslEngine) {
      console.error("FastForm Error: Feature_StandardDSL requires 'Feature_DSLEngine' feature.")
      return
    }
    const engine = form.dslEngine()
    const { createDefine, defineBox, defineField, When, PropResolvers } = engine
    const { INNER, SCHEMA, NONE, TABS, TAB_APPEND, MERGE_INNER, FALLBACK_ON_TRANSFER, WITH_SIDE_EFFECT, TOOLTIP } = PropResolvers

    const convertToUnit = WITH_SIDE_EFFECT((box, innerField) => {
      if (innerField.type === "number") innerField.type = "unit"
    })

    const PLACEHOLDER = { placeholder: INNER }
    const STATE = { disabled: INNER, readonly: INNER }
    const NUMBER = { min: INNER, max: INNER, step: INNER, isInteger: INNER, unit: convertToUnit }
    const OPTIONS = { options: INNER, disabledOptions: INNER }
    const LIMITS = { minItems: INNER, maxItems: INNER }

    const INLINE = { tooltip: TOOLTIP("INNER"), isBlockLayout: INNER, label: INNER }
    const BLOCK = { tooltip: TOOLTIP("SHARED"), isBlockLayout: FALLBACK_ON_TRANSFER(false) }

    const INLINE_INPUT = { ...INLINE, ...STATE }
    const INLINE_TEXT = { ...INLINE_INPUT, ...PLACEHOLDER }
    const INLINE_NUM = { ...INLINE_INPUT, ...NUMBER }
    const INLINE_OPTIONS = { ...INLINE, ...OPTIONS }

    const BLOCK_INPUT = { ...BLOCK, ...STATE }
    const BLOCK_TEXT = { ...BLOCK_INPUT, ...PLACEHOLDER }
    const BLOCK_OPTIONS = { ...BLOCK, ...OPTIONS }

    const Controls = {
      Switch: defineField("switch", INLINE_INPUT),
      Text: defineField("text", { ...INLINE_TEXT, liveCommit: INNER }),
      Password: defineField("password", { ...INLINE_TEXT, liveCommit: INNER }),
      Color: defineField("color", INLINE_TEXT),
      Icon: defineField("icon", INLINE_TEXT),
      Hotkey: defineField("hotkey", { ...INLINE_INPUT, idlePlaceholder: INNER, listenPlaceholder: INNER }),
      ModifierKey: defineField("modifierKey", INLINE_INPUT),
      Range: defineField("range", INLINE_NUM),
      Number: defineField("number", { ...INLINE_NUM, ...PLACEHOLDER, liveCommit: INNER }),
      Integer: defineField("integer", { ...INLINE_NUM, ...PLACEHOLDER, liveCommit: INNER }, { type: "number", isInteger: true }),
      Float: defineField("float", { ...INLINE_NUM, ...PLACEHOLDER, liveCommit: INNER }, { type: "number", isInteger: false }),
      Action: defineField("action", { ...INLINE, actionType: INNER, activeClass: INNER }),
      Static: defineField("static", { ...INLINE, content: INNER }),
      Composite: defineField("composite", { ...INLINE_INPUT, subSchema: SCHEMA, defaultValues: INNER }),
      Select: defineField("select", { ...INLINE_OPTIONS, ...LIMITS, labelJoiner: INNER }),
      Segment: defineField("segment", { ...INLINE_OPTIONS, ...LIMITS }),
      Radio: defineField("radio", { ...BLOCK_OPTIONS, columns: INNER }),
      Checkbox: defineField("checkbox", { ...BLOCK_OPTIONS, ...LIMITS, columns: INNER }),
      Transfer: defineField("transfer", { ...BLOCK_OPTIONS, ...LIMITS, titles: INNER, defaultHeight: INNER }),
      ToggleSort: defineField("togglesort", { ...BLOCK_OPTIONS, ...LIMITS }),
      Textarea: defineField("textarea", { ...BLOCK_TEXT, rows: INNER, cols: INNER, noResize: INNER, liveCommit: INNER }),
      Code: defineField("code", { ...BLOCK_TEXT, tabSize: INNER, lineNumbers: INNER, liveCommit: INNER }),
      Object: defineField("object", { ...BLOCK_TEXT, rows: INNER, noResize: INNER, format: INNER, liveCommit: INNER }),
      Custom: defineField("custom", { ...BLOCK, content: INNER, unsafe: INNER }),
      Hint: defineField("hint", { ...BLOCK, isBlockLayout: NONE, hintHeader: INNER, hintDetail: INNER, unsafe: INNER }),
      Divider: defineField("divider", { ...BLOCK, divider: INNER, position: INNER, dashed: INNER }),
      Array: defineField("array", { ...BLOCK, allowDuplicates: INNER, dataType: INNER }),
      Dict: defineField("dict", { ...BLOCK, keyPlaceholder: INNER, valuePlaceholder: INNER, allowAddItem: INNER }),
      Palette: defineField("palette", { ...BLOCK, defaultColor: INNER, dimensions: INNER, allowJagged: INNER }),
      Table: defineField("table", { ...BLOCK_INPUT, thMap: INNER, nestedBoxes: SCHEMA, defaultValues: INNER, subFormOptions: MERGE_INNER }),
      Tabs: defineField("tabs", {
        ...BLOCK,
        tabs: TABS,
        tab: TAB_APPEND,
        tabStyle: INNER,
        tabPosition: INNER,
        defaultSelectedTab: INNER,
        defaultTabLabel: INNER,
      }),
    }
    const dsl = { Group: defineBox(), Controls, When, Extend: engine }
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

      const lastArg = args.at(-1)
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
            const target = ev.target.closest?.(selector)
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
  },
}

const Feature_DefaultKeybindings = {
  onRender: (form) => form.onEvent("keydown", ev => ev.stopPropagation(), true),
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
  },
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
  },
}

const Feature_Highlight = {
  featureOptions: {
    highlight: "",  // string | RegExp
    highlightTargetSelector: ".title-text, .control-left",
    highlightIgnoreSelector: ".tooltip, .feature-highlight",
    highlightClass: "feature-highlight",
    autoExpandOnHighlight: true,
    scrollToFirstMatchOnHighlight: false,
    caseSensitiveOnHighlight: false,
  },
  configure: ({ form, registerApi, hooks, options }) => {
    const { highlight: hl, highlightTargetSelector: targetSel, highlightIgnoreSelector: ignoreSel, highlightClass } = options

    const clear = () => {
      const formEl = form.getFormEl()
      if (!formEl) return

      formEl.querySelectorAll(`mark.${highlightClass}`).forEach(mark => {
        const parent = mark.parentNode
        if (!parent) return
        mark.replaceWith(...mark.childNodes)
        parent.normalize()
      })
    }

    const highlight = (keyword) => {
      clear()

      if (!keyword) return { count: 0, firstMatchEl: null }

      const formEl = form.getFormEl()
      if (!formEl) return { count: 0, firstMatchEl: null }

      let regex
      if (typeof keyword === "string" && keyword.trim()) {
        const flags = options.caseSensitiveOnHighlight ? "g" : "gi"
        regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags)
      } else if (keyword instanceof RegExp) {
        regex = new RegExp(keyword.source, keyword.flags.includes("g") ? keyword.flags : keyword.flags + "g")
      } else {
        return { count: 0, firstMatchEl: null }
      }

      const walker = document.createTreeWalker(formEl, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const parent = node.parentElement
          if (!node.nodeValue.trim() || !parent) return NodeFilter.FILTER_REJECT
          if (ignoreSel && parent.closest(ignoreSel)) return NodeFilter.FILTER_REJECT
          if (targetSel && parent.closest(targetSel)) return NodeFilter.FILTER_ACCEPT
          return NodeFilter.FILTER_REJECT
        },
      })

      const targetNodes = []
      let node
      while ((node = walker.nextNode())) {
        targetNodes.push(node)
      }

      let matchCount = 0
      let firstMatchEl = null
      targetNodes.forEach(textNode => {
        const text = textNode.nodeValue
        const matches = [...text.matchAll(regex)]
        if (matches.length === 0) return

        const parentEl = textNode.parentElement
        const frag = document.createDocumentFragment()
        let lastIdx = 0

        matches.forEach(match => {
          if (!match[0]) return
          if (match.index > lastIdx) {
            frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)))
          }
          const mark = document.createElement("mark")
          mark.className = highlightClass
          mark.textContent = match[0]
          frag.appendChild(mark)
          lastIdx = match.index + match[0].length
          matchCount++
        })

        if (lastIdx < text.length) {
          frag.appendChild(document.createTextNode(text.slice(lastIdx)))
        }
        parentEl.replaceChild(frag, textNode)

        if (!firstMatchEl) {
          firstMatchEl = parentEl
        }
        if (options.autoExpandOnHighlight) {
          parentEl.closest(".box-container.collapsed")?.classList.remove("collapsed")
        }
      })

      if (options.scrollToFirstMatchOnHighlight && firstMatchEl) {
        firstMatchEl.scrollIntoView({ behavior: "smooth", block: "center" })
      }

      return { count: matchCount, firstMatchEl }
    }

    registerApi("highlight", { highlight, clear })
    hooks.on("onRender", () => hl && highlight(hl))
  },
}

const Feature_Reveal = {
  featureOptions: {
    reveal: [],
    revealClass: "input-focus",
    revealDuration: 3000,
  },
  configure: ({ form, options, hooks, registerApi, initState }) => {
    const timers = initState(new Map(), m => {
      m.forEach(clearTimeout)
      m.clear()
    })

    const resolve = (keys) => {
      const formEl = form.getFormEl()
      const find = (key) => options.layout.findControl(key, formEl) || options.layout.findBox(key, formEl)
      return (Array.isArray(keys) ? keys : [keys]).map(key => ({ key, el: find(key) })).filter(({ el }) => el)
    }

    const clearTimer = (key) => {
      const pending = timers.get(key)
      if (pending) {
        clearTimeout(pending)
        timers.delete(key)
      }
    }

    const clear = () => form.getFormEl()?.querySelectorAll(`.${options.revealClass}`).forEach(el => el.classList.remove(options.revealClass))

    const reveal = (keys) => {
      clear()
      const targets = resolve(keys)
      targets.forEach(({ key, el }) => {
        clearTimer(key)
        el.closest(".box-container.collapsed")?.classList.remove("collapsed")
        el.classList.add(options.revealClass)
      })
      targets[0]?.el.scrollIntoView({ behavior: "smooth", block: "center" })
      return targets.length
    }

    const pulse = (keys, overrides = {}) => {
      const targets = resolve(keys)
      targets.forEach(({ key, el }, idx) => revealElement(el, {
        key,
        timers,
        scroll: idx === 0,
        className: overrides.className ?? options.revealClass,
        duration: overrides.duration ?? options.revealDuration,
      }))
      return targets.length
    }

    registerApi("reveal", { reveal, pulse, clear })
    hooks.on("onRender", () => options.reveal?.length && reveal(options.reveal))
  },
}

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
          const args = rule.args === undefined ? [] : (Array.isArray(rule.args) ? rule.args : [rule.args])
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

    const isFieldSkippable = (key) => {
      const el = form.options.layout.findControl(key, form.getFormEl())
      if (!el) return false
      return !!el.closest(".plugin-common-hidden, .plugin-common-readonly")
    }

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
      getRules: (key) => state.compiledRules.get(key),
      validateAll: () => {
        let allValid = true
        for (const key of state.compiledRules.keys()) {
          if (isFieldSkippable(key)) continue
          const changeContext = { key, value: form.getData(key), type: "set" }
          const errors = form._validate(changeContext)
          if (Array.isArray(errors) && errors.length > 0) {
            allValid = false
            form.hooks.invoke("onValidateFailed", errors, changeContext)
          }
        }
        return allValid
      },
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
        if (Object.hasOwn(Feature_Validation._validators, name)) {
          console.warn(`FastForm Warning: Overwriting validator for '${name}'.`)
        }
        Feature_Validation._validators[name] = definition
      },
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
    minLength: (min) => ({ value }) => {
      if (!Object.hasOwn(value, "length")) return true
      return value.length >= min ? true : i18n.t("global", "error.minLength", { minLength: min })
    },
    maxLength: (max) => ({ value }) => {
      if (!Object.hasOwn(value, "length")) return true
      return value.length <= max ? true : i18n.t("global", "error.maxLength", { maxLength: max })
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
  },
}

function normalizeWatcherOptions(rule) {
  const isFullDefinition = ["when", "triggers"].some(key => Object.hasOwn(rule, key))
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
      if (Object.hasOwn(allDependencies, field.key)) {
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
  },
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
        if (Object.hasOwn(allRules, box.id)) {
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
  },
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
      if (!rule || !Object.hasOwn(rule, "target") || !Object.hasOwn(rule, "value")) {
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
  },
}

const Feature_History = {
  featureOptions: {
    historyEnabled: false,
    historyMaxSize: 50,
    historyMergeWindow: 0,
    historyExcludeKeys: [],
    historyFeedbackClass: "input-success",
    historyFeedbackDuration: 3000,
    historyEmitEvents: false,
  },

  configure: ({ form, hooks, initState, registerApi, options }) => {
    const state = initState({
      undoStack: [],
      redoStack: [],
      isReplaying: false,
      pendingSnapshot: new Map(),
      highlightTimers: new Map(),
    }, state => {
      state.undoStack.length = 0
      state.redoStack.length = 0
      state.pendingSnapshot.clear()
      state.highlightTimers.forEach(timerId => clearTimeout(timerId))
      state.highlightTimers.clear()
    })

    const isExcluded = fieldKey => options.historyExcludeKeys.includes(fieldKey)
    const captureSnapshot = (key) => {
      const context = form.resolveFieldContext(key)
      const containerKey = context ? context.field.key : key
      const value = utils.naiveCloneDeep(form.getData(containerKey))
      return { containerKey, value }
    }
    const emitChange = () => {
      if (!options.historyEmitEvents) return
      form.dispatchEvent(new CustomEvent("history-change", {
        detail: {
          canUndo: state.undoStack.length > 0,
          canRedo: state.redoStack.length > 0,
          undoSize: state.undoStack.length,
          redoSize: state.redoStack.length,
        },
      }))
    }

    const onBeforeCommit = changeContext => {
      if (state.isReplaying) return
      const { key } = changeContext
      if (isExcluded(key)) return
      state.pendingSnapshot.set(key, captureSnapshot(key))
    }
    const onAfterCommit = changeContext => {
      if (state.isReplaying) return
      const { key } = changeContext
      if (isExcluded(key)) return

      const before = state.pendingSnapshot.get(key)
      state.pendingSnapshot.delete(key)
      if (!before) return

      const after = captureSnapshot(key)
      const entry = { key: before.containerKey, oldValue: before.value, newValue: after.value, timestamp: Date.now() }
      if (utils.deepEqual(entry.oldValue, entry.newValue)) return

      const top = state.undoStack.at(-1)
      const canMerge = options.historyMergeWindow > 0
        && top
        && top.key === entry.key
        && (entry.timestamp - top.timestamp) < options.historyMergeWindow

      if (canMerge) {
        top.newValue = entry.newValue
        top.timestamp = entry.timestamp
      } else {
        state.undoStack.push(entry)
        if (state.undoStack.length > options.historyMaxSize) state.undoStack.shift()
      }

      state.redoStack.length = 0
      emitChange()
    }

    if (options.historyEnabled) {
      hooks.on("onBeforeCommit", onBeforeCommit)
      hooks.on("onAfterCommit", onAfterCommit)
    }

    const highlightControl = (key) => {
      const el = form.options.layout.findControl(key, form.getFormEl())
      const op = { key, duration: options.historyFeedbackDuration, className: options.historyFeedbackClass, timers: state.highlightTimers, scroll: true }
      revealElement(el, op)
    }

    const replay = (entry, value) => {
      state.isReplaying = true
      try {
        const ok = form.reactiveCommit(entry.key, value, "set")
        if (ok) {
          highlightControl(entry.key)
          utils.notification.show(i18n.t("global", "success.replay"))
        } else {
          utils.notification.show(i18n.t("global", "error.replay"), "error")
        }
        return ok
      } finally {
        state.isReplaying = false
      }
    }

    registerApi("history", {
      undo: () => {
        const entry = state.undoStack.pop()
        if (!entry) return false
        const ok = replay(entry, entry.oldValue)
        state[ok ? "redoStack" : "undoStack"].push(entry)
        emitChange()
        return ok
      },
      redo: () => {
        const entry = state.redoStack.pop()
        if (!entry) return false
        const ok = replay(entry, entry.newValue)
        state[ok ? "undoStack" : "redoStack"].push(entry)
        emitChange()
        return ok
      },
      clear: () => {
        state.undoStack.length = 0
        state.redoStack.length = 0
        emitChange()
      },
      canUndo: () => state.undoStack.length > 0,
      canRedo: () => state.redoStack.length > 0,
      inspect: () => ({ undoStack: [...state.undoStack], redoStack: [...state.redoStack] }),
    })
  },
}

const Feature_LiveCommit = {
  compile: ({ form, options }) => {
    const targets = new Map()  // fieldKey -> delay(ms)
    form.traverseFields(field => {
      const delay = field.liveCommit
      if (typeof delay === "number" && delay > 0) {
        targets.set(field.key, delay)
      }
    }, options.schema)

    if (targets.size === 0) return

    const composing = new Set()
    const timers = new Map()  // key -> timerId
    const commit = (key, value) => {
      clearTimeout(timers.get(key))
      timers.set(key, setTimeout(() => {
        timers.delete(key)
        form.validateAndCommit(key, value)
      }, targets.get(key)))
    }
    const resolve = ev => {
      const key = ev.target.closest("[data-control]")?.dataset?.control
      return (key && targets.has(key) && typeof ev.target.value === "string") ? key : null
    }

    form.onEvent("compositionstart", ev => {
      const key = resolve(ev)
      if (key) composing.add(key)
    }, true).onEvent("compositionend", ev => {
      const key = resolve(ev)
      if (!key) return
      composing.delete(key)
      clearTimeout(timers.get(key))
      timers.delete(key)
      form.validateAndCommit(key, ev.target.value)
    }, true).onEvent("input", ev => {
      const key = resolve(ev)
      if (key && !composing.has(key)) commit(key, ev.target.value)
    }, true)

    form.registerCleanup(() => timers.forEach(id => clearTimeout(id)))
  },
}

const Feature_TableRowRules = {
  configure: ({ options, form }) => {
    const { rules } = options
    if (!rules || typeof rules !== "object") return

    form.traverseFields(field => {
      if (field.type !== "table" || !field.key) return
      const rowRules = rules[field.key]?.$row
      if (rowRules && typeof rowRules === "object" && !Array.isArray(rowRules)) {
        field.subFormOptions = { rules: rowRules, ...(field.subFormOptions || {}) }
      }
    }, options.schema)
  },
}

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
    if (processedExpected_Regex === null) return false
    return processedActual ? processedExpected_Regex.test(processedActual) : true
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
  },
}

function Try(fn, buildErr = utils.identity) {
  try {
    fn()
  } catch (err) {
    return new Error(buildErr(err))
  }
}

const Validator_Url = ({ value }) => {
  if (!value) return true
  return Try(() => Boolean(new URL(value)), () => i18n.t("global", "error.invalidURL"))
}

const Validator_Regex = ({ value }) => {
  if (!value) return true
  return Try(() => value && new RegExp(value), () => `Error Regex: ${value}`)
}

const Validator_Path = ({ value }) => {
  if (!value) return true
  const base = utils.resolvePluginPath(value)
  return Try(() => value && utils.Package.FsExtra.accessSync(base), () => `No such path: ${base}`)
}

module.exports = {
  Feature_DSLEngine,
  Feature_StandardDSL,
  Feature_EventDelegation,
  Feature_DefaultKeybindings,
  Feature_CollapsibleBox,
  Feature_InteractiveTooltip,
  Feature_Highlight,
  Feature_Reveal,
  Feature_Parsing,
  Feature_Validation,
  normalizeWatcherOptions,
  Feature_FieldDependencies,
  Feature_BoxDependencies,
  Feature_Cascades,
  Feature_History,
  Feature_LiveCommit,
  Feature_TableRowRules,
  Condition_CompareFields,
  Condition_Length,
  Comparison_Regex,
  Effect_Map,
  Validator_Url,
  Validator_Regex,
  Validator_Path,
}
