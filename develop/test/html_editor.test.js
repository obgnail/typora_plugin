const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const test = require("node:test")

global.BasePlugin = class {
  i18n = { t: key => key }
}

const { plugin: HtmlEditorPlugin } = require("../../plugin/html_editor")

test("renders an integrated main-area HTML view instead of a separate modal", () => {
  const instance = new HtmlEditorPlugin()
  instance.pluginName = "HTML 编辑器"
  instance.config = { HOTKEY: "ctrl+alt+h" }
  instance.prepare()

  const html = instance.html()
  assert.match(html, /id="plugin-html-file-view"/)
  assert.match(html, /class="html-file-view plugin-common-hidden is-preview"/)
  assert.match(html, /class="html-editor-source"/)
  assert.match(html, /class="html-editor-preview"/)
  assert.match(html, /data-view="source"/)
  assert.match(html, /data-view="preview"/)
  assert.match(html, /data-view="split"/)
  assert.match(html, /data-action="inspect"/)
  assert.match(html, /class="html-editor-inspector/)
  assert.doesNotMatch(html, /plugin-html-editor-launcher/)
  assert.doesNotMatch(html, /role="dialog"/)
  assert.deepEqual(instance.hotkey(), [{ hotkey: "ctrl+alt+h", callback: instance.call }])
})

test("replaces the Typora writing surface for source, preview, and split layouts", () => {
  const instance = new HtmlEditorPlugin()
  instance.config = {}
  instance.prepare()

  const style = instance.style()
  assert.match(style, /content\.plugin-html-file-active > #write/)
  assert.match(style, /content\.plugin-html-file-active > #typora-source/)
  assert.doesNotMatch(style, /content\.plugin-html-file-active\s*\{[^}]*position:\s*relative/s)
  assert.match(style, /#plugin-html-file-view\s*\{[^}]*width:\s*auto\s*!important/s)
  assert.match(style, /#plugin-html-file-view\s*\{[^}]*height:\s*auto\s*!important/s)
  assert.match(style, /\.html-editor-workspace\s*\{[^}]*flex:\s*1\s+1\s+0/s)
  assert.match(style, /\.html-editor-preview\s*\{[^}]*margin:\s*0\s*!important/s)
  assert.match(style, /content\.plugin-html-file-active\s*~\s*footer\.ty-footer/)
  assert.match(style, /\.is-source \.html-editor-preview-pane/)
  assert.match(style, /\.is-preview \.html-editor-source-pane/)
  assert.match(style, /\.is-split \.html-editor-workspace/)
  assert.match(style, /@media print/)
})

test("renders preview through one blob URL owner and releases retired URLs", async t => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  const blobs = []
  const revoked = []
  URL.createObjectURL = blob => {
    blobs.push(blob)
    return `blob:preview-${blobs.length}`
  }
  URL.revokeObjectURL = url => revoked.push(url)
  t.after(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  const removedAttributes = []
  const preview = {
    src: "",
    setAttribute: () => {},
    removeAttribute: name => removedAttributes.push(name),
  }
  const instance = new HtmlEditorPlugin()
  instance.config = {}
  instance.prepare()
  instance.utils = { Package: { Path: path, FsExtra: {} } }
  instance.activeFile = "C:/docs/demo.html"
  instance.entities = {
    content: { classList: { remove: () => {} } },
    root: { classList: { add: () => {} } },
    source: { value: "<h1>first</h1>" },
    preview,
  }
  instance._syncUI = () => {}

  await instance._renderPreview()
  assert.equal(preview.src, "blob:preview-1")
  assert.match(await blobs[0].text(), /<h1[^>]*>first<\/h1>/)
  assert.deepEqual(revoked, [])

  instance.entities.source.value = "<h1>second</h1>"
  await instance._renderPreview()
  assert.equal(preview.src, "blob:preview-2")
  assert.match(await blobs[1].text(), /<h1[^>]*>second<\/h1>/)
  assert.deepEqual(revoked, ["blob:preview-1"])

  instance._deactivateFile()
  assert.deepEqual(removedAttributes, ["src"])
  assert.deepEqual(revoked, ["blob:preview-1", "blob:preview-2"])
})

test("loads and saves the active HTML source through the host filesystem boundary", async t => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "typora-html-editor-"))
  const filePath = path.join(dir, "demo.html")
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }))
  await fs.promises.writeFile(filePath, "<p>before</p>", "utf8")

  const instance = new HtmlEditorPlugin()
  instance.pluginName = "HTML 编辑器"
  instance.config = {}
  instance.prepare()
  instance.utils = {
    Package: {
      Path: path,
      FsExtra: {
        readFile: fs.promises.readFile,
        writeFile: fs.promises.writeFile,
        stat: fs.promises.stat,
      },
    },
    notification: { show: () => {} },
  }
  instance.entities = { source: { value: "", focus: () => {} } }
  instance._renderPreview = () => {}
  instance._syncUI = () => {}

  await instance._loadSourceFile(filePath)
  assert.equal(instance.entities.source.value, "<p>before</p>")
  instance.entities.source.value = "<p>after</p>"
  assert.equal(await instance._save(), true)
  assert.equal(await fs.promises.readFile(filePath, "utf8"), "<p>after</p>")
  assert.equal(instance.savedSource, "<p>after</p>")
})

test("registers HTML extensions in Typora's file tree without duplicates", t => {
  const previousFile = global.File
  t.after(() => { global.File = previousFile })
  let refreshCount = 0
  global.File = {
    SupportedFiles: ["md", "html"],
    editor: { library: { refreshPanelCommand: () => refreshCount++ } },
  }

  const instance = new HtmlEditorPlugin()
  instance.config = {}
  instance.prepare()
  instance._registerFileTypes()

  assert.deepEqual(global.File.SupportedFiles, ["md", "html", "htm"])
  assert.equal(refreshCount, 1)
})

test("masks HTML before Typora's Markdown parser while retaining source for preview", async () => {
  const instance = new HtmlEditorPlugin()
  instance.config = {}
  instance.prepare()

  const buffer = Buffer.from("<h1>demo</h1>")
  const masked = await instance._maskHtmlReadResult(
    Promise.resolve([true, "<h1>demo</h1>", "utf8", buffer]),
    "C:/docs/demo.html",
  )
  assert.deepEqual(masked.slice(0, 3), [true, "", "utf8"])
  assert.equal(masked[3].length, 0)
  assert.equal(instance.sourceCache.get("C:/docs/demo.html").source, "<h1>demo</h1>")

  await instance._maskHtmlReadResult(
    [true, "", "utf8", Buffer.from("<p>large html</p>")],
    "C:/docs/large.html",
  )
  assert.equal(instance.sourceCache.get("C:/docs/large.html").source, "<p>large html</p>")

  const markdown = [true, "# demo", "utf8", Buffer.from("# demo")]
  assert.equal(await instance._maskHtmlReadResult(markdown, "C:/docs/demo.md"), markdown)
})

test("activates the integrated surface for HTML and restores Typora for Markdown", async t => {
  const previousFile = global.File
  t.after(() => { global.File = previousFile })
  global.File = { bundle: {}, UNSUPPORTED_REASON: { OTHER_FILE: "OTHER_FILE" } }

  const createClassList = initial => {
    const values = new Set(initial)
    return {
      add: (...names) => names.forEach(name => values.add(name)),
      remove: (...names) => names.forEach(name => values.delete(name)),
      contains: name => values.has(name),
    }
  }
  const instance = new HtmlEditorPlugin()
  instance.config = {}
  instance.prepare()
  instance.entities = {
    content: { classList: createClassList([]) },
    root: { classList: createClassList(["plugin-common-hidden"]) },
    source: { value: "" },
    preview: { removeAttribute: () => {} },
  }
  instance._loadSourceFile = async filePath => { instance.activeFile = filePath }
  instance._setViewMode = () => {}
  instance._syncUI = () => {}

  await instance._activateFile("C:/docs/demo.html")
  assert.equal(global.File.bundle.unsupported, "OTHER_FILE")
  assert.equal(instance.entities.content.classList.contains("plugin-html-file-active"), true)
  assert.equal(instance.entities.root.classList.contains("plugin-common-hidden"), false)

  instance._deactivateFile()
  assert.equal(instance.entities.content.classList.contains("plugin-html-file-active"), false)
  assert.equal(instance.entities.root.classList.contains("plugin-common-hidden"), true)
  assert.equal(instance.activeFile, "")
})

test("inlines a readable local image before building the blob preview", async t => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "typora-html-images-"))
  const htmlPath = path.join(dir, "page.html")
  const imagePath = path.join(dir, "logo.png")
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }))
  await fs.promises.writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]))

  const instance = new HtmlEditorPlugin()
  instance.config = {}
  instance.prepare()
  instance.activeFile = htmlPath
  instance.utils = {
    Package: { Path: path, FsExtra: { readFile: fs.promises.readFile, stat: fs.promises.stat } },
    getMountFolder: () => dir,
  }

  const output = await instance._preparePreviewSource('<main><img src="./logo.png"></main>', 1)
  assert.match(output, /src="data:image\/png;base64,iVBORw=="/)
  assert.match(output, /data-typora-source-offset="6"/)
})

test("downloads a missing relative image from canonical online metadata only when network is enabled", async () => {
  const requested = []
  const instance = new HtmlEditorPlugin()
  instance.config = { PREVIEW_ALLOW_NETWORK: true }
  instance.prepare()
  instance.activeFile = path.join(os.tmpdir(), "missing", "page.html")
  instance.utils = {
    Package: { Path: path, FsExtra: { stat: async () => { throw new Error("missing") } } },
    getMountFolder: () => os.tmpdir(),
    fetch: async url => {
      requested.push(url)
      return {
        ok: true,
        headers: { get: name => name.toLowerCase() === "content-type" ? "image/png" : null },
        buffer: async () => Buffer.from([1, 2, 3]),
      }
    },
  }

  const output = await instance._preparePreviewSource(
    '<link rel="canonical" href="https://docs.example.test/library/page.html"><img src="_static/logo.png">',
    1,
  )
  assert.deepEqual(requested, ["https://docs.example.test/library/_static/logo.png"])
  assert.match(output, /src="data:image\/png;base64,AQID"/)
})

test("validates preview bridge messages before selecting the original source tag", () => {
  const instance = new HtmlEditorPlugin()
  instance.config = {}
  instance.prepare()
  const sourceWindow = {}
  let inspected = null
  instance.previewBridgeToken = "bridge-token"
  instance.entities = { preview: { contentWindow: sourceWindow } }
  instance._showInspectedElement = payload => { inspected = payload }

  instance._handlePreviewMessage({
    source: sourceWindow,
    data: { channel: "typora-html-editor", token: "wrong", type: "html-editor:inspect", payload: { offset: 4 } },
  })
  assert.equal(inspected, null)

  instance._handlePreviewMessage({
    source: sourceWindow,
    data: { channel: "typora-html-editor", token: "bridge-token", type: "html-editor:inspect", payload: { offset: 4, end: 10 } },
  })
  assert.deepEqual(inspected, { offset: 4, end: 10 })
})

test("jumps to inspected source offsets and routes related local documents through Typora", async t => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "typora-html-links-"))
  const htmlPath = path.join(dir, "page.html")
  const markdownPath = path.join(dir, "guide.md")
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }))
  await fs.promises.writeFile(markdownPath, "# Guide", "utf8")

  const opened = []
  const source = {
    value: "<main><p>hello</p></main>",
    selectionStart: 0,
    selectionEnd: 0,
    scrollHeight: 300,
    clientHeight: 100,
    scrollTop: 0,
    focus: () => {},
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end },
  }
  const instance = new HtmlEditorPlugin()
  instance.config = {}
  instance.prepare()
  instance.activeFile = htmlPath
  instance.entities = { source }
  instance._setViewMode = mode => { instance.viewMode = mode }
  instance.utils = {
    Package: { Path: path, FsExtra: { stat: fs.promises.stat } },
    openFile: target => opened.push(target),
    openUrl: target => opened.push(target),
  }

  instance._jumpToSource(6, 18)
  assert.equal(instance.viewMode, "split")
  assert.deepEqual([source.selectionStart, source.selectionEnd], [6, 18])

  await instance._handlePreviewNavigation({ href: "guide.md", resolvedHref: "" })
  assert.deepEqual(opened, [markdownPath])
  await instance._handlePreviewNavigation({ href: "https://docs.example.test/other.html", resolvedHref: "https://docs.example.test/other.html" })
  assert.deepEqual(opened, [markdownPath, "https://docs.example.test/other.html"])
})

test("synchronizes source and preview scroll ratios only in enabled split mode", () => {
  const instance = new HtmlEditorPlugin()
  instance.config = { SPLIT_SYNC: true }
  instance.prepare()
  const sent = []
  instance.viewMode = "split"
  instance.entities = {
    source: { scrollTop: 100, scrollHeight: 500, clientHeight: 100 },
  }
  instance._postPreviewMessage = (type, payload) => sent.push({ type, payload })

  instance._handleSourceScroll()
  assert.deepEqual(sent, [{ type: "html-editor:set-scroll-ratio", payload: { ratio: 0.25 } }])
  instance._handlePreviewScroll({ ratio: 0.5 })
  assert.equal(instance.entities.source.scrollTop, 200)

  instance.options.splitSync = false
  instance.entities.source.scrollTop = 50
  instance._handleSourceScroll()
  instance._handlePreviewScroll({ ratio: 1 })
  assert.equal(sent.length, 1)
  assert.equal(instance.entities.source.scrollTop, 50)
})
