const _impl = (target, attr, fn) => {
    if (target && !(attr in target)) {
        Object.defineProperty(target, attr, {
            value: fn,
            configurable: true,
            enumerable: false,
            writable: true,
        })
    }
}

const _isIterable = (obj) => {
    return obj == null ? false : typeof obj[Symbol.iterator] === "function"
}

function object() {
    _impl(Object, "hasOwn", function (obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key)
    })

    _impl(Object, "groupBy", function (items, callback) {
        if (items == null) {
            throw new TypeError("Cannot convert undefined or null to object")
        }
        if (typeof callback !== "function") {
            throw new TypeError("callback must be a function")
        }
        const result = Object.create(null)
        let index = 0
        for (const item of items) {
            const key = callback(item, index++)
            if (!(key in result)) {
                result[key] = []
            }
            result[key].push(item)
        }
        return result
    })
}

function typedArray() {
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

    for (const type of [Array, String, Object.getPrototypeOf(Int8Array)]) {
        _impl(type.prototype, "at", at)
    }
}

function array() {
    _impl(Array.prototype, "toReversed", function () {
        return [...this].reverse()
    })
    _impl(Array.prototype, "toSorted", function (compareFn) {
        return [...this].sort(compareFn)
    })
    _impl(Array.prototype, "toSpliced", function (start, deleteCount, ...items) {
        const newArray = [...this]
        newArray.splice(start, deleteCount, ...items)
        return newArray
    })
}

function promise() {
    _impl(Promise, "withResolvers", function () {
        const out = {}
        out.promise = new Promise((resolve_, reject_) => {
            out.resolve = resolve_
            out.reject = reject_
        })
        return out
    })

    _impl(Promise, "try", function (callback, ...args) {
        return new Promise(resolve => resolve(callback(...args)))
    })
}

function abortSignal() {
    _impl(AbortSignal, "timeout", function (ms) {
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
    })

    _impl(AbortSignal, "any", function (signals) {
        if (!_isIterable(signals)) {
            throw new TypeError("The provided value is not an AbortSignal sequence")
        }
        const signalsArray = [...signals]
        if (signalsArray.some(signal => !(signal instanceof AbortSignal))) {
            throw new TypeError("The provided value is not an AbortSignal sequence")
        }

        const controller = new AbortController()
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
    })
}

object()
array()
typedArray()
promise()
abortSignal()
