const { describe, it } = require("node:test")
const assert = require("node:assert")
const polyfills = require("../../plugin/global/core/polyfill.js")

describe("GlobalThis Polyfills", () => {
  const { structuredClone } = polyfills.get(globalThis)
  it("clones primitive values", () => {
    assert.strictEqual(structuredClone(null), null)
    assert.strictEqual(structuredClone(undefined), undefined)
    assert.strictEqual(structuredClone(42), 42)
    assert.strictEqual(structuredClone("string"), "string")
    assert.strictEqual(structuredClone(true), true)
  })
  it("clones plain objects", () => {
    const obj = { a: 1, b: { c: 2 } }
    const cloned = structuredClone(obj)
    assert.deepStrictEqual(cloned, obj)
    assert.notStrictEqual(cloned, obj)
    assert.notStrictEqual(cloned.b, obj.b)
  })
  it("clones arrays", () => {
    const arr = [1, [2, 3], { a: 4 }]
    const cloned = structuredClone(arr)
    assert.deepStrictEqual(cloned, arr)
    assert.notStrictEqual(cloned, arr)
    assert.notStrictEqual(cloned[1], arr[1])
    assert.notStrictEqual(cloned[2], arr[2])
  })
  it("clones Date objects", () => {
    const date = new Date("2023-01-01")
    const cloned = structuredClone(date)
    assert.deepStrictEqual(cloned, date)
    assert.notStrictEqual(cloned, date)
    assert.strictEqual(cloned.getTime(), date.getTime())
  })
  it("clones RegExp objects", () => {
    const regex = /test/g
    const cloned = structuredClone(regex)
    assert.deepStrictEqual(cloned, regex)
    assert.notStrictEqual(cloned, regex)
    assert.strictEqual(cloned.source, regex.source)
    assert.strictEqual(cloned.flags, regex.flags)
  })
  it("clones Map objects", () => {
    const map = new Map([["key", { value: 1 }]])
    const cloned = structuredClone(map)
    assert.deepStrictEqual(cloned, map)
    assert.notStrictEqual(cloned, map)
    assert.notStrictEqual(cloned.get("key"), map.get("key"))
  })
  it("clones Set objects", () => {
    const set = new Set([{ value: 1 }])
    const cloned = structuredClone(set)
    assert.deepStrictEqual(cloned, set)
    assert.notStrictEqual(cloned, set)
    assert.notStrictEqual([...cloned][0], [...set][0])
  })
  it("handles circular references", () => {
    const obj = { a: 1 }
    obj.self = obj
    const cloned = structuredClone(obj)
    assert.strictEqual(cloned.a, 1)
    assert.strictEqual(cloned.self, cloned)
    assert.notStrictEqual(cloned, obj)
  })
  it("preserves prototype chain", () => {
    class Custom {
      constructor(value) {
        this.value = value
      }
    }

    const obj = new Custom(42)
    const cloned = structuredClone(obj)
    assert.strictEqual(cloned.value, 42)
    assert(cloned instanceof Custom)
    assert.notStrictEqual(cloned, obj)
  })
})

describe("Object Polyfills", () => {
  const { hasOwn, groupBy } = polyfills.get(Object)

  it("Object.hasOwn should work as polyfill", () => {
    const obj = { prop: "value" }
    assert.strictEqual(hasOwn(obj, "prop"), true)
    assert.strictEqual(hasOwn(obj, "toString"), false)
    assert.throws(() => hasOwn(null, "prop"), TypeError)
    assert.throws(() => hasOwn(undefined, "prop"), TypeError)
  })

  it("Object.groupBy should group items correctly", () => {
    const items = [
      { type: "fruit", name: "apple" },
      { type: "fruit", name: "banana" },
      { type: "vegetable", name: "carrot" },
    ]
    const grouped = groupBy(items, item => item.type)
    assert.deepStrictEqual(Object.assign({}, grouped), {
      fruit: [
        { type: "fruit", name: "apple" },
        { type: "fruit", name: "banana" },
      ],
      vegetable: [
        { type: "vegetable", name: "carrot" },
      ],
    })
  })

  it("Object.groupBy should handle edge cases", () => {
    assert.throws(() => groupBy(null, () => undefined), TypeError)
    assert.throws(() => groupBy([], "not a function"), TypeError)
    const result = groupBy([], item => item.type)
    assert.deepStrictEqual(result, Object.create(null))
  })
})

describe("String Polyfills", () => {
  const { replaceAll } = polyfills.get(String.prototype)

  it("String.prototype.replaceAll should replace all occurrences of a string", () => {
    const result = replaceAll.call("hello world, hello universe", "hello", "goodbye")
    assert.strictEqual(result, "goodbye world, goodbye universe")
  })

  it("String.prototype.replaceAll should replace all occurrences using a global RegExp", () => {
    const result = replaceAll.call("apple banana apple", /apple/g, "orange")
    assert.strictEqual(result, "orange banana orange")
  })

  it("String.prototype.replaceAll should throw TypeError if regex is not global", () => {
    const str = "a-b-c"
    assert.throws(() => replaceAll.call(str, /-/), TypeError)
    assert.throws(() => replaceAll.call(str, /-/i), TypeError)
  })

  it("String.prototype.replaceAll should accept a replacer function", () => {
    const str = "123-456"
    const result = replaceAll.call(str, /\d/g, (match) => (parseInt(match) * 2).toString())
    assert.strictEqual(result, "246-81012")

    const str2 = "a-a-a"
    let count = 0
    const result2 = replaceAll.call(str2, "a", () => String(++count))
    assert.strictEqual(result2, "1-2-3")
  })

  it("String.prototype.replaceAll should handle special replacement patterns", () => {
    const str = "abc"
    assert.strictEqual(replaceAll.call(str, "b", "$$"), "a$c")
    assert.strictEqual(replaceAll.call(str, "b", "[$&]"), "a[b]c")
  })

  it("String.prototype.replaceAll should handle edge cases", () => {
    assert.throws(() => replaceAll.call(null, "a", "b"), TypeError)
    assert.throws(() => replaceAll.call(undefined, "a", "b"), TypeError)
    assert.strictEqual(replaceAll.call("abc", "", "-"), "-a-b-c-")
  })
})

describe("TypedArray, String and Array at() Polyfill", () => {
  const { at: arrayAt } = polyfills.get(Array.prototype)
  const { at: stringAt } = polyfills.get(String.prototype)
  const { at: typedArrayAt } = polyfills.get(Object.getPrototypeOf(Int8Array).prototype)

  it("Array.prototype.at should work", () => {
    const arr = ["a", "b", "c", "d"]
    assert.strictEqual(arrayAt.call(arr, 0), "a")
    assert.strictEqual(arrayAt.call(arr, 2), "c")
    assert.strictEqual(arrayAt.call(arr, -1), "d")
    assert.strictEqual(arrayAt.call(arr, -4), "a")
    assert.strictEqual(arrayAt.call(arr, 100), undefined)
  })

  it("String.prototype.at should work similarly", () => {
    const str = "hello"
    assert.strictEqual(stringAt.call(str, 0), "h")
    assert.strictEqual(stringAt.call(str, -1), "o")
    assert.strictEqual(stringAt.call(str, 10), undefined)
  })

  it("TypedArray.prototype.at should work", () => {
    const arr = new Int8Array([1, 2, 3, 4])
    assert.strictEqual(typedArrayAt.call(arr, 0), 1)
    assert.strictEqual(typedArrayAt.call(arr, -1), 4)
    assert.strictEqual(typedArrayAt.call(arr, 10), undefined)
  })
})

describe("Array Polyfills", () => {
  const { toReversed, toSorted, toSpliced } = polyfills.get(Array.prototype)

  it("Array.prototype.toReversed should return reversed copy", () => {
    const arr = [1, 2, 3]
    const reversed = toReversed.call(arr)
    assert.deepStrictEqual(reversed, [3, 2, 1])
    assert.deepStrictEqual(arr, [1, 2, 3])
  })

  it("Array.prototype.toSorted should return sorted copy", () => {
    const arr = [3, 1, 2]
    const sorted = toSorted.call(arr)
    assert.deepStrictEqual(sorted, [1, 2, 3])
    assert.deepStrictEqual(arr, [3, 1, 2])
  })

  it("Array.prototype.toSorted should accept compare function", () => {
    const arr = [1, 3, 2]
    const sorted = toSorted.call(arr, (a, b) => b - a)
    assert.deepStrictEqual(sorted, [3, 2, 1])
  })

  it("Array.prototype.toSpliced should return spliced copy", () => {
    const arr = [1, 2, 3, 4]
    const spliced = toSpliced.call(arr, 1, 2, "a", "b")
    assert.deepStrictEqual(spliced, [1, "a", "b", 4])
    assert.deepStrictEqual(arr, [1, 2, 3, 4])
  })
})

describe("Promise Polyfills", () => {
  const { withResolvers, try: promiseTry } = polyfills.get(Promise)

  it("Promise.withResolvers should create resolvable promise", async () => {
    const { promise, resolve } = withResolvers()
    resolve("test value")
    const result = await promise
    assert.strictEqual(result, "test value")
  })

  it("Promise.withResolvers should handle rejection", async () => {
    const { promise, reject } = withResolvers()
    const error = new Error("test error")
    reject(error)
    await assert.rejects(promise, error)
  })

  it("Promise.try should execute function and wrap in promise", async () => {
    const result = await promiseTry(() => "success")
    assert.strictEqual(result, "success")
  })

  it("Promise.try should handle thrown errors", async () => {
    const error = new Error("thrown error")
    await assert.rejects(promiseTry(() => {
      throw error
    }), error)
  })

  it("Promise.try should pass arguments", async () => {
    const result = await promiseTry((a, b) => a + b, 2, 3)
    assert.strictEqual(result, 5)
  })
})

describe("AbortSignal Polyfills", () => {
  const { timeout, any } = polyfills.get(AbortSignal)

  it("AbortSignal.timeout should create timed signal", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    const signal = timeout(50)
    assert.ok(signal instanceof AbortSignal)
    assert.strictEqual(signal.aborted, false)
    t.mock.timers.tick(50)
    assert.strictEqual(signal.aborted, true)
    assert.ok(signal.reason instanceof DOMException)
    assert.strictEqual(signal.reason.name, "TimeoutError")
    t.mock.timers.reset()
  })

  it("AbortSignal.timeout should validate input", () => {
    assert.throws(() => timeout(-1), TypeError)
    assert.throws(() => timeout(Infinity), TypeError)
    assert.throws(() => timeout("invalid"), TypeError)
  })

  it("AbortSignal.any should combine signals", () => {
    const controller1 = new AbortController()
    const controller2 = new AbortController()

    const signal = any([controller1.signal, controller2.signal])

    assert.ok(signal instanceof AbortSignal)
    assert.strictEqual(signal.aborted, false)

    controller1.abort("reason 1")

    assert.strictEqual(signal.aborted, true)
    assert.strictEqual(signal.reason, "reason 1")
  })

  it("AbortSignal.any should handle already aborted signals", () => {
    const controller1 = new AbortController()
    const controller2 = new AbortController()
    controller2.abort("already aborted")

    const signal = any([controller1.signal, controller2.signal])

    assert.strictEqual(signal.aborted, true)
    assert.strictEqual(signal.reason, "already aborted")
  })

  it("AbortSignal.any should validate input", () => {
    assert.throws(() => any("not iterable"), TypeError)
    assert.throws(() => any([null]), TypeError)
    assert.throws(() => any([{}]), TypeError)
  })
})
