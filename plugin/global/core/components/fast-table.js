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

        this.currentData = []
        this.currentColumns = []
        this.sortKey = null
        this.sortDirection = null
        this.entities = {
            table: this.shadowRoot.querySelector("table"),
            thead: this.shadowRoot.querySelector("thead"),
            theadRow: this.shadowRoot.querySelector("thead tr"),
            tbody: this.shadowRoot.querySelector("tbody"),
            tableWrapper: this.shadowRoot.querySelector(".table-wrapper"),
            noDataMessage: this.shadowRoot.querySelector(".no-data"),
        }

        this.showNoData()
    }

    connectedCallback() {
        this.entities.table.addEventListener("click", this._onTableClick)
        this.entities.thead.addEventListener("click", this._onHeaderClick)
    }

    disconnectedCallback() {
        this.entities.table.removeEventListener("click", this._onTableClick)
        this.entities.thead.removeEventListener("click", this._onHeaderClick)
    }

    setData = (data = [], columns = this.currentColumns) => {
        this.currentData = data
        this.currentColumns = columns

        this._clearTableInternal()
        const { processedData, processedColumns, isValid } = this._processData(data, columns)
        if (!isValid) {
            this.showNoData()
            return
        }
        this.hideNoData()
        this._renderHeader(processedColumns)
        this._renderBody(processedData, processedColumns)
    }

    getData = () => {
        const { processedData } = this._processData(this.currentData, this.currentColumns)
        return processedData
    }

    clear = () => {
        this._clearTableInternal()
        this.showNoData()
    }

    showNoData = () => {
        this.entities.tableWrapper.classList.add("hidden")
        this.entities.noDataMessage.classList.remove("hidden")
    }

    hideNoData = () => {
        this.entities.tableWrapper.classList.remove("hidden")
        this.entities.noDataMessage.classList.add("hidden")
    }

    _processData = (data, columns) => {
        let dataArray = []
        if (Array.isArray(data)) {
            dataArray = data
        } else if (data && typeof data === "object" && Array.isArray(data.data)) {
            dataArray = data.data
        }

        if (dataArray.length === 0 || columns.length === 0) {
            return { processedData: [], processedColumns: [], isValid: false }
        }

        if (this.sortKey && this.sortDirection) {
            const sortCol = columns.find(col => col.key === this.sortKey)
            if (sortCol && sortCol.sortable === true) {
                const isASC = this.sortDirection === "asc"
                dataArray = [...dataArray].sort((a, b) => {
                    const valA = a[this.sortKey]
                    const valB = b[this.sortKey]
                    if (typeof valA === "string" && typeof valB === "string") {
                        return isASC ? valA.localeCompare(valB) : valB.localeCompare(valA)
                    }
                    if (valA < valB) {
                        return isASC ? -1 : 1
                    }
                    if (valA > valB) {
                        return isASC ? 1 : -1
                    }
                    return 0
                })
            }
        }

        return { processedData: dataArray, processedColumns: columns, isValid: true }
    }

    _renderHeader = (columns) => {
        this.entities.theadRow.innerHTML = ""
        const thElements = columns.map(col => {
            const th = document.createElement("th")
            th.setAttribute("data-key", col.key)
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
            Object.keys(rowData)
                .filter(key => key.startsWith("data-"))
                .forEach(key => tr.setAttribute(`data-${key.slice(5)}`, String(rowData[key])))
            const tdElements = columns.map(col => this._createTableCell(rowData[col.key], rowData, col))
            tr.append(...tdElements)

            return tr
        })
        this.entities.tbody.append(...trElements)
    }

    _createTableCell = (cellValue, rowData, columnConfig) => {
        const td = document.createElement("td")
        if (columnConfig.width) {
            td.style.width = columnConfig.width
        }

        const contentDiv = document.createElement("div")
        contentDiv.classList.add("fast-table-cell-content")

        const valueToDisplay = cellValue !== undefined ? cellValue : ""
        if (columnConfig.render && typeof columnConfig.render === "function") {
            contentDiv.innerHTML = columnConfig.render(valueToDisplay, rowData)
        } else {
            contentDiv.textContent = String(valueToDisplay)
        }
        td.appendChild(contentDiv)
        return td
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
        const targetTh = ev.target.closest("th")
        if (!targetTh || !targetTh.classList.contains("sortable")) return

        const clickedKey = targetTh.getAttribute("data-key")
        const clickedColumnConfig = this.currentColumns.find(col => col.key === clickedKey)
        if (!clickedColumnConfig || clickedColumnConfig.sortable !== true) return

        if (this.sortKey === clickedKey) {
            this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc"
        } else {
            this.sortKey = clickedKey
            this.sortDirection = "asc"
        }

        this.setData(this.currentData, this.currentColumns)
    }

    _clearTableInternal = () => {
        this.entities.theadRow.innerHTML = ""
        this.entities.tbody.innerHTML = ""
    }
})
