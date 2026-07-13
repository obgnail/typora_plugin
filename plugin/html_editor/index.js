const { randomBytes } = require("crypto")
const { fileURLToPath, pathToFileURL } = require("url")
const {
  annotateSourceOffsets,
  applyAttributeReplacements,
  buildPreviewDocument,
  buildSandbox,
  collectImageReferences,
  discoverRemoteBase,
  isHtmlFile,
  isRelatedDocumentHref,
  normalizeOptions,
  parseSrcset,
} = require("./core")

const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const MAX_IMAGE_REFERENCES = 64
const IMAGE_MIME_TYPES = Object.freeze({
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
})

const clampRatio = value => Math.max(0, Math.min(1, Number(value) || 0))

const decodeUrlPath = value => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const detectImageMime = (buffer, resource = "", contentType = "") => {
  const declared = String(contentType || "").split(";", 1)[0].trim().toLowerCase()
  if (declared.startsWith("image/")) return declared
  const extension = String(resource || "").split(/[?#]/, 1)[0]
  const suffix = extension.slice(extension.lastIndexOf(".")).toLowerCase()
  if (IMAGE_MIME_TYPES[suffix]) return IMAGE_MIME_TYPES[suffix]
  if (!Buffer.isBuffer(buffer)) return ""
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png"
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg"
  if (buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString("ascii"))) return "image/gif"
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp"
  if (/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(buffer.subarray(0, 512).toString("utf8"))) return "image/svg+xml"
  return ""
}

const toDataUrl = (buffer, resource, contentType = "") => {
  const mime = detectImageMime(buffer, resource, contentType)
  return mime ? `data:${mime};base64,${buffer.toString("base64")}` : ""
}

const toBase64Url = buffer => buffer.toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/g, "")

class HtmlEditorPlugin extends BasePlugin {
  prepare = () => {
    this.options = normalizeOptions(this.config)
    this.sourceCache = new Map()
    this.activeFile = ""
    this.currentStat = null
    this.savedSource = ""
    this.viewMode = this.options.defaultView
    this.previewTimer = null
    this.previewUrl = ""
    this.previewRenderToken = 0
    this.previewBridgeToken = ""
    this.remoteImageCache = new Map()
    this.inspectorEnabled = false
    this.syncingSourceScroll = false
    this.activationToken = 0
    this.bypassOpenGuard = false
  }

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  style = () => `
    content.plugin-html-file-active {
      overflow: hidden !important;
    }
    content.plugin-html-file-active > #write,
    content.plugin-html-file-active > #typora-source,
    content.plugin-html-file-active > #ty-oversize-body {
      display: none !important;
    }
    content.plugin-html-file-active ~ footer.ty-footer {
      display: none !important;
    }
    #plugin-html-file-view {
      --html-editor-bg: #fff;
      --html-editor-toolbar-bg: #f8fafc;
      --html-editor-hover: rgba(15, 23, 42, .06);
      --html-editor-active: rgba(66, 133, 244, .12);
      --html-editor-border: rgba(15, 23, 42, .12);
      --html-editor-text: #172033;
      --html-editor-subtext: #64748b;
      --html-editor-primary: #4285f4;
      --html-editor-warning: #b45309;
      position: absolute !important;
      top: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      left: 0 !important;
      width: auto !important;
      height: auto !important;
      max-width: none !important;
      max-height: none !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box;
      z-index: 20;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-width: 0;
      min-height: 0;
      color: var(--html-editor-text);
      background: var(--html-editor-bg);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #plugin-html-file-view .html-editor-header {
      display: flex;
      flex: 0 0 52px;
      align-items: center;
      gap: 12px;
      min-width: 0;
      padding: 0 16px;
      background: var(--html-editor-toolbar-bg);
      border-bottom: 1px solid var(--html-editor-border);
    }
    #plugin-html-file-view .html-editor-heading {
      min-width: 0;
      flex: 1;
    }
    #plugin-html-file-view .html-editor-title,
    #plugin-html-file-view .html-editor-path {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #plugin-html-file-view .html-editor-title {
      font-size: 15px;
      font-weight: 600;
    }
    #plugin-html-file-view .html-editor-path {
      margin-top: 1px;
      color: var(--html-editor-subtext);
      font-size: 10px;
    }
    #plugin-html-file-view button {
      box-sizing: border-box;
      min-height: 30px;
      padding: 4px 9px;
      color: inherit;
      background: var(--html-editor-bg);
      border: 1px solid var(--html-editor-border);
      border-radius: 6px;
      cursor: pointer;
      transition: background .15s, border-color .15s, color .15s;
    }
    #plugin-html-file-view button:hover:not(:disabled) {
      background: var(--html-editor-hover);
    }
    #plugin-html-file-view button:disabled {
      cursor: not-allowed;
      opacity: .45;
    }
    #plugin-html-file-view .html-editor-view-group {
      display: inline-flex;
      flex: none;
      padding: 2px;
      background: var(--html-editor-hover);
      border-radius: 8px;
    }
    #plugin-html-file-view .html-editor-view-group button {
      border-color: transparent;
      background: transparent;
    }
    #plugin-html-file-view .html-editor-view-group button[aria-pressed="true"] {
      color: var(--html-editor-primary);
      background: var(--html-editor-active);
      border-color: rgba(66, 133, 244, .22);
    }
    #plugin-html-file-view > .html-editor-header > button[aria-pressed="true"] {
      color: var(--html-editor-primary);
      background: var(--html-editor-active);
      border-color: rgba(66, 133, 244, .22);
    }
    #plugin-html-file-view .html-editor-workspace {
      display: grid;
      flex: 1 1 0;
      width: 100%;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      background: var(--html-editor-bg);
    }
    #plugin-html-file-view.is-split .html-editor-workspace {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
    #plugin-html-file-view .html-editor-pane {
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    #plugin-html-file-view .html-editor-source-pane {
      display: flex;
      border-right: 1px solid var(--html-editor-border);
    }
    #plugin-html-file-view .html-editor-source {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 18px;
      resize: none;
      color: var(--html-editor-text);
      background: var(--html-editor-bg);
      border: 0;
      outline: 0;
      font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
      line-height: 1.55;
      tab-size: 2;
      white-space: pre;
    }
    #plugin-html-file-view .html-editor-preview-pane {
      position: relative;
      display: flex;
      background: #fff;
    }
    #plugin-html-file-view .html-editor-preview {
      display: block;
      width: 100%;
      height: 100%;
      max-width: none !important;
      margin: 0 !important;
      background: #fff;
      border: 0;
    }
    #plugin-html-file-view.is-source .html-editor-preview-pane,
    #plugin-html-file-view.is-preview .html-editor-source-pane {
      display: none;
    }
    #plugin-html-file-view.is-source .html-editor-workspace,
    #plugin-html-file-view.is-preview .html-editor-workspace {
      grid-template-columns: minmax(0, 1fr);
    }
    #plugin-html-file-view .html-editor-inspector {
      position: absolute;
      right: 12px;
      bottom: 12px;
      z-index: 4;
      box-sizing: border-box;
      width: min(380px, calc(100% - 24px));
      max-height: min(520px, calc(100% - 24px));
      overflow: auto;
      color: var(--html-editor-text);
      background: var(--html-editor-bg);
      border: 1px solid var(--html-editor-border);
      border-radius: 9px;
      box-shadow: 0 14px 36px rgba(15, 23, 42, .2);
    }
    #plugin-html-file-view .html-editor-inspector.plugin-common-hidden {
      display: none !important;
    }
    #plugin-html-file-view .html-editor-inspector-header {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      background: var(--html-editor-toolbar-bg);
      border-bottom: 1px solid var(--html-editor-border);
    }
    #plugin-html-file-view .html-editor-inspector-header button {
      min-width: 28px;
      min-height: 26px;
      padding: 2px 7px;
    }
    #plugin-html-file-view .html-editor-inspector-body {
      padding: 10px;
      font-size: 12px;
    }
    #plugin-html-file-view .html-editor-inspector-selector {
      display: block;
      margin-top: 5px;
      overflow-wrap: anywhere;
      color: var(--html-editor-primary);
      font-family: "Cascadia Code", Consolas, monospace;
    }
    #plugin-html-file-view .html-editor-inspector-box {
      margin: 8px 0;
      color: var(--html-editor-subtext);
    }
    #plugin-html-file-view .html-editor-inspector details {
      margin-top: 8px;
    }
    #plugin-html-file-view .html-editor-inspector pre {
      max-height: 160px;
      margin: 5px 0 0;
      padding: 8px;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      color: inherit;
      background: var(--html-editor-hover);
      border-radius: 6px;
      font: 11px/1.45 "Cascadia Code", Consolas, monospace;
    }
    #plugin-html-file-view .html-editor-footer {
      display: flex;
      flex: 0 0 30px;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-width: 0;
      padding: 0 12px;
      color: var(--html-editor-subtext);
      background: var(--html-editor-toolbar-bg);
      border-top: 1px solid var(--html-editor-border);
      font-size: 10px;
    }
    #plugin-html-file-view .html-editor-status,
    #plugin-html-file-view .html-editor-security {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #plugin-html-file-view .html-editor-security.is-warning {
      color: var(--html-editor-warning);
      font-weight: 600;
    }
    body.plugin-dark-mode #plugin-html-file-view {
      --html-editor-bg: #1e1e20;
      --html-editor-toolbar-bg: #252529;
      --html-editor-hover: rgba(255, 255, 255, .07);
      --html-editor-active: rgba(138, 180, 248, .14);
      --html-editor-border: rgba(255, 255, 255, .1);
      --html-editor-text: #f1f5f9;
      --html-editor-subtext: #9ca3af;
      --html-editor-primary: #8ab4f8;
      --html-editor-warning: #fbbf24;
    }
    @media (max-width: 760px) {
      #plugin-html-file-view .html-editor-header {
        flex-wrap: wrap;
        height: auto;
        padding-top: 7px;
        padding-bottom: 7px;
      }
      #plugin-html-file-view .html-editor-heading {
        flex-basis: 100%;
      }
      #plugin-html-file-view.is-split .html-editor-workspace {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
      }
      #plugin-html-file-view .html-editor-source-pane {
        border-right: 0;
        border-bottom: 1px solid var(--html-editor-border);
      }
    }
    @media print {
      #plugin-html-file-view {
        display: none !important;
      }
    }
  `

  html = () => `
    <section id="plugin-html-file-view" class="html-file-view plugin-common-hidden is-${this.options.defaultView}" aria-label="${this.i18n.t("aria.fileView")}">
      <div class="html-editor-header">
        <div class="html-editor-heading">
          <div class="html-editor-title">HTML</div>
          <div class="html-editor-path"></div>
        </div>
        <button type="button" data-action="open" title="${this.i18n.t("action.openTitle")}"><span class="fa fa-folder-open-o"></span> ${this.i18n.t("action.open")}</button>
        <button type="button" data-action="save" title="${this.i18n.t("action.saveTitle")}" disabled><span class="fa fa-save"></span> ${this.i18n.t("action.save")}</button>
        <button type="button" data-action="reload" title="${this.i18n.t("action.reloadTitle")}"><span class="fa fa-refresh"></span></button>
        <button type="button" data-action="external" title="${this.i18n.t("action.externalTitle")}"><span class="fa fa-external-link"></span></button>
        <button type="button" data-action="inspect" aria-pressed="false" title="${this.i18n.t("action.inspectTitle")}"><span class="fa fa-crosshairs"></span> ${this.i18n.t("action.inspect")}</button>
        <div class="html-editor-view-group" aria-label="${this.i18n.t("aria.viewMode")}">
          <button type="button" data-view="source" aria-pressed="false">${this.i18n.t("view.source")}</button>
          <button type="button" data-view="preview" aria-pressed="true">${this.i18n.t("view.preview")}</button>
          <button type="button" data-view="split" aria-pressed="false">${this.i18n.t("view.split")}</button>
        </div>
      </div>
      <div class="html-editor-workspace">
        <div class="html-editor-pane html-editor-source-pane">
          <textarea class="html-editor-source" aria-label="${this.i18n.t("aria.sourceEditor")}" spellcheck="false"></textarea>
        </div>
        <div class="html-editor-pane html-editor-preview-pane">
          <iframe class="html-editor-preview" title="${this.i18n.t("aria.preview")}" sandbox="" referrerpolicy="no-referrer"></iframe>
          <aside class="html-editor-inspector plugin-common-hidden" aria-label="${this.i18n.t("aria.inspector")}">
            <div class="html-editor-inspector-header">
              <strong>${this.i18n.t("inspector.title")}</strong>
              <button type="button" data-action="close-inspector" title="${this.i18n.t("inspector.close")}">×</button>
            </div>
            <div class="html-editor-inspector-body">
              <strong class="html-editor-inspector-tag">${this.i18n.t("inspector.noSelection")}</strong>
              <code class="html-editor-inspector-selector"></code>
              <div class="html-editor-inspector-box"></div>
              <details open><summary>${this.i18n.t("inspector.attributes")}</summary><pre class="html-editor-inspector-attributes"></pre></details>
              <details><summary>${this.i18n.t("inspector.text")}</summary><pre class="html-editor-inspector-text"></pre></details>
            </div>
          </aside>
        </div>
      </div>
      <div class="html-editor-footer">
        <div class="html-editor-status" aria-live="polite"></div>
        <div class="html-editor-security"></div>
      </div>
    </section>
  `

  init = () => {
    const root = document.querySelector("#plugin-html-file-view")
    const content = this.utils.entities.eContent
    content.appendChild(root)
    this.entities = {
      content,
      root,
      title: root.querySelector(".html-editor-title"),
      path: root.querySelector(".html-editor-path"),
      source: root.querySelector(".html-editor-source"),
      preview: root.querySelector(".html-editor-preview"),
      status: root.querySelector(".html-editor-status"),
      security: root.querySelector(".html-editor-security"),
      open: root.querySelector('[data-action="open"]'),
      save: root.querySelector('[data-action="save"]'),
      reload: root.querySelector('[data-action="reload"]'),
      external: root.querySelector('[data-action="external"]'),
      inspect: root.querySelector('[data-action="inspect"]'),
      closeInspector: root.querySelector('[data-action="close-inspector"]'),
      inspector: root.querySelector(".html-editor-inspector"),
      inspectorTag: root.querySelector(".html-editor-inspector-tag"),
      inspectorSelector: root.querySelector(".html-editor-inspector-selector"),
      inspectorBox: root.querySelector(".html-editor-inspector-box"),
      inspectorAttributes: root.querySelector(".html-editor-inspector-attributes"),
      inspectorText: root.querySelector(".html-editor-inspector-text"),
      views: [...root.querySelectorAll("[data-view]")],
    }
    this.entities.source.style.fontSize = `${this.options.editorFontSize}px`
    this._setViewMode(this.viewMode, false)
    this._syncSecurityLabel()
  }

  process = () => {
    this._registerFileTypes(false)
    this._installReadMask()
    this._installOpenGuard()
    this._installSaveRedirect()

    this.entities.open.addEventListener("click", () => void this._chooseFile())
    this.entities.save.addEventListener("click", () => void this._save())
    this.entities.reload.addEventListener("click", () => void this._reload())
    this.entities.external.addEventListener("click", () => this.activeFile && this.utils.openPath(this.activeFile))
    this.entities.inspect.addEventListener("click", () => this._toggleInspector())
    this.entities.closeInspector.addEventListener("click", () => this._toggleInspector(false))
    this.entities.views.forEach(button => button.addEventListener("click", () => this._setViewMode(button.dataset.view)))
    this.entities.source.addEventListener("input", this._handleSourceInput)
    this.entities.source.addEventListener("keydown", this._handleEditorKeydown)
    this.entities.source.addEventListener("scroll", this._handleSourceScroll, { passive: true })
    this.entities.preview.addEventListener("load", this._handlePreviewLoad)
    document.addEventListener("keydown", this._handleDocumentKeydown, true)
    window.addEventListener("beforeunload", this._handleBeforeUnload)
    window.addEventListener("message", this._handlePreviewMessage)

    const eventType = this.utils.eventHub?.eventType
    if (eventType?.fileContentLoaded) {
      this.utils.eventHub.addEventListener(eventType.fileContentLoaded, this._handleFileContentLoaded)
    }
    if (eventType?.allPluginsHadInjected) {
      this.utils.eventHub.addEventListener(eventType.allPluginsHadInjected, () => this._registerFileTypes(true))
    }
  }

  call = () => {
    if (this.activeFile) {
      this._setViewMode(this.viewMode === "preview" ? "source" : "preview")
    } else {
      void this._chooseFile()
    }
  }

  _registerFileTypes = (refresh = true) => {
    if (!this.options.showInFileTree || !Array.isArray(File?.SupportedFiles)) return false
    let changed = false
    for (const extension of ["html", "htm"]) {
      if (!File.SupportedFiles.includes(extension)) {
        File.SupportedFiles.push(extension)
        changed = true
      }
    }
    if (refresh) File.editor?.library?.refreshPanelCommand?.()
    return changed
  }

  _installReadMask = () => {
    this.utils.decorator.modifyReturn(
      () => File,
      "readContentFrom",
      (result, filePath) => this._maskHtmlReadResult(result, filePath),
      { priority: -200 },
    ).catch(error => this._showError(this.i18n.t("error.hookRead"), error))
  }

  _maskHtmlReadResult = async (result, filePath) => {
    const payload = await result
    if (!isHtmlFile(filePath) || !Array.isArray(payload) || !payload[0]) return payload
    const encoding = payload[2] || "utf8"
    let source = String(payload[1] || "")
    if (!source && Buffer.isBuffer(payload[3]) && payload[3].length) {
      try {
        source = payload[3].toString(encoding.replace(/-bom$/i, ""))
      } catch {
        source = payload[3].toString("utf8")
      }
    }
    const entry = { source, encoding }
    this.sourceCache.set(String(filePath), entry)
    this.sourceCache.set(this._normalizedPath(filePath), entry)
    return [true, "", entry.encoding, Buffer.alloc(0)]
  }

  _installOpenGuard = () => {
    this.utils.decorator.preventCallIf(
      () => File?.editor?.library,
      "openFile",
      target => {
        if (this.bypassOpenGuard || !this._isDirty() || this._samePath(target, this.activeFile)) return false
        const name = this.utils.Package.Path.basename(target || "")
        void this._confirmDiscard(this.i18n.t("action.openTarget", { name })).then(confirmed => {
          if (!confirmed) return
          this.bypassOpenGuard = true
          try {
            File.editor.library.openFile(target)
          } finally {
            this.bypassOpenGuard = false
          }
        })
        return true
      },
      { priority: -200 },
    ).catch(error => this._showError(this.i18n.t("error.hookSwitch"), error))
  }

  _installSaveRedirect = () => {
    this.utils.decorator.preventCallIf(
      () => File,
      "saveUseNode",
      () => {
        if (!this.activeFile || !this._samePath(this.utils.getFilePath(), this.activeFile)) return false
        void this._save()
        return true
      },
      { priority: -200 },
    ).catch(error => this._showError(this.i18n.t("error.hookSave"), error))
  }

  _handleFileContentLoaded = filePath => {
    const target = filePath || this.utils.getFilePath()
    if (isHtmlFile(target)) {
      void this._activateFile(target)
    } else {
      this._deactivateFile()
    }
  }

  _activateFile = async filePath => {
    const token = ++this.activationToken
    try {
      await this._loadSourceFile(filePath)
      if (token !== this.activationToken) return
      if (File?.bundle) {
        File.bundle.unsupported = File.UNSUPPORTED_REASON?.OTHER_FILE || "OTHER_FILE"
      }
      this.entities.content.classList.add("plugin-html-file-active")
      this.entities.root.classList.remove("plugin-common-hidden")
      this._setViewMode(this.options.defaultView)
      this._syncUI(this.i18n.t("status.loaded"))
    } catch (error) {
      this._showError(this.i18n.t("error.load"), error)
      this._deactivateFile()
    }
  }

  _deactivateFile = () => {
    this.activationToken++
    this.previewRenderToken++
    clearTimeout(this.previewTimer)
    if (!this.entities) return
    this.entities.content.classList.remove("plugin-html-file-active")
    this.entities.root.classList.add("plugin-common-hidden")
    this.activeFile = ""
    this.currentStat = null
    this.savedSource = ""
    this.entities.source.value = ""
    this.entities.preview.removeAttribute("src")
    this.previewBridgeToken = ""
    this.inspectorEnabled = false
    this.entities.inspect?.setAttribute("aria-pressed", "false")
    this.entities.inspector?.classList.add("plugin-common-hidden")
    this._releasePreviewUrl()
  }

  _loadSourceFile = async filePath => {
    if (!isHtmlFile(filePath)) throw new TypeError(this.i18n.t("error.unsupported"))
    const resolved = this._normalizedPath(filePath)
    const cached = this.sourceCache.get(String(filePath)) || this.sourceCache.get(resolved)
    const source = cached?.source ?? await this.utils.Package.FsExtra.readFile(filePath, "utf8")
    const stat = await this.utils.Package.FsExtra.stat(filePath)

    this.activeFile = resolved
    this.currentStat = { mtimeMs: stat.mtimeMs, size: stat.size }
    this.savedSource = source
    this.entities.source.value = source
    this.sourceCache.delete(String(filePath))
    this.sourceCache.delete(resolved)
    void this._renderPreview()
    this._syncUI(this.i18n.t("status.loaded"))
    return source
  }

  _chooseFile = async () => {
    if (this._isDirty() && !await this._confirmDiscard(this.i18n.t("action.openOther"))) return
    try {
      const { canceled, filePaths } = await JSBridge.invoke("dialog.showOpenDialog", {
        title: this.i18n.t("dialog.openTitle"),
        properties: ["openFile"],
        filters: [{ name: this.i18n.t("dialog.htmlFiles"), extensions: ["html", "htm"] }],
      })
      if (!canceled && filePaths?.[0]) this.utils.openFile(filePaths[0])
    } catch (error) {
      this._showError(this.i18n.t("error.open"), error)
    }
  }

  _save = async () => {
    if (!this.activeFile) return false
    try {
      if (await this._hasExternalChange() && !await this._confirmExternalOverwrite()) return false
      const source = this.entities.source.value
      await this.utils.Package.FsExtra.writeFile(this.activeFile, source, "utf8")
      const stat = await this.utils.Package.FsExtra.stat(this.activeFile)
      this.currentStat = { mtimeMs: stat.mtimeMs, size: stat.size }
      this.savedSource = source
      this._syncUI(this.i18n.t("status.saved"))
      this._notify(this.i18n.t("notify.saved"), "success")
      return true
    } catch (error) {
      this._showError(this.i18n.t("error.save"), error)
      return false
    }
  }

  _reload = async () => {
    if (!this.activeFile || this._isDirty() && !await this._confirmDiscard(this.i18n.t("action.reload"))) return
    const filePath = this.activeFile
    this.sourceCache.delete(filePath)
    try {
      await this._loadSourceFile(filePath)
    } catch (error) {
      this._showError(this.i18n.t("error.reload"), error)
    }
  }

  _handleSourceInput = () => {
    this._syncUI()
    if (this.options.autoPreview) this._schedulePreview()
  }

  _handleEditorKeydown = event => {
    if (event.key !== "Tab") return
    event.preventDefault()
    const { selectionStart, selectionEnd, value } = this.entities.source
    this.entities.source.value = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`
    this.entities.source.selectionStart = this.entities.source.selectionEnd = selectionStart + 2
    this._handleSourceInput()
  }

  _handleDocumentKeydown = event => {
    if (!this.activeFile || !this.entities.content.classList.contains("plugin-html-file-active")) return
    if (!(event.ctrlKey || event.metaKey)) return
    const key = event.key.toLowerCase()
    if (key === "s") {
      event.preventDefault()
      event.stopImmediatePropagation()
      void this._save()
    } else if (key === "o") {
      event.preventDefault()
      event.stopImmediatePropagation()
      void this._chooseFile()
    } else if (key === "e") {
      event.preventDefault()
      event.stopImmediatePropagation()
      this._setViewMode(this.viewMode === "preview" ? "source" : "preview")
    }
  }

  _handleBeforeUnload = event => {
    if (!this._isDirty()) return
    event.preventDefault()
    event.returnValue = ""
  }

  _setViewMode = (mode, shouldRender = true) => {
    if (!["source", "preview", "split"].includes(mode)) mode = "preview"
    this.viewMode = mode
    if (!this.entities?.root) return
    this.entities.root.classList.remove("is-source", "is-preview", "is-split")
    this.entities.root.classList.add(`is-${mode}`)
    this.entities.views.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.view === mode)))
    if (mode === "source" && this.inspectorEnabled) this._toggleInspector(false)
    if (shouldRender && mode !== "source") void this._renderPreview()
    this._postPreviewMessage("html-editor:set-sync", { enabled: this.options.splitSync && mode === "split" })
    if (mode !== "preview") this.entities.source.focus()
  }

  _schedulePreview = () => {
    clearTimeout(this.previewTimer)
    this.previewTimer = setTimeout(() => void this._renderPreview(), this.options.previewDelay)
  }

  _renderPreview = async () => {
    if (!this.entities?.preview) return false
    const renderToken = ++this.previewRenderToken
    const source = this.entities.source.value
    this._syncUI(this.i18n.t("status.preparingPreview"))
    const preparedSource = await this._preparePreviewSource(source, renderToken)
    if (renderToken !== this.previewRenderToken || !this.entities?.preview) return false
    const path = this.utils.Package.Path
    const baseHref = this.activeFile
      ? pathToFileURL(path.dirname(this.activeFile) + path.sep).href
      : ""
    const runtimeNonce = toBase64Url(randomBytes(18))
    const bridgeToken = toBase64Url(randomBytes(24))
    const previewDocument = buildPreviewDocument(preparedSource, {
      baseHref,
      allowScripts: this.options.allowScripts,
      allowNetwork: this.options.allowNetwork,
      splitSync: this.options.splitSync,
      runtimeNonce,
      bridgeToken,
    })
    const retiredUrl = this.previewUrl
    this.previewBridgeToken = bridgeToken
    this.previewUrl = URL.createObjectURL(new Blob([previewDocument], { type: "text/html;charset=utf-8" }))
    this.entities.preview.setAttribute("sandbox", buildSandbox({ ...this.options, allowRuntime: true }))
    this.entities.preview.src = this.previewUrl
    if (retiredUrl) URL.revokeObjectURL(retiredUrl)
    this._syncUI(this.i18n.t("status.previewUpdated"))
    return true
  }

  _preparePreviewSource = async source => {
    const annotated = annotateSourceOffsets(source)
    const references = collectImageReferences(annotated).slice(0, MAX_IMAGE_REFERENCES)
    if (!references.length) return annotated
    const remoteBase = discoverRemoteBase(source)
    const replacements = await Promise.all(references.map(async reference => {
      if (reference.attribute === "srcset") {
        const entries = parseSrcset(reference.value)
        if (!entries.length) return null
        const resolved = await Promise.all(entries.map(async entry => ({
          ...entry,
          url: await this._resolvePreviewImage(entry.url, remoteBase),
        })))
        return {
          start: reference.valueStart,
          end: reference.valueEnd,
          value: resolved.map(entry => `${entry.url}${entry.descriptor ? ` ${entry.descriptor}` : ""}`).join(", "),
        }
      }
      return {
        start: reference.valueStart,
        end: reference.valueEnd,
        value: await this._resolvePreviewImage(reference.value, remoteBase),
      }
    }))
    return applyAttributeReplacements(annotated, replacements.filter(Boolean))
  }

  _resolvePreviewImage = async (value, remoteBase) => {
    const resource = String(value || "").trim()
    if (!resource || /^(?:data|blob|about|javascript):/i.test(resource) || resource.startsWith("#")) return resource
    const localPath = this._resolveLocalResourcePath(resource)
    if (localPath) {
      const localData = await this._readLocalImage(localPath)
      if (localData) return localData
    }
    if (!this.options.allowNetwork) return resource
    const remoteUrl = this._resolveRemoteResourceUrl(resource, remoteBase)
    return remoteUrl ? this._downloadRemoteImage(remoteUrl, resource) : resource
  }

  _resolveLocalResourcePath = resource => {
    const path = this.utils.Package.Path
    const mountFolder = this.utils.getMountFolder?.() || ""
    try {
      if (/^file:/i.test(resource)) return fileURLToPath(new URL(resource))
      if (/^https?:/i.test(resource) || /^[A-Za-z][A-Za-z\d+.-]*:/.test(resource) && !/^[A-Za-z]:[\\/]/.test(resource)) return ""
      const clean = decodeUrlPath(resource.split(/[?#]/, 1)[0])
      if (!clean) return ""
      if (/^[\\/]{2}/.test(clean) || path.isAbsolute(clean) && !/^[\\/]/.test(clean)) return path.resolve(clean)
      if (/^[\\/]/.test(clean) && mountFolder) return path.resolve(mountFolder, clean.replace(/^[\\/]+/, ""))
      return this.activeFile ? path.resolve(path.dirname(this.activeFile), clean) : ""
    } catch {
      return ""
    }
  }

  _readLocalImage = async filePath => {
    const fs = this.utils.Package.FsExtra
    if (!fs?.stat || !fs?.readFile) return ""
    try {
      const stat = await fs.stat(filePath)
      if (stat.isFile && !stat.isFile() || stat.size > MAX_IMAGE_BYTES) return ""
      const buffer = await fs.readFile(filePath)
      if (!Buffer.isBuffer(buffer) || buffer.length > MAX_IMAGE_BYTES) return ""
      return toDataUrl(buffer, filePath)
    } catch {
      return ""
    }
  }

  _resolveRemoteResourceUrl = (resource, remoteBase) => {
    try {
      const url = /^https?:/i.test(resource)
        ? new URL(resource)
        : remoteBase ? new URL(resource, remoteBase) : null
      return url && /^https?:$/.test(url.protocol) ? url.href : ""
    } catch {
      return ""
    }
  }

  _downloadRemoteImage = async (url, original) => {
    if (!this.utils.fetch) return original
    if (!this.remoteImageCache.has(url)) {
      const pending = (async () => {
        const response = await this.utils.fetch(url, {
          timeout: 15000,
          headers: { Accept: "image/avif,image/webp,image/svg+xml,image/*,*/*;q=0.8" },
        })
        if (!response?.ok) throw new Error(`HTTP ${response?.status || "error"}`)
        const declaredLength = Number(response.headers?.get?.("content-length") || 0)
        if (declaredLength > MAX_IMAGE_BYTES) throw new RangeError("remote image is too large")
        const buffer = await response.buffer()
        if (!Buffer.isBuffer(buffer) || buffer.length > MAX_IMAGE_BYTES) throw new RangeError("remote image is too large")
        const dataUrl = toDataUrl(buffer, url, response.headers?.get?.("content-type") || "")
        if (!dataUrl) throw new TypeError("remote response is not an image")
        return dataUrl
      })()
      this.remoteImageCache.set(url, pending)
    }
    try {
      return await this.remoteImageCache.get(url)
    } catch (error) {
      this.remoteImageCache.delete(url)
      console.warn(`[html_editor] ${this.i18n.t("warn.imageDownload", { url })}`, error)
      return original
    }
  }

  _toggleInspector = (enabled = !this.inspectorEnabled) => {
    this.inspectorEnabled = Boolean(enabled)
    if (this.inspectorEnabled && this.viewMode === "source") this._setViewMode("split", false)
    this.entities?.inspect?.setAttribute("aria-pressed", String(this.inspectorEnabled))
    this.entities?.inspector?.classList.toggle("plugin-common-hidden", !this.inspectorEnabled)
    this._postPreviewMessage("html-editor:set-inspector", { enabled: this.inspectorEnabled })
  }

  _handlePreviewLoad = () => {
    this._postPreviewMessage("html-editor:set-inspector", { enabled: this.inspectorEnabled })
    this._postPreviewMessage("html-editor:set-sync", { enabled: this.options.splitSync && this.viewMode === "split" })
    if (this.options.splitSync && this.viewMode === "split") this._handleSourceScroll()
  }

  _postPreviewMessage = (type, payload = {}) => {
    const target = this.entities?.preview?.contentWindow
    if (!target || !this.previewBridgeToken) return false
    target.postMessage({ channel: "typora-html-editor", token: this.previewBridgeToken, type, payload }, "*")
    return true
  }

  _handlePreviewMessage = event => {
    if (!this.entities?.preview || event.source !== this.entities.preview.contentWindow) return
    const data = event.data || {}
    if (data.channel !== "typora-html-editor" || data.token !== this.previewBridgeToken) return
    if (data.type === "html-editor:inspect") {
      this._showInspectedElement(data.payload || {})
    } else if (data.type === "html-editor:navigate") {
      void this._handlePreviewNavigation(data.payload || {})
    } else if (data.type === "html-editor:scroll") {
      this._handlePreviewScroll(data.payload || {})
    } else if (data.type === "html-editor:ready") {
      this._handlePreviewLoad()
    }
  }

  _showInspectedElement = payload => {
    this._toggleInspector(true)
    if (this.entities.inspectorTag) this.entities.inspectorTag.textContent = `<${payload.tagName || "element"}>`
    if (this.entities.inspectorSelector) this.entities.inspectorSelector.textContent = payload.selector || ""
    if (this.entities.inspectorBox) {
      const box = payload.box || {}
      this.entities.inspectorBox.textContent = Number.isFinite(box.width)
        ? `${box.width} × ${box.height}px · x ${box.x}, y ${box.y}`
        : ""
    }
    if (this.entities.inspectorAttributes) {
      this.entities.inspectorAttributes.textContent = (payload.attributes || [])
        .map(attribute => `${attribute.name}="${attribute.value}"`)
        .join("\n") || this.i18n.t("inspector.noAttributes")
    }
    if (this.entities.inspectorText) this.entities.inspectorText.textContent = payload.text || this.i18n.t("inspector.noText")
    this._jumpToSource(payload.offset, payload.end)
  }

  _jumpToSource = (offset, end) => {
    const source = this.entities?.source
    if (!source) return false
    const start = Math.max(0, Math.min(source.value.length, Number(offset) || 0))
    const finish = Math.max(start, Math.min(source.value.length, Number(end) || start))
    if (this.viewMode !== "split") this._setViewMode("split", false)
    source.focus?.()
    if (source.setSelectionRange) source.setSelectionRange(start, finish)
    else {
      source.selectionStart = start
      source.selectionEnd = finish
    }
    const line = source.value.slice(0, start).split("\n").length - 1
    const lineHeight = this.options.editorFontSize * 1.55
    source.scrollTop = Math.max(0, line * lineHeight - (source.clientHeight || 0) / 3)
    return true
  }

  _handleSourceScroll = () => {
    if (!this.options.splitSync || this.viewMode !== "split" || this.syncingSourceScroll) return
    const source = this.entities?.source
    if (!source) return
    const maximum = Math.max(0, source.scrollHeight - source.clientHeight)
    this._postPreviewMessage("html-editor:set-scroll-ratio", { ratio: maximum ? source.scrollTop / maximum : 0 })
  }

  _handlePreviewScroll = payload => {
    if (!this.options.splitSync || this.viewMode !== "split") return
    const source = this.entities?.source
    if (!source) return
    const maximum = Math.max(0, source.scrollHeight - source.clientHeight)
    this.syncingSourceScroll = true
    source.scrollTop = maximum * clampRatio(payload.ratio)
    const release = () => { this.syncingSourceScroll = false }
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(release)
    else release()
  }

  _handlePreviewNavigation = async payload => {
    const href = String(payload.href || "").trim()
    if (!isRelatedDocumentHref(href)) return false
    const localTarget = await this._resolveLocalDocumentTarget(href, payload.resolvedHref)
    if (localTarget) {
      this.utils.openFile(localTarget)
      return true
    }
    const remoteBase = discoverRemoteBase(this.entities?.source?.value || "")
    const external = this._resolveRemoteResourceUrl(payload.resolvedHref || href, remoteBase)
      || this._resolveRemoteResourceUrl(href, remoteBase)
    if (external) {
      this.utils.openUrl(external)
      return true
    }
    this._notify(this.i18n.t("notify.linkMissing"), "warning")
    return false
  }

  _resolveLocalDocumentTarget = async (href, resolvedHref = "") => {
    const path = this.utils.Package.Path
    const candidates = []
    const addCandidate = value => {
      if (!value) return
      const normalized = path.resolve(value)
      if (!candidates.some(candidate => this._samePath(candidate, normalized))) candidates.push(normalized)
    }
    const addHrefCandidate = value => {
      try {
        if (/^file:/i.test(value)) {
          addCandidate(fileURLToPath(new URL(value)))
          return
        }
        if (/^https?:/i.test(value)) return
        const clean = decodeUrlPath(String(value || "").split(/[?#]/, 1)[0])
        if (!clean) return
        if (path.isAbsolute(clean)) addCandidate(clean)
        else if (this.activeFile) addCandidate(path.resolve(path.dirname(this.activeFile), clean))
      } catch {}
    }
    addHrefCandidate(href)
    addHrefCandidate(resolvedHref)

    const remoteBase = discoverRemoteBase(this.entities?.source?.value || "")
    if (remoteBase && this.activeFile) {
      try {
        const baseUrl = new URL(remoteBase)
        const targetUrl = new URL(/^https?:/i.test(href) ? href : resolvedHref || href, remoteBase)
        if (baseUrl.origin === targetUrl.origin) {
          const relative = path.posix.relative(decodeUrlPath(baseUrl.pathname), decodeUrlPath(targetUrl.pathname))
          addCandidate(path.resolve(path.dirname(this.activeFile), relative.split("/").join(path.sep)))
        }
      } catch {}
    }

    for (const candidate of candidates) {
      try {
        const stat = await this.utils.Package.FsExtra.stat(candidate)
        if (!stat.isFile || stat.isFile()) return candidate
      } catch {}
    }
    return ""
  }

  _releasePreviewUrl = () => {
    const retiredUrl = this.previewUrl
    this.previewUrl = ""
    if (retiredUrl) URL.revokeObjectURL(retiredUrl)
  }

  _syncUI = message => {
    if (!this.entities || !this.activeFile) return
    const dirty = this._isDirty()
    this.entities.title.textContent = `${this.utils.Package.Path.basename(this.activeFile)}${dirty ? " *" : ""}`
    this.entities.path.textContent = this.activeFile
    this.entities.save.disabled = !dirty
    this.entities.status.textContent = message || this.i18n.t("status.summary", {
      state: this.i18n.t(dirty ? "status.dirty" : "status.clean"),
      count: this.entities.source.value.length.toLocaleString(),
    })
  }

  _syncSecurityLabel = () => {
    const active = this.options.allowScripts || this.options.allowNetwork
    this.entities.security.classList.toggle("is-warning", active)
    const state = enabled => this.i18n.t(enabled ? "state.on" : "state.off")
    this.entities.security.textContent = this.i18n.t("security.summary", {
      scripts: state(this.options.allowScripts),
      network: state(this.options.allowNetwork),
      sync: state(this.options.splitSync),
    })
  }

  _isDirty = () => Boolean(this.activeFile) && this.entities?.source?.value !== this.savedSource

  _confirmDiscard = async action => {
    if (!this._isDirty()) return true
    const { response } = await this.utils.showMessageBox({
      type: "warning",
      title: this.pluginName,
      message: this.i18n.t("dialog.discardMessage", { action }),
      detail: this.activeFile,
      buttons: [this.i18n.t("dialog.discard"), this.i18n.t("dialog.cancel")],
      defaultId: 1,
      cancelId: 1,
    })
    return response === 0
  }

  _hasExternalChange = async () => {
    if (!this.currentStat) return false
    try {
      const stat = await this.utils.Package.FsExtra.stat(this.activeFile)
      return stat.mtimeMs !== this.currentStat.mtimeMs || stat.size !== this.currentStat.size
    } catch {
      return true
    }
  }

  _confirmExternalOverwrite = async () => {
    const { response } = await this.utils.showMessageBox({
      type: "warning",
      title: this.pluginName,
      message: this.i18n.t("dialog.overwriteMessage"),
      detail: this.activeFile,
      buttons: [this.i18n.t("dialog.overwrite"), this.i18n.t("dialog.cancel")],
      defaultId: 1,
      cancelId: 1,
    })
    return response === 0
  }

  _normalizedPath = filePath => this.utils?.Package?.Path?.resolve
    ? this.utils.Package.Path.resolve(String(filePath || ""))
    : String(filePath || "")

  _samePath = (first, second) => {
    if (!first || !second) return false
    const a = this._normalizedPath(first)
    const b = this._normalizedPath(second)
    return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b
  }

  _notify = (message, type = "info") => this.utils.notification?.show(message, type, 4500)

  _showError = (message, error) => {
    console.error(`[html_editor] ${message}`, error)
    this._notify(message, "error")
  }
}

module.exports = { plugin: HtmlEditorPlugin }
