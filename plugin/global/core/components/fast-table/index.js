const { sharedSheets } = require("../common")

customElements.define("fast-table", class extends HTMLElement {
  static observedAttributes = ["max-height"]

  static _template =
    `<link rel="stylesheet" href="./plugin/global/core/components/fast-table/index.css" crossorigin="anonymous">
    <div class="table-wrapper"><div class="table"><div class="thead"><div class="tr"></div></div><div class="tbody"></div></div></div>
    <div class="no-data hidden">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
      <span>No Data</span>
    </div>`

  constructor() {
    super()
    const root = this.attachShadow({ mode: "open" })
    root.adoptedStyleSheets = sharedSheets
    root.innerHTML = this.constructor._template

    this.entities = {
      wrapper: root.querySelector(".table-wrapper"),
      table: root.querySelector(".table"),
      thead: root.querySelector(".thead"),
      theadRow: root.querySelector(".thead .tr"),
      tbody: root.querySelector(".tbody"),
      noData: root.querySelector(".no-data"),
    }
    this.clear()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "max-height" && newValue !== oldValue) {
      this.style.setProperty("--table-max-height", newValue)
    }
  }

  connectedCallback() {
    this.entities.tbody.addEventListener("click", this._onBodyClick)
    this.entities.thead.addEventListener("click", this._onHeaderClick)
  }

  disconnectedCallback() {
    this.entities.tbody.removeEventListener("click", this._onBodyClick)
    this.entities.thead.removeEventListener("click", this._onHeaderClick)
  }

  configure = (data, schema) => {
    this.setData(data)
    this.setSchema(schema)
  }

  setData = (data = []) => {
    this.data = data
    this._scheduleUpdate()
  }

  setSchema = (schema = { columns: [] }) => {
    if (!schema.columns) {
      schema.columns = []
    }
    if (!schema.defaultSort) {
      schema.defaultSort = { key: "", direction: "" }
    }
    if (!this.sortKey) {
      const { key, direction } = schema.defaultSort
      this.sortKey = key ? key : null
      this.sortDirection = direction ? (direction || "asc") : null
    }
    this.schema = schema

    if (schema.maxHeight && !this.hasAttribute("max-height")) {
      this.style.setProperty("--table-max-height", schema.maxHeight)
    }
    const gridCols = schema.columns
      .filter(Boolean)
      .filter(col => !col.ignore)
      .map(col => col.width || schema.defaultCellWidth || "minmax(0, 1fr)")
      .join(" ")
    this.style.setProperty("--grid-columns", gridCols)

    this._scheduleUpdate()
  }

  getProcessed = () => this._process(this.data, this.schema)
  getProcessedData = () => this._process(this.data, this.schema).processedData

  clear = () => {
    this._updateScheduled = false
    this._pauseReactivity = false

    this.data = []
    this.schema = { columns: [] }
    this.sortKey = null
    this.sortDirection = null

    this._clearTable()
    this._showNoData()
  }

  deleteRow = (key, value) => {
    if (key == null || value == null) {
      console.warn("deleteRow: 'key' and 'value' must be provided.")
      return false
    }
    const initialLength = this.data.length
    this.data = this.data.filter(item => item[key] !== value)
    if (this.data.length < initialLength) {
      this._scheduleUpdate()
      return true
    }
    return false
  }

  editRow = (key, value, newData) => {
    if (key == null || value == null || typeof newData !== "object") {
      console.warn("editRow: 'key', 'value', and 'newData' (object) must be provided.")
      return false
    }
    const index = this.data.findIndex(item => item[key] === value)
    if (index !== -1) {
      this.data[index] = { ...this.data[index], ...newData }
      this._scheduleUpdate()
      return true
    }
    return false
  }

  batchUpdate = (updateFn) => {
    this._pauseReactivity = true
    try {
      updateFn(this.data)
    } finally {
      this._pauseReactivity = false
      this._scheduleUpdate()
    }
  }

  _process = (data, schema) => {
    const columns = schema?.columns?.filter(col => !col.ignore) ?? []

    if (!data?.length || !columns.length) {
      return { processedData: [], processedColumns: [], isValid: false }
    }

    let processedData = data
    if (this.sortKey && this.sortDirection) {
      const sortCol = columns.find(col => col.key === this.sortKey)
      if (sortCol?.sortable) {
        const isASC = this.sortDirection === "asc"
        processedData = [...data].sort((i1, i2) => {
          const v1 = i1[this.sortKey]
          const v2 = i2[this.sortKey]
          if (typeof v1 === "string" && typeof v2 === "string") {
            return isASC ? v1.localeCompare(v2) : v2.localeCompare(v1)
          }
          if (v1 < v2) return isASC ? -1 : 1
          if (v1 > v2) return isASC ? 1 : -1
          return 0
        })
      }
    }

    return { processedData, processedColumns: columns, isValid: true }
  }

  _scheduleUpdate = () => {
    if (this._pauseReactivity || this._updateScheduled) return

    this._updateScheduled = true
    queueMicrotask(() => {
      try {
        this._updateScheduled = false
        this._render()
      } catch (error) {
        this._updateScheduled = false
        console.error("Fast-table render error:", error)
      }
    })
  }

  _render = () => {
    const { processedData, processedColumns, isValid } = this._process(this.data, this.schema)
    if (!isValid) {
      this._showNoData()
      return
    }
    this._hideNoData()
    this._renderHeader(processedColumns)
    this._renderBody(processedData, processedColumns)
  }

  _renderHeader = (columns) => {
    this.entities.theadRow.innerHTML = ""

    const thElements = columns.map(col => {
      const th = document.createElement("div")
      th.className = "th" + (col.sortable ? " sortable" : "")
      th.dataset.key = col.key

      const titleSpan = document.createElement("span")
      titleSpan.className = "th-title"
      titleSpan.textContent = col.title
      th.append(titleSpan)

      if (col.sortable) {
        const icon = document.createElement("i")
        const cls = this.sortKey !== col.key
          ? "fa-sort"
          : this.sortDirection === "asc"
            ? "fa-sort-asc"
            : "fa-sort-desc"
        icon.className = `fa ${cls}`
        th.append(icon)
      }
      return th
    })

    this.entities.theadRow.append(...thElements)
  }

  // TODO: too expensive, introducing DOM Diffing may be a good solution
  _renderBody = (data, columns) => {
    this.entities.tbody.innerHTML = ""
    const trElements = data.map(rowData => {
      const tr = document.createElement("div")
      tr.className = "tr"
      tr._rowData = rowData
      const tdElements = columns.map(col => {
        const td = document.createElement("div")
        td.className = "td"
        if (typeof col.render === "function") {
          td.innerHTML = col.render(rowData)
        } else {
          td.textContent = rowData[col.key] ?? ""
        }
        return td
      })
      tr.append(...tdElements)
      return tr
    })
    this.entities.tbody.append(...trElements)
  }

  _onBodyClick = (ev) => {
    const row = ev.target.closest(".tr")
    if (!row?._rowData) return

    const action = ev.target.closest("[action]")?.getAttribute("action")
    const options = { bubbles: true, composed: true, detail: { rowData: row._rowData } }
    if (action) {
      options.detail.action = action
      this.dispatchEvent(new CustomEvent("row-action", options))
    } else {
      this.dispatchEvent(new CustomEvent("row-click", options))
    }
  }

  _onHeaderClick = (ev) => {
    const th = ev.target.closest(".th.sortable")
    if (!th) return

    const clickedKey = th.dataset.key
    const colConfig = this.schema.columns.find(col => col.key === clickedKey)
    if (!colConfig?.sortable) return

    if (this.sortKey === clickedKey) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc"
    } else {
      this.sortKey = clickedKey
      this.sortDirection = "asc"
    }
    this._scheduleUpdate()
  }

  _clearTable = () => {
    this.entities.theadRow.innerHTML = ""
    this.entities.tbody.innerHTML = ""
  }

  _showNoData = () => {
    this.entities.wrapper.classList.add("hidden")
    this.entities.noData.classList.remove("hidden")
  }

  _hideNoData = () => {
    this.entities.wrapper.classList.remove("hidden")
    this.entities.noData.classList.add("hidden")
  }
})
