const { JSONRPCClient } = require("./json-rpc-2.0.min.js")

class RpcClient {
  constructor(endpoint, { token = null, timeout = 0 } = {}) {
    this._endpoint = endpoint
    this.token = token
    this.timeout = timeout
    this._rpc = new JSONRPCClient(this._transport)
  }

  setToken(token) {
    this.token = token
  }

  setTimeout(timeout) {
    this.timeout = timeout
  }

  async invoke(method, params) {
    return this._rpc.request(method, params)
  }

  notify(method, params) {
    this._rpc.notify(method, params)
  }

  _transport = async jsonRPCRequest => {
    const response = await fetch(this._endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": this.token ? `Bearer ${this.token}` : "",
      },
      body: JSON.stringify(jsonRPCRequest),
      signal: this.timeout > 0 ? AbortSignal.timeout(this.timeout) : undefined,
    })
    if (response.ok) {
      const jsonRPCResponse = await response.json()
      this._rpc.receive(jsonRPCResponse)
    } else if (jsonRPCRequest.id !== undefined) {
      const errorText = await response.text().catch(() => "Unknown Error")
      throw new Error(`[RpcClient] Transport Error: ${response.status} ${response.statusText} - ${errorText}`)
    }
  }
}

class SDK extends RpcClient {
  api = {
    system: this._createNamespace("system"),
    document: this._createNamespace("document"),
    plugin: this._createNamespace("plugin"),
    config: this._createNamespace("config"),
  }

  constructor(endpoint, options) {
    super(endpoint, options)
  }

  _createNamespace(namespace) {
    return new Proxy({}, {
      get: (_, methodName) => (...params) =>
        this.invoke(`${namespace}.${methodName}`, params),
    })
  }

  async authenticate(token) {
    this.token = token
    return this.api.system.authenticate({ token })
  }

  async discover() {
    return this.invoke("rpc.discover")
  }
}

module.exports = SDK
