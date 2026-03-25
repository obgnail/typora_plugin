const { describe, it, mock, before, beforeEach } = require("node:test")
const assert = require("node:assert")
const proxyquire = require("proxyquire")

let utils
let dom, container
let FastTable, ft

before(async () => {
    utils = require("./mocks/utils.mock.js")
    dom = require("./mocks/dom.mock.js")

    proxyquire("../../plugin/global/core/components/fast-table.js", {
        "./common": { sharedSheets: [new CSSStyleSheet()], "@noCallThru": true },
        "../utils": { ...utils, "@noCallThru": true },
    })

    FastTable = customElements.get("fast-table")
    ft = new FastTable()
    container = document.getElementById("test-container")
    container.appendChild(ft)
})

const flushMicrotasks = () => Promise.resolve()

describe("FastTable Browser Env", () => {
    it("FastTable has initialized", () => {
        assert.ok(typeof ft.configure === "function")
        assert.ok(typeof ft.setData === "function")
        assert.ok(typeof ft.setSchema === "function")
        assert.ok(typeof ft.clear === "function")
        assert.ok(typeof ft.deleteRow === "function")
        assert.ok(typeof ft.editRow === "function")
    })
})

describe("FastTable Basic Functionality", () => {
    beforeEach(() => ft.clear())

    it("should initialize with empty state and show no data message", () => {
        assert.strictEqual(ft.data.length, 0)
        assert.strictEqual(ft.schema.columns.length, 0)
        assert.ok(ft.entities.noData.classList.contains("hidden") === false)
        assert.ok(ft.entities.tbody.innerHTML === "")
    })

    it("should configure data and schema simultaneously", () => {
        const data = [{ id: 1, name: "test" }]
        const schema = { columns: [{ key: "id", title: "ID" }, { key: "name", title: "Name" }] }
        ft.configure(data, schema)

        assert.strictEqual(ft.data, data)
        assert.deepStrictEqual(ft.schema, schema)
    })

    it("should handle empty data array", async () => {
        ft.setData([])
        ft.setSchema({ columns: [{ key: "id", title: "ID" }] })

        assert.strictEqual(ft.data.length, 0)

        await flushMicrotasks()
        assert.ok(ft.entities.noData.classList.contains("hidden") === false)
    })
})

describe("FastTable Schema Configuration", () => {
    beforeEach(() => ft.clear())

    it("should set schema with default values", () => {
        const schema = { columns: [{ key: "name", title: "Name" }] }
        ft.setSchema(schema)

        assert.deepStrictEqual(ft.schema, schema)
        assert.strictEqual(ft.sortKey, null)
        assert.strictEqual(ft.sortDirection, null)
    })

    it("should apply default sort from schema", () => {
        const schema = {
            columns: [{ key: "name", title: "Name" }],
            defaultSort: { key: "name", direction: "asc" }
        }
        ft.setSchema(schema)

        assert.strictEqual(ft.sortKey, "name")
        assert.strictEqual(ft.sortDirection, "asc")
    })

    it("should handle schema without columns", () => {
        const schema = {}
        ft.setSchema(schema)

        assert.deepStrictEqual(ft.schema.columns, [])
        assert.deepStrictEqual(ft.schema.defaultSort, { key: "", direction: "" })
    })

    it("should preserve existing sort when setting schema without defaultSort", () => {
        ft.sortKey = "existing"
        ft.sortDirection = "desc"

        const schema = { columns: [{ key: "name", title: "Name" }] }
        ft.setSchema(schema)

        assert.strictEqual(ft.sortKey, "existing")
        assert.strictEqual(ft.sortDirection, "desc")
    })
})

describe("FastTable Data Processing", () => {
    beforeEach(() => ft.clear())

    it("should process data with simple columns", () => {
        const data = [{ id: 1, name: "John" }, { id: 2, name: "Jane" }]
        const schema = { columns: [{ key: "id", title: "ID" }, { key: "name", title: "Name" }] }

        ft.setData(data)
        ft.setSchema(schema)

        const processedData = ft.getProcessedData()
        assert.strictEqual(processedData.length, 2)
        assert.strictEqual(processedData[0].id, 1)
        assert.strictEqual(processedData[0].name, "John")
    })

    it("should handle undefined values in data", () => {
        ft.setData([{ id: 1, name: undefined }, { id: 2 }])
        ft.setSchema({ columns: [{ key: "id", title: "ID" }, { key: "name", title: "Name" }] })

        const processedData = ft.getProcessedData()
        assert.strictEqual(processedData[0].name, undefined)
        assert.strictEqual(processedData[1].name, undefined)
    })

    it("should use custom render functions", async () => {
        ft.setData([{ id: 1, status: "active" }])
        ft.setSchema({
            columns: [
                { key: "id", title: "ID" },
                { key: "status", title: "Status", render: (row) => `<span class="status-${row.status}">${row.status}</span>` }
            ]
        })

        await flushMicrotasks()
        const rows = ft.entities.tbody.querySelectorAll("tr")
        const statusCell = rows[0].querySelectorAll("td")[1]
        assert.ok(statusCell.innerHTML.includes('status-active'))
    })
})

describe("FastTable Sorting", () => {
    beforeEach(() => ft.clear())

    it("should sort data ascending by column key", () => {
        ft.setData([{ name: "Charlie" }, { name: "Alice" }, { name: "Bob" }])
        ft.setSchema({ columns: [{ key: "name", title: "Name", sortable: true }] })

        ft.sortKey = "name"
        ft.sortDirection = "asc"
        ft._scheduleUpdate()

        const processedData = ft.getProcessedData()
        assert.strictEqual(processedData[0].name, "Alice")
        assert.strictEqual(processedData[1].name, "Bob")
        assert.strictEqual(processedData[2].name, "Charlie")
    })

    it("should sort data descending by column key", () => {
        ft.setData([{ name: "Charlie" }, { name: "Alice" }, { name: "Bob" }])
        ft.setSchema({ columns: [{ key: "name", title: "Name", sortable: true }] })

        ft.sortKey = "name"
        ft.sortDirection = "desc"
        ft._scheduleUpdate()

        const processedData = ft.getProcessedData()
        assert.strictEqual(processedData[0].name, "Charlie")
        assert.strictEqual(processedData[1].name, "Bob")
        assert.strictEqual(processedData[2].name, "Alice")
    })

    it("should handle sorting with null/undefined values", () => {
        const data = [{ name: null }, { name: "Alice" }, { name: undefined }]
        const schema = { columns: [{ key: "name", title: "Name" }] }

        ft.setData(data)
        ft.setSchema(schema)

        ft.sortKey = "name"
        ft.sortDirection = "asc"
        ft._scheduleUpdate()

        const processedData = ft.getProcessedData()
        assert.strictEqual(processedData.length, 3)
    })
})

describe("FastTable Row Operations", () => {
    beforeEach(() => ft.clear())

    it("should delete row by index", () => {
        const data = [{ id: 1, name: "John" }, { id: 2, name: "Jane" }]
        const schema = { columns: [{ key: "id", title: "ID" }, { key: "name", title: "Name" }] }
        ft.configure(data, schema)

        const isDeleted = ft.deleteRow("id", 1)
        assert.strictEqual(isDeleted, true)
        assert.strictEqual(ft.data.length, 1)
        assert.strictEqual(ft.data[0].id, 2)
    })

    it("should return false when deleting invalid value", () => {
        const data = [{ id: 1, name: "John" }]
        const schema = { columns: [{ key: "id", title: "ID" }] }
        ft.configure(data, schema)

        const isDeleted = ft.deleteRow("id", 2)
        assert.strictEqual(isDeleted, false)
        assert.strictEqual(ft.data.length, 1)
    })

    it("should edit row by index", () => {
        const data = [{ id: 1, name: "John" }]
        const schema = { columns: [{ key: "id", title: "ID" }, { key: "name", title: "Name" }] }
        ft.configure(data, schema)

        const newData = { id: 1, name: "Johnny" }
        const isEdited = ft.editRow("id", 1, newData)
        assert.strictEqual(isEdited, true)
        assert.strictEqual(ft.data[0].name, "Johnny")
    })

    it("should return false when editing invalid index", () => {
        const data = [{ id: 1, name: "John" }]
        const schema = { columns: [{ key: "id", title: "ID" }] }
        ft.configure(data, schema)

        const isEdited = ft.editRow("id", 5, { id: 2, name: "Jane" })
        assert.strictEqual(isEdited, false)
        assert.strictEqual(ft.data[0].name, "John")
    })
})

describe("FastTable Event Emission", () => {
    beforeEach(() => ft.clear())

    it("should emit row-click event when clicking on row", async () => {
        const data = [{ id: 1, name: "John" }]
        const schema = { columns: [{ key: "id", title: "ID" }, { key: "name", title: "Name" }] }
        ft.configure(data, schema)

        let eventFired = false
        let eventData = null
        ft.addEventListener("row-click", (e) => {
            eventFired = true
            eventData = e.detail
        })

        await flushMicrotasks()
        const row = ft.entities.tbody.querySelector("tr")
        row.dispatchEvent(new window.Event("click", { bubbles: true }))

        assert.strictEqual(eventFired, true)
        assert.deepStrictEqual(eventData.rowData, { id: 1, name: "John" })
        assert.strictEqual(eventData.action, undefined)
    })

    it("should emit row-action event when clicking on action element", async () => {
        const data = [{ id: 1, name: "John" }]
        const schema = {
            columns: [
                { key: "id", title: "ID" },
                { key: "actions", title: "Actions", render: () => '<button action="delete">Delete</button>' }
            ]
        }
        ft.configure(data, schema)

        let eventFired = false
        let eventData = null
        ft.addEventListener("row-action", (e) => {
            eventFired = true
            eventData = e.detail
        })

        await flushMicrotasks()
        const actionButton = ft.entities.tbody.querySelector("button[action='delete']")
        actionButton.dispatchEvent(new window.Event("click", { bubbles: true }))

        assert.strictEqual(eventFired, true)
        assert.deepStrictEqual(eventData.rowData, { id: 1, name: "John" })
        assert.strictEqual(eventData.action, "delete")
    })

    it("should not emit events when clicking outside rows", () => {
        const data = [{ id: 1, name: "John" }]
        const schema = { columns: [{ key: "id", title: "ID" }] }
        ft.configure(data, schema)

        let eventFired = false
        ft.addEventListener("row-click", () => eventFired = true)

        ft.entities.table.dispatchEvent(new window.Event("click", { bubbles: true }))
        assert.strictEqual(eventFired, false)
    })
})

describe("FastTable Lifecycle", () => {
    beforeEach(() => ft.clear())

    it("should add event listeners in connectedCallback", () => {
        const newTable = new FastTable()
        container.appendChild(newTable)
        // Should not throw when connected
        assert.ok(newTable.isConnected)
    })

    it("should remove event listeners in disconnectedCallback", () => {
        const newTable = new FastTable()
        container.appendChild(newTable)
        // Should not throw when disconnected
        container.removeChild(newTable)
        assert.ok(!newTable.isConnected)
    })
})

describe("FastTable Edge Cases", () => {
    beforeEach(() => ft.clear())

    it("should handle data with missing column keys", () => {
        const data = [{ id: 1 }, { id: 2, name: "Jane" }]
        const schema = { columns: [{ key: "id", title: "ID" }, { key: "name", title: "Name" }] }
        ft.configure(data, schema)

        const processedData = ft.getProcessedData()
        assert.strictEqual(processedData[0].name, undefined)
        assert.strictEqual(processedData[1].name, "Jane")
    })

    it("should handle empty schema columns", async () => {
        const data = [{ id: 1, name: "John" }]
        const schema = { columns: [] }
        ft.configure(data, schema)

        const processedData = ft.getProcessedData()
        assert.strictEqual(processedData.length, 0)

        await flushMicrotasks()
        assert.strictEqual(ft.entities.tbody.querySelectorAll("td").length, 0)
    })

    it("should handle null data", () => {
        const schema = { columns: [{ key: "id", title: "ID" }] }
        ft.setData(null)
        ft.setSchema(schema)
        assert.strictEqual(ft.data, null)
    })

    it("should handle render function that throws error", async () => {
        mock.method(console, "error", () => undefined)

        const render = () => {
            throw new Error("Render error")
        }
        const data = [{ id: 1 }]
        const schema = { columns: [{ key: "id", title: "ID" }, { key: "broken", title: "Broken", render }] }
        assert.doesNotThrow(() => ft.configure(data, schema))

        await flushMicrotasks()
        assert.strictEqual(console.error.mock.calls.length, 1)
    })

    it("should handle large datasets efficiently", async () => {
        const data = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }))
        const schema = { columns: [{ key: "id", title: "ID" }, { key: "name", title: "Name" }] }

        const start = performance.now()
        ft.configure(data, schema)
        await flushMicrotasks()
        const end = performance.now()

        assert.ok(end - start < 1000, "Large dataset rendering should be efficient")
        assert.strictEqual(ft.entities.tbody.querySelectorAll("tr").length, 1000)
    })
})

describe("FastTable Clear and Reset", () => {
    beforeEach(() => ft.clear())

    it("should clear all data and reset state", async () => {
        const data = [{ id: 1, name: "John" }]
        const schema = { columns: [{ key: "id", title: "ID" }, { key: "name", title: "Name" }] }
        ft.configure(data, schema)
        assert.strictEqual(ft.data.length, 1)
        assert.strictEqual(ft.schema.columns.length, 2)

        ft.clear()

        await flushMicrotasks()
        assert.strictEqual(ft.data.length, 0)
        assert.strictEqual(ft.schema.columns.length, 0)
        assert.strictEqual(ft.sortKey, null)
        assert.strictEqual(ft.sortDirection, null)
        assert.ok(ft.entities.noData.classList.contains("hidden") === false)
        assert.strictEqual(ft.entities.tbody.innerHTML, "")
    })

    it("should reset sort state when clearing", () => {
        const data = [{ name: "Charlie" }, { name: "Alice" }]
        const schema = { columns: [{ key: "name", title: "Name" }] }

        ft.configure(data, schema)
        ft.sortKey = "name"
        ft.sortDirection = "desc"

        ft.clear()

        assert.strictEqual(ft.sortKey, null)
        assert.strictEqual(ft.sortDirection, null)
    })
})

describe("FastTable Internal Methods", () => {
    beforeEach(() => ft.clear())

    it("should show no data message when data is empty", () => {
        ft._showNoData()
        assert.ok(ft.entities.noData.classList.contains("hidden") === false)
    })

    it("should hide no data message when data exists", () => {
        ft._hideNoData()
        assert.ok(ft.entities.noData.classList.contains("hidden") === true)
    })

    it("should clear table content", async () => {
        const data = [{ id: 1, name: "John" }]
        const schema = { columns: [{ key: "id", title: "ID" }, { key: "name", title: "Name" }] }
        ft.configure(data, schema)

        await flushMicrotasks()
        assert.ok(ft.entities.tbody.querySelectorAll("tr").length > 0)

        ft._clearTable()
        assert.strictEqual(ft.entities.tbody.innerHTML, "")
    })

    it("should schedule update only once when called multiple times", async () => {
        let updateCount = 0
        const originalRender = ft._render
        mock.method(ft, "_render", () => {
            updateCount++
            originalRender.call(ft)
        })

        ft._scheduleUpdate()
        ft._scheduleUpdate()
        ft._scheduleUpdate()

        await flushMicrotasks()
        assert.strictEqual(updateCount, 1, "Should only render once despite multiple schedule calls")
    })
})

describe("FastTable Header Click Sorting", () => {
    beforeEach(() => ft.clear())

    it("should toggle sort direction when clicking sortable column header", async () => {
        const data = [{ name: "Charlie" }, { name: "Alice" }, { name: "Bob" }]
        const schema = { columns: [{ key: "name", title: "Name", sortable: true }] }
        ft.configure(data, schema)

        // First click - ascending
        await flushMicrotasks()
        ft.entities.thead.querySelector("th").dispatchEvent(new window.Event("click", { bubbles: true }))
        await flushMicrotasks()
        assert.strictEqual(ft.sortKey, "name")
        assert.strictEqual(ft.sortDirection, "asc")

        // Second click - descending
        ft.entities.thead.querySelector("th").dispatchEvent(new window.Event("click", { bubbles: true }))
        await flushMicrotasks()
        assert.strictEqual(ft.sortKey, "name")
        assert.strictEqual(ft.sortDirection, "desc")
    })

    it("should not sort when clicking non-sortable column header", async () => {
        const data = [{ name: "Charlie" }, { name: "Alice" }]
        const schema = { columns: [{ key: "name", title: "Name", sortable: false }] }
        ft.configure(data, schema)

        await flushMicrotasks()
        ft.entities.thead.querySelector("th").dispatchEvent(new window.Event("click", { bubbles: true }))

        await flushMicrotasks()
        assert.strictEqual(ft.sortKey, null)
        assert.strictEqual(ft.sortDirection, null)
    })
})

describe("FastTable Column Configuration", () => {
    beforeEach(() => ft.clear())

    it("should ignore columns with ignore: true", async () => {
        const data = [{ id: 1, name: "John", hidden: "secret" }]
        const schema = { columns: [{ key: "id", title: "ID" }, { key: "name", title: "Name" }, { key: "hidden", title: "Hidden", ignore: true }] }
        ft.configure(data, schema)

        await flushMicrotasks()
        assert.strictEqual(ft.entities.thead.querySelectorAll("th").length, 2, "Should only render 2 columns")

        const { processedColumns } = ft.getProcessed()
        assert.strictEqual(processedColumns.length, 2, "Hidden column should be filtered out")
    })

    it("should handle columns without render function", async () => {
        const data = [{ id: 1, name: "John" }]
        const schema = { columns: [{ key: "id", title: "ID" }, { key: "name", title: "Name" }] }
        ft.configure(data, schema)

        await flushMicrotasks()
        const cells = ft.entities.tbody.querySelectorAll("tr")[0].querySelectorAll("td")
        assert.strictEqual(cells[0].textContent, "1")
        assert.strictEqual(cells[1].textContent, "John")
    })
})

describe("FastTable Performance and Memory", () => {
    beforeEach(() => ft.clear())

    it("should handle rapid data updates efficiently", async () => {
        const schema = { columns: [{ key: "id", title: "ID" }] }
        ft.setSchema(schema)

        const start = performance.now()
        for (let i = 0; i < 100; i++) {
            ft.setData([{ id: i }])
        }

        await flushMicrotasks()
        const end = performance.now()
        assert.ok(end - start < 500, "Rapid updates should be efficient")
    })

    it("should not leak memory when clearing and reconfiguring", () => {
        for (let i = 0; i < 50; i++) {
            ft.setData([{ id: i }])
            ft.clear()
        }

        // Should not throw and should be in clean state
        assert.strictEqual(ft.data.length, 0)
        assert.strictEqual(ft.entities.tbody.innerHTML, "")
    })
})

describe("FastTable Accessibility", () => {
    beforeEach(() => ft.clear())

    it("should maintain proper table structure", async () => {
        const data = [{ id: 1, name: "John" }]
        const schema = { columns: [{ key: "id", title: "ID" }, { key: "name", title: "Name" }] }
        ft.configure(data, schema)

        await flushMicrotasks()
        assert.ok(ft.entities.table.querySelector("thead"))
        assert.ok(ft.entities.table.querySelector("tbody"))
        assert.strictEqual(ft.entities.thead.querySelectorAll("th").length, 2)
        assert.strictEqual(ft.entities.tbody.querySelectorAll("tr").length, 1)
        assert.strictEqual(ft.entities.tbody.querySelectorAll("td").length, 2)
    })
})

describe("FastTable Error Handling", () => {
    beforeEach(() => ft.clear())

    it("should handle malformed schema gracefully", () => {
        // Schema with null column
        assert.doesNotThrow(() => ft.setSchema({ columns: [null, { key: "id", title: "ID" }] }))
        // Schema with invalid column
        assert.doesNotThrow(() => ft.setSchema({ columns: [{ invalid: "column" }] }))
    })

    it("should handle circular references in data", () => {
        const data = [{ id: 1 }]
        data[0].self = data[0] // Circular reference
        const schema = { columns: [{ key: "id", title: "ID" }] }
        assert.doesNotThrow(() => ft.configure(data, schema))
    })

    it("should handle very long strings in data", () => {
        const longString = "a".repeat(10000)
        const data = [{ id: 1, name: longString }]
        const schema = { columns: [{ key: "id", title: "ID" }, { key: "name", title: "Name" }] }
        assert.doesNotThrow(() => ft.configure(data, schema))
    })
})
