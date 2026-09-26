const {
  MODE, FEATURES, extractTableRecords, createFileState, getDocumentFingerprint, hasOverrides, restoreOverrides, resolveEffectiveOverrides,
} = require("./state")

const ACTIONS = Object.freeze({ header: "cycle_header", firstColumn: "cycle_first_column", nowrap: "cycle_nowrap", autoWidth: "cycle_auto_width" })
const CLASS_PREFIX = "plugin-table-style-"

class TableStylePlugin extends BasePlugin {
  overrides = new WeakMap()
  storage = null
  // Reused by StateRecorder callbacks so one file-switch event parses Markdown only once.
  stateSnapshot = null

  style = () => `
#write table.md-table.${CLASS_PREFIX}header-on > thead > tr > th { background-color: ${this.config.HEADER_BACKGROUND_COLOR}; font-weight: 700; }
#write table.md-table.${CLASS_PREFIX}first-column-on > tbody > tr > td:first-child { background-color: ${this.config.FIRST_COLUMN_BACKGROUND_COLOR}; font-weight: 600; }
#write table.md-table.${CLASS_PREFIX}nowrap-on > thead > tr > th { white-space: nowrap; }
#write table.md-table.${CLASS_PREFIX}auto-width-on:not([style*="width"]) { width: 100%; table-layout: auto; }
`

  process = () => {
    this.storage = this.utils.getStorage(`${this.fixedName}.data`)
    this._registerStateRecorder()
    // Save old-table overrides while its file path and DOM nodes are still current.
    this.utils.eventHub.on(this.utils.eventHub.eventType.beforeFileOpen, this._persistCurrentFile)
    // Reapply saved overrides only after the new file has rendered its table DOM.
    this.utils.eventHub.on(this.utils.eventHub.eventType.fileContentLoaded, this._restoreCurrentFile)
    this._restoreCurrentFile()
  }

  getDynamicActions = (anchorNode, meta) => {
    const table = anchorNode.closest("#write table.md-table")
    meta.table = table
    const disabled = !table
    const overrides = table ? this.getOverrides(table) : {}
    const effective = table ? resolveEffectiveOverrides(this._getGlobalDefaults(), overrides) : {}
    return FEATURES.map(feature => ({
      act_value: ACTIONS[feature],
      act_name: `${this.i18n.t(`act.${ACTIONS[feature]}`)}: ${this.i18n.t(`state.${overrides[feature] || MODE.INHERIT}`)}`,
      act_state: effective[feature],
      act_disabled: disabled,
    }))
  }

  call = (action, meta) => {
    const feature = FEATURES.find(key => ACTIONS[key] === action)
    const table = meta?.table
    if (!feature || !table) return
    const overrides = this.getOverrides(table)
    const order = [MODE.INHERIT, MODE.ON, MODE.OFF]
    overrides[feature] = order[(order.indexOf(overrides[feature]) + 1) % order.length]
    this._setOverrides(table, overrides)
    this._persistCurrentFile()
  }

  /**
   * Generate a complete override configuration object for a table, with all features defaulting to "inherit",
   * and then override the default values with the override values actually saved in that table.
   * 1.Object.fromEntries(...) converts this array of key-value pairs into an object
   * 2.this.overrides is a WeakMap where the key is a DOM table element,
   * and the value is the override object that the user has actually set.
   */
  getOverrides = table => ({ ...Object.fromEntries(FEATURES.map(feature => [feature, MODE.INHERIT])), ...this.overrides.get(table) })

  _setOverrides = (table, overrides) => {
    // Store the raw overrides in the WeakMap, keyed by the DOM table element.
    this.overrides.set(table, overrides)
    // Determine the effective overrides by combining the global defaults with the table-specific overrides.
    const effective = resolveEffectiveOverrides(this._getGlobalDefaults(), overrides)
    // Check if the table already has a manual width set (via inline style).
    const hasManualWidth = Boolean(table.querySelector('th[style*="width"], td[style*="width"]'))
     // Iterate over all 4 features and toggle their CSS classes accordingly.
    FEATURES.forEach(feature => {
      // The autoWidth feature is suppressed when a manual width exists to avoid conflicting layout rules.
      const enabled = effective[feature] && (feature !== "autoWidth" || !hasManualWidth)
      // Add or remove the class based on the enabled state.
      table.classList.toggle(`${CLASS_PREFIX}${this._toClassName(feature)}-on`, enabled)
    })
  }

  _toClassName = feature => feature.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)

  _getGlobalDefaults = () => ({
    header: this.config.HEADER_STYLE,
    firstColumn: this.config.FIRST_COLUMN_STYLE,
    nowrap: this.config.HEADER_NOWRAP,
    autoWidth: this.config.AUTO_WIDTH,
  })

  _getCurrentDocument = () => {
    const content = this.utils.getCurrentFileContent()
    const records = extractTableRecords(content, this.utils.parseMarkdownBlock)
    const tables = Array.from(document.querySelectorAll("#write table.md-table"))
    return records.length === tables.length ? { content, records, tables } : null
  }

  /**
   * saves this "partial override" to the utils.getStorage() record corresponding to the current file path
   * only then can it be restored the next time the same file is opened. Unsaved files do not have a path, so they will not be persisted to disk.
   */
  _persistCurrentFile = () => {
    // Get the current file path. If there is none, clear the snapshot and bail.
    const filepath = this.utils.getFilePath()
    if (!filepath) {
      this.stateSnapshot = null
      return
    }

    // Get the document snapshot. It contains content, records, and tables
    // from the same point in time. If null, the DOM and Markdown tables
    // don't match, so saving would be unsafe.
    const documentState = this._getStateSnapshot()
    if (!documentState) return

    // Build a Map of index -> overrides for every table in the snapshot.
    const overrides = new Map(documentState.tables.map((table, index) => [index, this.getOverrides(table)]))

    // Create the file state object to be persisted. It only keeps tables
    // that actually have overrides, skipping untouched ones.
    const state = createFileState(documentState.content, documentState.records, overrides)

    // Read the existing storage (all files).
    const all = this._readStorage()
    if (state.tables.some(record => hasOverrides(record.overrides))) {
      all.files[this._normalizePath(filepath)] = state
    } else {
      delete all.files[this._normalizePath(filepath)]
    }

    // Write the updated storage back.
    this.storage.set(all)


    this.stateSnapshot = null
  }

  _restoreCurrentFile = () => {
    const filepath = this.utils.getFilePath()
    if (!filepath) return
    const documentState = this._getStateSnapshot()
    if (!documentState) return
    const state = this._readStorage().files[this._normalizePath(filepath)]
    const overrides = restoreOverrides(documentState.content, documentState.records, state)
    documentState.tables.forEach((table, index) => this._setOverrides(table, overrides.get(index) || this.getOverrides(table)))
    this.stateSnapshot = null
  }

  _registerStateRecorder = () => this.utils.stateRecorder.register({
    name: this.fixedName,
    selector: "#write table.md-table",
    stateGetter: table => {
      const documentState = this._getStateSnapshot()
      const index = documentState?.tables.indexOf(table)
      const overrides = this.getOverrides(table)
      if (index === -1 || !documentState || !hasOverrides(overrides)) return
      return JSON.stringify({
        documentFingerprint: getDocumentFingerprint(documentState.content),
        fingerprint: documentState.records[index].fingerprint,
        overrides,
      })
    },
    stateRestorer: (table, value) => {
      try {
        const saved = JSON.parse(value)
        const documentState = this._getStateSnapshot()
        if (!documentState) return
        const index = documentState?.tables.indexOf(table)
        const current = index === -1 ? null : documentState.records[index]
        const currentFingerprint = getDocumentFingerprint(documentState.content)
        if (current && current.fingerprint === saved.fingerprint && currentFingerprint === saved.documentFingerprint) this._setOverrides(table, saved.overrides)
      } catch (_) {}
    },
  })

  _normalizePath = filepath => process.platform === "win32" ? filepath.toLowerCase() : filepath

  _getStateSnapshot = () => this.stateSnapshot || (this.stateSnapshot = this._getCurrentDocument())

  _readStorage = () => {
    try {
      const data = this.storage.get()
      return data?.version === 1 && data.files && typeof data.files === "object" ? data : { version: 1, files: {} }
    } catch (_) {
      return { version: 1, files: {} }
    }
  }
}

module.exports = { plugin: TableStylePlugin }
