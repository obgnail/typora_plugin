const { describe, it } = require("node:test")
const assert = require("node:assert")
const fs = require("fs-extra")
const path = require("path")
const os = require("os")
const { setTimeout: delay } = require("node:timers/promises")
const utils = require("./mocks/utils.mock.js")

describe("String, Parsing & Markdown Utilities", () => {
    describe("utils.compareVersion", () => {
        it("compares equal versions", () => {
            assert.strictEqual(utils.compareVersion("1.0.0", "1.0.0"), 0)
            assert.strictEqual(utils.compareVersion("2.5", "2.5.0"), 0)
            assert.strictEqual(utils.compareVersion("", ""), 0)
        })

        it("compares greater versions", () => {
            assert.strictEqual(utils.compareVersion("2.0.0", "1.0.0"), 1)
            assert.strictEqual(utils.compareVersion("1.2.0", "1.1.9"), 1)
            assert.strictEqual(utils.compareVersion("1.0.1", "1.0.0"), 1)
        })

        it("compares lesser versions", () => {
            assert.strictEqual(utils.compareVersion("1.0.0", "2.0.0"), -1)
            assert.strictEqual(utils.compareVersion("1.1.9", "1.2.0"), -1)
            assert.strictEqual(utils.compareVersion("1.0.0", "1.0.1"), -1)
        })

        it("handles different length versions", () => {
            assert.strictEqual(utils.compareVersion("1.0", "1.0.0"), 0)
            assert.strictEqual(utils.compareVersion("1.0.0", "1.0"), 0)
            assert.strictEqual(utils.compareVersion("1.0.1", "1.0"), 1)
            assert.strictEqual(utils.compareVersion("1.0", "1.0.1"), -1)
        })

        it("handles null/undefined versions", () => {
            assert.strictEqual(utils.compareVersion(null, "1.0.0"), -1)
            assert.strictEqual(utils.compareVersion("1.0.0", null), 1)
            assert.strictEqual(utils.compareVersion(null, null), 0)
            assert.strictEqual(utils.compareVersion(undefined, "1.0.0"), -1)
            assert.strictEqual(utils.compareVersion("1.0.0", undefined), 1)
            assert.strictEqual(utils.compareVersion(undefined, undefined), 0)
        })

        it("handles empty strings", () => {
            assert.strictEqual(utils.compareVersion("", "1.0.0"), -1)
            assert.strictEqual(utils.compareVersion("1.0.0", ""), 1)
            assert.strictEqual(utils.compareVersion("", ""), 0)
        })

        it("ignores non-numeric parts", () => {
            assert.strictEqual(utils.compareVersion("1.0.0-alpha", "1.0.0"), 0)
            assert.strictEqual(utils.compareVersion("1.0.0", "1.0.0-alpha"), 0)
        })
    })

    describe("utils.asyncReplaceAll", () => {
        it("replaces all matches with async function", async () => {
            const content = "hello world hello universe"
            const regex = /hello/g
            const replaceFunc = async (match) => match.toUpperCase()
            const result = await utils.asyncReplaceAll(content, regex, replaceFunc)
            assert.strictEqual(result, "HELLO world HELLO universe")
        })

        it("handles multiple matches", async () => {
            const content = "a1b2c3"
            const regex = /\d/g
            const replaceFunc = async (match) => String(parseInt(match) * 10)
            const result = await utils.asyncReplaceAll(content, regex, replaceFunc)
            assert.strictEqual(result, "a10b20c30")
        })

        it("preserves unmatched content", async () => {
            const content = "hello world"
            const regex = /hello/g
            const replaceFunc = async (match) => "hi"
            const result = await utils.asyncReplaceAll(content, regex, replaceFunc)
            assert.strictEqual(result, "hi world")
        })

        it("throws on non-global regex", async () => {
            const content = "hello world"
            const regex = /hello/  // not global
            const replaceFunc = async (match) => "hi"
            assert.throws(() => utils.asyncReplaceAll(content, regex, replaceFunc))
        })

        it("handles empty string", async () => {
            const content = ""
            const regex = /test/g
            const replaceFunc = async (match) => "replaced"
            const result = await utils.asyncReplaceAll(content, regex, replaceFunc)
            assert.strictEqual(result, "")
        })

        it("passes all arguments to replace function", async () => {
            const content = "test123"
            const regex = /test(\d+)/g
            const args = []
            const replaceFunc = async (...arg) => {
                args.push(...arg)
                return "replaced"
            }
            await utils.asyncReplaceAll(content, regex, replaceFunc)
            assert.strictEqual(args.length, 4) // match, group1, index, input
            assert.strictEqual(args[0], "test123")
            assert.strictEqual(args[1], "123")
            assert.strictEqual(args[2], 0)
            assert.strictEqual(args[3], "test123")
        })
    })

    describe("utils.splitFrontMatter", () => {
        it("splits content with front matter", () => {
            const content = `---\ntitle: Test\ndate: 2023-01-01\n---\n# Content here`
            const result = utils.splitFrontMatter(content)
            assert.strictEqual(result.yamlObject.title, "Test")
            assert.strictEqual(result.yamlObject.date.getTime(), 1672531200000)
            assert.strictEqual(result.remainContent, "# Content here")
            assert.strictEqual(result.yamlLineCount, 4)
        })

        it("handles content without front matter", () => {
            const content = "# Just content\n\nNo front matter here."
            const result = utils.splitFrontMatter(content)
            assert.strictEqual(result.yamlObject, null)
            assert.strictEqual(result.remainContent, content)
            assert.strictEqual(result.yamlLineCount, 0)
        })

        it("handles content starting with whitespace", () => {
            const content = `   \n---\ntitle: Test\n---\n# Content`
            const result = utils.splitFrontMatter(content)
            assert.strictEqual(result.yamlObject.title, "Test")
            assert.strictEqual(result.remainContent, "# Content")
        })

        it("handles incomplete front matter", () => {
            const content = `---\ntitle: Test\n# No closing delimiter`
            const result = utils.splitFrontMatter(content)
            assert.strictEqual(result.yamlObject, null)
            assert.strictEqual(result.remainContent, content)
            assert.strictEqual(result.yamlLineCount, 0)
        })

        it("handles empty front matter", () => {
            const content = `---\n---\n# Content`
            const result = utils.splitFrontMatter(content)
            assert.deepStrictEqual(result.yamlObject, {})
            assert.strictEqual(result.remainContent, "# Content")
            assert.strictEqual(result.yamlLineCount, 2)
        })

        it("handles invalid YAML gracefully", (t) => {
            const content = `---\ninvalid: yaml: content: [unclosed\n---\n# Content`
            t.mock.method(console, "error", () => undefined)
            const result = utils.splitFrontMatter(content)
            assert.strictEqual(console.error.mock.calls.length, 1)
            assert.strictEqual(result.yamlObject, null)
            assert.strictEqual(result.remainContent, "# Content")
        })

        it("counts lines correctly", () => {
            const content = `---\na: 1\nb: 2\nc: 3\n---\n# Content`
            const result = utils.splitFrontMatter(content)
            assert.strictEqual(result.yamlLineCount, 5)
        })
    })

    describe("utils.markdownInlineStyleToHTML", () => {
        const dir = "/root/"

        it("converts basic markdown inline styles to HTML", () => {
            const input = "This is **bold** and *italic* text"
            const result = utils.markdownInlineStyleToHTML(input, dir)
            assert.ok(result.includes("<strong>bold</strong>"))
            assert.ok(result.includes("<em>italic</em>"))
        })

        it("handles code spans", () => {
            const input = "Use `console.log()` for debugging"
            const result = utils.markdownInlineStyleToHTML(input, dir)
            assert.ok(result.includes("<code>console.log()</code>"))
        })

        it("handles links", () => {
            const input = "Visit [GitHub](https://github.com)"
            const result = utils.markdownInlineStyleToHTML(input, dir)
            assert.ok(result.includes('<a href="https://github.com">GitHub</a>'))
        })

        it("handles images", () => {
            const input = "![Alt text](image.png)"
            const result = utils.markdownInlineStyleToHTML(input, dir)
            assert.ok(/<img alt="Alt text" src=".+?image\.png">/.test(result))
        })

        it("handles strikethrough", () => {
            const input = "~~deleted text~~"
            const result = utils.markdownInlineStyleToHTML(input, dir)
            assert.ok(result.includes("<del>deleted text</del>"))
        })

        it("handles mixed styles", () => {
            const input = "**bold** *italic* `code` [link](url)"
            const result = utils.markdownInlineStyleToHTML(input, dir)
            assert.ok(result.includes("<strong>bold</strong>"))
            assert.ok(result.includes("<em>italic</em>"))
            assert.ok(result.includes("<code>code</code>"))
            assert.ok(result.includes('<a href="url">link</a>'))
        })

        it("handles empty string", () => {
            const input = ""
            const result = utils.markdownInlineStyleToHTML(input, dir)
            assert.strictEqual(result, "")
        })

        it("handles plain text without markdown", () => {
            const input = "Just plain text"
            const result = utils.markdownInlineStyleToHTML(input, dir)
            assert.strictEqual(result, "Just plain text")
        })
    })
})

describe("Object & Array Utilities", () => {
    describe("utils.merge", () => {
        it("merges simple objects", () => {
            const source = { a: 1, b: 2 }
            const other = { b: 3, c: 4 }
            const result = utils.merge(source, other)
            assert.deepStrictEqual(result, { a: 1, b: 3, c: 4 })
        })

        it("merges nested objects", () => {
            const source = { a: { x: 1, y: 2 } }
            const other = { a: { y: 3, z: 4 } }
            const result = utils.merge(source, other)
            assert.deepStrictEqual(result, { a: { x: 1, y: 3, z: 4 } })
        })

        it("replaces arrays", () => {
            const source = { a: [1, 2] }
            const other = { a: [3, 4] }
            const result = utils.merge(source, other)
            assert.deepStrictEqual(result, { a: [3, 4] })
        })

        it("handles undefined values", () => {
            const source = { a: 1, b: 2 }
            const result = utils.merge(source, undefined)
            assert.deepStrictEqual(result, { a: 1, b: 2 })
        })

        it("handles null values", () => {
            const source = { a: 1 }
            const other = { b: null }
            const result = utils.merge(source, other)
            assert.deepStrictEqual(result, { a: 1, b: null })
        })
    })

    describe("utils.update", () => {
        it("merges objects with existing keys", () => {
            const source = { a: 1, b: 2, c: 3 }
            const other = { a: 10, b: 20 }
            const result = utils.update(source, other)
            assert.deepStrictEqual(result, { a: 10, b: 20, c: 3 })
        })

        it("does not add new keys", () => {
            const source = { a: 1, b: 2 }
            const other = { a: 10, d: 30 }
            const result = utils.update(source, other)
            assert.deepStrictEqual(result, { a: 10, b: 2 })
        })

        it("handles nested objects", () => {
            const source = { a: { x: 1, y: 2 }, b: 3 }
            const other = { a: { x: 10 } }
            const result = utils.update(source, other)
            assert.deepStrictEqual(result, { a: { x: 10, y: 2 }, b: 3 })
        })

        it("replaces arrays", () => {
            const source = { a: [1, 2, 3], b: 4 }
            const other = { a: [4, 5] }
            const result = utils.update(source, other)
            assert.deepStrictEqual(result, { a: [4, 5], b: 4 })
        })

        it("handles null/undefined other", () => {
            const source = { a: 1, b: 2 }
            assert.deepStrictEqual(utils.update(source, undefined), source)
            assert.deepStrictEqual(utils.update(source, { a: 10 }), { a: 10, b: 2 })
        })

        // it.todo("handles null target", () => {
        //     const source = { a: 1, b: 2 }
        //     assert.deepStrictEqual(utils.update(source, null), source)
        // })
        //
        // it.todo("handles non-object inputs", () => {
        //     assert.strictEqual(utils.update(null, { a: 1 }), { a: 1 })
        //     assert.strictEqual(utils.update(undefined, { a: 1 }), { a: 1 })
        //     assert.strictEqual(utils.update("string", { a: 1 }), { a: 1 })
        // })
    })

    describe("utils.minimize", () => {
        it("removes properties matching defaults", () => {
            const source = { a: 1, b: 2, c: 3 }
            const defaults = { a: 1, b: 10 }
            const result = utils.minimize(source, defaults)
            assert.deepStrictEqual(result, { b: 2, c: 3 })
        })

        it("handles nested objects", () => {
            const source = { a: { x: 1, y: 2 }, b: 3 }
            const defaults = { a: { x: 1 } }
            const result = utils.minimize(source, defaults)
            assert.deepStrictEqual(result, { a: { y: 2 }, b: 3 })
        })

        it("removes null values by default", () => {
            const source = { a: 1, b: null, c: 3 }
            const defaults = {}
            const result = utils.minimize(source, defaults)
            assert.deepStrictEqual(result, { a: 1, c: 3 })
        })

        it("removes undefined values by default", () => {
            const source = { a: 1, b: undefined, c: 3 }
            const defaults = {}
            const result = utils.minimize(source, defaults)
            assert.deepStrictEqual(result, { a: 1, c: 3 })
        })

        it("respects allowNull option", () => {
            const source = { a: 1, b: null, c: 3 }
            const defaults = {}
            const result = utils.minimize(source, defaults, { allowNull: true })
            assert.deepStrictEqual(result, { a: 1, b: null, c: 3 })
        })

        it("respects allowUndefined option", () => {
            const source = { a: 1, b: undefined, c: 3 }
            const defaults = {}
            const result = utils.minimize(source, defaults, { allowUndefined: true })
            assert.deepStrictEqual(result, { a: 1, c: 3 })
        })

        it("removes empty arrays by default", () => {
            const source = { a: [], b: [1, 2], c: 3 }
            const defaults = {}
            const result = utils.minimize(source, defaults)
            assert.deepStrictEqual(result, { b: [1, 2], c: 3 })
        })

        it("respects allowEmptyArray option", () => {
            const source = { a: [], b: [1, 2], c: 3 }
            const defaults = {}
            const result = utils.minimize(source, defaults, { allowEmptyArray: true })
            assert.deepStrictEqual(result, { a: [], b: [1, 2], c: 3 })
        })

        it("removes empty objects by default", () => {
            const source = { a: {}, b: { x: 1 }, c: 3 }
            const defaults = {}
            const result = utils.minimize(source, defaults)
            assert.deepStrictEqual(result, { b: { x: 1 }, c: 3 })
        })

        it("respects allowEmptyObject option", () => {
            const source = { a: {}, b: { x: 1 }, c: 3 }
            const defaults = {}
            const result = utils.minimize(source, defaults, { allowEmptyObject: true })
            assert.deepStrictEqual(result, { a: {}, b: { x: 1 }, c: 3 })
        })
    })

    describe("utils.pick", () => {
        it("picks specified attributes", () => {
            const obj = { a: 1, b: 2, c: 3, d: 4 }
            const result = utils.pick(obj, ["a", "c"])
            assert.deepStrictEqual(result, { a: 1, c: 3 })
        })

        it("handles undefined values", () => {
            const obj = { a: 1, b: undefined, c: 3 }
            const result = utils.pick(obj, ["a", "b", "c"])
            assert.deepStrictEqual(result, { a: 1, c: 3 })
        })

        it("handles non-existent keys", () => {
            const obj = { a: 1, b: 2 }
            const result = utils.pick(obj, ["a", "x", "y"])
            assert.deepStrictEqual(result, { a: 1 })
        })

        it("handles null/undefined input", () => {
            assert.deepStrictEqual(utils.pick(null, ["a"]), {})
            assert.deepStrictEqual(utils.pick(undefined, ["a"]), {})
            assert.deepStrictEqual(utils.pick("string", ["a"]), {})
        })

        it("handles empty attributes array", () => {
            const obj = { a: 1, b: 2 }
            const result = utils.pick(obj, [])
            assert.deepStrictEqual(result, {})
        })
    })

    describe("utils.pickBy", () => {
        it("picks attributes based on predicate", () => {
            const obj = { a: 1, b: 2, c: 3, d: 4 }
            const result = utils.pickBy(obj, (value) => value % 2 === 0)
            assert.deepStrictEqual(result, { b: 2, d: 4 })
        })

        it("passes key and object to predicate", () => {
            const obj = { a: 1, b: 2, c: 3 }
            const keys = []
            const result = utils.pickBy(obj, (value, key) => {
                keys.push(key)
                return key === "b"
            })
            assert.deepStrictEqual(result, { b: 2 })
            assert.deepStrictEqual(keys.sort(), ["a", "b", "c"])
        })

        it("handles null/undefined input", () => {
            assert.deepStrictEqual(utils.pickBy(null, () => true), {})
            assert.deepStrictEqual(utils.pickBy(undefined, () => true), {})
            assert.deepStrictEqual(utils.pickBy("string", () => true), {})
        })

        it("handles non-function predicate", () => {
            const obj = { a: 1, b: 2 }
            assert.deepStrictEqual(utils.pickBy(obj, null), {})
            assert.deepStrictEqual(utils.pickBy(obj, "not a function"), {})
        })

        it("handles empty object", () => {
            const result = utils.pickBy({}, (value) => true)
            assert.deepStrictEqual(result, {})
        })
    })

    describe("utils.nestedPropertyHelpers", () => {
        it("has: checks nested properties", () => {
            const obj = { a: { b: { c: 1 } } }
            assert.strictEqual(utils.nestedPropertyHelpers.has(obj, "a.b.c"), true)
            assert.strictEqual(utils.nestedPropertyHelpers.has(obj, "a.b.d"), false)
            assert.strictEqual(utils.nestedPropertyHelpers.has(obj, "x.y.z"), false)
        })

        it("get: retrieves nested properties", () => {
            const obj = { a: { b: { c: 1 } } }
            assert.strictEqual(utils.nestedPropertyHelpers.get(obj, "a.b.c"), 1)
            assert.strictEqual(utils.nestedPropertyHelpers.get(obj, "a.b.d"), undefined)
        })

        it("set: updates nested properties", () => {
            const obj = { a: { b: {} } }
            utils.nestedPropertyHelpers.set(obj, "a.b.c", 42)
            assert.strictEqual(obj.a.b.c, 42)
        })

        it("push: adds to nested arrays", () => {
            const obj = { a: { b: [] } }
            utils.nestedPropertyHelpers.push(obj, "a.b", 1)
            utils.nestedPropertyHelpers.push(obj, "a.b", 2)
            assert.deepStrictEqual(obj.a.b, [1, 2])
        })
    })

    describe("utils.chunk", () => {
        it("splits array into chunks", () => {
            const array = [1, 2, 3, 4, 5, 6, 7]
            const chunks = utils.chunk(array, 3)
            assert.deepStrictEqual(chunks, [[1, 2, 3], [4, 5, 6], [7]])
        })

        it("uses default size", () => {
            const array = Array.from({ length: 25 }, (_, i) => i)
            const chunks = utils.chunk(array)
            assert.strictEqual(chunks.length, 3)
            assert.strictEqual(chunks[0].length, 10)
            assert.strictEqual(chunks[1].length, 10)
            assert.strictEqual(chunks[2].length, 5)
        })
    })

    describe("utils.zip", () => {
        it("zips arrays", () => {
            const a = [1, 2, 3]
            const b = ["a", "b", "c"]
            const c = [true, false, true]
            const result = utils.zip(a, b, c)
            assert.deepStrictEqual(result, [
                [1, "a", true],
                [2, "b", false],
                [3, "c", true],
            ])
        })

        it("handles different lengths", () => {
            const a = [1, 2, 3]
            const b = ["a", "b"]
            const result = utils.zip(a, b)
            assert.deepStrictEqual(result, [[1, "a"], [2, "b"]])
        })

        it("handles empty arrays", () => {
            const result = utils.zip()
            assert.deepStrictEqual(result, [])
        })
    })

    describe("clone utilities", () => {
        describe("utils.cloneDeep", () => {
            it("clones primitive values", () => {
                assert.strictEqual(utils.cloneDeep(null), null)
                assert.strictEqual(utils.cloneDeep(undefined), undefined)
                assert.strictEqual(utils.cloneDeep(42), 42)
                assert.strictEqual(utils.cloneDeep("string"), "string")
                assert.strictEqual(utils.cloneDeep(true), true)
            })

            it("clones plain objects", () => {
                const obj = { a: 1, b: { c: 2 } }
                const cloned = utils.cloneDeep(obj)
                assert.deepStrictEqual(cloned, obj)
                assert.notStrictEqual(cloned, obj)
                assert.notStrictEqual(cloned.b, obj.b)
            })

            it("clones arrays", () => {
                const arr = [1, [2, 3], { a: 4 }]
                const cloned = utils.cloneDeep(arr)
                assert.deepStrictEqual(cloned, arr)
                assert.notStrictEqual(cloned, arr)
                assert.notStrictEqual(cloned[1], arr[1])
                assert.notStrictEqual(cloned[2], arr[2])
            })

            it("clones Date objects", () => {
                const date = new Date("2023-01-01")
                const cloned = utils.cloneDeep(date)
                assert.deepStrictEqual(cloned, date)
                assert.notStrictEqual(cloned, date)
                assert.strictEqual(cloned.getTime(), date.getTime())
            })

            it("clones RegExp objects", () => {
                const regex = /test/g
                const cloned = utils.cloneDeep(regex)
                assert.deepStrictEqual(cloned, regex)
                assert.notStrictEqual(cloned, regex)
                assert.strictEqual(cloned.source, regex.source)
                assert.strictEqual(cloned.flags, regex.flags)
            })

            it("clones Map objects", () => {
                const map = new Map([["key", { value: 1 }]])
                const cloned = utils.cloneDeep(map)
                assert.deepStrictEqual(cloned, map)
                assert.notStrictEqual(cloned, map)
                assert.notStrictEqual(cloned.get("key"), map.get("key"))
            })

            it("clones Set objects", () => {
                const set = new Set([{ value: 1 }])
                const cloned = utils.cloneDeep(set)
                assert.deepStrictEqual(cloned, set)
                assert.notStrictEqual(cloned, set)
                assert.notStrictEqual([...cloned][0], [...set][0])
            })

            it("handles circular references", () => {
                const obj = { a: 1 }
                obj.self = obj
                const cloned = utils.cloneDeep(obj)
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
                const cloned = utils.cloneDeep(obj)
                assert.strictEqual(cloned.value, 42)
                assert(cloned instanceof Custom)
                assert.notStrictEqual(cloned, obj)
            })
        })

        describe("utils.naiveCloneDeep", () => {
            it("clones primitive values", () => {
                assert.strictEqual(utils.naiveCloneDeep(null), null)
                assert.strictEqual(utils.naiveCloneDeep(undefined), undefined)
                assert.strictEqual(utils.naiveCloneDeep(42), 42)
                assert.strictEqual(utils.naiveCloneDeep("string"), "string")
            })

            it("clones plain objects", () => {
                const obj = { a: 1, b: { c: 2 } }
                const cloned = utils.naiveCloneDeep(obj)
                assert.deepStrictEqual(cloned, obj)
                assert.notStrictEqual(cloned, obj)
                assert.notStrictEqual(cloned.b, obj.b)
            })

            it("clones arrays", () => {
                const arr = [1, [2, 3], { a: 4 }]
                const cloned = utils.naiveCloneDeep(arr)
                assert.deepStrictEqual(cloned, arr)
                assert.notStrictEqual(cloned, arr)
                assert.notStrictEqual(cloned[1], arr[1])
                assert.notStrictEqual(cloned[2], arr[2])
            })

            it("does not handle circular references (throws error)", () => {
                const obj = { a: 1 }
                obj.self = obj
                assert.throws(() => utils.naiveCloneDeep(obj))
            })
        })
    })
})

describe("Function, Timing & Flow Control Utilities", () => {
    describe("utils.debounce", () => {
        it("delays function execution", async () => {
            let count = 0
            const debouncedFn = utils.debounce(() => ++count, 50)

            const promise = debouncedFn()
            assert.strictEqual(count, 0, "Function should not be called immediately")
            assert.strictEqual(await promise, 1, "Function should be called after delay")
        })

        it("handles async functions", async () => {
            const debouncedFn = utils.debounce(async () => {
                await delay(10)
                return 42
            }, 30)

            const promise = debouncedFn()
            assert.strictEqual(await promise, 42, "Should return async function result")
        })

        it("cancels previous calls", async () => {
            let count = 0
            const debouncedFn = utils.debounce(() => ++count, 50)

            const promise1 = debouncedFn()
            const promise2 = debouncedFn()
            const promise3 = debouncedFn()
            assert.equal(promise1, promise2)
            assert.equal(promise1, promise3)
            assert.strictEqual(await promise1, 1, "Function should only be called once")

            const newPromise = debouncedFn()
            assert.notEqual(promise1, newPromise)
            assert.strictEqual(await newPromise, 2)
        })
    })

    describe("utils.throttle", () => {
        it("limits function execution rate", async () => {
            let count = 0
            const throttledFn = utils.throttle(() => ++count, 50)

            assert.strictEqual(throttledFn(), 1, "Function should be called immediately")
            assert.strictEqual(throttledFn(), 1, "Function should not be called again within delay")

            await delay(60)
            assert.strictEqual(throttledFn(), 2, "Function should be called after delay")
        })

        it("handles async functions", async () => {
            const throttledFn = utils.throttle(async () => {
                await delay(10)
                return 42
            }, 30)

            assert.strictEqual(await throttledFn(), 42, "Should return async function result")
        })
    })

    describe("utils.once", () => {
        it("calls function only once", () => {
            let count = 0
            const onceFn = utils.once(() => count++)
            onceFn()
            onceFn()
            onceFn()
            assert.strictEqual(count, 1, "Function should only be called once")
        })

        it("caches the result", () => {
            let count = 0
            const onceFn = utils.once(() => {
                count++
                return 42
            })

            const result1 = onceFn()
            const result2 = onceFn()
            assert.strictEqual(count, 1)
            assert.strictEqual(result1, 42)
            assert.strictEqual(result2, 42)
        })

        it("handles async functions", async () => {
            let count = 0
            const onceFn = utils.once(async () => {
                count++
                return 42
            })

            const result1 = await onceFn()
            const result2 = await onceFn()
            assert.strictEqual(count, 1)
            assert.strictEqual(result1, 42)
            assert.strictEqual(result2, 42)
        })
    })

    describe("utils.memorize", () => {
        it("caches based on arguments", () => {
            let count = 0
            const memoizedFn = utils.memorize((a, b) => {
                count++
                return a + b
            })

            const result1 = memoizedFn(1, 2)
            const result2 = memoizedFn(1, 2)
            const result3 = memoizedFn(2, 3)
            assert.strictEqual(count, 2, "Function should be called twice for different arguments")
            assert.strictEqual(result1, 3)
            assert.strictEqual(result2, 3)
            assert.strictEqual(result3, 5)
        })

        it("handles object arguments", () => {
            let count = 0
            const memoizedFn = utils.memorize((obj) => {
                count++
                return obj.value
            })

            const result1 = memoizedFn({ value: 1 })
            const result2 = memoizedFn({ value: 1 })
            assert.strictEqual(count, 1, "Different object references should use cache")
            assert.strictEqual(result1, 1)
            assert.strictEqual(result2, 1)
        })
    })

    describe("utils.memoizeLimited", () => {
        it("limits cache size", () => {
            let count = 0
            const memoizedFn = utils.memoizeLimited((x) => {
                count++
                return x * 2
            }, 2)

            memoizedFn(1)
            memoizedFn(2)
            memoizedFn(3)
            memoizedFn(1) // Should call again because cache is full
            assert.strictEqual(count, 4, "Should call function when cache is full")
        })

        it("updates LRU order", () => {
            let count = 0
            const memoizedFn = utils.memoizeLimited((x) => {
                count++
                return x * 2
            }, 2)

            memoizedFn(1)
            memoizedFn(2)
            memoizedFn(1) // Updates LRU order
            memoizedFn(3) // Evicts key 2
            memoizedFn(2) // Should call again
            assert.strictEqual(count, 4, "Should evict least recently used item")
        })
    })

    describe("utils.oneShot", () => {
        it("creates arm and fire functions", () => {
            const [arm, fire] = utils.oneShot()
            assert.strictEqual(typeof arm, "function")
            assert.strictEqual(typeof fire, "function")
        })

        it("executes function only once when armed", () => {
            const [arm, fire] = utils.oneShot()
            let count = 0
            arm(() => count++)

            assert.strictEqual(fire(), 0)
            assert.strictEqual(count, 1)
            assert.strictEqual(fire(), undefined)
            assert.strictEqual(count, 1)
        })

        it("returns undefined when not armed", () => {
            const [arm, fire] = utils.oneShot()
            assert.strictEqual(fire(), undefined)

            arm(() => 42)
            assert.strictEqual(fire(), 42)
            assert.strictEqual(fire(), undefined)
        })

        it("passes arguments to fired function", () => {
            const [arm, fire] = utils.oneShot()
            const result = []
            arm((...args) => result.push(...args))

            fire(1, 2, 3)
            assert.deepStrictEqual(result, [1, 2, 3])
        })

        it("allows rearming after firing", () => {
            const [arm, fire] = utils.oneShot()
            let count = 0
            arm(() => count++)

            fire()
            assert.strictEqual(count, 1)

            arm(() => count++)
            fire()
            assert.strictEqual(count, 2)
        })
    })

    describe("utils.createConsecutiveAction", () => {
        const onInsufficient = (currentCount, threshold) => undefined

        it("requires onConfirmed callback", () => {
            assert.throws(() => utils.createConsecutiveAction({ onInsufficient }), Error)
        })

        it("creates consecutive action with default options", () => {
            let confirmed = false
            const action = utils.createConsecutiveAction({
                onInsufficient,
                onConfirmed: () => confirmed = true
            })
            assert.strictEqual(typeof action, "function")
            assert.strictEqual(confirmed, false)
        })

        it("confirms after threshold calls within time window", async () => {
            let confirmed = false
            const action = utils.createConsecutiveAction({
                threshold: 3,
                timeWindow: 500,
                onInsufficient,
                onConfirmed: () => confirmed = true
            })

            action()
            action()
            assert.strictEqual(confirmed, false)
            await delay(100)
            action()
            assert.strictEqual(confirmed, true)
        })

        it("resets when time window expires", async () => {
            let confirmed = false
            const action = utils.createConsecutiveAction({
                threshold: 3,
                timeWindow: 100,
                onInsufficient,
                onConfirmed: () => confirmed = true
            })

            action()
            action()
            await delay(150)
            action()
            assert.strictEqual(confirmed, false)
        })

        it("respects getIdentifier for different actions", () => {
            const results = []
            const action = utils.createConsecutiveAction({
                threshold: 2,
                timeWindow: 1000,
                onInsufficient,
                getIdentifier: (id) => id,
                onConfirmed: (id) => results.push(id)
            })

            action("actionA")
            action("actionB")
            action("actionA")
            action("actionB")
            assert.deepStrictEqual(results, [])

            action("action1")
            action("action1")
            assert.deepStrictEqual(results, ["action1"])

            action("action2")
            assert.deepStrictEqual(results, ["action1"])
            action("action2")
            assert.deepStrictEqual(results, ["action1", "action2"])
        })

        it("handles shouldReset callback", () => {
            let confirmed = false
            const action = utils.createConsecutiveAction({
                threshold: 2,
                timeWindow: 1000,
                onInsufficient,
                shouldReset: (value) => value === "reset",
                onConfirmed: () => confirmed = true
            })

            action()
            action("reset")
            assert.strictEqual(confirmed, false)
        })

        it("handles shouldConfirm callback", () => {
            let confirmed = false
            const action = utils.createConsecutiveAction({
                threshold: 2,
                timeWindow: 1000,
                onInsufficient,
                shouldConfirm: (value) => value === "confirm",
                onConfirmed: () => confirmed = true
            })

            action("confirm")
            assert.strictEqual(confirmed, true)
        })
    })

    describe("utils.decorate", () => {
        it("decorates function with before and after hooks", async () => {
            let beforeCalled = false
            let afterCalled = false
            let originalCalled = false
            const obj = {
                method: function (x) {
                    originalCalled = true
                    return x * 2
                }
            }
            const beforeFn = function (x) {
                beforeCalled = true
                return x + 1
            }
            const afterFn = function (result, x) {
                afterCalled = true
                return result + 10
            }

            await utils.decorator.decorate(() => obj, "method", { before: beforeFn, after: afterFn, modifyResult: true })

            const result = obj.method(5)
            assert.ok(beforeCalled)
            assert.ok(originalCalled)
            assert.ok(afterCalled)
            assert.strictEqual(result, 20)
        })

        it("handles modifyArgs flag", async () => {
            let beforeCalled = false
            const obj = {
                method: function (x) {
                    return x * 2
                }
            }
            const beforeFn = function (x) {
                beforeCalled = true
                return [x + 5]
            }

            await utils.decorator.decorate(() => obj, "method", { before: beforeFn, modifyArgs: true })

            const result = obj.method(3)
            assert.ok(beforeCalled)
            assert.strictEqual(result, 16)
        })

        it("stops execution when before returns PREVENT_DEFAULT", async () => {
            let originalCalled = false
            const obj = {
                method: function () {
                    originalCalled = true
                    return "should not reach"
                }
            }
            const beforeFn = function () {
                return utils.decorator.PREVENT_DEFAULT
            }

            await utils.decorator.decorate(() => obj, "method", { before: beforeFn })

            const result = obj.method()
            assert.ok(!originalCalled)
            assert.strictEqual(result, undefined)
        })

        it("preserves function name and length", async () => {
            const obj = {
                myMethod: function (a, b) {
                    return a + b
                }
            }
            const originalName = obj.myMethod.name
            const originalLength = obj.myMethod.length
            await utils.decorator.decorate(() => obj, "myMethod")

            assert.strictEqual(obj.myMethod.name, originalName)
            assert.strictEqual(obj.myMethod.length, originalLength)
        })

        it("waits for object to be available", async () => {
            let obj = null
            setTimeout(() => obj = { method: () => "delayed" }, 100)
            await utils.decorator.decorate(() => obj, "method")
            await delay(200)
            if (obj && obj.method) {
                const result = obj.method()
                assert.strictEqual(result, "delayed")
            }
        })
    })

    describe("utils.waitUntil", () => {
        it("polls until condition is true", async () => {
            let count = 0
            const until = () => {
                count++
                return count >= 3
            }
            await utils.waitUntil(until, 10, 1000)
            assert.strictEqual(count, 3)
        })

        it("does not run then on timeout", async () => {
            let conditionCalled = false
            let afterCalled = false
            const until = () => {
                conditionCalled = true
                return false
            }
            await utils.waitUntil(until, 10, 50).then(() => afterCalled = true).catch(() => undefined)
            assert.ok(conditionCalled)
            assert.strictEqual(afterCalled, false)
        })

        it("runs catch on timeout", async () => {
            let conditionCalled = false
            let afterCalled = false
            const until = () => {
                conditionCalled = true
                return false
            }
            await utils.waitUntil(until, 20, 50).catch(() => afterCalled = true)
            assert.ok(conditionCalled)
        })

        it("handles immediate true condition", async () => {
            let conditionCalled = false
            const until = () => {
                conditionCalled = true
                return true
            }
            await utils.waitUntil(until)
            assert.ok(conditionCalled)
        })

        it("uses default interval and timeout", async () => {
            let count = 0
            const startTime = Date.now()
            const until = () => {
                count++
                return count >= 2
            }
            await utils.waitUntil(until)
            const elapsed = Date.now() - startTime
            assert.ok(elapsed >= 50) // Should wait at least 2 intervals (2 * 25ms default))
        })
    })
})

describe("Evaluation Utilities", () => {
    describe("utils.safeEval", () => {
        it("evaluates simple expressions", () => {
            assert.strictEqual(utils.safeEval("1 + 2"), 3)
            assert.strictEqual(utils.safeEval("'hello' + ' world'"), "hello world")
            assert.strictEqual(utils.safeEval("Math.max(1, 2, 3)"), 3)
        })

        it("evaluates object expressions", () => {
            const result = utils.safeEval("({ a: 1, b: 2 })")
            assert.deepStrictEqual(result, { a: 1, b: 2 })
        })

        it("evaluates array expressions", () => {
            const result = utils.safeEval("[1, 2, 3]")
            assert.deepStrictEqual(result, [1, 2, 3])
        })

        it("handles function expressions", () => {
            const result = utils.safeEval("() => 42")
            assert.strictEqual(typeof result, "function")
            assert.strictEqual(result(), 42)
        })

        it("throws on syntax errors", () => {
            assert.throws(() => utils.safeEval("invalid syntax"), SyntaxError)
        })
    })

    describe("utils.unsafeEval", () => {
        it("evaluates simple expressions", () => {
            assert.strictEqual(utils.unsafeEval("1 + 2"), 3)
            assert.strictEqual(utils.unsafeEval("'hello' + ' world'"), "hello world")
        })

        it("has access to global scope", () => {
            global.testVar = 42
            assert.strictEqual(utils.unsafeEval("testVar"), 42)
            delete global.testVar
        })

        it("throws on syntax errors", () => {
            assert.throws(() => utils.unsafeEval("invalid syntax"), SyntaxError)
        })
    })
})

describe("Formatting & Presentation Utilities", () => {
    describe("utils.dateTimeFormat", () => {
        it("formats date with default pattern", () => {
            const date = new Date("2023-01-15T14:30:45.123")
            const result = utils.dateTimeFormat(date)
            assert.strictEqual(result, "2023-01-15 14:30:45")
        })

        it("formats year components", () => {
            const date = new Date("2023-01-15")
            assert.strictEqual(utils.dateTimeFormat(date, "yyyy"), "2023")
            assert.strictEqual(utils.dateTimeFormat(date, "yyy"), "023")
            assert.strictEqual(utils.dateTimeFormat(date, "yy"), "23")
        })

        it("formats month components", () => {
            const date = new Date("2023-01-15")
            assert.strictEqual(utils.dateTimeFormat(date, "MM"), "01")
            assert.strictEqual(utils.dateTimeFormat(date, "M"), "1")
        })

        it("formats day components", () => {
            const date = new Date("2023-01-05")
            assert.strictEqual(utils.dateTimeFormat(date, "dd"), "05")
            assert.strictEqual(utils.dateTimeFormat(date, "d"), "5")
        })

        it("formats time components", () => {
            const date = new Date("2023-01-15T14:30:45")
            assert.strictEqual(utils.dateTimeFormat(date, "HH"), "14")
            assert.strictEqual(utils.dateTimeFormat(date, "H"), "14")
            assert.strictEqual(utils.dateTimeFormat(date, "hh"), "02")
            assert.strictEqual(utils.dateTimeFormat(date, "h"), "2")
            assert.strictEqual(utils.dateTimeFormat(date, "mm"), "30")
            assert.strictEqual(utils.dateTimeFormat(date, "m"), "30")
            assert.strictEqual(utils.dateTimeFormat(date, "ss"), "45")
            assert.strictEqual(utils.dateTimeFormat(date, "s"), "45")
        })

        it("formats milliseconds", () => {
            const date = new Date("2023-01-15T14:30:45.123")
            assert.strictEqual(utils.dateTimeFormat(date, "SSS"), "123")
            assert.strictEqual(utils.dateTimeFormat(date, "S"), "123")
        })

        it("formats with locale", () => {
            const date = new Date("2023-01-15")
            const result = utils.dateTimeFormat(date, "MMMM", "en-US")
            assert(result.length > 0) // Should return month name
        })

        it("handles 12-hour format", () => {
            const date = new Date("2023-01-15T14:30:00")
            assert.strictEqual(utils.dateTimeFormat(date, "hh"), "02")
            assert.strictEqual(utils.dateTimeFormat(date, "h"), "2")

            const midnight = new Date("2023-01-15T00:30:00")
            assert.strictEqual(utils.dateTimeFormat(midnight, "hh"), "12")
            assert.strictEqual(utils.dateTimeFormat(midnight, "h"), "12")
        })

        it("uses current date when not provided", () => {
            const result = utils.dateTimeFormat(undefined, "yyyy")
            const currentYear = new Date().getFullYear().toString()
            assert.strictEqual(result, currentYear)
        })
    })

    describe("utils.buildTable", () => {
        it("builds basic HTML table from rows", () => {
            const rows = [
                ["Name", "Age", "City"],
                ["John", "25", "New York"],
                ["Jane", "30", "London"]
            ]
            const result = utils.buildTable(rows)
            assert.ok(result.includes("<table>"))
            assert.ok(result.includes("<thead>"))
            assert.ok(result.includes("<tbody>"))
            assert.ok(result.includes("<th>Name</th>"))
            assert.ok(result.includes("<td>John</td>"))
            assert.ok(result.includes("</table>"))
        })

        it("handles single row table", () => {
            const rows = [["Header1", "Header2"]]
            const result = utils.buildTable(rows)
            assert.ok(result.includes("<th>Header1</th>"))
            assert.ok(result.includes("<th>Header2</th>"))
            assert.ok(result.includes("<tbody>"))
        })

        it("handles empty rows array", () => {
            const rows = []
            const result = utils.buildTable(rows)
            assert.ok(result.includes("<table>"))
            assert.ok(result.includes("<thead>"))
            assert.ok(result.includes("<tbody>"))
        })

        it("handles numeric values", () => {
            const rows = [
                ["Count", "Value"],
                [1, 2.5]
            ]
            const result = utils.buildTable(rows)
            assert.ok(result.includes("<td>1</td>"))
            assert.ok(result.includes("<td>2.5</td>"))
        })
    })
})

describe("File System Utilities", () => {
    describe("utils.walkDir", () => {
        const createTestDir = async () => {
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "walkdir-test-"))
            await fs.mkdir(path.join(tmpDir, "subdir1"), { recursive: true })
            await fs.mkdir(path.join(tmpDir, "subdir2"), { recursive: true })
            await fs.mkdir(path.join(tmpDir, "subdir1", "nested"), { recursive: true })
            await fs.writeFile(path.join(tmpDir, "file1.txt"), "content1")
            await fs.writeFile(path.join(tmpDir, "file2.md"), "# content2")
            await fs.writeFile(path.join(tmpDir, "subdir1", "file3.txt"), "content3")
            await fs.writeFile(path.join(tmpDir, "subdir2", "file4.js"), "content4")
            await fs.writeFile(path.join(tmpDir, "subdir1", "nested", "file5.txt"), "content5")
            return tmpDir
        }
        const cleanupTestDir = async (tmpDir) => fs.rm(tmpDir, { recursive: true, force: true })

        it("traverses directory structure with BFS strategy", async () => {
            const tmpDir = await createTestDir()
            try {
                const visitedFiles = []
                const visitedDirs = []

                await utils.walkDir({
                    dir: tmpDir,
                    strategy: "bfs",
                    onFile: ({ path, file }) => visitedFiles.push(path),
                    onDir: (name, path) => visitedDirs.push(path)
                })

                assert.strictEqual(visitedFiles.length, 5)
                assert.ok(visitedFiles.some(f => f.endsWith("file1.txt")))
                assert.ok(visitedFiles.some(f => f.endsWith("file2.md")))
                assert.ok(visitedFiles.some(f => f.endsWith("file3.txt")))
                assert.ok(visitedFiles.some(f => f.endsWith("file4.js")))
                assert.ok(visitedFiles.some(f => f.endsWith("file5.txt")))

                assert.strictEqual(visitedDirs.length, 4)
                assert.ok(visitedDirs.some(d => d.endsWith("subdir1")))
                assert.ok(visitedDirs.some(d => d.endsWith("subdir2")))
                assert.ok(visitedDirs.some(d => d.endsWith("nested")))
            } finally {
                await cleanupTestDir(tmpDir)
            }
        })

        it("traverses directory structure with DFS strategy", async () => {
            const tmpDir = await createTestDir()
            try {
                const visitedFiles = []
                const visitOrder = []
                await utils.walkDir({
                    dir: tmpDir,
                    strategy: "dfs",
                    semaphore: 1,
                    onFile: ({ path }) => {
                        visitedFiles.push(path)
                        visitOrder.push(path)
                    }
                })

                const nestedFileIndex = visitOrder.findIndex(f => f.endsWith("file5.txt"))
                const siblingFileIndex = visitOrder.findIndex(f => f.endsWith("file4.js"))
                assert.ok(nestedFileIndex > siblingFileIndex)
                assert.strictEqual(visitedFiles.length, 5)
            } finally {
                await cleanupTestDir(tmpDir)
            }
        })

        it("respects file filter", async () => {
            const tmpDir = await createTestDir()
            try {
                const visitedFiles = []
                await utils.walkDir({
                    dir: tmpDir,
                    fileFilter: (name, path) => path.endsWith(".txt"),
                    onFile: ({ path }) => visitedFiles.push(path)
                })

                assert.strictEqual(visitedFiles.length, 3)
                assert.ok(visitedFiles.every(f => f.endsWith(".txt")))
            } finally {
                await cleanupTestDir(tmpDir)
            }
        })

        it("respects directory filter", async () => {
            const tmpDir = await createTestDir()
            try {
                const visitedFiles = []
                await utils.walkDir({
                    dir: tmpDir,
                    dirFilter: (name) => name !== "subdir2",
                    onFile: ({ path }) => visitedFiles.push(path)
                })

                assert.strictEqual(visitedFiles.length, 4)
                assert.ok(!visitedFiles.some(f => f.includes("subdir2")))
            } finally {
                await cleanupTestDir(tmpDir)
            }
        })

        it("respects max depth", async () => {
            const tmpDir = await createTestDir()
            try {
                const visitedFiles = []
                await utils.walkDir({
                    dir: tmpDir,
                    maxDepth: 1,
                    onFile: ({ path }) => visitedFiles.push(path)
                })
                assert.strictEqual(visitedFiles.length, 2)
                assert.ok(!visitedFiles.some(f => f.includes("nested")))
            } finally {
                await cleanupTestDir(tmpDir)
            }
        })

        it("respects max entities", async () => {
            const tmpDir = await createTestDir()
            try {
                const visitedFiles = []
                let error = null
                try {
                    await utils.walkDir({
                        dir: tmpDir,
                        maxEntities: 3,
                        onFile: ({ path }) => visitedFiles.push(path)
                    })
                } catch (err) {
                    error = err
                }

                assert.ok(error)
                assert.strictEqual(error.name, "QuotaExceededError")
                assert.ok(visitedFiles.length <= 3)
            } finally {
                await cleanupTestDir(tmpDir)
            }
        })

        it("handles semaphore concurrency control", async () => {
            const tmpDir = await createTestDir()
            try {
                let concurrentTasks = 0
                let maxConcurrentTasks = 0
                const visitedFiles = []
                await utils.walkDir({
                    dir: tmpDir,
                    semaphore: 2,
                    onFile: async ({ path }) => {
                        concurrentTasks++
                        maxConcurrentTasks = Math.max(maxConcurrentTasks, concurrentTasks)
                        await delay(10)
                        visitedFiles.push(path)
                        concurrentTasks--
                    }
                })

                assert.ok(maxConcurrentTasks <= 2, "Should not exceed semaphore limit")
                assert.strictEqual(visitedFiles.length, 5)
            } finally {
                await cleanupTestDir(tmpDir)
            }
        })

        it("calls onEntity callback", async () => {
            const tmpDir = await createTestDir()
            try {
                const statsCalled = []
                await utils.walkDir({
                    dir: tmpDir,
                    onFile: () => undefined,
                    onEntity: (stats) => statsCalled.push(stats.isFile() ? "file" : "dir")
                })

                assert.ok(statsCalled.length > 0)
                assert.ok(statsCalled.some(s => s === "file"))
                assert.ok(statsCalled.some(s => s === "dir"))
            } finally {
                await cleanupTestDir(tmpDir)
            }
        })

        it("calls onFinished callback", async () => {
            const tmpDir = await createTestDir()
            try {
                let finished = false
                let finishedError = null
                await utils.walkDir({
                    dir: tmpDir,
                    onFile: () => undefined,
                    onFinished: (err) => {
                        finished = true
                        finishedError = err
                    }
                })

                assert.ok(finished)
                assert.strictEqual(finishedError, undefined)
            } finally {
                await cleanupTestDir(tmpDir)
            }
        })

        it("handles onNonFatalError", async () => {
            const tmpDir = await createTestDir()
            try {
                const errors = []
                const visitedFiles = []
                const problematicFile = path.join(tmpDir, "problem.txt")
                await fs.writeFile(problematicFile, "content")

                await utils.walkDir({
                    dir: tmpDir,
                    onFile: ({ path }) => visitedFiles.push(path),
                    onNonFatalError: (path, err) => errors.push({ path, error: err.message })
                })

                assert.ok(visitedFiles.length > 0)
            } finally {
                await cleanupTestDir(tmpDir)
            }
        })

        it("uses custom fileParamsGetter", async () => {
            const tmpDir = await createTestDir()
            try {
                const receivedParams = []
                await utils.walkDir({
                    dir: tmpDir,
                    fileParamsGetter: (path, file, dir, stats) => ({
                        customPath: path,
                        customFile: file,
                        customDir: dir,
                        size: stats.size
                    }),
                    onFile: (params) => receivedParams.push(params)
                })

                assert.strictEqual(receivedParams.length, 5)
                assert.ok(receivedParams.every(p => p.customPath && p.customFile && p.customDir && typeof p.size === "number"))
            } finally {
                await cleanupTestDir(tmpDir)
            }
        })

        it("handles onDir returning false to stop processing children", async () => {
            const tmpDir = await createTestDir()
            try {
                const visitedFiles = []
                await utils.walkDir({
                    dir: tmpDir,
                    onDir: (name, path) => {
                        if (name === "subdir1") return false
                    },
                    onFile: ({ path }) => visitedFiles.push(path)
                })

                assert.strictEqual(visitedFiles.length, 3)
                assert.ok(!visitedFiles.some(f => f.includes("subdir1")))
            } finally {
                await cleanupTestDir(tmpDir)
            }
        })

        it("handles symbolic links based on followSymlinks option", async () => {
            const tmpDir = await createTestDir()
            try {
                const linkPath = path.join(tmpDir, "symlink.txt")
                const targetPath = path.join(tmpDir, "file1.txt")

                try {
                    await fs.symlink(targetPath, linkPath)
                } catch (err) {
                    console.log("Symlinks not supported, skipping test")
                    return
                }

                const visitedFiles = []
                await utils.walkDir({
                    dir: tmpDir,
                    followSymlinks: false,
                    onFile: ({ path }) => visitedFiles.push(path)
                })

                assert.ok(visitedFiles.some(f => f.includes("symlink.txt")))
            } finally {
                await cleanupTestDir(tmpDir)
            }
        })

        it("handles empty directory", async () => {
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "walkdir-empty-"))
            try {
                const visitedFiles = []
                const visitedDirs = []
                await utils.walkDir({
                    dir: tmpDir,
                    onFile: ({ path }) => visitedFiles.push(path),
                    onDir: (name, path) => visitedDirs.push(path)
                })

                assert.strictEqual(visitedFiles.length, 0)
                assert.strictEqual(visitedDirs.length, 1)
            } finally {
                await cleanupTestDir(tmpDir)
            }
        })

        it("handles abort signal", async () => {
            const tmpDir = await createTestDir()
            try {
                const visitedFiles = []
                const signal = AbortSignal.timeout(50)
                await assert.rejects(async () => {
                    await utils.walkDir({
                        dir: tmpDir,
                        signal,
                        onFile: async ({ path }) => {
                            await delay(100)
                            visitedFiles.push(path)
                        }
                    })
                }, /TimeoutError/)
                assert.ok(visitedFiles.length < 5, "Should have been aborted before completing")
            } finally {
                await cleanupTestDir(tmpDir)
            }
        })
    })
})
