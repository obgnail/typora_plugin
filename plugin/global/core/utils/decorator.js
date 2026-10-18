const PREVENT_DEFAULT = Symbol.for("decorator:prevent-default")

const decoratorChain = {
  chains: new WeakMap(),
  getMeta(target, property) {
    return this.chains.get(target)?.get(property)
  },
  initMeta(target, property, originalFn) {
    if (!this.chains.has(target)) {
      this.chains.set(target, new Map())
    }
    const meta = { originalFn, chainedFn: null, decorators: [], beforeHooks: [], afterHooks: [], settledHooks: [] }
    this.chains.get(target).set(property, meta)
    return meta
  },
  recompile(meta) {
    const sorted = meta.decorators.toSorted((a, b) => a.priority - b.priority)
    meta.beforeHooks = sorted.filter(d => d.before)
    meta.afterHooks = sorted.filter(d => d.after).reverse()
    meta.settledHooks = sorted.filter(d => d.settled).reverse()
  },
  removeMeta(target, property) {
    this.chains.get(target)?.delete(property)
  },
}

const capture = fn => {
  try {
    return { ok: true, value: fn() }
  } catch (error) {
    return { ok: false, error }
  }
}

const intercept = (meta, property) => function (...args) {
  const { beforeHooks, afterHooks, settledHooks, originalFn } = meta
  let executionArgs = args

  const invoke = () => {
    for (const { before, modifyArgs } of beforeHooks) {
      const out = before.apply(this, executionArgs)
      if (out === PREVENT_DEFAULT) return
      if (modifyArgs) {
        executionArgs = out == null ? [] : [out].flat()
      }
    }
    let result = originalFn.apply(this, executionArgs)
    for (const { after, modifyResult } of afterHooks) {
      const out = after.call(this, result, ...executionArgs)
      if (modifyResult) {
        result = out
      }
    }
    return result
  }

  if (settledHooks.length === 0) return invoke()

  const release = ({ ok, value, error }) => {
    for (const { settled } of settledHooks) {
      try {
        settled.call(this, ok ? null : error, value, ...executionArgs)
      } catch (e) {
        console.error(`settled hook error for ${String(property)}:`, e)
      }
    }
    if (!ok) throw error
    return value
  }

  const outcome = capture(invoke)
  if (outcome.ok && typeof outcome.value?.then === "function") {
    return Promise.resolve(outcome.value).then(
      value => release({ ok: true, value }),
      error => release({ ok: false, error }),
    )
  }
  return release(outcome)
}

const install = (obj, property) => {
  const meta = decoratorChain.initMeta(obj, property, obj[property])
  const chainedFn = intercept(meta, property)
  Object.defineProperties(chainedFn, {
    name: { value: meta.originalFn.name, configurable: true },
    length: { value: meta.originalFn.length, configurable: true },
    __original: { value: meta.originalFn },
  })
  meta.chainedFn = chainedFn
  obj[property] = chainedFn
  return meta
}

const undecorate = (obj, property, id) => {
  const meta = decoratorChain.getMeta(obj, property)
  const index = meta?.decorators.findIndex(d => d.id === id) ?? -1
  if (index === -1) return

  meta.decorators.splice(index, 1)
  if (meta.decorators.length > 0) {
    return decoratorChain.recompile(meta)
  }
  if (obj[property] === meta.chainedFn) {
    obj[property] = meta.originalFn
  }
  decoratorChain.removeMeta(obj, property)
}

const waitFor = (probe, timeout, interval, onTimeout) => new Promise((resolve, reject) => {
  const deadline = Date.now() + timeout
  const poll = () => {
    let obj
    try {
      obj = probe()
    } catch (e) {
      return reject(e)
    }
    if (obj != null) {
      return resolve(obj)
    }
    if (Date.now() < deadline) {
      return void setTimeout(poll, interval)
    }
    reject(onTimeout())
  }
  poll()
})

const decorate = (target, property, options = {}) => {
  const {
    before,
    after,
    settled,
    modifyArgs = false,
    modifyResult = false,
    timeout = 10000,
    interval = 50,
    priority = 0,
  } = options
  if (typeof property !== "string" && typeof property !== "symbol") {
    return Promise.reject(new TypeError("options.property must be a string or symbol"))
  }
  for (const [name, hook] of Object.entries({ before, after, settled })) {
    if (hook !== undefined && typeof hook !== "function") {
      return Promise.reject(new TypeError(`options.${name} must be a function`))
    }
  }

  const getTarget = typeof target === "function" ? target : () => target
  const probe = () => {
    const obj = getTarget()
    const valid = obj != null
      && (typeof obj === "object" || typeof obj === "function")
      && typeof obj[property] === "function"
    return valid ? obj : null
  }

  return waitFor(
    probe,
    timeout,
    interval,
    () => new Error(`decorate timeout for ${String(property)} after ${timeout}ms`),
  ).then(obj => {
    const meta = decoratorChain.getMeta(obj, property) ?? install(obj, property)
    const id = Symbol(`decorator_${String(property)}`)
    meta.decorators.push({ id, before, after, settled, modifyArgs, modifyResult, priority })
    decoratorChain.recompile(meta)
    return {
      id,
      decorated: meta.chainedFn,
      decorators: meta.decorators.length,
      undecorate: () => undecorate(obj, property, id),
    }
  })
}

const beforeCall = (target, property, hook, options = {}) => decorate(target, property, { ...options, before: hook })
const afterCall = (target, property, hook, options = {}) => decorate(target, property, { ...options, after: hook })
const settledCall = (target, property, hook, options = {}) => decorate(target, property, { ...options, settled: hook })
const modifyArguments = (target, property, mapper, options = {}) => decorate(target, property, { ...options, before: mapper, modifyArgs: true })
const modifyReturn = (target, property, mapper, options = {}) => decorate(target, property, { ...options, after: mapper, modifyResult: true })
const preventCallIf = (target, property, conditionFn, options = {}) => {
  return decorate(target, property, {
    ...options,
    before: function (...args) {
      if (conditionFn.apply(this, args)) {
        return PREVENT_DEFAULT
      }
    },
  })
}

const getInfo = (target, property) => decoratorChain.getMeta(target, property)

const exposes = {
  PREVENT_DEFAULT,
  decorate,
  beforeCall,
  afterCall,
  settledCall,
  modifyArguments,
  modifyReturn,
  preventCallIf,
  getInfo,
}

module.exports = class Decorator {
  constructor() {
    Object.assign(this, exposes)
  }
}
