const http = require("http")
const { JSONRPCServer, JSONRPCErrorCode, JSONRPCErrorException } = require("./json-rpc-2.0.min.js")

class TokenBucketLimiter {
  cache = new Map()
  lastGcTime = Date.now()

  constructor(requestsPerMinute, burstSize, staleThresholdMs = 3600000) {
    this.refillRate = requestsPerMinute / 60000
    this.burstSize = burstSize
    this.staleThresholdMs = staleThresholdMs
  }

  consume(key) {
    const now = Date.now()
    if (now - this.lastGcTime > this.staleThresholdMs) {
      for (const [k, session] of this.cache.entries()) {
        if (now - session.lastRefillTime > this.staleThresholdMs) this.cache.delete(k)
      }
      this.lastGcTime = now
    }
    if (!this.cache.has(key)) {
      this.cache.set(key, { tokens: this.burstSize, lastRefillTime: now })
    }
    const session = this.cache.get(key)
    session.tokens = Math.min(this.burstSize, session.tokens + (now - session.lastRefillTime) * this.refillRate)
    session.lastRefillTime = now
    if (session.tokens < 1) return false
    session.tokens -= 1
    return true
  }
}

class RpcServer {
  _rpc = new JSONRPCServer()
  _server = null
  _middleware = []
  _registry = new Map()

  constructor({ enableDiscovery = true } = {}) {
    if (enableDiscovery) {
      this._rpc.addMethod("rpc.discover", () => this.getRegisteredMethods())
    }
  }

  static auth({ validator, bypass = [] }) {
    return ({ namespace, methodName, context }) => {
      if (bypass.includes(`${namespace}.${methodName}`)) return true
      const authHeader = context.req.headers["authorization"]
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""
      if (!validator(token)) {
        throw new JSONRPCErrorException("Unauthorized", JSONRPCErrorCode.InvalidRequest, { typoraCode: "AUTH_FAILED" })
      }
      return true
    }
  }

  static rateLimit({ requestsPerMinute, burstSize, staleThresholdMs }) {
    const limiter = new TokenBucketLimiter(requestsPerMinute, burstSize, staleThresholdMs)
    return ({ namespace, methodName, context }) => {
      const key = `${context.remoteAddress}:${namespace}.${methodName}`
      if (!limiter.consume(key)) {
        throw new JSONRPCErrorException("Rate limit exceeded", JSONRPCErrorCode.InvalidRequest, { typoraCode: "RATE_LIMIT_EXCEEDED" })
      }
      return true
    }
  }

  static acl(rules) {
    return (ctx) => {
      const fullMethod = `${ctx.namespace}.${ctx.methodName}`
      const rule = rules[fullMethod] ?? rules[ctx.namespace] ?? rules["*"] ?? true
      const isAllowed = typeof rule === "function" ? rule(ctx) : Boolean(rule)
      if (!isAllowed) {
        throw new JSONRPCErrorException("Access denied by ACL", JSONRPCErrorCode.InvalidRequest, { typoraCode: "PERMISSION_DENIED" })
      }
      return true
    }
  }

  use(middleware) {
    if (typeof middleware !== "function") {
      throw new TypeError("[RpcServer] Middleware must be a function")
    }
    this._middleware.push(middleware)
    return this
  }

  registerNamespace(namespace, methods) {
    const methodNames = new Set()
    for (const [methodName, handler] of Object.entries(methods)) {
      methodNames.add(methodName)
      this._rpc.addMethod(
        `${namespace}.${methodName}`,
        this._createHandler(handler, namespace, methodName),
      )
    }
    this._registry.set(namespace, methodNames)
    return this
  }

  getRegisteredMethods() {
    return Object.fromEntries(
      [...this._registry.entries()].map(([ns, methods]) => [ns, Array.from(methods)]),
    )
  }

  start(port = 3000) {
    this._server = http.createServer((req, res) => this._handleRequest(req, res))
    return new Promise((resolve, reject) => {
      this._server.listen(port, "127.0.0.1", (err) => {
        if (err) return reject(err)
        console.log(`[RpcServer] System online. Listening on 127.0.0.1:${port}`)
        resolve(this)
      })
    })
  }

  stop() {
    if (this._server?.listening) {
      this._server.close(() => console.log("[RpcServer] System goes offline."))
    }
  }

  _createHandler(handler, namespace, methodName) {
    return async (params, context) => {
      const methodContext = { namespace, methodName, params, context }
      for (const middleware of this._middleware) {
        if (await middleware(methodContext) === false) {
          throw new JSONRPCErrorException("Middleware rejected request", JSONRPCErrorCode.InvalidRequest, { typoraCode: "MIDDLEWARE_REJECTED" })
        }
      }
      try {
        return await handler(params, context)
      } catch (error) {
        if (error instanceof JSONRPCErrorException) throw error
        throw new JSONRPCErrorException(error.message || "Internal Error", JSONRPCErrorCode.InternalError, { typoraCode: "INTERNAL_ERROR" })
      }
    }
  }

  async _handleRequest(req, res) {
    if (req.method !== "POST") {
      return this._sendResponse(res, 405, "Method Not Allowed")
    }
    try {
      const body = await this._readRequestBody(req)
      const jsonRequest = JSON.parse(body)
      const context = {
        req,
        res,
        timestamp: Date.now(),
        remoteAddress: req.socket.remoteAddress,
      }
      const jsonResponse = await this._rpc.receive(jsonRequest, context)
      if (jsonResponse) {
        this._sendResponse(res, 200, JSON.stringify(jsonResponse), "application/json")
      } else {
        this._sendResponse(res, 204)
      }
    } catch (error) {
      const isParseError = error instanceof SyntaxError
      const errorResponse = {
        jsonrpc: "2.0",
        error: {
          code: isParseError ? JSONRPCErrorCode.ParseError : (error.code ?? JSONRPCErrorCode.InternalError),
          message: isParseError ? "Parse error" : (error.message || "Internal error"),
          data: error.data ?? null,
        },
        id: null,
      }
      this._sendResponse(res, isParseError ? 400 : 500, JSON.stringify(errorResponse), "application/json")
    }
  }

  async _readRequestBody(req) {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks).toString("utf8")
  }

  _sendResponse(res, statusCode, payload = "", contentType = "text/plain") {
    res.writeHead(statusCode, payload ? { "Content-Type": contentType } : {})
    res.end(payload)
  }
}

module.exports = { RpcServer, JSONRPCErrorCode, JSONRPCErrorException }
