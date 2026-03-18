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
        const targetMap = this.chains.get(target)
        const meta = { originalFn, chainedFn: null, decorators: [], beforeHooks: [], afterHooks: [] }
        targetMap.set(property, meta)
        return meta
    },
    recompile(meta) {
        const sorted = [...meta.decorators].sort((a, b) => a.priority - b.priority)
        meta.beforeHooks = sorted.filter(d => d.before)
        meta.afterHooks = sorted.filter(d => d.after).reverse()
    },
    removeMeta(target, property) {
        if (this.chains.has(target)) {
            this.chains.get(target).delete(property)
        }
    }
}

const decorate = (target, property, options = {}) => {
    const {
        before,
        after,
        modifyArgs = false,
        modifyResult = false,
        timeout = 10000,
        interval = 50,
        priority = 0,
    } = options
    if (typeof property !== "string" && typeof property !== "symbol") {
        return Promise.reject(new TypeError("options.property must be a string or symbol"))
    }
    if (before && typeof before !== "function") {
        return Promise.reject(new TypeError("options.before must be a function"))
    }
    if (after && typeof after !== "function") {
        return Promise.reject(new TypeError("options.after must be a function"))
    }

    const objGetter = typeof target === "function" ? target : () => target
    const decoratorId = Symbol(`decorator_${String(property)}`)

    let timer = null
    return new Promise((resolve, reject) => {
        const endTime = Date.now() + timeout

        const checkAndDecorate = () => {
            try {
                const obj = objGetter()
                if (obj == null || (typeof obj !== "object" && typeof obj !== "function")) {
                    return false
                }
                const targetFn = obj[property]
                if (typeof targetFn !== "function") {
                    return false
                }

                let meta = decoratorChain.getMeta(obj, property)
                if (!meta) {
                    meta = decoratorChain.initMeta(obj, property, targetFn)
                    const chainedFn = function (...args) {
                        const { beforeHooks, afterHooks, originalFn } = meta
                        const beforeLen = beforeHooks.length
                        const afterLen = afterHooks.length

                        let executionArgs = args
                        for (let i = 0; i < beforeLen; i++) {
                            const hook = beforeHooks[i]
                            const beforeResult = hook.before.apply(this, executionArgs)
                            if (beforeResult === PREVENT_DEFAULT) return
                            if (hook.modifyArgs) {
                                executionArgs = (beforeResult == null)
                                    ? []
                                    : Array.isArray(beforeResult) ? beforeResult : [beforeResult]
                            }
                        }
                        let result = originalFn.apply(this, executionArgs)
                        for (let i = 0; i < afterLen; i++) {
                            const hook = afterHooks[i]
                            const afterResult = hook.after.call(this, result, ...executionArgs)
                            if (hook.modifyResult) {
                                result = afterResult
                            }
                        }

                        return result
                    }

                    Object.defineProperties(chainedFn, {
                        name: { value: targetFn.name, configurable: true },
                        length: { value: targetFn.length, configurable: true },
                        __original: { value: targetFn, configurable: true, enumerable: false },
                    })

                    meta.chainedFn = chainedFn
                    obj[property] = chainedFn
                }

                meta.decorators.push({ id: decoratorId, before, after, modifyArgs, modifyResult, priority })
                decoratorChain.recompile(meta)
                const undecorate = () => {
                    const currentMeta = decoratorChain.getMeta(obj, property)
                    if (!currentMeta) return
                    const index = currentMeta.decorators.findIndex(d => d.id === decoratorId)
                    if (index === -1) return

                    currentMeta.decorators.splice(index, 1)
                    if (currentMeta.decorators.length === 0) {
                        if (obj[property] === currentMeta.chainedFn) {
                            obj[property] = currentMeta.originalFn
                        }
                        decoratorChain.removeMeta(obj, property)
                    } else {
                        decoratorChain.recompile(currentMeta)
                    }
                }
                resolve({ decorated: obj[property], undecorate, id: decoratorId, decorators: meta.decorators.length })
                return true
            } catch (e) {
                console.error(`decorate error for ${String(property)}:`, e)
                reject(e)
                return true
            }
        }

        if (checkAndDecorate()) return

        timer = setInterval(() => {
            if (Date.now() > endTime) {
                clearInterval(timer)
                reject(new Error(`decorate timeout for ${String(property)} after ${timeout}ms`))
                return
            }
            if (checkAndDecorate()) {
                clearInterval(timer)
            }
        }, interval)
    })
}

const beforeCall = (target, property, hook, options = {}) => decorate(target, property, { ...options, before: hook })
const afterCall = (target, property, hook, options = {}) => decorate(target, property, { ...options, after: hook })
const modifyArguments = (target, property, mapper, options = {}) => decorate(target, property, { ...options, before: mapper, modifyArgs: true })
const modifyReturn = (target, property, mapper, options = {}) => decorate(target, property, { ...options, after: mapper, modifyResult: true })
const preventCallIf = (target, property, conditionFn, options = {}) => {
    return decorate(target, property, {
        ...options,
        before: function (...args) {
            if (conditionFn.apply(this, args)) {
                return PREVENT_DEFAULT
            }
        }
    })
}

const getInfo = (target, property) => decoratorChain.getMeta(target, property)

const exposes = {
    PREVENT_DEFAULT,
    decorate,
    beforeCall,
    afterCall,
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
