function At() {
    function at(n) {
        n = Math.trunc(n) || 0
        if (n < 0) {
            n += this.length
        }
        if (n < 0 || n >= this.length) {
            return undefined
        }
        return this[n]
    }

    for (const type of [Array, String, Int8Array]) {
        if (!type.prototype.at) {
            Object.defineProperty(type.prototype, "at", {
                value: at,
                configurable: true,
                enumerable: false,
                writable: true,
            })
        }
    }
}

function HasOwn() {
    if (!Object.hasOwn) {
        Object.defineProperty(Object, "hasOwn", {
            value(object, key) {
                return Object.prototype.hasOwnProperty.call(object, key)
            },
            configurable: true,
            enumerable: false,
            writable: true,
        })
    }
}

function GroupBy() {
    if (!Object.groupBy) {
        Object.defineProperty(Object, "groupBy", {
            value(items, callback) {
                return items.reduce((acc, item, index, array) => {
                    const key = callback.call(this, item, index, array)
                    if (acc[key] === undefined) {
                        acc[key] = []
                    }
                    acc[key].push(item)
                    return acc
                }, {})
            },
            configurable: true,
            enumerable: false,
            writable: true,
        })
    }
}

function AbortSignalTimeout() {
    if (AbortSignal && !AbortSignal.timeout) {
        Object.defineProperty(AbortSignal, "timeout", {
            value(ms) {
                if (!Number.isFinite(ms) || ms < 0) {
                    throw new TypeError("ms must be a finite, non-negative number")
                }
                const controller = new AbortController()
                const timeoutId = setTimeout(() => {
                    if (!controller.signal.aborted) {
                        const reason = new DOMException("Signal Timed Out", "TimeoutError")
                        controller.abort(reason)
                    }
                }, ms)
                controller.signal.addEventListener("abort", () => clearTimeout(timeoutId), { once: true })
                return controller.signal
            },
            configurable: true,
            enumerable: false,
            writable: true,
        })
    }
}

function AbortSignalAny() {
    if (AbortSignal && !AbortSignal.any) {
        Object.defineProperty(AbortSignal, "any", {
            value(signals) {
                if (!Array.isArray(signals)) {
                    throw new TypeError("The provided value is not AbortSignal sequence")
                }

                const controller = new AbortController()
                const signalsArray = [...signals]

                for (const signal of signalsArray) {
                    if (signal.aborted) {
                        controller.abort(signal.reason)
                        return controller.signal
                    }
                }

                const onAbort = (e) => {
                    controller.abort(e.target.reason)
                    for (const signal of signalsArray) {
                        signal.removeEventListener("abort", onAbort)
                    }
                }
                for (const signal of signalsArray) {
                    signal.addEventListener("abort", onAbort, { once: true })
                }

                return controller.signal
            },
            configurable: true,
            enumerable: false,
            writable: true,
        })
    }
}

function WithResolvers() {
    if (!Promise.withResolvers) {
        Object.defineProperty(Promise, "withResolvers", {
            value() {
                const out = {}
                out.promise = new Promise((resolve_, reject_) => {
                    out.resolve = resolve_
                    out.reject = reject_
                })
                return out
            },
            configurable: true,
            enumerable: false,
            writable: true,
        })
    }
}

At()
HasOwn()
GroupBy()
AbortSignalTimeout()
AbortSignalAny()
WithResolvers()
