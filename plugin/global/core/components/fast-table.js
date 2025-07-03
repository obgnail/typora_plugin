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
            tableWrapper: root.querySelector(".table-wrapper"),
            noDataMessage: root.querySelector(".no-data"),
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

    setData = (data = [], schema = { columns: [] }) => {
        if (!schema.columns) {
            schema.columns = []
        }
        if (!schema.defaultSort) {
            schema.defaultSort = { key: "", direction: "" }
        }

        this.data = data
        this.schema = schema
        if (!this.sortKey) {
            const { key, direction } = schema.defaultSort
            this.sortKey = key ? key : null
            this.sortDirection = direction ? (direction || "asc") : null
        }

        this._clearTable()
        const { processedData, processedColumns, isValid } = this._process(this.data, this.schema)
        if (!isValid) {
            this._showNoData()
            return
        }
        this._hideNoData()
        this._renderHeader(processedColumns)
        this._renderBody(processedData, processedColumns)
    }

    getProcessedData = () => this._process(this.data, this.schema).processedData

    clear = () => {
        this.data = []
        this.schema = { columns: [] }
        this.sortKey = null
        this.sortDirection = null
        this._clearTable()
        this._showNoData()
    }

    deleteRow = (key, value) => {
        if (!key || !value) {
            console.warn("deleteRow: 'key' and 'value' must be provided.")
            return false
        }
        const initialLength = this.data.length
        this.data = this.data.filter(item => item[key] !== value)
        if (this.data.length < initialLength) {
            this.setData(this.data, this.schema)
            return true
        }
        return false
    }

    editRow = (key, value, newData) => {
        if (!key || !value || typeof newData !== "object" || newData === null) {
            console.warn("editRow: 'key', 'value', and 'newData' (object) must be provided.")
            return false
        }
        const index = this.data.findIndex(item => item[key] === value)
        if (index !== -1) {
            this.data[index] = { ...this.data[index], ...newData }
            this.setData(this.data, this.schema)
            return true
        }
        return false
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

    _renderHeader = (columns) => {
        this.entities.theadRow.innerHTML = ""
        const thElements = columns.map(col => {
            const th = document.createElement("th")
            th.dataset.key = col.key
            if (col.width) {
                th.style.width = col.width
            }

            const thContent = document.createElement("div")
            thContent.classList.add("th-content")

            const titleSpan = document.createElement("span")
            titleSpan.textContent = col.title
            thContent.appendChild(titleSpan)

            if (col.sortable === true) {
                th.classList.add("sortable")
                const icon = document.createElement("i")
                const cls = this.sortKey !== col.key
                    ? "fa-sort"
                    : this.sortDirection === "asc"
                        ? "fa-sort-asc"
                        : "fa-sort-desc"
                icon.classList.add("sort-icon", "fa", cls)
                thContent.appendChild(icon)
            }
            th.appendChild(thContent)
            return th
        })
        this.entities.theadRow.append(...thElements)
    }

    _renderBody = (data, columns) => {
        this.entities.tbody.innerHTML = ""
        const trElements = data.map(rowData => {
            const tr = document.createElement("tr")
            tr._rowData = rowData
            const tdElements = columns.map(col => {
                const val = rowData[col.key]
                const cell = document.createElement("div")
                cell.classList.add("cell")
                if (col.render && typeof col.render === "function") {
                    cell.innerHTML = col.render(rowData)
                } else {
                    cell.textContent = val !== undefined ? val : ""
                }
                const td = document.createElement("td")
                td.appendChild(cell)
                return td
            })
            tr.append(...tdElements)
            return tr
        })
        this.entities.tbody.append(...trElements)
    }

    _onTableClick = (ev) => {
        const target = ev.target

        const isActionElement = target.hasAttribute("action")
        if (!isActionElement) return

        const action = target.getAttribute("action")
        const row = target.closest("tr")
        if (!row || !row._rowData) return

        const detail = { action: action, rowData: row._rowData }
        this.dispatchEvent(new CustomEvent("table-click", { bubbles: true, composed: true, detail }))
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

        this.setData(this.data, this.schema)
    }

    _clearTable = () => {
        this.entities.theadRow.innerHTML = ""
        this.entities.tbody.innerHTML = ""
    }

    _showNoData = () => {
        this.entities.tableWrapper.classList.add("hidden")
        this.entities.noDataMessage.classList.remove("hidden")
    }

    _hideNoData = () => {
        this.entities.tableWrapper.classList.remove("hidden")
        this.entities.noDataMessage.classList.add("hidden")
    }
})
