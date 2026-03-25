// setupGlobalVars
global.BasePlugin = class {
}

const { describe, it, beforeEach, mock } = require("node:test")
const assert = require("node:assert")
const { TabManager } = require("../../plugin/window_tab.js")

describe("TabManager Test Suite", () => {
    let context
    let manager

    beforeEach(() => {
        context = {
            utils: {
                openFile: mock.fn(),
                existPath: mock.fn(),
                showMessageBox: mock.fn(),
                getFileName: (p) => p.split("/").pop(),
                separator: "/",
            },
            i18n: {
                t: (key) => key,
            },
            config: {
                NEW_TAB_POSITION: "end",
                MAX_TAB_NUM: 0,
                TAB_SWITCH_ON_CLOSE: "right",
                LAST_TAB_CLOSE_ACTION: "reconfirm",
                SHOW_DIR_ON_DUPLICATE: true,
                TRIM_FILE_EXT: false,
            },
            onRender: mock.fn(),
            onEmpty: mock.fn(),
            onExit: mock.fn(),
        }
        manager = new TabManager(context)
    })

    describe("1. Getters, Setters & Basic Info", () => {
        it("should return correct initial values", () => {
            assert.strictEqual(manager.count, 0)
            assert.strictEqual(manager.activeIdx, 0)
            assert.strictEqual(manager.current, null)
            assert.strictEqual(manager.isLocalOpen, false)
            assert.strictEqual(manager.maxIdx, 0)
        })

        it("should toggle and set local open state correctly", () => {
            manager.toggleLocalOpen()
            assert.strictEqual(manager.isLocalOpen, true)
            manager.setLocalOpen(false)
            assert.strictEqual(manager.isLocalOpen, false)
        })

        it("should return correct tab object and path by index", () => {
            manager.reset([{ path: "/a.md" }, { path: "/b.md" }])
            assert.strictEqual(manager.getByIdx(1).path, "/b.md")
            assert.strictEqual(manager.getTabPathByIdx(0), "/a.md")
            assert.strictEqual(manager.getTabPathByIdx(999), undefined)
        })
    })

    describe("2. open() - Tab Insertion and Trimming", () => {
        it("should modify current tab path when local open is true", () => {
            manager.reset([{ path: "/original.md" }])
            manager.setLocalOpen(true)
            manager.open("/new.md")

            assert.strictEqual(manager.count, 1)
            assert.strictEqual(manager.current.path, "/new.md")
        })

        it("should insert tab based on NEW_TAB_POSITION config", () => {
            manager.reset([{ path: "/a" }, { path: "/b" }])
            manager.switch(0)

            context.config.NEW_TAB_POSITION = "end"
            manager.open("/end")
            assert.strictEqual(manager.getTabPathByIdx(2), "/end")

            context.config.NEW_TAB_POSITION = "start"
            manager.open("/start")
            assert.strictEqual(manager.getTabPathByIdx(0), "/start")

            context.config.NEW_TAB_POSITION = "right"
            manager.open("/right")
            assert.strictEqual(manager.getTabPathByIdx(1), "/right")

            context.config.NEW_TAB_POSITION = "left"
            manager.open("/left")
            assert.strictEqual(manager.getTabPathByIdx(1), "/left")
        })

        it("should trim tabs from left when overflow and inserting to right/end", () => {
            context.config.MAX_TAB_NUM = 2
            context.config.NEW_TAB_POSITION = "end"
            manager.reset([{ path: "/1" }, { path: "/2" }])

            manager.open("/3") // Overflows, should trim "/1"
            assert.strictEqual(manager.count, 2)
            assert.strictEqual(manager.tabs[0].path, "/2")
            assert.strictEqual(manager.tabs[1].path, "/3")
        })

        it("should trim tabs from right when overflow and inserting to left/start", () => {
            context.config.MAX_TAB_NUM = 2
            context.config.NEW_TAB_POSITION = "start"
            manager.reset([{ path: "/1" }, { path: "/2" }])

            manager.open("/3") // Inserts at 0, overflows, should trim "/2"
            assert.strictEqual(manager.count, 2)
            assert.strictEqual(manager.tabs[0].path, "/3")
            assert.strictEqual(manager.tabs[1].path, "/1")
        })

        it("should just switch to tab if it already exists", () => {
            manager.reset([{ path: "/1" }, { path: "/2" }])
            manager.switch(0)
            manager.open("/2")

            assert.strictEqual(manager.count, 2)
            assert.strictEqual(manager.activeIdx, 1)
            assert.ok(manager.current.timestamp > 0)
        })
    })

    describe("3. Navigation - switch, previous, next, switchToLastActive", () => {
        beforeEach(() => {
            manager.reset([{ path: "/a" }, { path: "/b" }, { path: "/c" }])
        })

        it("should clamp switch index within valid boundaries", () => {
            manager.switch(-5)
            assert.strictEqual(manager.activeIdx, 0)
            manager.switch(99)
            assert.strictEqual(manager.activeIdx, 2)
        })

        it("should switch by path correctly", () => {
            manager.switchByPath("/b")
            assert.strictEqual(manager.activeIdx, 1)
            manager.switchByPath("/invalid") // Should not change
            assert.strictEqual(manager.activeIdx, 1)
        })

        it("should cycle correctly on previous() and next()", () => {
            manager.switch(0)
            manager.previous()
            assert.strictEqual(manager.activeIdx, 2) // Wraps to end
            manager.next()
            assert.strictEqual(manager.activeIdx, 0) // Wraps to start
        })

        it("should switch to the last active tab based on timestamp", () => {
            manager.tabs[0].timestamp = 100
            manager.tabs[1].timestamp = 500
            manager.tabs[2].timestamp = 300
            manager.switch(0) // Current is 0

            manager.switchToLastActive()
            assert.strictEqual(manager.activeIdx, 1) // 1 has the highest timestamp among others
        })

        it("should ignore switchToLastActive if only one tab exists", () => {
            manager.reset([{ path: "/a" }])
            manager.switchToLastActive()
            assert.strictEqual(manager.activeIdx, 0)
        })
    })

    describe("4. Single close() Logic and Actions", () => {
        it("should trigger onEmpty when closing the last tab and action is blankPage", () => {
            context.config.LAST_TAB_CLOSE_ACTION = "blankPage"
            manager.reset([{ path: "/a" }])
            manager.close(0)
            assert.strictEqual(manager.count, 0)
            assert.strictEqual(context.onEmpty.mock.callCount(), 1)
        })

        it("should trigger onExit when closing the last tab and action is exit", () => {
            context.config.LAST_TAB_CLOSE_ACTION = "exit"
            manager.reset([{ path: "/a" }])
            manager.close(0)
            assert.strictEqual(manager.count, 0)
            assert.strictEqual(context.onExit.mock.callCount(), 1)
        })

        it("should trigger message box when closing the last tab and action is reconfirm", async () => {
            context.config.LAST_TAB_CLOSE_ACTION = "reconfirm"
            manager.reset([{ path: "/a" }])
            context.utils.showMessageBox.mock.mockImplementation(async () => ({ response: 0 })) // Simulate OK click

            manager.close(0)

            // Allow microtasks to process
            await Promise.resolve()
            assert.strictEqual(context.onExit.mock.callCount(), 1)
            assert.strictEqual(manager.count, 0)
        })

        it("should switch to the latest tab when active tab is closed and config is latest", () => {
            context.config.TAB_SWITCH_ON_CLOSE = "latest"
            manager.reset([{ path: "/a", timestamp: 50 }, { path: "/b", timestamp: 200 }, { path: "/c", timestamp: 100 }])
            manager.switch(1) // Active is /b

            manager.close(1) // Close /b
            assert.strictEqual(manager.activeIdx, 1) // Index 1 is now "/c", which has highest remaining timestamp (100 > 50)
        })

        it("should shift activeIdx left when closed tab is before active tab", () => {
            manager.reset([{ path: "/a" }, { path: "/b" }, { path: "/c" }])
            manager.switch(2) // Active is /c
            manager.close(0) // Close /a
            assert.strictEqual(manager.activeIdx, 1) // Active index must shift to remain on /c
            assert.strictEqual(manager.current.path, "/c")
        })

        it("should shift activeIdx left when active tab itself is closed and config is left", () => {
            context.config.TAB_SWITCH_ON_CLOSE = "left"
            manager.reset([{ path: "/a" }, { path: "/b" }, { path: "/c" }])
            manager.switch(1) // Active is /b
            manager.close(1) // Close /b
            assert.strictEqual(manager.activeIdx, 0) // Fallbacks to /a
        })

        it("should close the active tab when closeActive is called", () => {
            manager.reset([{ path: "/a" }, { path: "/b" }])
            manager.switch(1)
            manager.closeActive()
            assert.strictEqual(manager.count, 1)
            assert.strictEqual(manager.getTabPathByIdx(0), "/a")
        })
    })

    describe("5. Bulk close: closeOthers, closeLeft, closeRight", () => {
        beforeEach(() => {
            manager.reset([
                { path: "/0" }, { path: "/1" }, { path: "/2" }, { path: "/3" }, { path: "/4" }
            ])
        })

        it("should close all other tabs and switch to the remaining one", () => {
            manager.switch(1)
            manager.closeOthers(3) // Keep only "/3"
            assert.strictEqual(manager.count, 1)
            assert.strictEqual(manager.current.path, "/3")
            assert.strictEqual(manager.activeIdx, 0)
        })

        describe("closeLeft", () => {
            it("should switch to 0 if active tab is among the deleted left tabs (activeIdx < idx)", () => {
                manager.switch(1) // Active is "/1"
                manager.closeLeft(3) // Deletes 0, 1, 2. Remaining: 3, 4

                assert.strictEqual(manager.count, 2)
                assert.strictEqual(manager.current.path, "/3") // Fallback to new 0
                assert.strictEqual(manager.activeIdx, 0)
            })

            it("should preserve active tab and adjust activeIdx if active tab survives (activeIdx >= idx)", () => {
                manager.switch(4) // Active is "/4"
                manager.closeLeft(3) // Deletes 0, 1, 2. Remaining: 3, 4

                assert.strictEqual(manager.count, 2)
                assert.strictEqual(manager.current.path, "/4") // Remains on "/4"
                assert.strictEqual(manager.activeIdx, 1) // Adjusted index
            })

            it("should switch to 0 if active tab was somehow deleted and origin path not found", () => {
                manager.switch(1)
                manager.tabs[1].path = "/ghost" // Corrupt the origin path
                manager.closeLeft(2)
                assert.strictEqual(manager.activeIdx, 0)
            })
        })

        describe("closeRight", () => {
            it("should switch to maxIdx if active tab is among deleted right tabs (activeIdx > idx)", () => {
                manager.switch(4) // Active is "/4"
                manager.closeRight(2) // Deletes 3, 4. Remaining: 0, 1, 2

                assert.strictEqual(manager.count, 3)
                assert.strictEqual(manager.current.path, "/2") // Fallback to end
                assert.strictEqual(manager.activeIdx, 2)
            })

            it("should preserve active tab and keep activeIdx if active tab survives (activeIdx <= idx)", () => {
                manager.switch(1) // Active is "/1"
                manager.closeRight(2) // Deletes 3, 4. Remaining: 0, 1, 2

                assert.strictEqual(manager.count, 3)
                assert.strictEqual(manager.current.path, "/1") // Remains on "/1"
                assert.strictEqual(manager.activeIdx, 1) // Index unchanged
            })
        })
    })

    describe("6. Manipulation: sort and move", () => {
        it("should sort tabs alphabetically and track the active tab", () => {
            manager.reset([
                { path: "/z.md", showName: "z.md" },
                { path: "/a.md", showName: "a.md" },
                { path: "/m.md", showName: "m.md" }
            ])
            manager.switch(0) // Active is "/z.md"

            manager.sort()

            assert.strictEqual(manager.tabs[0].path, "/a.md")
            assert.strictEqual(manager.tabs[1].path, "/m.md")
            assert.strictEqual(manager.tabs[2].path, "/z.md")
            assert.strictEqual(manager.activeIdx, 2) // Cursor moved to track "/z.md"
        })

        describe("move", () => {
            beforeEach(() => {
                manager.reset([{ path: "/0" }, { path: "/1" }, { path: "/2" }, { path: "/3" }])
            })

            it("should ignore invalid moves", () => {
                manager.switch(1)
                manager.move(1, 1) // Same index
                manager.move(-1, 2) // Invalid from
                manager.move(0, 99) // Invalid to
                assert.strictEqual(manager.activeIdx, 1)
                assert.strictEqual(manager.getTabPathByIdx(1), "/1")
            })

            it("should move activeIdx when the active tab itself is moved", () => {
                manager.switch(1)
                manager.move(1, 3) // Move "/1" to end
                assert.strictEqual(manager.activeIdx, 3)
                assert.strictEqual(manager.current.path, "/1")
            })

            it("should decrement activeIdx if a tab before it is moved to after it", () => {
                manager.switch(2) // Active is "/2"
                manager.move(0, 3) // Move "/0" to end
                assert.strictEqual(manager.activeIdx, 1)
                assert.strictEqual(manager.current.path, "/2")
            })

            it("should increment activeIdx if a tab after it is moved to before it", () => {
                manager.switch(1) // Active is "/1"
                manager.move(3, 0) // Move "/3" to start
                assert.strictEqual(manager.activeIdx, 2)
                assert.strictEqual(manager.current.path, "/1")
            })
        })
    })

    describe("7. Session Recovery & Async Checks: checkExist, restoreSession", () => {
        it("should async check existence and remove deleted tabs", async () => {
            manager.reset([{ path: "/exist1" }, { path: "/deleted" }, { path: "/exist2" }])
            manager.switch(1) // Active is the one to be deleted

            context.utils.existPath.mock.mockImplementation(async (path) => path !== "/deleted")

            await manager.checkExist()

            assert.strictEqual(manager.count, 2)
            assert.strictEqual(manager.tabs[0].path, "/exist1")
            assert.strictEqual(manager.tabs[1].path, "/exist2")
            assert.strictEqual(manager.activeIdx, 1) // Defaults right switch behavior after active tab is deleted
        })

        it("should restore session and merge tabs", () => {
            manager.reset([{ path: "/exist.md" }]) // Already exists
            const saveTabs = [
                { path: "/exist.md", scrollTop: 100, active: false },
                { path: "/restored.md", scrollTop: 50, active: true }
            ]

            manager.restoreSession(saveTabs, "root", "root", true)

            assert.strictEqual(manager.count, 2)
            assert.strictEqual(manager.tabs[0].scrollTop, 100) // Updated exist tab
            assert.strictEqual(manager.tabs[1].path, "/restored.md") // Appended new
            assert.strictEqual(manager.activeIdx, 1) // Switched to active path
        })

        it("should ignore restore if mount folders do not match and matchMountFolder is true", () => {
            const saveTabs = [{ path: "/restored.md", scrollTop: 50, active: true }]
            manager.restoreSession(saveTabs, "oldRoot", "newRoot", true)
            assert.strictEqual(manager.count, 0) // Ignored
        })
    })

    describe("8. Directory Resolution (_formatShowNames)", () => {
        it("should format showName resolving duplicate file names using parent directories", () => {
            manager.reset([
                { path: "/project/docs/index.md" },
                { path: "/project/src/index.md" },
                { path: "/other/index.md" }
            ])

            assert.strictEqual(manager.tabs[0].showName, "docs/index.md")
            assert.strictEqual(manager.tabs[1].showName, "src/index.md")
            assert.strictEqual(manager.tabs[2].showName, "other/index.md")
        })

        it("should handle duplicates gracefully even when one path reaches root", () => {
            manager.reset([
                { path: "/index.md" }, // Root
                { path: "/src/index.md" }
            ])

            assert.strictEqual(manager.tabs[0].showName, "index.md")
            assert.strictEqual(manager.tabs[1].showName, "src/index.md")
        })

        it("should skip directory resolution if SHOW_DIR_ON_DUPLICATE is false", () => {
            context.config.SHOW_DIR_ON_DUPLICATE = false
            manager.reset([
                { path: "/docs/index.md" },
                { path: "/src/index.md" }
            ])

            assert.strictEqual(manager.tabs[0].showName, "index.md")
            assert.strictEqual(manager.tabs[1].showName, "index.md")
        })
    })

    describe("9. Operations on Empty States", () => {
        it("should handle open() safely when isLocalOpen is true but current is null", () => {
            manager.setLocalOpen(true)
            manager.open("/first.md") // Normally replaces current, but current is null

            assert.strictEqual(manager.count, 1)
            assert.strictEqual(manager.getTabPathByIdx(0), "/first.md")
        })

        it("should do nothing and not crash when closeActive() is called with zero tabs", () => {
            assert.strictEqual(manager.count, 0)
            assert.doesNotThrow(() => manager.closeActive())
            assert.strictEqual(manager.count, 0)
        })

        it("should do nothing when switchToLastActive() is called with zero or one tab", () => {
            assert.doesNotThrow(() => manager.switchToLastActive())

            manager.reset([{ path: "/single.md" }])
            manager.switchToLastActive()
            assert.strictEqual(manager.activeIdx, 0) // Still 0, no crash
        })

        it("should handle sort() safely when tabs array is empty or has only one element", () => {
            assert.doesNotThrow(() => manager.sort())

            manager.reset([{ path: "/alone.md" }])
            manager.sort()
            assert.strictEqual(manager.count, 1)
        })
    })

    describe("10. Out-of-Bounds and Invalid Parameters", () => {
        beforeEach(() => {
            manager.reset([{ path: "/0" }, { path: "/1" }, { path: "/2" }])
        })

        it("should ignore closeOthers() if the target index is completely out of bounds", () => {
            manager.closeOthers(999)
            assert.strictEqual(manager.count, 3) // Should abort gracefully

            manager.closeOthers(-5)
            assert.strictEqual(manager.count, 3)
        })

        it("should safely bound move() if fromIdx or toIdx are invalid", () => {
            manager.move(-1, 2)
            manager.move(0, 500)
            manager.move(1, 1) // Moving to same place

            // Order should remain unchanged
            assert.strictEqual(manager.getTabPathByIdx(0), "/0")
            assert.strictEqual(manager.getTabPathByIdx(1), "/1")
            assert.strictEqual(manager.getTabPathByIdx(2), "/2")
        })

        it("should handle closeLeft() smoothly when index is exactly 0", () => {
            manager.switch(2)
            manager.closeLeft(0) // Deletes nothing (splice 0, 0)
            assert.strictEqual(manager.count, 3)
            assert.strictEqual(manager.activeIdx, 2)
        })
    })

    describe("11. Missing Properties & Falsy Values", () => {
        it("should fallback safely in switchToLastActive() if all timestamps are missing (undefined)", () => {
            manager.reset([{ path: "/a" }, { path: "/b" }, { path: "/c" }])
            manager.switch(1) // Active is "/b"

            // Because timestamps are undefined, it falls back to `{ timestamp: 0 }` safely
            // and simply picks the first available non-active tab gracefully.
            assert.doesNotThrow(() => manager.switchToLastActive())
        })

        it("should handle TAB_SWITCH_ON_CLOSE = 'latest' safely when timestamps are missing", () => {
            context.config.TAB_SWITCH_ON_CLOSE = "latest"
            manager.reset([{ path: "/a" }, { path: "/b" }, { path: "/c" }])
            manager.switch(1) // /b is active

            manager.close(1) // Deletes /b
            // If all timestamps are missing, reduce logic defaults to index 0 gracefully
            assert.strictEqual(manager.activeIdx, 0)
            assert.strictEqual(manager.current.path, "/a")
        })

        it("should not crash when sorting tabs with missing or empty showName", () => {
            manager.reset([{ path: "/a" }, { path: "/b" }])
            manager.tabs[0].showName = undefined
            manager.tabs[1].showName = null

            assert.doesNotThrow(() => manager.sort())
        })
    })

    describe("12. Asynchronous checkExist() Specific Configurations", () => {
        beforeEach(() => {
            manager.reset([{ path: "/keep1" }, { path: "/delete1" }, { path: "/keep2" }])
            context.utils.existPath.mock.mockImplementation(async (path) => path.startsWith("/keep"))
        })

        it("should shift active index to the LEFT if active tab is deleted and TAB_SWITCH_ON_CLOSE is 'left'", async () => {
            context.config.TAB_SWITCH_ON_CLOSE = "left"
            manager.switch(1) // Active is "/delete1"

            await manager.checkExist()

            assert.strictEqual(manager.count, 2)
            // Before delete: [keep1, delete1(active), keep2]
            // After delete with "left" config: falls back to index 0 (keep1)
            assert.strictEqual(manager.activeIdx, 0)
            assert.strictEqual(manager.current.path, "/keep1")
        })

        it("should trigger onEmpty() if ALL tabs are deleted simultaneously", async () => {
            manager.reset([{ path: "/delete1" }, { path: "/delete2" }])
            context.utils.existPath.mock.mockImplementation(async () => false) // All return false

            await manager.checkExist()

            assert.strictEqual(manager.count, 0)
            assert.strictEqual(context.onEmpty.mock.callCount(), 1)
        })
    })

    describe("13. Session Restore Edge Cases", () => {
        it("should exit early and do nothing if saveTabs is empty, null, or undefined", () => {
            manager.reset([{ path: "/original" }])

            manager.restoreSession(null, "root", "root", false)
            manager.restoreSession([], "root", "root", false)

            assert.strictEqual(manager.count, 1) // Still 1
        })

        it("should update scrollTop for already existing tabs instead of duplicating them", () => {
            manager.reset([{ path: "/exist1.md", scrollTop: 0 }])

            const savedSession = [
                { path: "/exist1.md", scrollTop: 999, active: false }, // Should update existing
                { path: "/new.md", scrollTop: 100, active: true }      // Should append
            ]

            manager.restoreSession(savedSession, "root", "root", false)

            assert.strictEqual(manager.count, 2)
            assert.strictEqual(manager.tabs[0].scrollTop, 999) // scrollTop updated
            assert.strictEqual(manager.tabs[1].path, "/new.md") // appended correctly
        })

        it("should fallback to activeIdx if restored session has no active flag", () => {
            manager.reset([{ path: "/exist.md" }])
            const savedSession = [{ path: "/restored.md", scrollTop: 0, active: false }] // No active tab marked

            manager.restoreSession(savedSession, "root", "root", false)

            assert.strictEqual(manager.count, 2)
            // Default activeIdx is 0 (from initialization/reset)
            assert.strictEqual(manager.activeIdx, 0)
        })
    })
})
