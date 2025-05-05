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

                let timeoutId
                const controller = new AbortController()
                const signal = controller.signal

                const abortHandler = () => {
                    clearTimeout(timeoutId)
                    signal.removeEventListener("abort", abortHandler)
                }
                signal.addEventListener("abort", abortHandler)
                timeoutId = setTimeout(() => {
                    if (!signal.aborted) {
                        controller.abort("timeout")
                    }
                }, ms)
                return signal
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
