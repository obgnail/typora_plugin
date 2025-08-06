const { sharedSheets } = require("./common")

customElements.define("fast-table", class extends HTMLElement {
    static _template = `
        <link rel="stylesheet" href="./plugin/global/styles/plugin-fast-table.css" crossorigin="anonymous">
        <div class="table-wrapper"><table><thead><tr></tr></thead><tbody></tbody></table></div>
        <div class="no-data hidden">No Data</div>
    `

    constructor() {
        super()
        const root = this.attachShadow({ mode: "open" })
        root.adoptedStyleSheets = sharedSheets
        root.innerHTML = this.constructor._template

        this.entities = {
            table: root.querySelector("table"),
            thead: root.querySelector("thead"),
            theadRow: root.querySelector("thead tr"),
            tbody: root.querySelector("tbody"),
            wrapper: root.querySelector(".table-wrapper"),
            noData: root.querySelector(".no-data"),
        }
        this.clear()
    }

    connectedCallback() {
        this.entities.table.addEventListener("click", this._onTableClick)
        this.entities.thead.addEventListener("click", this._onHeaderClick)
    }

    disconnectedCallback() {
        this.entities.table.removeEventListener("click", this._onTableClick)
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
        this._scheduleUpdate()
    }

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
            this.configure(this.data, this.schema)
            return true
        }
        return false
    }

    editRow = (key, value, newData) => {
        if (key == null || value == null || newData == null || typeof newData !== "object") {
            console.warn("editRow: 'key', 'value', and 'newData' (object) must be provided.")
            return false
        }
        const index = this.data.findIndex(item => item[key] === value)
        if (index !== -1) {
            this.data[index] = { ...this.data[index], ...newData }
            this.configure(this.data, this.schema)
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
        const columns = schema.columns.filter(col => col.ignore !== true)

        if (data.length === 0 || columns.length === 0) {
            return { processedData: [], processedColumns: [], isValid: false }
        }

        if (this.sortKey && this.sortDirection) {
            const sortCol = columns.find(col => col.key === this.sortKey)
            if (sortCol && sortCol.sortable === true) {
                const isASC = this.sortDirection === "asc"
                data = [...data].sort((i1, i2) => {
                    const v1 = i1[this.sortKey]
                    const v2 = i2[this.sortKey]
                    if (typeof v1 === "string" && typeof v2 === "string") {
                        return isASC ? v1.localeCompare(v2) : v2.localeCompare(v1)
                    } else if (v1 < v2) {
                        return isASC ? -1 : 1
                    } else if (v1 > v2) {
                        return isASC ? 1 : -1
                    }
                    return 0
                })
            }
        }

        return { processedData: data, processedColumns: columns, isValid: true }
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
                console.error('Fast-table render error:', error)
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
            const th = document.createElement("th")
            th.dataset.key = col.key
            if (col.width) {
                th.style.width = col.width
            }
            th.append(document.createTextNode(col.title))
            if (col.sortable === true) {
                th.classList.add("sortable")
                const icon = document.createElement("i")
                const cls = this.sortKey !== col.key
                    ? "fa-sort"
                    : this.sortDirection === "asc"
                        ? "fa-sort-asc"
                        : "fa-sort-desc"
                icon.classList.add("fa", cls)
                th.appendChild(icon)
            }
            return th
        })
        this.entities.theadRow.append(...thElements)
    }

    // TODO: too expensive, introducing DOM Diffing may be a good solution
    _renderBody = (data, columns) => {
        this.entities.tbody.innerHTML = ""
        const trElements = data.map(rowData => {
            const tr = document.createElement("tr")
            tr._rowData = rowData
            const tdElements = columns.map(col => {
                const td = document.createElement("td")
                if (col.render && typeof col.render === "function") {
                    td.innerHTML = col.render(rowData)
                } else {
                    const val = rowData[col.key]
                    td.textContent = val !== undefined ? val : ""
                }
                return td
            })
            tr.append(...tdElements)
            return tr
        })
        this.entities.tbody.append(...trElements)
    }

    _onTableClick = (ev) => {
        const row = ev.target.closest("tr")
        if (!row || !row._rowData) return

        const action = ev.target.getAttribute("action")
        const options = { bubbles: true, composed: true, detail: { rowData: row._rowData } }
        if (action) {
            options.detail.action = action
            this.dispatchEvent(new CustomEvent("row-action", options))
        } else {
            this.dispatchEvent(new CustomEvent("row-click", options))
        }
    }

    _onHeaderClick = (ev) => {
        const th = ev.target.closest("th")
        if (!th || !th.classList.contains("sortable")) return

        const clickedKey = th.dataset.key
        const clickedColumnConfig = this.schema.columns.find(col => col.key === clickedKey)
        if (!clickedColumnConfig || clickedColumnConfig.sortable !== true) return

        if (this.sortKey === clickedKey) {
            this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc"
        } else {
            this.sortKey = clickedKey
            this.sortDirection = "asc"
        }

        this.configure(this.data, this.schema)
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
