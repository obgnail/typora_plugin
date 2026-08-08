const RENDER_MODE = { AUTO: 0, POST: 1, GET: 2 }

const createRenderEngine = (context) => {
  const { Readable } = require("stream")
  const { fetch, getBaseUrl, getFormat, getTimeout, getProxy, resolveMode } = context
  const headers = { "User-Agent": "Typora-Plugin/1.0.0" }
  const probeCache = Object.create(null)

  const encodeUML = (text) => {
    const zlib = require("zlib")
    const b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    const uml = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_"
    const buffer = zlib.deflateRawSync(text)
    return buffer.toString("base64").replace(/[A-Za-z0-9+/]/g, c => uml[b64.indexOf(c)]).replace(/=/g, "")
  }

  const executeGet = async (content, req) => {
    const resp = await fetch(`${req.url}/${req.format}/${encodeUML(content)}`, {
      method: "GET", headers, timeout: req.timeout, proxy: req.proxy, redirect: "follow",
    })
    if (!resp.ok) {
      const msg = resp.status === 414
        ? `[HTTP 414 URI Too Long]\nFatal: Server DOES NOT support large diagrams via GET.\nDeploy a local PlantUML server (supports POST).`
        : `HTTP ${resp.status}: ${await resp.text()}`
      return new Error(msg)
    }
    const contentType = resp.headers.get("content-type") || ""
    if (contentType.includes("html")) return new Error(`HTML Trap: Expected image stream but got Web UI.`)
    return { contentType, buffer: Buffer.from(await resp.arrayBuffer()) }
  }

  /**
   * WORKAROUND: The `body` is explicitly wrapped in a native Readable stream containing a single Buffer.
   * This mitigates a compatibility issue between `node-fetch` v3 and legacy Node.js/Electron environments.
   * It prevents `node-fetch` from treating cross-context `Uint8Array` payloads as basic iterables,
   * which would otherwise feed individual byte numbers to Node's underlying `http.ClientRequest.write()`
   * and trigger a "Received type number" TypeError.
   */
  const executePost = async (content, req) => {
    const resp = await fetch(`${req.url}/${req.format}/`, {
      method: "POST",
      body: Readable.from([Buffer.from(content)]),
      headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
      timeout: req.timeout, proxy: req.proxy, redirect: "error",
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const contentType = resp.headers.get("content-type") || ""
    if (contentType.includes("html")) throw new Error("HTML Trap Detected")
    return { contentType, buffer: Buffer.from(await resp.arrayBuffer()) }
  }

  return async (content) => {
    const req = { url: getBaseUrl(), format: getFormat(), timeout: getTimeout(), proxy: getProxy() }

    const mode = probeCache[req.url] || resolveMode?.(req.url) || RENDER_MODE.AUTO
    if (mode === RENDER_MODE.GET) {
      return await executeGet(content, req)
    }
    if (mode === RENDER_MODE.POST) {
      try {
        return await executePost(content, req)
      } catch (e) {
        return new Error(`POST rendering strategy failed.\nDetails: ${e.stack}`)
      }
    }

    try {
      const result = await executePost(content, req)
      probeCache[req.url] = RENDER_MODE.POST
      return result
    } catch (err) {
      const shouldDowngrade = err.message.includes("HTTP 405") || err.message.includes("HTTP 404")
      if (shouldDowngrade) {
        probeCache[req.url] = RENDER_MODE.GET
        return await executeGet(content, req)
      }
      return err
    }
  }
}

const testServer = async ({ url, proxy, fetch, format = "svg", timeout = 10_000 }) => {
  const engine = createRenderEngine({
    fetch,
    getBaseUrl: () => url.replace(/\/+$/, ""),
    getFormat: () => format,
    getTimeout: () => timeout,
    getProxy: () => proxy,
    resolveMode: null,
  })

  try {
    const result = await engine(`@startuml\nTest -> Server: Ping\n@enduml`)
    if (result instanceof Error) {
      return { success: false, message: result.message }
    }
    if (!result.contentType.includes("svg") && !result.contentType.includes("image")) {
      return { success: false, message: `Invalid content type returned: ${result.contentType}` }
    }
    return { success: true, message: `Connection Successful` }
  } catch (err) {
    return { success: false, message: err.message }
  }
}

const defaultModeResolver = (url) => {
  const feature = url.toLowerCase()
  if (feature.includes("plantuml.com")) return RENDER_MODE.GET
  if (feature.includes("kroki.io") || feature.includes("localhost") || feature.includes("127.0.0.1")) return RENDER_MODE.POST
  return RENDER_MODE.AUTO
}

module.exports = {
  RENDER_MODE,
  createRenderEngine,
  defaultModeResolver,
  testServer,
}
