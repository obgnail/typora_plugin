const { describe, it, before, after, mock } = require("node:test")
const assert = require("node:assert")

before(() => {
  const originalWarn = console.warn
  const originalError = console.error
  mock.method(console, "warn", (message, ...args) => {
    if (typeof message === "string" && message.includes("An unexpected error occurred while executing")) return
    originalWarn(message, ...args)
  })
  mock.method(console, "error", (message, ...args) => {
    if (typeof message === "string" && message.includes("An unexpected error occurred while executing")) {
      return
    }
    originalError(message, ...args)
  })
  mock.method(console, "log", () => undefined)
})

after(() => mock.restoreAll())

const SDK = require("../../plugin/remote_control/client.js")
const { RpcServer, JSONRPCErrorCode, JSONRPCErrorException } = require("../../plugin/remote_control/server.js")

async function startServer(options) {
  const server = new RpcServer(options)
  await server.start(0)
  const port = server._server.address().port
  return { server, url: `http://127.0.0.1:${port}` }
}

async function rpcRequest(url, method, params, { id = 1, token = null } = {}) {
  const headers = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const body = JSON.stringify({ jsonrpc: "2.0", method, params, id })
  const res = await fetch(url, { method: "POST", headers, body })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function rpcNotify(url, method, params, { token = null } = {}) {
  const headers = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const body = JSON.stringify({ jsonrpc: "2.0", method, params })
  const res = await fetch(url, { method: "POST", headers, body })
  return { status: res.status }
}

describe("RpcServer - HTTP layer", () => {
  let server, url

  before(async () => {
    ({ server, url } = await startServer())
    server.registerNamespace("echo", {
      ping: () => "pong",
      fail: () => {
        throw new Error("handler error")
      },
      rpcFail: () => {
        throw new JSONRPCErrorException("custom", JSONRPCErrorCode.InvalidParams, { typoraCode: "CUSTOM" })
      },
    })
  })

  after(() => server.stop())

  it("responds 405 to non-POST requests (GET)", async () => {
    const res = await fetch(url, { method: "GET" })
    assert.strictEqual(res.status, 405)
  })

  it("responds 405 to non-POST requests (PUT)", async () => {
    const res = await fetch(url, { method: "PUT" })
    assert.strictEqual(res.status, 405)
  })

  it("responds 400 with ParseError for invalid JSON body", async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {{{",
    })
    assert.strictEqual(res.status, 400)
    const body = await res.json()
    assert.strictEqual(body.error.code, JSONRPCErrorCode.ParseError)
    assert.strictEqual(body.id, null)
  })

  it("responds 200 with result for valid JSON-RPC request", async () => {
    const { status, body } = await rpcRequest(url, "echo.ping", [])
    assert.strictEqual(status, 200)
    assert.strictEqual(body.result, "pong")
    assert.strictEqual(body.jsonrpc, "2.0")
  })

  it("responds 204 for JSON-RPC notification (no id)", async () => {
    const { status } = await rpcNotify(url, "echo.ping", [])
    assert.strictEqual(status, 204)
  })

  it("returns JSON-RPC error for unknown method", async () => {
    const { status, body } = await rpcRequest(url, "echo.unknown", [])
    assert.strictEqual(status, 200)
    assert.ok(body.error, "should have error field")
    assert.strictEqual(body.result, undefined)
  })

  it("wraps generic handler errors as INTERNAL_ERROR", async () => {
    const { body } = await rpcRequest(url, "echo.fail", [])
    assert.ok(body.error)
    assert.strictEqual(body.error.data?.typoraCode, "INTERNAL_ERROR")
    assert.strictEqual(body.error.code, JSONRPCErrorCode.InternalError)
  })

  it("passes through JSONRPCErrorException from handler unchanged", async () => {
    const { body } = await rpcRequest(url, "echo.rpcFail", [])
    assert.ok(body.error)
    assert.strictEqual(body.error.data?.typoraCode, "CUSTOM")
    assert.strictEqual(body.error.code, JSONRPCErrorCode.InvalidParams)
  })

  it("response id matches request id", async () => {
    const { body } = await rpcRequest(url, "echo.ping", [], { id: 42 })
    assert.strictEqual(body.id, 42)
  })
})

describe("RpcServer - registerNamespace and getRegisteredMethods", () => {
  it("registers methods and returns them via getRegisteredMethods", () => {
    const server = new RpcServer({ enableDiscovery: false })
    server.registerNamespace("ns1", {
      foo: () => {
      }, bar: () => {
      },
    })
    server.registerNamespace("ns2", {
      baz: () => {
      },
    })
    const methods = server.getRegisteredMethods()
    assert.deepStrictEqual(methods.ns1.sort(), ["bar", "foo"])
    assert.deepStrictEqual(methods.ns2, ["baz"])
  })

  it("supports method chaining on registerNamespace", () => {
    const server = new RpcServer({ enableDiscovery: false })
    const result = server.registerNamespace("ns", {
      a: () => {
      },
    })
    assert.strictEqual(result, server)
  })

  it("overwriting a namespace replaces its registry entry", () => {
    const server = new RpcServer({ enableDiscovery: false })
    server.registerNamespace("ns", {
      a: () => {
      }, b: () => {
      },
    })
    server.registerNamespace("ns", {
      c: () => {
      },
    })
    const methods = server.getRegisteredMethods()
    assert.deepStrictEqual(methods.ns, ["c"])
  })

  it("getRegisteredMethods returns empty object when no namespaces registered", () => {
    const server = new RpcServer({ enableDiscovery: false })
    assert.deepStrictEqual(server.getRegisteredMethods(), {})
  })
})

describe("RpcServer - rpc.discover", () => {
  it("rpc.discover returns all registered namespaces and methods", async () => {
    const { server, url } = await startServer({ enableDiscovery: true })
    server.registerNamespace("system", { version: () => "1.0" })
    server.registerNamespace("document", {
      open: () => {
      }, close: () => {
      },
    })
    const { body } = await rpcRequest(url, "rpc.discover", [])
    server.stop()
    assert.deepStrictEqual(body.result.system, ["version"])
    assert.deepStrictEqual(body.result.document.sort(), ["close", "open"])
  })

  it("rpc.discover is not available when enableDiscovery=false", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    const { body } = await rpcRequest(url, "rpc.discover", [])
    server.stop()
    assert.ok(body.error, "should return error for unknown method")
  })

  it("rpc.discover is available by default (enableDiscovery defaults to true)", async () => {
    const { server, url } = await startServer()
    const { body } = await rpcRequest(url, "rpc.discover", [])
    server.stop()
    assert.ok(body.result !== undefined)
  })

  it("rpc.discover does NOT go through user middleware", async () => {
    // rpc.discover is registered directly via _rpc.addMethod, not via registerNamespace,
    // so _createHandler (and thus middleware) is never called for it
    const { server, url } = await startServer({ enableDiscovery: true })
    let middlewareCalled = false
    server.use(() => {
      middlewareCalled = true
      return true
    })
    const { body } = await rpcRequest(url, "rpc.discover", [])
    server.stop()
    assert.ok(body.result !== undefined)
    assert.strictEqual(middlewareCalled, false)
  })
})

describe("RpcServer - middleware", () => {
  it("throws TypeError when middleware is not a function", () => {
    const server = new RpcServer({ enableDiscovery: false })
    assert.throws(() => server.use("not a function"), TypeError)
    assert.throws(() => server.use(null), TypeError)
    assert.throws(() => server.use(42), TypeError)
    assert.throws(() => server.use({}), TypeError)
  })

  it("supports method chaining on use()", () => {
    const server = new RpcServer({ enableDiscovery: false })
    const result = server.use(() => true)
    assert.strictEqual(result, server)
  })

  it("middleware is called with correct context fields", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    let capturedCtx = null
    server.use((ctx) => {
      capturedCtx = ctx
      return true
    })
    server.registerNamespace("test", { hello: () => "world" })
    await rpcRequest(url, "test.hello", [])
    server.stop()
    assert.strictEqual(capturedCtx.namespace, "test")
    assert.strictEqual(capturedCtx.methodName, "hello")
    assert.ok(capturedCtx.context.req, "context.req should be present")
    assert.ok(typeof capturedCtx.context.timestamp === "number")
    assert.ok(capturedCtx.context.remoteAddress)
  })

  it("middleware returning false causes MIDDLEWARE_REJECTED error", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(() => false)
    server.registerNamespace("test", { hello: () => "world" })
    const { body } = await rpcRequest(url, "test.hello", [])
    server.stop()
    assert.strictEqual(body.error.data?.typoraCode, "MIDDLEWARE_REJECTED")
    assert.strictEqual(body.error.code, JSONRPCErrorCode.InvalidRequest)
  })

  it("multiple middleware are called in order", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    const order = []
    server.use(() => {
      order.push(1)
      return true
    })
    server.use(() => {
      order.push(2)
      return true
    })
    server.use(() => {
      order.push(3)
      return true
    })
    server.registerNamespace("test", { hello: () => "world" })
    await rpcRequest(url, "test.hello", [])
    server.stop()
    assert.deepStrictEqual(order, [1, 2, 3])
  })

  it("first middleware returning false short-circuits subsequent middleware", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    const called = []
    server.use(() => {
      called.push(1)
      return false
    })
    server.use(() => {
      called.push(2)
      return true
    })
    server.registerNamespace("test", { hello: () => "world" })
    await rpcRequest(url, "test.hello", [])
    server.stop()
    assert.deepStrictEqual(called, [1])
  })

  it("middleware throwing JSONRPCErrorException propagates the error code", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(() => {
      throw new JSONRPCErrorException("forbidden", JSONRPCErrorCode.InvalidRequest, { typoraCode: "CUSTOM_MW_ERROR" })
    })
    server.registerNamespace("test", { hello: () => "world" })
    const { body } = await rpcRequest(url, "test.hello", [])
    server.stop()
    assert.strictEqual(body.error.data?.typoraCode, "CUSTOM_MW_ERROR")
    assert.strictEqual(body.error.code, JSONRPCErrorCode.InvalidRequest)
  })

  it("async middleware is awaited correctly", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    let called = false
    server.use(async () => {
      await new Promise(r => setTimeout(r, 10))
      called = true
      return true
    })
    server.registerNamespace("test", { hello: () => "world" })
    await rpcRequest(url, "test.hello", [])
    server.stop()
    assert.ok(called)
  })
})

describe("RpcServer.auth - static middleware factory", () => {
  const TOKEN = "secret-token"

  it("allows request with valid Bearer token", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(RpcServer.auth({ validator: (t) => t === TOKEN }))
    server.registerNamespace("private", { data: () => "secret" })
    const { body } = await rpcRequest(url, "private.data", [], { token: TOKEN })
    server.stop()
    assert.strictEqual(body.result, "secret")
  })

  it("rejects request with invalid token (AUTH_FAILED)", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(RpcServer.auth({ validator: (t) => t === TOKEN }))
    server.registerNamespace("private", { data: () => "secret" })
    const { body } = await rpcRequest(url, "private.data", [], { token: "wrong" })
    server.stop()
    assert.strictEqual(body.error.data?.typoraCode, "AUTH_FAILED")
    assert.strictEqual(body.error.code, JSONRPCErrorCode.InvalidRequest)
  })

  it("rejects request with no Authorization header (token is empty string)", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(RpcServer.auth({ validator: (t) => t === TOKEN }))
    server.registerNamespace("private", { data: () => "secret" })
    const { body } = await rpcRequest(url, "private.data", [])
    server.stop()
    assert.strictEqual(body.error.data?.typoraCode, "AUTH_FAILED")
  })

  it("passes empty string to validator when no Authorization header", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    let capturedToken = null
    server.use(RpcServer.auth({
      validator: (t) => {
        capturedToken = t
        return true
      },
    }))
    server.registerNamespace("test", { hello: () => "world" })
    await rpcRequest(url, "test.hello", [])
    server.stop()
    assert.strictEqual(capturedToken, "")
  })

  it("extracts token correctly from 'Bearer <token>' format", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    let capturedToken = null
    server.use(RpcServer.auth({
      validator: (t) => {
        capturedToken = t
        return true
      },
    }))
    server.registerNamespace("test", { hello: () => "world" })
    await rpcRequest(url, "test.hello", [], { token: "my-secret" })
    server.stop()
    assert.strictEqual(capturedToken, "my-secret")
  })

  it("bypasses auth for methods in bypass list", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(RpcServer.auth({ validator: (t) => t === TOKEN, bypass: ["public.ping"] }))
    server.registerNamespace("public", { ping: () => "pong" })
    const { body } = await rpcRequest(url, "public.ping", [])
    server.stop()
    assert.strictEqual(body.result, "pong")
  })

  it("does NOT bypass auth for methods not in bypass list (same namespace)", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(RpcServer.auth({ validator: (t) => t === TOKEN, bypass: ["public.ping"] }))
    server.registerNamespace("public", { ping: () => "pong", other: () => "other" })
    const { body } = await rpcRequest(url, "public.other", [])
    server.stop()
    assert.strictEqual(body.error.data?.typoraCode, "AUTH_FAILED")
  })

  it("bypass list is empty by default", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(RpcServer.auth({ validator: (t) => t === TOKEN }))
    server.registerNamespace("public", { ping: () => "pong" })
    const { body } = await rpcRequest(url, "public.ping", [])
    server.stop()
    assert.strictEqual(body.error.data?.typoraCode, "AUTH_FAILED")
  })
})

describe("RpcServer.rateLimit - static middleware factory", () => {
  it("allows requests within burst size", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(RpcServer.rateLimit({ requestsPerMinute: 60, burstSize: 5 }))
    server.registerNamespace("test", { hello: () => "world" })
    for (let i = 0; i < 5; i++) {
      const { body } = await rpcRequest(url, "test.hello", [])
      assert.strictEqual(body.result, "world", `Request ${i + 1} should succeed`)
    }
    server.stop()
  })

  it("rejects requests exceeding burst size (RATE_LIMIT_EXCEEDED)", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(RpcServer.rateLimit({ requestsPerMinute: 60, burstSize: 2 }))
    server.registerNamespace("test", { hello: () => "world" })
    await rpcRequest(url, "test.hello", [])
    await rpcRequest(url, "test.hello", [])
    const { body } = await rpcRequest(url, "test.hello", [])
    server.stop()
    assert.strictEqual(body.error.data?.typoraCode, "RATE_LIMIT_EXCEEDED")
    assert.strictEqual(body.error.code, JSONRPCErrorCode.InvalidRequest)
  })

  it("rate limit is per-method (different methods have separate token buckets)", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(RpcServer.rateLimit({ requestsPerMinute: 60, burstSize: 1 }))
    server.registerNamespace("test", { a: () => "a", b: () => "b" })
    // Exhaust bucket for test.a
    await rpcRequest(url, "test.a", [])
    const { body: bodyA } = await rpcRequest(url, "test.a", [])
    // test.b should still have tokens
    const { body: bodyB } = await rpcRequest(url, "test.b", [])
    server.stop()
    assert.strictEqual(bodyA.error.data?.typoraCode, "RATE_LIMIT_EXCEEDED")
    assert.strictEqual(bodyB.result, "b")
  })

  it("tokens refill over time", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    // 600 req/min = 10 req/sec = 1 token per 100ms; burstSize=1
    server.use(RpcServer.rateLimit({ requestsPerMinute: 600, burstSize: 1 }))
    server.registerNamespace("test", { hello: () => "world" })
    // Exhaust the bucket
    await rpcRequest(url, "test.hello", [])
    const { body: rateLimited } = await rpcRequest(url, "test.hello", [])
    assert.strictEqual(rateLimited.error.data?.typoraCode, "RATE_LIMIT_EXCEEDED")
    // Wait for refill (>100ms)
    await new Promise(r => setTimeout(r, 150))
    const { body: refilled } = await rpcRequest(url, "test.hello", [])
    server.stop()
    assert.strictEqual(refilled.result, "world")
  })
})

describe("RpcServer.acl - static middleware factory", () => {
  it("allows method when specific rule is true", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(RpcServer.acl({ "test.hello": true }))
    server.registerNamespace("test", { hello: () => "world" })
    const { body } = await rpcRequest(url, "test.hello", [])
    server.stop()
    assert.strictEqual(body.result, "world")
  })

  it("denies method when specific rule is false (PERMISSION_DENIED)", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(RpcServer.acl({ "test.hello": false }))
    server.registerNamespace("test", { hello: () => "world" })
    const { body } = await rpcRequest(url, "test.hello", [])
    server.stop()
    assert.strictEqual(body.error.data?.typoraCode, "PERMISSION_DENIED")
    assert.strictEqual(body.error.code, JSONRPCErrorCode.InvalidRequest)
  })

  it("uses namespace-level rule when no method-specific rule exists", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(RpcServer.acl({ "test": false }))
    server.registerNamespace("test", { hello: () => "world" })
    const { body } = await rpcRequest(url, "test.hello", [])
    server.stop()
    assert.strictEqual(body.error.data?.typoraCode, "PERMISSION_DENIED")
  })

  it("uses wildcard rule when no method or namespace rule exists", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(RpcServer.acl({ "*": false }))
    server.registerNamespace("test", { hello: () => "world" })
    const { body } = await rpcRequest(url, "test.hello", [])
    server.stop()
    assert.strictEqual(body.error.data?.typoraCode, "PERMISSION_DENIED")
  })

  it("allows by default when no matching rule exists (implicit true)", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(RpcServer.acl({}))
    server.registerNamespace("test", { hello: () => "world" })
    const { body } = await rpcRequest(url, "test.hello", [])
    server.stop()
    assert.strictEqual(body.result, "world")
  })

  it("method-specific rule takes precedence over namespace rule", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(RpcServer.acl({ "test": false, "test.hello": true }))
    server.registerNamespace("test", { hello: () => "world", secret: () => "secret" })
    const { body: helloBody } = await rpcRequest(url, "test.hello", [])
    const { body: secretBody } = await rpcRequest(url, "test.secret", [])
    server.stop()
    assert.strictEqual(helloBody.result, "world")
    assert.strictEqual(secretBody.error.data?.typoraCode, "PERMISSION_DENIED")
  })

  it("namespace rule takes precedence over wildcard rule", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    server.use(RpcServer.acl({ "*": false, "test": true }))
    server.registerNamespace("test", { hello: () => "world" })
    server.registerNamespace("other", { hello: () => "other" })
    const { body: testBody } = await rpcRequest(url, "test.hello", [])
    const { body: otherBody } = await rpcRequest(url, "other.hello", [])
    server.stop()
    assert.strictEqual(testBody.result, "world")
    assert.strictEqual(otherBody.error.data?.typoraCode, "PERMISSION_DENIED")
  })

  it("function rule is called with ctx and its return value determines access", async () => {
    const { server, url } = await startServer({ enableDiscovery: false })
    let capturedCtx = null
    server.use(RpcServer.acl({
      "test.hello": (ctx) => {
        capturedCtx = ctx
        return true
      },
      "test.secret": () => false,
    }))
    server.registerNamespace("test", { hello: () => "world", secret: () => "secret" })
    const { body: helloBody } = await rpcRequest(url, "test.hello", [])
    const { body: secretBody } = await rpcRequest(url, "test.secret", [])
    server.stop()
    assert.strictEqual(helloBody.result, "world")
    assert.ok(capturedCtx, "function rule should be called with ctx")
    assert.strictEqual(capturedCtx.namespace, "test")
    assert.strictEqual(capturedCtx.methodName, "hello")
    assert.strictEqual(secretBody.error.data?.typoraCode, "PERMISSION_DENIED")
  })

  it("falsy non-false values (0, '') are treated as denied via Boolean()", async () => {
    for (const falsyRule of [0, ""]) {
      const { server, url } = await startServer({ enableDiscovery: false })
      server.use(RpcServer.acl({ "test.hello": falsyRule }))
      server.registerNamespace("test", { hello: () => "world" })
      const { body } = await rpcRequest(url, "test.hello", [])
      server.stop()
      assert.strictEqual(
        body.error.data?.typoraCode,
        "PERMISSION_DENIED",
        `Rule value ${JSON.stringify(falsyRule)} should be treated as denied`,
      )
    }
  })

  it("truthy non-true values (1, 'yes', {}) are treated as allowed via Boolean()", async () => {
    for (const truthyRule of [1, "yes", {}]) {
      const { server, url } = await startServer({ enableDiscovery: false })
      server.use(RpcServer.acl({ "test.hello": truthyRule }))
      server.registerNamespace("test", { hello: () => "world" })
      const { body } = await rpcRequest(url, "test.hello", [])
      server.stop()
      assert.strictEqual(
        body.result,
        "world",
        `Rule value ${JSON.stringify(truthyRule)} should be treated as allowed`,
      )
    }
  })
})

describe("RpcClient - unit tests (mocked fetch)", () => {
  let originalFetch
  before(() => {
    originalFetch = global.fetch
  })
  after(() => {
    global.fetch = originalFetch
  })

  function mockFetchOk(result) {
    let lastBody = null
    global.fetch = async (_url, options) => {
      lastBody = JSON.parse(options.body)
      return {
        ok: true,
        status: 200,
        json: async () => ({ jsonrpc: "2.0", result, id: lastBody.id }),
        text: async () => JSON.stringify({ jsonrpc: "2.0", result, id: lastBody.id }),
      }
    }
    return () => lastBody
  }

  it("invoke sends POST with correct JSON-RPC 2.0 body", async () => {
    const getBody = mockFetchOk(42)
    const client = new SDK("http://localhost:3000")
    await client.invoke("math.add", [1, 2])
    const body = getBody()
    assert.strictEqual(body.jsonrpc, "2.0")
    assert.strictEqual(body.method, "math.add")
    assert.deepStrictEqual(body.params, [1, 2])
    assert.ok(body.id !== undefined, "request should have an id")
  })

  it("invoke sends Content-Type: application/json header", async () => {
    let capturedHeaders = null
    global.fetch = async (_url, options) => {
      capturedHeaders = options.headers
      const body = JSON.parse(options.body)
      return { ok: true, json: async () => ({ jsonrpc: "2.0", result: "ok", id: body.id }) }
    }
    const client = new SDK("http://localhost:3000")
    await client.invoke("test.method", [])
    assert.strictEqual(capturedHeaders["Content-Type"], "application/json")
  })

  it("invoke sends 'Bearer <token>' Authorization header when token is set", async () => {
    let capturedHeaders = null
    global.fetch = async (_url, options) => {
      capturedHeaders = options.headers
      const body = JSON.parse(options.body)
      return { ok: true, json: async () => ({ jsonrpc: "2.0", result: "ok", id: body.id }) }
    }
    const client = new SDK("http://localhost:3000", { token: "my-token" })
    await client.invoke("test.method", [])
    assert.strictEqual(capturedHeaders["Authorization"], "Bearer my-token")
  })

  it("invoke sends empty Authorization header when no token is set", async () => {
    let capturedHeaders = null
    global.fetch = async (_url, options) => {
      capturedHeaders = options.headers
      const body = JSON.parse(options.body)
      return { ok: true, json: async () => ({ jsonrpc: "2.0", result: "ok", id: body.id }) }
    }
    const client = new SDK("http://localhost:3000")
    await client.invoke("test.method", [])
    assert.strictEqual(capturedHeaders["Authorization"], "")
  })

  it("invoke rejects with Transport Error when response is not ok", async () => {
    global.fetch = async () => ({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "Server blew up",
    })
    const client = new SDK("http://localhost:3000")
    await assert.rejects(
      () => client.invoke("test.method", []),
      (err) => {
        assert.ok(err.message.includes("Transport Error"))
        assert.ok(err.message.includes("500"))
        return true
      },
    )
  })

  it("notify does not throw even when response is not ok (fire-and-forget)", async () => {
    global.fetch = async () => ({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "error",
    })
    const client = new SDK("http://localhost:3000")
    // notify has no id, so transport error is silently ignored
    assert.doesNotThrow(() => client.notify("test.method", []))
  })

  it("setToken updates the token used in subsequent requests", async () => {
    let capturedHeaders = null
    global.fetch = async (_url, options) => {
      capturedHeaders = options.headers
      const body = JSON.parse(options.body)
      return { ok: true, json: async () => ({ jsonrpc: "2.0", result: "ok", id: body.id }) }
    }
    const client = new SDK("http://localhost:3000")
    client.setToken("updated-token")
    await client.invoke("test.method", [])
    assert.strictEqual(capturedHeaders["Authorization"], "Bearer updated-token")
  })

  it("setTimeout > 0 attaches an AbortSignal to the fetch request", async () => {
    let capturedSignal = null
    global.fetch = async (_url, options) => {
      capturedSignal = options.signal
      const body = JSON.parse(options.body)
      return { ok: true, json: async () => ({ jsonrpc: "2.0", result: "ok", id: body.id }) }
    }
    const client = new SDK("http://localhost:3000")
    client.setTimeout(5000)
    await client.invoke("test.method", [])
    assert.ok(capturedSignal instanceof AbortSignal, "should attach AbortSignal when timeout > 0")
  })

  it("setTimeout = 0 (default) does not attach an AbortSignal", async () => {
    let capturedSignal = null
    global.fetch = async (_url, options) => {
      capturedSignal = options.signal
      const body = JSON.parse(options.body)
      return { ok: true, json: async () => ({ jsonrpc: "2.0", result: "ok", id: body.id }) }
    }
    const client = new SDK("http://localhost:3000")
    await client.invoke("test.method", [])
    assert.strictEqual(capturedSignal, undefined)
  })
})

describe("SDK - unit tests (mocked fetch)", () => {
  let originalFetch
  before(() => {
    originalFetch = global.fetch
  })
  after(() => {
    global.fetch = originalFetch
  })

  function setupMockFetch(result) {
    let lastBody = null
    global.fetch = async (_url, options) => {
      lastBody = JSON.parse(options.body)
      return {
        ok: true,
        json: async () => ({ jsonrpc: "2.0", result, id: lastBody.id }),
      }
    }
    return () => lastBody
  }

  it("api.system.xxx() calls invoke('system.xxx', [args])", async () => {
    const getBody = setupMockFetch("ok")
    const sdk = new SDK("http://localhost:3000")
    await sdk.api.system.version()
    assert.strictEqual(getBody().method, "system.version")
  })

  it("api.document.xxx() calls invoke('document.xxx', [args])", async () => {
    const getBody = setupMockFetch("ok")
    const sdk = new SDK("http://localhost:3000")
    await sdk.api.document.open("file.md")
    assert.strictEqual(getBody().method, "document.open")
    assert.deepStrictEqual(getBody().params, ["file.md"])
  })

  it("api.plugin.xxx() calls invoke('plugin.xxx', [args])", async () => {
    const getBody = setupMockFetch("ok")
    const sdk = new SDK("http://localhost:3000")
    await sdk.api.plugin.list()
    assert.strictEqual(getBody().method, "plugin.list")
  })

  it("api.config.xxx() calls invoke('config.xxx', [args])", async () => {
    const getBody = setupMockFetch("ok")
    const sdk = new SDK("http://localhost:3000")
    await sdk.api.config.get("key")
    assert.strictEqual(getBody().method, "config.get")
  })

  it("api proxy spreads multiple arguments into params array", async () => {
    const getBody = setupMockFetch("ok")
    const sdk = new SDK("http://localhost:3000")
    await sdk.api.system.method("a", "b", "c")
    assert.deepStrictEqual(getBody().params, ["a", "b", "c"])
  })

  it("api proxy with no arguments produces empty params array", async () => {
    const getBody = setupMockFetch("ok")
    const sdk = new SDK("http://localhost:3000")
    await sdk.api.system.ping()
    assert.deepStrictEqual(getBody().params, [])
  })

  it("api proxy works for any arbitrary method name (dynamic dispatch)", async () => {
    const getBody = setupMockFetch("ok")
    const sdk = new SDK("http://localhost:3000")
    await sdk.api.system.someArbitraryMethodName()
    assert.strictEqual(getBody().method, "system.someArbitraryMethodName")
  })

  it("authenticate(token) sets this.token then calls system.authenticate({ token })", async () => {
    const getBody = setupMockFetch("ok")
    const sdk = new SDK("http://localhost:3000")
    await sdk.authenticate("my-token")
    assert.strictEqual(sdk.token, "my-token")
    assert.strictEqual(getBody().method, "system.authenticate")
    assert.deepStrictEqual(getBody().params, [{ token: "my-token" }])
  })

  it("authenticate(token) returns the result from system.authenticate", async () => {
    setupMockFetch("authenticated")
    const sdk = new SDK("http://localhost:3000")
    const result = await sdk.authenticate("my-token")
    assert.strictEqual(result, "authenticated")
  })

  it("discover() calls invoke('rpc.discover') with no params", async () => {
    const getBody = setupMockFetch({ system: ["version"] })
    const sdk = new SDK("http://localhost:3000")
    const result = await sdk.discover()
    assert.strictEqual(getBody().method, "rpc.discover")
    assert.deepStrictEqual(result, { system: ["version"] })
  })
})

describe("Integration - RpcServer + SDK (real HTTP)", () => {
  let server, sdk

  before(async () => {
    server = new RpcServer({ enableDiscovery: true })
    server.registerNamespace("math", {
      add: ([a, b]) => a + b,
      multiply: ([a, b]) => a * b,
    })
    server.registerNamespace("system", {
      // sdk.authenticate calls api.system.authenticate({ token }), which arrives as [{ token }]
      authenticate: ([{ token }]) => token === "valid-token" ? "ok" : (() => {
        throw new Error("bad token")
      })(),
      version: () => "1.0.0",
    })
    await server.start(0)
    const port = server._server.address().port
    sdk = new SDK(`http://127.0.0.1:${port}`)
    sdk.api.math = sdk._createNamespace("math")
  })

  after(() => server.stop())

  it("sdk.api.math.add() returns correct result", async () => {
    assert.strictEqual(await sdk.api.math.add(3, 7), 10)
  })

  it("sdk.api.math.multiply() returns correct result", async () => {
    assert.strictEqual(await sdk.api.math.multiply(4, 5), 20)
  })

  it("sdk.discover() returns all registered namespaces and their methods", async () => {
    const result = await sdk.discover()
    assert.ok(result.math, "should include math namespace")
    assert.ok(result.system, "should include system namespace")
    assert.deepStrictEqual(result.math.sort(), ["add", "multiply"])
    assert.deepStrictEqual(result.system.sort(), ["authenticate", "version"])
  })

  it("sdk.authenticate() sets token and returns server response", async () => {
    const result = await sdk.authenticate("valid-token")
    assert.strictEqual(sdk.token, "valid-token")
    assert.strictEqual(result, "ok")
  })

  it("sdk.invoke() with unknown method rejects", async () => {
    await assert.rejects(() => sdk.invoke("math.unknown", []))
  })

  it("sdk.api proxy dispatches to any registered method dynamically", async () => {
    assert.strictEqual(await sdk.api.system.version(), "1.0.0")
  })
})

describe("Integration - auth middleware + SDK", () => {
  const TOKEN = "integration-secret"
  let server, url

  before(async () => {
    server = new RpcServer({ enableDiscovery: false })
    server.use(RpcServer.auth({
      validator: (t) => t === TOKEN,
      bypass: ["public.ping"],
    }))
    server.registerNamespace("public", { ping: () => "pong" })
    server.registerNamespace("private", { data: () => "secret-data" })
    await server.start(0)
    url = `http://127.0.0.1:${server._server.address().port}`
  })

  after(() => server.stop())

  it("SDK with valid token can access protected methods", async () => {
    const client = new SDK(url, { token: TOKEN })
    client.api.private = client._createNamespace("private")
    assert.strictEqual(await client.api.private.data(), "secret-data")
  })

  it("SDK without token is rejected for protected methods", async () => {
    const client = new SDK(url)
    client.api.private = client._createNamespace("private")
    await assert.rejects(() => client.api.private.data())
  })

  it("SDK without token can access bypassed methods", async () => {
    const client = new SDK(url)
    client.api.public = client._createNamespace("public")
    assert.strictEqual(await client.api.public.ping(), "pong")
  })

  it("SDK with wrong token is rejected", async () => {
    const client = new SDK(url, { token: "wrong-token" })
    client.api.private = client._createNamespace("private")
    await assert.rejects(() => client.api.private.data())
  })

  it("setToken() enables access after initial rejection", async () => {
    const client = new SDK(url)
    client.api.private = client._createNamespace("private")
    await assert.rejects(() => client.api.private.data())
    client.setToken(TOKEN)
    assert.strictEqual(await client.api.private.data(), "secret-data")
  })
})

describe("Integration - ACL middleware + SDK", () => {
  let server, url, sdk

  before(async () => {
    server = new RpcServer({ enableDiscovery: false })
    server.use(RpcServer.acl({
      "*": false,
      "public": true,
      "admin.status": true,
    }))
    server.registerNamespace("public", { ping: () => "pong", info: () => "info" })
    server.registerNamespace("admin", { status: () => "ok", shutdown: () => "shutdown" })
    await server.start(0)
    url = `http://127.0.0.1:${server._server.address().port}`
    sdk = new SDK(url)
    sdk.api.admin = sdk._createNamespace("admin")
    sdk.api.public = sdk._createNamespace("public")
  })

  after(() => server.stop())

  it("SDK can call all methods in an allowed namespace", async () => {
    assert.strictEqual(await sdk.api.public.ping(), "pong")
    assert.strictEqual(await sdk.api.public.info(), "info")
  })

  it("SDK can call a specifically allowed method in an otherwise-denied namespace", async () => {
    assert.strictEqual(await sdk.api.admin.status(), "ok")
  })

  it("SDK is denied for methods blocked by wildcard rule", async () => {
    await assert.rejects(() => sdk.api.admin.shutdown())
  })
})

describe("Integration - rate limit middleware + SDK", () => {
  it("requests within burst size succeed", async () => {
    const server = new RpcServer({ enableDiscovery: false })
    server.use(RpcServer.rateLimit({ requestsPerMinute: 60, burstSize: 3 }))
    server.registerNamespace("test", { ping: () => "pong" })
    await server.start(0)
    const url = `http://127.0.0.1:${server._server.address().port}`
    const client = new SDK(url)
    client.api.test = client._createNamespace("test")
    assert.strictEqual(await client.api.test.ping(), "pong")
    assert.strictEqual(await client.api.test.ping(), "pong")
    assert.strictEqual(await client.api.test.ping(), "pong")
    server.stop()
  })

  it("requests exceeding burst size are rejected", async () => {
    const server = new RpcServer({ enableDiscovery: false })
    server.use(RpcServer.rateLimit({ requestsPerMinute: 60, burstSize: 2 }))
    server.registerNamespace("test", { ping: () => "pong" })
    await server.start(0)
    const url = `http://127.0.0.1:${server._server.address().port}`
    const client = new SDK(url)
    client.api.test = client._createNamespace("test")
    await client.api.test.ping()
    await client.api.test.ping()
    await assert.rejects(() => client.api.test.ping())
    server.stop()
  })

  it("tokens refill over time allowing requests to resume", async () => {
    const server = new RpcServer({ enableDiscovery: false })
    // 600 req/min = 10 req/sec → 1 token per 100ms; burstSize=1
    server.use(RpcServer.rateLimit({ requestsPerMinute: 600, burstSize: 1 }))
    server.registerNamespace("test", { ping: () => "pong" })
    await server.start(0)
    const url = `http://127.0.0.1:${server._server.address().port}`
    const client = new SDK(url)
    client.api.test = client._createNamespace("test")
    await client.api.test.ping()  // consumes the 1 token
    await assert.rejects(() => client.api.test.ping())  // bucket empty
    await new Promise(r => setTimeout(r, 150))  // wait for refill
    assert.strictEqual(await client.api.test.ping(), "pong")  // token refilled
    server.stop()
  })
})
