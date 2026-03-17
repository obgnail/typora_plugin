const { describe, it } = require("node:test")
const assert = require("node:assert")
const polyfills = require("../../plugin/global/core/polyfill.js")

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

describe("Array Change Methods Polyfill", () => {
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

    it("AbortSignal.timeout should create timed signal", async () => {
        const signal = timeout(10)

        assert.ok(signal instanceof AbortSignal)
        assert.strictEqual(signal.aborted, false)

        if (!signal.aborted) {
            await new Promise(resolve => signal.addEventListener("abort", resolve, { once: true }))
        }

        assert.strictEqual(signal.aborted, true)
        assert.ok(signal.reason instanceof DOMException)
        assert.strictEqual(signal.reason.name, "TimeoutError")
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
