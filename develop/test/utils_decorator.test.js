const { describe, it, beforeEach } = require("node:test")
const assert = require("node:assert")
const Decorator = require("../../plugin/global/core/utils/decorator")

describe("Decorator (AOP utility)", () => {
  let decorator
  let target

  beforeEach(() => {
    decorator = new Decorator()
    target = {
      add(a, b) {
        return a + b
      },
    }
  })

  describe("constructor / exposed API", () => {
    it("exposes all expected methods and the PREVENT_DEFAULT symbol", () => {
      assert.strictEqual(typeof decorator.decorate, "function")
      assert.strictEqual(typeof decorator.beforeCall, "function")
      assert.strictEqual(typeof decorator.afterCall, "function")
      assert.strictEqual(typeof decorator.modifyArguments, "function")
      assert.strictEqual(typeof decorator.modifyReturn, "function")
      assert.strictEqual(typeof decorator.preventCallIf, "function")
      assert.strictEqual(typeof decorator.getInfo, "function")
      assert.strictEqual(typeof decorator.PREVENT_DEFAULT, "symbol")
    })

    it("PREVENT_DEFAULT is a shared global symbol", () => {
      assert.strictEqual(decorator.PREVENT_DEFAULT, Symbol.for("decorator:prevent-default"))
      // Two independent instances must share the same symbol
      const other = new Decorator()
      assert.strictEqual(decorator.PREVENT_DEFAULT, other.PREVENT_DEFAULT)
    })
  })

  describe("decorate() argument validation", () => {
    it("rejects when property is not a string or symbol", async () => {
      await assert.rejects(
        decorator.decorate(target, 123, {}),
        TypeError,
      )
    })

    it("rejects when options.before is not a function", async () => {
      await assert.rejects(
        decorator.decorate(target, "add", { before: "not-a-fn" }),
        TypeError,
      )
    })

    it("rejects when options.after is not a function", async () => {
      await assert.rejects(
        decorator.decorate(target, "add", { after: "not-a-fn" }),
        TypeError,
      )
    })
  })

  describe("beforeCall", () => {
    it("invokes the hook before the original function without altering args/result by default", async () => {
      const calls = []
      const { undecorate } = await decorator.beforeCall(target, "add", (a, b) => {
        calls.push([a, b])
      })

      const result = target.add(1, 2)
      assert.strictEqual(result, 3)
      assert.deepStrictEqual(calls, [[1, 2]])

      undecorate()
      assert.strictEqual(target.add(1, 2), 3)
    })

    it("can short-circuit the original call via PREVENT_DEFAULT", async () => {
      let originalCalled = false
      const original = target.add
      target.add = function (...args) {
        originalCalled = true
        return original.apply(this, args)
      }

      const { undecorate } = await decorator.beforeCall(target, "add", () => decorator.PREVENT_DEFAULT)
      const result = target.add(1, 2)

      assert.strictEqual(result, undefined)
      assert.strictEqual(originalCalled, false)
      undecorate()
    })
  })

  describe("afterCall", () => {
    it("invokes the hook after the original function with (result, ...args) but does not change the return value unless modifyResult is set", async () => {
      const captured = []
      const { undecorate } = await decorator.afterCall(target, "add", (result, a, b) => {
        captured.push({ result, a, b })
      })

      const result = target.add(2, 3)
      assert.strictEqual(result, 5)
      assert.deepStrictEqual(captured, [{ result: 5, a: 2, b: 3 }])

      undecorate()
    })
  })

  describe("modifyArguments", () => {
    it("rewrites the arguments passed to the original function", async () => {
      const { undecorate } = await decorator.modifyArguments(target, "add", (a, b) => [a * 10, b * 10])
      assert.strictEqual(target.add(1, 2), 30)
      undecorate()
      assert.strictEqual(target.add(1, 2), 3)
    })

    it("treats a null/undefined mapper result as no arguments", async () => {
      target.echo = (...args) => args.length
      const { undecorate } = await decorator.modifyArguments(target, "echo", () => undefined)
      assert.strictEqual(target.echo(1, 2, 3), 0)
      undecorate()
    })
  })

  describe("modifyReturn", () => {
    it("rewrites the return value of the original function", async () => {
      const { undecorate } = await decorator.modifyReturn(target, "add", result => result * 2)
      assert.strictEqual(target.add(1, 2), 6)
      undecorate()
      assert.strictEqual(target.add(1, 2), 3)
    })
  })

  describe("preventCallIf", () => {
    it("prevents the original call when the condition is true", async () => {
      let calls = 0
      const original = target.add
      target.add = function (...args) {
        calls++
        return original.apply(this, args)
      }

      const { undecorate } = await decorator.preventCallIf(target, "add", (a, b) => a < 0)

      assert.strictEqual(target.add(-1, 2), undefined)
      assert.strictEqual(calls, 0)
      assert.strictEqual(target.add(1, 2), 3)
      assert.strictEqual(calls, 1)

      undecorate()
    })
  })

  describe("decorator.settled", () => {
    it("runs settled hook with (null, result, ...args) on sync success", async () => {
      const obj = { add(a, b) { return a + b } }
      const calls = []
      await decorator.decorate(obj, "add", {
        settled: function (error, result, ...args) { calls.push([error, result, args]) },
      })
      assert.equal(obj.add(1, 2), 3)
      assert.deepEqual(calls, [[null, 3, [1, 2]]])
    })

    it("runs settled hook with the thrown error and re-throws it", async () => {
      const obj = { fail() { throw new Error("boom") } }
      const seen = []
      await decorator.decorate(obj, "fail", {
        settled: (error, result) => seen.push(error),
      })
      assert.throws(() => obj.fail(), /boom/)
      assert.equal(seen.length, 1)
      assert.equal(seen[0].message, "boom")
    })

    it("runs settled hook after async resolution", async () => {
      const obj = { load() { return Promise.resolve("data") } }
      const seen = []
      await decorator.decorate(obj, "load", {
        settled: (error, result) => seen.push([error, result]),
      })
      await assert.doesNotReject(obj.load())
      assert.deepEqual(seen, [[null, "data"]])
    })

    it("runs settled hook after async rejection and preserves rejection", async () => {
      const obj = { load() { return Promise.reject(new Error("async boom")) } }
      const seen = []
      await decorator.decorate(obj, "load", {
        settled: (error, result) => seen.push(error),
      })
      await assert.rejects(obj.load(), /async boom/)
      assert.equal(seen[0].message, "async boom")
    })

    it("a throwing settled hook does not mask the original result or break other hooks", async () => {
      const obj = { ok() { return 42 } }
      const order = []
      await decorator.decorate(obj, "ok", {
        settled: () => { throw new Error("hook bug") },
      })
      await decorator.decorate(obj, "ok", {
        settled: () => order.push("second"),
      })
      assert.equal(obj.ok(), 42)
      assert.deepEqual(order, ["second"])
    })

    it("settled hooks run in reverse priority order (onion model)", async () => {
      const obj = { run() {} }
      const order = []
      await decorator.decorate(obj, "run", { priority: 1, settled: () => order.push("p1") })
      await decorator.decorate(obj, "run", { priority: 9, settled: () => order.push("p9") })
      obj.run()
      assert.deepEqual(order, ["p9", "p1"])
    })

    it("settled runs even when before hook prevents the call", async () => {
      const obj = { guarded() { return "ran" } }
      let settled = false
      await decorator.decorate(obj, "guarded", {
        before: () => decorator.PREVENT_DEFAULT,
        settled: () => { settled = true },
      })
      assert.equal(obj.guarded(), undefined)
      assert.equal(settled, true)
    })

    it("settled hook is removed by undecorate", async () => {
      const obj = { ping() { return "pong" } }
      let ran = 0
      const { undecorate } = await decorator.decorate(obj, "ping", {
        settled: () => ran++,
      })
      obj.ping()
      undecorate()
      obj.ping()
      assert.equal(ran, 1)
    })

    it("settledCall convenience API registers a settled hook", async () => {
      const obj = { go() { return 1 } }
      const seen = []
      await decorator.settledCall(obj, "go", (error, result) => seen.push(result))
      obj.go()
      assert.deepEqual(seen, [1])
    })
  })

  describe("decorator core semantics", () => {
    it("before/after wrap in order and this-binding is preserved", async () => {
      const obj = {
        label: "ctx",
        who() { return this.label },
      }
      const order = []
      await decorator.decorate(obj, "who", {
        before() { order.push("before") },
        after() { order.push("after") },
      })
      assert.equal(obj.who(), "ctx")
      assert.deepEqual(order, ["before", "after"])
    })

    it("modifyArguments rewrites args; modifyReturn rewrites result", async () => {
      const obj = { join(a, b) { return `${a}-${b}` } }
      await decorator.modifyArguments(obj, "join", () => ["x", "y"])
      assert.equal(obj.join("a", "b"), "x-y")

      const obj2 = { join(a, b) { return `${a}-${b}` } }
      await decorator.modifyReturn(obj2, "join", r => r.toUpperCase())
      assert.equal(obj2.join("a", "b"), "A-B")
    })

    it("undecorate restores originalFn when the last decorator is removed", async () => {
      const obj = { f() { return "orig" } }
      const original = obj.f
      const { undecorate } = await decorator.beforeCall(obj, "f", () => {})
      assert.notEqual(obj.f, original)
      undecorate()
      assert.equal(obj.f, original)
      assert.equal(decorator.getInfo(obj, "f"), undefined)
    })

    it("partial undecorate keeps remaining decorators alive", async () => {
      const obj = { f() { return 1 } }
      const calls = []
      const a = await decorator.beforeCall(obj, "f", () => calls.push("a"))
      await decorator.beforeCall(obj, "f", () => calls.push("b"))
      a.undecorate()
      obj.f()
      assert.deepEqual(calls, ["b"])
    })

    it("preserves name/length and exposes __original", async () => {
      const obj = { named(a, b, c) { return a } }
      await decorator.beforeCall(obj, "named", () => {})
      assert.equal(obj.named.name, "named")
      assert.equal(obj.named.length, 3)
      assert.equal(typeof obj.named.__original, "function")
    })

    it("resolves lazily when target appears later", async () => {
      let obj = null
      const promise = decorator.beforeCall(() => obj, "f", () => {}, { timeout: 500, interval: 10 })
      setTimeout(() => { obj = { f() { return 7 } } }, 20)
      const { decorated } = await promise
      assert.equal(decorated(), 7)
    })

    it("rejects on invalid option types", async () => {
      const obj = { f() {} }
      await assert.rejects(decorator.decorate(obj, "f", { before: 1 }), TypeError)
      await assert.rejects(decorator.decorate(obj, "f", { settled: "x" }), TypeError)
      await assert.rejects(decorator.decorate(obj, 123, {}), TypeError)
    })

    it("accepts symbol properties", async () => {
      const sym = Symbol("m")
      const obj = { [sym]() { return "s" } }
      await decorator.beforeCall(obj, sym, () => {})
      assert.equal(obj[sym](), "s")
    })
  })

  describe("multiple decorators / chaining & priority", () => {
    it("runs before-hooks in ascending priority order and after-hooks in descending (reverse) order", async () => {
      const order = []
      const { undecorate: undo1 } = await decorator.beforeCall(target, "add", () => order.push("before-low"), { priority: 0 })
      const { undecorate: undo2 } = await decorator.beforeCall(target, "add", () => order.push("before-high"), { priority: 10 })
      const { undecorate: undo3 } = await decorator.afterCall(target, "add", () => order.push("after-low"), { priority: 0 })
      const { undecorate: undo4 } = await decorator.afterCall(target, "add", () => order.push("after-high"), { priority: 10 })

      target.add(1, 1)
      assert.deepStrictEqual(order, ["before-low", "before-high", "after-high", "after-low"])

      undo1()
      undo2()
      undo3()
      undo4()
    })

    it("reports the number of active decorators on the same property", async () => {
      const { decorators: d1 } = await decorator.beforeCall(target, "add", () => undefined)
      assert.strictEqual(d1, 1)
      const { decorators: d2, undecorate: undo2 } = await decorator.beforeCall(target, "add", () => undefined)
      assert.strictEqual(d2, 2)

      undo2()
    })
  })

  describe("undecorate", () => {
    it("restores the original function once the last decorator is removed", async () => {
      const original = target.add
      const { undecorate } = await decorator.beforeCall(target, "add", () => undefined)

      assert.notStrictEqual(target.add, original)
      undecorate()
      assert.strictEqual(target.add, original)
    })

    it("is idempotent / safe to call multiple times", async () => {
      const { undecorate } = await decorator.beforeCall(target, "add", () => undefined)
      undecorate()
      assert.doesNotThrow(() => undecorate())
    })

    it("keeps the chained function active while other decorators remain", async () => {
      const { undecorate: undo1 } = await decorator.beforeCall(target, "add", () => undefined)
      const { undecorate: undo2 } = await decorator.beforeCall(target, "add", () => undefined)

      const chained = target.add
      undo1()
      assert.strictEqual(target.add, chained, "chained fn should remain while decorators.length > 0")

      undo2()
    })
  })

  describe("getInfo", () => {
    it("returns undefined when no decorator has been applied", () => {
      assert.strictEqual(decorator.getInfo(target, "add"), undefined)
    })

    it("returns metadata describing the decorator chain after decoration", async () => {
      const { undecorate } = await decorator.beforeCall(target, "add", () => undefined)
      const info = decorator.getInfo(target, "add")

      assert.ok(info)
      assert.strictEqual(typeof info.originalFn, "function")
      assert.strictEqual(typeof info.chainedFn, "function")
      assert.strictEqual(info.decorators.length, 1)

      undecorate()
    })
  })

  describe("decorate() with a function-returning target (objGetter)", () => {
    it("resolves the target lazily via a getter function", async () => {
      let realTarget = null
      const getter = () => realTarget

      const promise = decorator.decorate(getter, "add", {
        before: () => undefined,
        interval: 10,
        timeout: 500,
      })

      // property doesn't exist yet -> decorate should keep polling
      await new Promise(resolve => setTimeout(resolve, 20))
      realTarget = { add: (a, b) => a + b }

      const { decorated } = await promise
      assert.strictEqual(typeof decorated, "function")
    })

    it("rejects with a timeout error when the target/property never becomes available", async () => {
      await assert.rejects(
        decorator.decorate(() => null, "add", { before: () => undefined, timeout: 30, interval: 10 }),
        /decorate timeout for add/,
      )
    })
  })

  describe("error handling inside decorate()", () => {
    it("rejects when an internal error occurs while decorating", async (t) => {
      t.mock.method(console, "error", () => undefined)
      // Force objGetter to throw synchronously to hit the catch branch
      const throwingGetter = () => {
        throw new Error("boom")
      }
      await assert.rejects(
        decorator.decorate(throwingGetter, "add", { before: () => undefined }),
        /boom/,
      )
    })
  })
})
