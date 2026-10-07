const utils = require("../../utils")
const { validateDefinition } = require("./helpers")

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
      if (Object.hasOwn(normalized, key)) {
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
        },
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
      $typeof: { evaluate: (actual, expected) => (expected === "object") ? (typeof actual === "object" && actual != null) : (typeof actual === expected) },
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
        },
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
        },
      },
    }

    const uiBehaviors = {
      visibility: (el, actions, ctx) => {
        if (Object.hasOwn(actions, "$toggle")) {
          utils.toggleInvisible(el)
        } else if (Object.hasOwn(actions, "$set")) {
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
        if (Object.hasOwn(condition, name)) {
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
        if (Object.hasOwn(condition, name)) {
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
        if (Object.hasOwn(Registries.meta, name)) console.warn(`FastForm Warning: Overwriting meta '${name}'.`)
        Registries.meta[name] = getterFn
      }
      FastFormClass.registerConditionEvaluator = (name, definition) => {
        const checks = { evaluate: { required: true, type: "function" }, collectTriggers: { required: true, type: "function" }, beforeEvaluate: { type: "function" } }
        validateDefinition(name, definition, checks, validationOptions)
        if (Object.hasOwn(Registries.conditionEvaluators, name)) console.warn(`FastForm Warning: Overwriting Condition Evaluator for '${name}'.`)
        Registries.conditionEvaluators[name] = definition
      }
      FastFormClass.registerComparisonEvaluator = (name, definition) => {
        const checks = { evaluate: { required: true, type: "function" }, beforeEvaluate: { type: "function" } }
        validateDefinition(name, definition, checks, validationOptions)
        if (Object.hasOwn(Registries.comparisonEvaluators, name)) console.warn(`FastForm Warning: Overwriting Comparison Evaluator for '${name}'.`)
        Registries.comparisonEvaluators[name] = definition
      }
      FastFormClass.registerEffectHandler = (name, definition) => {
        const checks = { collectAffects: { required: true, type: "function" }, execute: { required: true, type: "function" } }
        validateDefinition(name, definition, checks, validationOptions)
        if (Object.hasOwn(Registries.effectHandlers, name)) console.warn(`FastForm Warning: Overwriting Effect Handler for '${name}'.`)
        Registries.effectHandlers[name] = definition
      }
    },
  }
})()

module.exports = { Feature_Watchers }
