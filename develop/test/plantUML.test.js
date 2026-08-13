const { describe, it } = require("node:test")
const assert = require("node:assert")
const { RENDER_MODE, createRenderEngine, defaultModeResolver, testServer } = require("../../plugin/plantUML/server.js")

// ---- Helpers to build fake fetch Response objects ----
function makeResponse({ ok = true, status = 200, contentType = "image/svg+xml", body = "<svg></svg>", text } = {}) {
  const buf = Buffer.from(body)
  return {
    ok,
    status,
    headers: { get: (name) => (name.toLowerCase() === "content-type" ? contentType : null) },
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    text: async () => (text !== undefined ? text : body),
  }
}

describe("plantUML/server.js - encodeUML (via GET mode, indirectly)", () => {
  it("GET request URL is built as {url}/{format}/{encoded}", async () => {
    let capturedUrl = null
    const fetchMock = async (url, opts) => {
      capturedUrl = url
      assert.strictEqual(opts.method, "GET")
      return makeResponse({ contentType: "image/svg+xml" })
    }
    const engine = createRenderEngine({
      fetch: fetchMock,
      getBaseUrl: () => "https://plantuml.example.com",
      getFormat: () => "svg",
      getTimeout: () => 5000,
      getProxy: () => "",
      resolveMode: () => RENDER_MODE.GET,
    })
    await engine("@startuml\nA -> B\n@enduml")
    assert.match(capturedUrl, /^https:\/\/plantuml\.example\.com\/svg\/[A-Za-z0-9\-_]+$/)
  })

  it("produces a deterministic PlantUML-alphabet encoding for identical input", async () => {
    const urls = []
    const fetchMock = async (url) => {
      urls.push(url)
      return makeResponse()
    }
    const engine = createRenderEngine({
      fetch: fetchMock,
      getBaseUrl: () => "https://x.example.com",
      getFormat: () => "svg",
      getTimeout: () => 5000,
      getProxy: () => "",
      resolveMode: () => RENDER_MODE.GET,
    })
    await engine("@startuml\nA -> B\n@enduml")
    await engine("@startuml\nA -> B\n@enduml")
    assert.strictEqual(urls[0], urls[1])
  })

  it("different input content produces different encoded URLs", async () => {
    const urls = []
    const fetchMock = async (url) => {
      urls.push(url)
      return makeResponse()
    }
    const engine = createRenderEngine({
      fetch: fetchMock,
      getBaseUrl: () => "https://x.example.com",
      getFormat: () => "svg",
      getTimeout: () => 5000,
      getProxy: () => "",
      resolveMode: () => RENDER_MODE.GET,
    })
    await engine("@startuml\nA -> B\n@enduml")
    await engine("@startuml\nC -> D\n@enduml")
    assert.notStrictEqual(urls[0], urls[1])
  })
})

describe("plantUML/server.js - executeGet (via RENDER_MODE.GET)", () => {
  const buildEngine = (fetchMock, resolveMode = () => RENDER_MODE.GET) => createRenderEngine({
    fetch: fetchMock,
    getBaseUrl: () => "https://plantuml.example.com",
    getFormat: () => "svg",
    getTimeout: () => 5000,
    getProxy: () => "",
    resolveMode,
  })

  it("returns { contentType, buffer } on success", async () => {
    const engine = buildEngine(async () => makeResponse({ contentType: "image/svg+xml", body: "<svg>ok</svg>" }))
    const result = await engine("@startuml\nA -> B\n@enduml")
    assert.strictEqual(result.contentType, "image/svg+xml")
    assert.ok(Buffer.isBuffer(result.buffer))
    assert.strictEqual(result.buffer.toString("utf-8"), "<svg>ok</svg>")
  })

  it("returns an Error (not throws) with a special message for HTTP 414", async () => {
    const engine = buildEngine(async () => makeResponse({ ok: false, status: 414 }))
    const result = await engine("content")
    assert.ok(result instanceof Error)
    assert.match(result.message, /414 URI Too Long/)
    assert.match(result.message, /Deploy a local PlantUML server/)
  })

  it("returns a generic HTTP error for other failing statuses, including response body text", async () => {
    const engine = buildEngine(async () => makeResponse({ ok: false, status: 500, text: "boom" }))
    const result = await engine("content")
    assert.ok(result instanceof Error)
    assert.strictEqual(result.message, "HTTP 500: boom")
  })

  it("returns an 'HTML Trap' Error when content-type is html (server returned a UI page instead of an image)", async () => {
    const engine = buildEngine(async () => makeResponse({ contentType: "text/html; charset=utf-8", body: "<html></html>" }))
    const result = await engine("content")
    assert.ok(result instanceof Error)
    assert.match(result.message, /HTML Trap/)
  })

  it("passes timeout and proxy through to fetch options", async () => {
    let capturedOpts = null
    const engine = createRenderEngine({
      fetch: async (_url, opts) => {
        capturedOpts = opts
        return makeResponse()
      },
      getBaseUrl: () => "https://x.example.com",
      getFormat: () => "png",
      getTimeout: () => 12345,
      getProxy: () => "http://proxy.local:8080",
      resolveMode: () => RENDER_MODE.GET,
    })
    await engine("content")
    assert.strictEqual(capturedOpts.timeout, 12345)
    assert.strictEqual(capturedOpts.proxy, "http://proxy.local:8080")
    assert.strictEqual(capturedOpts.redirect, "follow")
  })
})

describe("plantUML/server.js - executePost (via RENDER_MODE.POST)", () => {
  const buildEngine = (fetchMock) => createRenderEngine({
    fetch: fetchMock,
    getBaseUrl: () => "https://plantuml.example.com",
    getFormat: () => "svg",
    getTimeout: () => 5000,
    getProxy: () => "",
    resolveMode: () => RENDER_MODE.POST,
  })

  it("POSTs to {url}/{format}/ with a Readable stream body and text/plain content-type", async () => {
    let capturedUrl, capturedOpts
    const engine = buildEngine(async (url, opts) => {
      capturedUrl = url
      capturedOpts = opts
      return makeResponse()
    })
    await engine("@startuml\nA -> B\n@enduml")
    assert.strictEqual(capturedUrl, "https://plantuml.example.com/svg/")
    assert.strictEqual(capturedOpts.method, "POST")
    assert.strictEqual(capturedOpts.headers["Content-Type"], "text/plain; charset=utf-8")
    assert.strictEqual(capturedOpts.redirect, "error")
    // body should be a Readable stream wrapping the raw content
    assert.strictEqual(typeof capturedOpts.body.pipe, "function")
  })

  it("resolves the content correctly through the Readable stream body", async () => {
    let received = Buffer.alloc(0)
    const engine = buildEngine(async (_url, opts) => {
      for await (const chunk of opts.body) {
        received = Buffer.concat([received, chunk])
      }
      return makeResponse()
    })
    await engine("@startuml\nHello\n@enduml")
    assert.strictEqual(received.toString("utf-8"), "@startuml\nHello\n@enduml")
  })

  it("catches non-ok responses and wraps them as a 'POST rendering strategy failed abruptly' Error (returned, not thrown)", async () => {
    const engine = buildEngine(async () => makeResponse({ ok: false, status: 405 }))
    const result = await engine("content")
    assert.ok(result instanceof Error)
    assert.match(result.message, /POST rendering strategy failed/)
    assert.match(result.message, /HTTP 405/)
  })

  it("catches HTML-trap errors from executePost and wraps them the same way", async () => {
    const engine = buildEngine(async () => makeResponse({ contentType: "text/html" }))
    const result = await engine("content")
    assert.ok(result instanceof Error)
    assert.match(result.message, /POST rendering strategy failed/)
    assert.match(result.message, /HTML Trap Detected/)
  })

  it("returns { contentType, buffer } on success", async () => {
    const engine = buildEngine(async () => makeResponse({ contentType: "image/png", body: "PNGDATA" }))
    const result = await engine("content")
    assert.strictEqual(result.contentType, "image/png")
    assert.strictEqual(result.buffer.toString("utf-8"), "PNGDATA")
  })
})

describe("plantUML/server.js - AUTO mode / probing & downgrade behavior", () => {
  it("AUTO mode tries POST first; on success it caches POST for the same base URL", async () => {
    let postCalls = 0
    const fetchMock = async (_url, opts) => {
      if (opts.method === "POST") postCalls++
      return makeResponse()
    }
    const engine = createRenderEngine({
      fetch: fetchMock,
      getBaseUrl: () => "https://x.example.com",
      getFormat: () => "svg",
      getTimeout: () => 5000,
      getProxy: () => "",
      resolveMode: null, // no resolver -> defaults to RENDER_MODE.AUTO
    })
    await engine("content1")
    await engine("content2")
    assert.strictEqual(postCalls, 2, "both calls should use POST once probed successfully")
  })

  it("AUTO mode downgrades to GET after a 405 from POST, and caches GET thereafter", async () => {
    let postCalls = 0, getCalls = 0
    const fetchMock = async (_url, opts) => {
      if (opts.method === "POST") {
        postCalls++
        return makeResponse({ ok: false, status: 405 })
      }
      getCalls++
      return makeResponse({ ok: true })
    }
    const engine = createRenderEngine({
      fetch: fetchMock,
      getBaseUrl: () => "https://downgrade.example.com",
      getFormat: () => "svg",
      getTimeout: () => 5000,
      getProxy: () => "",
      resolveMode: null,
    })
    const first = await engine("content1")
    assert.ok(!(first instanceof Error))
    assert.strictEqual(postCalls, 1)
    assert.strictEqual(getCalls, 1)

    // second call should go straight to GET (cached), no more POST attempts
    const second = await engine("content2")
    assert.ok(!(second instanceof Error))
    assert.strictEqual(postCalls, 1, "probeCache should prevent re-trying POST")
    assert.strictEqual(getCalls, 2)
  })

  it("AUTO mode downgrades to GET after a 404 from POST", async () => {
    const fetchMock = async (_url, opts) => {
      if (opts.method === "POST") return makeResponse({ ok: false, status: 404 })
      return makeResponse({ ok: true })
    }
    const engine = createRenderEngine({
      fetch: fetchMock,
      getBaseUrl: () => "https://x404.example.com",
      getFormat: () => "svg",
      getTimeout: () => 5000,
      getProxy: () => "",
      resolveMode: null,
    })
    const result = await engine("content")
    assert.ok(!(result instanceof Error))
  })

  it("AUTO mode returns the error directly (no downgrade) for non-404/405 failures", async () => {
    let getCalls = 0
    const fetchMock = async (_url, opts) => {
      if (opts.method === "POST") return makeResponse({ ok: false, status: 500, text: "server error" })
      getCalls++
      return makeResponse({ ok: true })
    }
    const engine = createRenderEngine({
      fetch: fetchMock,
      getBaseUrl: () => "https://x500.example.com",
      getFormat: () => "svg",
      getTimeout: () => 5000,
      getProxy: () => "",
      resolveMode: null,
    })
    const result = await engine("content")
    assert.ok(result instanceof Error)
    assert.match(result.message, /HTTP 500/)
    assert.strictEqual(getCalls, 0, "should not attempt GET fallback for a 500 error")
  })

  it("probeCache is keyed per base URL — different URLs probe independently", async () => {
    const postCallsByUrl = {}
    const fetchMock = async (url, opts) => {
      const base = url.split("/svg")[0]
      if (opts.method === "POST") {
        postCallsByUrl[base] = (postCallsByUrl[base] || 0) + 1
        if (base.includes("fails")) return makeResponse({ ok: false, status: 405 })
        return makeResponse({ ok: true })
      }
      return makeResponse({ ok: true })
    }
    const engineA = createRenderEngine({
      fetch: fetchMock, getBaseUrl: () => "https://ok.example.com", getFormat: () => "svg",
      getTimeout: () => 5000, getProxy: () => "", resolveMode: null,
    })
    const engineB = createRenderEngine({
      fetch: fetchMock, getBaseUrl: () => "https://fails.example.com", getFormat: () => "svg",
      getTimeout: () => 5000, getProxy: () => "", resolveMode: null,
    })
    await engineA("content")
    await engineB("content")
    // Each engine's probeCache is local to its own createRenderEngine() closure,
    // so both attempt POST independently on first call.
    assert.strictEqual(postCallsByUrl["https://ok.example.com"], 1)
    assert.strictEqual(postCallsByUrl["https://fails.example.com"], 1)
  })
})

describe("plantUML/server.js - resolveMode explicit override", () => {
  it("resolveMode returning RENDER_MODE.POST forces POST without probing", async () => {
    let getCalls = 0, postCalls = 0
    const fetchMock = async (_url, opts) => {
      if (opts.method === "GET") getCalls++
      if (opts.method === "POST") postCalls++
      return makeResponse()
    }
    const engine = createRenderEngine({
      fetch: fetchMock,
      getBaseUrl: () => "https://x.example.com",
      getFormat: () => "svg",
      getTimeout: () => 5000,
      getProxy: () => "",
      resolveMode: () => RENDER_MODE.POST,
    })
    await engine("content")
    assert.strictEqual(postCalls, 1)
    assert.strictEqual(getCalls, 0)
  })

  it("resolveMode returning RENDER_MODE.GET forces GET without attempting POST", async () => {
    let getCalls = 0, postCalls = 0
    const fetchMock = async (_url, opts) => {
      if (opts.method === "GET") getCalls++
      if (opts.method === "POST") postCalls++
      return makeResponse()
    }
    const engine = createRenderEngine({
      fetch: fetchMock,
      getBaseUrl: () => "https://x.example.com",
      getFormat: () => "svg",
      getTimeout: () => 5000,
      getProxy: () => "",
      resolveMode: () => RENDER_MODE.GET,
    })
    await engine("content")
    assert.strictEqual(getCalls, 1)
    assert.strictEqual(postCalls, 0)
  })

  it("resolveMode returning a falsy value falls back to AUTO", async () => {
    let postCalls = 0
    const fetchMock = async (_url, opts) => {
      if (opts.method === "POST") postCalls++
      return makeResponse()
    }
    const engine = createRenderEngine({
      fetch: fetchMock,
      getBaseUrl: () => "https://x.example.com",
      getFormat: () => "svg",
      getTimeout: () => 5000,
      getProxy: () => "",
      resolveMode: () => undefined,
    })
    await engine("content")
    assert.strictEqual(postCalls, 1, "AUTO mode tries POST first")
  })

  it("resolveMode is optional (undefined) and defaults to AUTO behavior", async () => {
    let postCalls = 0
    const fetchMock = async (_url, opts) => {
      if (opts.method === "POST") postCalls++
      return makeResponse()
    }
    const engine = createRenderEngine({
      fetch: fetchMock,
      getBaseUrl: () => "https://x.example.com",
      getFormat: () => "svg",
      getTimeout: () => 5000,
      getProxy: () => "",
      resolveMode: undefined,
    })
    await engine("content")
    assert.strictEqual(postCalls, 1)
  })
})

describe("plantUML/server.js - defaultModeResolver", () => {
  it("returns GET for plantuml.com URLs", () => {
    assert.strictEqual(defaultModeResolver("https://www.plantuml.com/plantuml"), RENDER_MODE.GET)
  })

  it("is case-insensitive", () => {
    assert.strictEqual(defaultModeResolver("HTTPS://WWW.PLANTUML.COM/plantuml"), RENDER_MODE.GET)
  })

  it("returns POST for kroki.io URLs", () => {
    assert.strictEqual(defaultModeResolver("https://kroki.io/plantuml"), RENDER_MODE.POST)
  })

  it("returns POST for localhost URLs", () => {
    assert.strictEqual(defaultModeResolver("http://localhost:8080"), RENDER_MODE.POST)
  })

  it("returns POST for 127.0.0.1 URLs", () => {
    assert.strictEqual(defaultModeResolver("http://127.0.0.1:8080"), RENDER_MODE.POST)
  })

  it("returns AUTO for unrecognized hosts", () => {
    assert.strictEqual(defaultModeResolver("https://my-custom-server.example.com"), RENDER_MODE.AUTO)
  })
})

describe("plantUML/server.js - testServer", () => {
  it("returns success:true with a fixed 'Connection Successful' message on valid svg response", async () => {
    const fetchMock = async () => makeResponse({ contentType: "image/svg+xml", body: "<svg></svg>" })
    const result = await testServer({ url: "https://x.example.com/", proxy: "", fetch: fetchMock })
    assert.deepStrictEqual(result, { success: true, message: "Connection Successful" })
  })

  it("accepts image/* content types as valid too", async () => {
    const fetchMock = async () => makeResponse({ contentType: "image/png", body: "PNG" })
    const result = await testServer({ url: "https://x.example.com/", proxy: "", fetch: fetchMock, format: "png" })
    assert.strictEqual(result.success, true)
  })

  it("strips trailing slashes from url before probing (getBaseUrl behavior)", async () => {
    let capturedUrl = null
    const fetchMock = async (url) => {
      capturedUrl = url
      return makeResponse()
    }
    await testServer({ url: "https://x.example.com///", proxy: "", fetch: fetchMock })
    assert.ok(capturedUrl.startsWith("https://x.example.com/"))
    assert.ok(!capturedUrl.startsWith("https://x.example.com///"))
  })

  it("returns success:false with the underlying error message when the engine returns an Error", async () => {
    const fetchMock = async () => makeResponse({ ok: false, status: 500, text: "server down" })
    const result = await testServer({ url: "https://x.example.com/", proxy: "", fetch: fetchMock })
    assert.strictEqual(result.success, false)
    assert.match(result.message, /HTTP 500/)
  })

  it("returns success:false with 'Invalid content type returned' when response is ok but not svg/image", async () => {
    const fetchMock = async () => makeResponse({ contentType: "application/json", body: "{}" })
    const result = await testServer({ url: "https://x.example.com/", proxy: "", fetch: fetchMock })
    assert.strictEqual(result.success, false)
    assert.match(result.message, /Invalid content type returned/)
  })

  it("returns success:false when fetch itself throws synchronously/rejects", async () => {
    const fetchMock = async () => {
      throw new Error("network unreachable")
    }
    const result = await testServer({ url: "https://x.example.com/", proxy: "", fetch: fetchMock })
    assert.strictEqual(result.success, false)
    assert.match(result.message, /network unreachable/)
  })

  it("passes resolveMode:null explicitly, so testServer always uses AUTO probing regardless of URL", async () => {
    let postCalls = 0, getCalls = 0
    const fetchMock = async (_url, opts) => {
      if (opts.method === "POST") postCalls++
      if (opts.method === "GET") getCalls++
      return makeResponse()
    }
    // Even a plantuml.com-style URL (which defaultModeResolver would map to GET) should use AUTO/POST-first
    // here, because testServer always creates its engine with resolveMode: null.
    await testServer({ url: "https://www.plantuml.com/plantuml", proxy: "", fetch: fetchMock })
    assert.strictEqual(postCalls, 1)
    assert.strictEqual(getCalls, 0)
  })

  it("uses the default timeout of 10000ms when not specified", async () => {
    let capturedOpts = null
    const fetchMock = async (_url, opts) => {
      capturedOpts = opts
      return makeResponse()
    }
    await testServer({ url: "https://x.example.com/", proxy: "", fetch: fetchMock })
    assert.strictEqual(capturedOpts.timeout, 10_000)
  })

  it("uses the default format 'svg' when not specified", async () => {
    let capturedUrl = null
    const fetchMock = async (url) => {
      capturedUrl = url
      return makeResponse()
    }
    await testServer({ url: "https://x.example.com/", proxy: "", fetch: fetchMock })
    assert.ok(capturedUrl.includes("/svg/"))
  })

  it("passes proxy through to the underlying request", async () => {
    let capturedOpts = null
    const fetchMock = async (_url, opts) => {
      capturedOpts = opts
      return makeResponse()
    }
    await testServer({ url: "https://x.example.com/", proxy: "http://my-proxy:3128", fetch: fetchMock })
    assert.strictEqual(capturedOpts.proxy, "http://my-proxy:3128")
  })
})

describe("plantUML/server.js - RENDER_MODE constant", () => {
  it("exposes the expected numeric enum values", () => {
    assert.deepStrictEqual(RENDER_MODE, { AUTO: 0, POST: 1, GET: 2 })
  })
})
