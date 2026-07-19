const assert = require("node:assert/strict")
const test = require("node:test")

const {
  annotateSourceOffsets,
  applyAttributeReplacements,
  buildPreviewBridgeSource,
  buildPreviewDocument,
  buildSandbox,
  collectImageReferences,
  discoverRemoteBase,
  isHtmlFile,
  isRelatedDocumentHref,
  normalizeOptions,
  parseSrcset,
} = require("../../plugin/html_editor/core")

test("normalizes HTML editor settings with secure defaults", () => {
  assert.deepEqual(normalizeOptions({}), {
    defaultView: "preview",
    autoPreview: true,
    previewDelay: 300,
    allowScripts: false,
    allowNetwork: false,
    splitSync: true,
    showInFileTree: true,
    editorFontSize: 14,
  })

  assert.deepEqual(normalizeOptions({
    DEFAULT_VIEW: "preview",
    AUTO_PREVIEW: "false",
    PREVIEW_DELAY: 10,
    PREVIEW_ALLOW_SCRIPTS: true,
    PREVIEW_ALLOW_NETWORK: "true",
    SPLIT_SYNC: "false",
    SHOW_IN_FILE_TREE: false,
    EDITOR_FONT_SIZE: 99,
  }), {
    defaultView: "preview",
    autoPreview: false,
    previewDelay: 100,
    allowScripts: true,
    allowNetwork: true,
    splitSync: false,
    showInFileTree: false,
    editorFontSize: 28,
  })
})

test("accepts only HTML and HTM files case-insensitively", () => {
  assert.equal(isHtmlFile("C:/docs/index.html"), true)
  assert.equal(isHtmlFile("C:/docs/INDEX.HTM"), true)
  assert.equal(isHtmlFile("C:/docs/index.Html"), true)
  assert.equal(isHtmlFile("C:/docs/index.xhtml"), false)
  assert.equal(isHtmlFile("C:/docs/readme.md"), false)
})

test("preserves an existing doctype when wrapping fragments without a head", () => {
  const output = buildPreviewDocument("<!doctype html><body>ok</body>", {})
  assert.equal((output.match(/<!doctype html>/gi) || []).length, 1)
  assert.match(output, /^<!doctype html><html><head>/i)
})

test("builds an isolated preview with base URL and restrictive CSP", () => {
  const output = buildPreviewDocument("<html><head><title>Demo</title></head><body>ok</body></html>", {
    baseHref: "file:///C:/docs/",
    allowScripts: false,
    allowNetwork: false,
    runtimeNonce: "runtime-nonce",
    bridgeToken: "bridge-token",
  })

  assert.match(output, /<head><base href="file:\/\/\/C:\/docs\/">/)
  assert.match(output, /http-equiv="Content-Security-Policy"/)
  assert.match(output, /script-src &#39;nonce-runtime-nonce&#39;/)
  assert.match(output, /connect-src &#39;none&#39;/)
  assert.doesNotMatch(output, /https:/)
  assert.match(output, /nonce="runtime-nonce"/)
  assert.match(output, /bridge-token/)
  assert.equal(buildSandbox({ allowScripts: false, allowRuntime: true }), "allow-scripts")
  assert.doesNotMatch(buildSandbox({ allowScripts: false, allowRuntime: true }), /allow-same-origin/)
})

test("script and network access remain opt-in and sandboxed", () => {
  const output = buildPreviewDocument("<p>ok</p>", {
    allowScripts: true,
    allowNetwork: true,
  })

  assert.match(output, /script-src &#39;unsafe-inline&#39; &#39;unsafe-eval&#39;/)
  assert.match(output, /https:/)
  assert.equal(buildSandbox({ allowScripts: true }), "allow-scripts")
  assert.doesNotMatch(buildSandbox({ allowScripts: true }), /allow-same-origin/)
})

test("annotates rendered elements with offsets from the original HTML source", () => {
  const source = [
    "<!doctype html>",
    "<main><img src=\"images/logo.png\"><p class='copy'>Hello</p></main>",
    "<script>const fake = \"<img src='ignore.png'>\"</script>",
  ].join("\n")
  const output = annotateSourceOffsets(source)

  assert.match(output, new RegExp(`data-typora-source-offset=\"${source.indexOf("<main>")}\"`))
  assert.match(output, new RegExp(`data-typora-source-offset=\"${source.indexOf("<img")}\"`))
  assert.match(output, new RegExp(`data-typora-source-offset=\"${source.indexOf("<p")}\"`))
  assert.equal((output.match(/data-typora-source-offset/g) || []).length, 4)
  assert.doesNotMatch(output, /ignore\.png' data-typora-source-offset/)
})

test("discovers and rewrites image-bearing attributes without rebuilding the document", () => {
  const source = '<img src="a.png"><source srcset="a.png 1x, b.png 2x"><svg><image href="icon.svg"></image></svg>'
  const references = collectImageReferences(source)
  assert.deepEqual(references.map(({ tagName, attribute, value }) => ({ tagName, attribute, value })), [
    { tagName: "img", attribute: "src", value: "a.png" },
    { tagName: "source", attribute: "srcset", value: "a.png 1x, b.png 2x" },
    { tagName: "image", attribute: "href", value: "icon.svg" },
  ])
  assert.deepEqual(parseSrcset("a.png 1x, b.png 2x"), [
    { url: "a.png", descriptor: "1x" },
    { url: "b.png", descriptor: "2x" },
  ])

  const output = applyAttributeReplacements(source, references.map(reference => ({
    start: reference.valueStart,
    end: reference.valueEnd,
    value: `data:image/png;base64,${Buffer.from(reference.value).toString("base64")}`,
  })))
  assert.match(output, /src="data:image\/png;base64,/)
  assert.match(output, /srcset="data:image\/png;base64,/)
  assert.match(output, /href="data:image\/png;base64,/)
})

test("uses explicit remote metadata as the online fallback base", () => {
  assert.equal(
    discoverRemoteBase('<base href="https://docs.example.test/library/"><link rel="canonical" href="https://ignored.test/a.html">'),
    "https://docs.example.test/library/",
  )
  assert.equal(
    discoverRemoteBase('<link rel="canonical" href="https://docs.example.test/library/page.html">'),
    "https://docs.example.test/library/",
  )
  assert.equal(
    discoverRemoteBase('<meta property="og:url" content="https://docs.example.test/reference/page.html">'),
    "https://docs.example.test/reference/",
  )
})

test("builds one preview bridge for inspection, navigation, and split synchronization", () => {
  const source = buildPreviewBridgeSource({ bridgeToken: "token-123", splitSync: true })
  assert.match(source, /token-123/)
  assert.match(source, /html-editor:inspect/)
  assert.match(source, /html-editor:navigate/)
  assert.match(source, /html-editor:scroll/)
  assert.match(source, /html-editor:set-scroll-ratio/)
  assert.doesNotMatch(source, /require\(|process\.|electron/i)
})

test("classifies only HTML and Markdown document links for host navigation", () => {
  assert.equal(isRelatedDocumentHref("next.html"), true)
  assert.equal(isRelatedDocumentHref("../guide/README.md#install"), true)
  assert.equal(isRelatedDocumentHref("https://docs.example.test/page.htm?q=1"), true)
  assert.equal(isRelatedDocumentHref("#section"), false)
  assert.equal(isRelatedDocumentHref("image.png"), false)
  assert.equal(isRelatedDocumentHref("javascript:alert(1)"), false)
})
