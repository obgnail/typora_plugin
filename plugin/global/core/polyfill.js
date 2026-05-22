"use strict"

const __POLYFILLS__ = new Map()

const _record = (target, prop, fn) => {
  if (!__POLYFILLS__.has(target)) {
    __POLYFILLS__.set(target, {})
  }
  __POLYFILLS__.get(target)[prop] = fn
}

const _define = (target, prop, fn) => {
  if (target && !(prop in target)) {
    Object.defineProperty(target, prop, { value: fn, configurable: true, enumerable: false, writable: true })
  }
}

const _impl = (target, prop, fn) => {
  _record(target, prop, fn)
  _define(target, prop, fn)
}

const _isIterable = (obj) => {
  return obj == null ? false : typeof obj[Symbol.iterator] === "function"
}

const _isRegExp = (obj) => {
  if (obj == null) return false
  const matchSym = obj[Symbol.match]
  return matchSym !== undefined ? !!matchSym : Object.prototype.toString.call(obj) === "[object RegExp]"
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

function string() {
  _impl(String.prototype, "replaceAll", function (searchValue, replaceValue) {
    if (this == null) {
      throw new TypeError("String.prototype.replaceAll called on null or undefined")
    }
    const str = String(this)
    if (_isRegExp(searchValue)) {
      if (!searchValue.flags.includes("g")) {
        throw new TypeError("String.prototype.replaceAll called with a non-global RegExp argument")
      }
      return str.replace(searchValue, replaceValue)
    }
    const regex = new RegExp(String(searchValue).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")
    return str.replace(regex, replaceValue)
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
string()
array()
typedArray()
promise()
abortSignal()

module.exports = __POLYFILLS__
