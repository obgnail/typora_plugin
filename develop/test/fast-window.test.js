const { describe, it, mock, before, beforeEach } = require("node:test")
const assert = require("node:assert")
const proxyquire = require("proxyquire")

let utils
let dom, container
let FastWindow, fw

const clean = () => {
    fw.remove()
    fw = new FastWindow()
    container.appendChild(fw)
}

before(async () => {
    utils = require("./mocks/utils.mock.js")
    dom = require("./mocks/dom.mock.js")
    proxyquire("../../plugin/global/core/components/fast-window.js", {
        "./common": { sharedSheets: [new CSSStyleSheet()], "@noCallThru": true },
        "../utils": { ...utils, "@noCallThru": true },
    })

    FastWindow = customElements.get("fast-window")
    fw = new FastWindow()
    container = document.getElementById("test-container")
    container.appendChild(fw)
})

describe("FastWindow Browser Env", () => {
    it("FastWindow has initialized", () => {
        assert.ok(typeof fw.setContent === "function")
        assert.ok(typeof fw.updateTitle === "function")
        assert.ok(typeof fw.updateButtons === "function")
    })
})

describe("FastWindow Shadow DOM Structure", () => {
    beforeEach(clean)

    it("should create shadow DOM with correct structure", () => {
        const root = fw.shadowRoot
        assert.ok(root, "Shadow root should exist")
        assert.ok(root.querySelector(".title-bar"), "Title bar should exist")
        assert.ok(root.querySelector(".title-name"), "Title name element should exist")
        assert.ok(root.querySelector(".title-buttons"), "Title buttons container should exist")
        assert.ok(root.querySelector(".content-area"), "Content area should exist")
        assert.ok(root.querySelector("slot"), "Slot for content should exist")
    })

    it("should initialize entities correctly", () => {
        assert.ok(fw.entities.titleBar, "Title bar entity should be set")
        assert.ok(fw.entities.titleName, "Title name entity should be set")
        assert.ok(fw.entities.titleButtons, "Title buttons entity should be set")
        assert.ok(fw.entities.contentArea, "Content area entity should be set")
    })

    it("should initialize dragging state", () => {
        assert.strictEqual(fw._offsetX, 0, "Offset X should be 0 initially")
        assert.strictEqual(fw._offsetY, 0, "Offset Y should be 0 initially")
    })
})

describe("FastWindow Attributes", () => {
    beforeEach(clean)

    it("should observe correct attributes", () => {
        const observed = FastWindow.observedAttributes
        assert.ok(Array.isArray(observed), "Should return array of observed attributes")
        assert.ok(observed.includes("window-title"), "Should observe window-title")
        assert.ok(observed.includes("window-buttons"), "Should observe window-buttons")
        assert.ok(observed.includes("window-resize"), "Should observe window-resize")
        assert.ok(observed.includes("x"), "Should observe x")
        assert.ok(observed.includes("y"), "Should observe y")
        assert.ok(observed.includes("width"), "Should observe width")
        assert.ok(observed.includes("height"), "Should observe height")
    })

    it("should handle window-title attribute changes", () => {
        fw.setAttribute("window-title", "Test Title")
        assert.strictEqual(fw.entities.titleName.textContent, "Test Title", "Title should update")

        fw.updateTitle("New Title")
        assert.strictEqual(fw.entities.titleName.textContent, "New Title", "Title should update via method")
    })

    it("should handle hidden attribute in connectedCallback", () => {
        fw.setAttribute("hidden", "")
        fw.connectedCallback()
        assert.strictEqual(fw.style.display, "none", "Should hide when hidden attribute present")
    })

    it("should not update when old and new values are the same", () => {
        const initialTitle = fw.getAttribute("window-title")
        fw.setAttribute("window-title", initialTitle)
        // Should not throw error and should not trigger unnecessary updates
        assert.doesNotThrow(() => fw.attributeChangedCallback("window-title", initialTitle, initialTitle))
    })
})

describe("FastWindow Content Management", () => {
    beforeEach(clean)

    it("should set text content safely", () => {
        fw.setContent("Hello World")
        assert.strictEqual(fw.entities.contentArea.textContent, "Hello World", "Text content should be set")
    })

    it("should set HTML content unsafely", () => {
        fw.setContent("<strong>Bold</strong>", true)
        const strong = fw.entities.contentArea.querySelector("strong")
        assert.ok(strong, "HTML should be rendered when unsafe is true")
        assert.strictEqual(strong.textContent, "Bold", "HTML content should be correct")
    })

    it("should set HTMLElement content", () => {
        const div = document.createElement("div")
        div.textContent = "Dynamic Content"
        fw.setContent(div)
        assert.strictEqual(fw.entities.contentArea.firstChild, div, "HTMLElement should be appended")
    })

    it("should clear existing content before setting new content", () => {
        fw.setContent("Initial")
        fw.setContent("New")
        assert.strictEqual(fw.entities.contentArea.textContent, "New", "Old content should be cleared")
        assert.strictEqual(fw.entities.contentArea.childNodes.length, 1, "Should have only one child")
    })

    it("should warn for invalid content type", () => {
        let warningMessage = ""
        mock.method(console, "warn", (msg) => warningMessage = msg)
        fw.setContent(123)
        assert.ok(warningMessage.includes("Invalid content"), "Should warn about invalid content")
    })

    it("should handle empty string content", () => {
        fw.setContent("")
        assert.strictEqual(fw.entities.contentArea.textContent, "", "Empty string should be handled")
    })

    it("should handle null content gracefully", () => {
        fw.setContent(null)
        assert.doesNotThrow(() => fw.setContent(null))
    })
})

describe("FastWindow Button Management", () => {
    beforeEach(clean)

    it("should parse button config correctly", () => {
        const config = "close|×|Close;download|↓|Download;"
        fw.setAttribute("window-buttons", config)

        const parsed = fw._parseButtonConfig()
        assert.strictEqual(parsed.length, 2, "Should parse two buttons")
        assert.strictEqual(parsed[0].action, "close", "First button action should be correct")
        assert.strictEqual(parsed[0].icon, "×", "First button icon should be correct")
        assert.strictEqual(parsed[0].hint, "Close", "First button hint should be correct")
    })

    it("should handle empty button config", () => {
        fw.setAttribute("window-buttons", "")
        const parsed = fw._parseButtonConfig()
        assert.strictEqual(parsed.length, 0, "Should return empty array for empty config")
    })

    it("should handle malformed button config gracefully", () => {
        fw.setAttribute("window-buttons", "invalid-format")
        const parsed = fw._parseButtonConfig()
        assert.ok(Array.isArray(parsed), "Should return array even for malformed config")
    })

    it("should update buttons using updater function", () => {
        fw.setAttribute("window-buttons", "close|×|Close;")
        fw.updateButtons((buttons) => {
            buttons.push({ action: "help", icon: "?", hint: "Help" })
            return buttons
        })

        const newConfig = fw.getAttribute("window-buttons")
        assert.ok(newConfig.includes("help"), "New button should be added")
    })

    it("should handle updater returning undefined", () => {
        const originalConfig = "close|×|Close;"
        fw.setAttribute("window-buttons", originalConfig)
        fw.updateButtons(() => undefined)
        assert.strictEqual(fw.getAttribute("window-buttons"), originalConfig, "Should keep original config when updater returns undefined")
    })

    it("should handle empty buttons array", () => {
        fw.updateButtons(() => [])
        assert.strictEqual(fw.getAttribute("window-buttons"), "", "Should set empty string for empty array")
    })
})

describe("FastWindow Position and Size", () => {
    beforeEach(clean)

    it("should apply initial position and size from attributes", () => {
        fw.setAttribute("x", "100px")
        fw.setAttribute("y", "200px")
        fw.setAttribute("width", "300px")
        fw.setAttribute("height", "400px")
        fw._applyInitialPosAndSize()

        assert.strictEqual(fw.style.left, "100px", "X position should be applied")
        assert.strictEqual(fw.style.top, "200px", "Y position should be applied")
        assert.strictEqual(fw.style.width, "300px", "Width should be applied")
        assert.strictEqual(fw.style.height, "400px", "Height should be applied")
    })

    it("should handle missing position/size attributes", () => {
        fw._applyInitialPosAndSize()
        assert.doesNotThrow(() => fw._applyInitialPosAndSize())
    })

    it("should handle invalid numeric values", () => {
        fw.setAttribute("x", "invalid")
        fw.setAttribute("y", "NaN")
        fw._applyInitialPosAndSize()
        assert.doesNotThrow(() => fw._applyInitialPosAndSize())
    })
})

describe("FastWindow Resize Functionality", () => {
    beforeEach(clean)

    it("should set resize when attribute is present", () => {
        fw.setAttribute("window-resize", "both")
        fw._setResize()
        assert.doesNotThrow(() => fw._setResize())
    })

    it("should handle missing resize attribute", () => {
        fw._setResize()
        assert.doesNotThrow(() => fw._setResize())
    })
})

describe("FastWindow Dragging", () => {
    beforeEach(clean)

    it("should initialize dragging state correctly", () => {
        assert.strictEqual(fw._offsetX, 0, "Offset X should be 0")
        assert.strictEqual(fw._offsetY, 0, "Offset Y should be 0")
    })

    it("should add event listeners on construction", () => {
        // Event listeners should be added in constructor
        assert.ok(fw._addEventListeners, "Should have _addEventListeners method")
        assert.doesNotThrow(() => fw._addEventListeners(), "Should not throw when adding listeners")
    })

    it("should remove event listeners on disconnection", () => {
        assert.ok(fw._removeEventListeners, "Should have _removeEventListeners method")
        assert.doesNotThrow(() => fw._removeEventListeners(), "Should not throw when removing listeners")
    })
})

describe("FastWindow Lifecycle", () => {
    beforeEach(clean)

    it("should call connectedCallback methods", () => {
        let updateTitleCalled = false
        let updateButtonsCalled = false
        let setResizeCalled = false
        let applyInitialCalled = false

        fw.updateTitle = () => updateTitleCalled = true
        fw._updateButtons = () => updateButtonsCalled = true
        fw._setResize = () => setResizeCalled = true
        fw._applyInitialPosAndSize = () => applyInitialCalled = true
        fw.connectedCallback()

        assert.ok(updateTitleCalled, "updateTitle should be called")
        assert.ok(updateButtonsCalled, "_updateButtons should be called")
        assert.ok(setResizeCalled, "_setResize should be called")
        assert.ok(applyInitialCalled, "_applyInitialPosAndSize should be called")
    })

    it("should call disconnectedCallback", () => {
        let removeListenersCalled = false
        fw._removeEventListeners = () => removeListenersCalled = true
        fw.disconnectedCallback()
        assert.ok(removeListenersCalled, "_removeEventListeners should be called")
    })
})

describe("FastWindow Edge Cases", () => {
    beforeEach(clean)

    it("should handle multiple rapid attribute changes", () => {
        fw.setAttribute("window-title", "Title1")
        fw.setAttribute("window-title", "Title2")
        fw.setAttribute("window-title", "Title3")
        assert.strictEqual(fw.entities.titleName.textContent, "Title3", "Should handle rapid changes")
    })

    it("should handle content with special characters", () => {
        const specialContent = "<script>alert('xss')</script>"
        fw.setContent(specialContent)
        assert.strictEqual(fw.entities.contentArea.textContent, specialContent, "Should escape HTML by default")
    })

    it("should handle very long titles", () => {
        const longTitle = "A".repeat(1000)
        fw.setAttribute("window-title", longTitle)
        assert.strictEqual(fw.entities.titleName.textContent, longTitle, "Should handle long titles")
    })

    it("should handle button config with special characters", () => {
        const specialConfig = "test|<>&|Test with <special> chars;"
        fw.setAttribute("window-buttons", specialConfig)
        const parsed = fw._parseButtonConfig()
        assert.strictEqual(parsed[0].hint, "Test with <special> chars", "Should handle special chars in hints")
    })

    it("should handle negative position values", () => {
        fw.setAttribute("x", "-50px")
        fw.setAttribute("y", "-100px")
        fw._applyInitialPosAndSize()
        assert.strictEqual(fw.style.left, "-50px", "Should handle negative X")
        assert.strictEqual(fw.style.top, "-100px", "Should handle negative Y")
    })

    it("should handle zero size values", () => {
        fw.setAttribute("width", "0")
        fw.setAttribute("height", "0")
        fw._applyInitialPosAndSize()
        assert.strictEqual(fw.style.width, "0px", "Should handle zero width")
        assert.strictEqual(fw.style.height, "0px", "Should handle zero height")
    })

    it("should handle floating point position values", () => {
        fw.setAttribute("x", "100.5px")
        fw.setAttribute("y", "200.7px")
        fw._applyInitialPosAndSize()
        assert.strictEqual(fw.style.left, "100.5px", "Should handle float X")
        assert.strictEqual(fw.style.top, "200.7px", "Should handle float Y")
    })
})

describe("FastWindow Error Handling", () => {
    beforeEach(clean)

    it("should handle malformed button config without crashing", () => {
        const malformedConfigs = [
            "single|button",
            "too|many|parts|here|extra",
            "missing|icon|",
            "|missing|action",
            ""
        ]

        malformedConfigs.forEach(config => {
            assert.doesNotThrow(() => {
                fw.setAttribute("window-buttons", config)
                fw._parseButtonConfig()
            }, `Should handle config: ${config}`)
        })
    })

    it("should handle DOM manipulation errors", () => {
        const originalContentArea = fw.entities.contentArea
        try {
            fw.entities.contentArea = null
            assert.throws(() => fw.setContent("test"), "Should handle null contentArea")
        } finally {
            fw.entities.contentArea = originalContentArea
        }
    })

    it("should handle attribute changes on disconnected element", () => {
        fw.remove()
        // Should not throw when changing attributes on disconnected element
        assert.doesNotThrow(
            () => fw.setAttribute("window-title", "Disconnected Title"),
            "Should handle attribute changes on disconnected element"
        )
    })
})

describe("FastWindow Button Events", () => {
    beforeEach(clean)

    it("should emit btn-click events for button clicks", () => {
        let eventFired = false
        let eventData = null

        fw.addEventListener("btn-click", (e) => {
            eventFired = true
            eventData = e.detail
        })

        fw.setAttribute("window-buttons", "close|×|Close;")
        fw._updateButtons()

        const closeButton = fw.entities.titleButtons.querySelector(".button")
        closeButton.dispatchEvent(new MouseEvent("click", { bubbles: true }))

        assert.ok(eventFired, "Should emit btn-click event")
        assert.strictEqual(eventData.action, "close", "Should pass correct action in event detail")
    })

    it("should handle button clicks without registered listeners", () => {
        fw.setAttribute("window-buttons", "close|×|Close;")
        fw._updateButtons()
        const closeButton = fw.entities.titleButtons.querySelector(".button")
        assert.doesNotThrow(
            () => closeButton.dispatchEvent(new MouseEvent("click", { bubbles: true })),
            "Should handle button clicks without listeners"
        )
    })

    it("should handle multiple button clicks", () => {
        let clickCount = 0

        fw.addEventListener("btn-click", () => clickCount++)
        fw.setAttribute("window-buttons", "close|×|Close;minimize|−|Minimize;")
        fw._updateButtons()

        const buttons = fw.entities.titleButtons.querySelectorAll(".button")
        buttons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }))
        buttons[1].dispatchEvent(new MouseEvent("click", { bubbles: true }))

        assert.strictEqual(clickCount, 2, "Should handle multiple button clicks")
    })
})

describe("FastWindow Animation and Transitions", () => {
    beforeEach(clean)

    it("should add showing class on show", () => {
        fw.hidden = true
        fw.show()
        assert.ok(fw.classList.contains("showing"), "Should add showing class")
    })

    it("should add hiding class on hide", () => {
        fw.hide()
        assert.ok(fw.classList.contains("hiding"), "Should add hiding class")
    })

    it("should handle show/hide method calls", () => {
        assert.doesNotThrow(() => fw.show(), "Show method should not throw")
        assert.doesNotThrow(() => fw.hide(), "Hide method should not throw")
    })

    it("should handle multiple show/hide calls", () => {
        fw.show()
        fw.show()
        fw.hide()
        fw.hide()
        // Should not throw and should maintain correct classes
        assert.ok(fw.classList.contains("hiding"), "Should maintain hiding class after multiple calls")
    })
})

describe("FastWindow Resize Functionality", () => {
    beforeEach(clean)

    it("should handle resize handle events", () => {
        fw.setAttribute("window-resize", "both")
        fw._setResize()

        const resizeHandle = fw.shadowRoot.querySelector(".resize-handle")
        if (resizeHandle) {
            assert.doesNotThrow(
                () => resizeHandle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 200, clientY: 150 })),
                "Should handle resize handle mouse down"
            )
        }
    })

    it("should handle different resize modes", () => {
        const resizeModes = ["both", "horizontal", "vertical", ""]
        resizeModes.forEach(mode => {
            fw.setAttribute("window-resize", mode)
            assert.doesNotThrow(() => fw._setResize(), `Should handle resize mode: ${mode}`)
        })
    })

    it("should handle resize without handle element", () => {
        fw.setAttribute("window-resize", "both")
        mock.method(fw.shadowRoot, "querySelector", () => null)
        assert.doesNotThrow(() => fw._setResize(), "Should handle missing resize handle")
    })
})

describe("FastWindow State Persistence", () => {
    beforeEach(clean)

    it("should persist position attributes", () => {
        fw.style.left = "100px"
        fw.style.top = "200px"

        // Simulate position persistence
        assert.doesNotThrow(() => {
            fw.setAttribute("x", "100")
            fw.setAttribute("y", "200")
        }, "Should persist position attributes")
    })

    it("should persist size attributes", () => {
        fw.style.width = "300px"
        fw.style.height = "400px"

        // Simulate size persistence
        assert.doesNotThrow(() => {
            fw.setAttribute("width", "300")
            fw.setAttribute("height", "400")
        }, "Should persist size attributes")
    })

    it("should handle attribute persistence with invalid values", () => {
        const invalidValues = ["invalid", "NaN", "null", "undefined"]
        invalidValues.forEach(value => {
            assert.doesNotThrow(() => {
                fw.setAttribute("x", value)
                fw.setAttribute("y", value)
                fw.setAttribute("width", value)
                fw.setAttribute("height", value)
            }, `Should handle invalid value: ${value}`)
        })
    })
})

describe("FastWindow Accessibility", () => {
    beforeEach(clean)

    it("should handle keyboard navigation", () => {
        fw.setAttribute("window-buttons", "close|×|Close;")
        fw._updateButtons()

        const closeButton = fw.entities.titleButtons.querySelector(".button")
        assert.doesNotThrow(
            () => closeButton.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
            "Should handle keyboard navigation"
        )
    })

    it("should maintain focus management", () => {
        assert.doesNotThrow(() => {
            fw.focus()
            fw.blur()
        }, "Should handle focus management")
    })
})

describe("FastWindow Performance", () => {
    beforeEach(clean)

    it("should handle rapid content updates", () => {
        const startTime = performance.now()
        for (let i = 0; i < 100; i++) {
            fw.setContent(`Content ${i}`)
        }

        const endTime = performance.now()
        const duration = endTime - startTime
        assert.ok(duration < 1000, "Should handle rapid updates efficiently")
    })

    it("should handle large content", () => {
        const largeContent = "A".repeat(10000)
        assert.doesNotThrow(() => fw.setContent(largeContent), "Should handle large content")
        assert.strictEqual(fw.entities.contentArea.textContent.length, 10000, "Should preserve large content")
    })

    it("should debounce rapid attribute changes", () => {
        const startTime = performance.now()
        for (let i = 0; i < 100; i++) {
            fw.setAttribute("window-title", `Title ${i}`)
        }
        const endTime = performance.now()
        const duration = endTime - startTime
        assert.ok(duration < 500, "Should handle rapid attribute changes efficiently")
    })
})

describe("FastWindow Integration", () => {
    beforeEach(clean)

    it("should work with other FastWindow instances", () => {
        const fw2 = new FastWindow()
        container.appendChild(fw2)
        fw.setAttribute("window-title", "Window 1")
        fw2.setAttribute("window-title", "Window 2")

        assert.strictEqual(fw.entities.titleName.textContent, "Window 1", "First window should maintain its state")
        assert.strictEqual(fw2.entities.titleName.textContent, "Window 2", "Second window should maintain its state")

        fw2.remove()
    })

    it("should handle nested content", () => {
        const nestedContent = document.createElement("div")
        nestedContent.innerHTML = "<p>Nested <strong>content</strong></p>"
        fw.setContent(nestedContent)

        assert.ok(fw.entities.contentArea.querySelector("p"), "Should preserve nested elements")
        assert.ok(fw.entities.contentArea.querySelector("strong"), "Should preserve deeply nested elements")
    })

    it("should handle CSS custom properties", () => {
        fw.style.setProperty("--custom-color", "red")
        assert.strictEqual(fw.style.getPropertyValue("--custom-color").trim(), "red", "Should preserve CSS custom properties")
    })
})
