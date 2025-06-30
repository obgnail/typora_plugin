const { sharedSheets } = require("./common")

customElements.define("fast-window", class extends HTMLElement {
    static _template = `
        <link rel="stylesheet" href="./plugin/global/styles/plugin-fast-window.css" crossorigin="anonymous">
        <div class="title-bar" part="title-bar">
            <span class="title-text" id="window-title"></span>
            <div class="buttons-container"></div>
        </div>
        <div class="content-area" part="content-area">
            <slot></slot>
        </div>
    `

    constructor() {
        super()
        const root = this.attachShadow({ mode: "open" })
        root.adoptedStyleSheets = sharedSheets
        root.innerHTML = this.constructor._template

        this.entities = {
            titleBar: root.querySelector(".title-bar"),
            titleTextElement: root.getElementById("window-title"),
            buttonsContainer: root.querySelector(".buttons-container"),
            contentArea: root.querySelector(".content-area"),
        }

        this.contentArea = this.entities.contentArea
        this._isDragging = false
        this._offsetX = 0
        this._offsetY = 0

        this._addEventListeners()
    }

    connectedCallback() {
        if (this.hasAttribute("hidden")) {
            this.style.display = "none"
        }
        this.updateTitle()
        this._updateButtons()
        this._setResize()
        this._applyInitialPosAndSize()
    }

    static get observedAttributes() {
        return ["window-title", "window-buttons", "window-resize", "x", "y", "width", "height"]
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return

        switch (name) {
            case "window-title":
                this.updateTitle()
                break
            case "window-buttons":
                this._updateButtons()
                break
            case "window-resize":
                this._setResize()
                break
            case "x":
            case "y":
            case "width":
            case "height":
                this._applyInitialPosAndSize()
                break
        }
    }

    disconnectedCallback() {
        this._removeEventListeners()
    }

    setContent = (content, unsafe = false) => {
        const contentArea = this.entities.contentArea
        contentArea.innerHTML = ""
        if (typeof content === "string") {
            if (unsafe) {
                contentArea.innerHTML = content
            } else {
                const textNode = document.createTextNode(content)
                contentArea.appendChild(textNode)
            }
        } else if (content instanceof Node) {
            contentArea.appendChild(content)
        } else {
            console.warn("fast-window: Invalid content type for setContent. Expected string, HTMLElement, or DocumentFragment.")
        }
    }

    updateTitle = (title = this.getAttribute("window-title")) => this.entities.titleTextElement.textContent = title || ""

    updateButtons = (updater) => {
        const buttons = this._parseButtonConfig()
        const _updated = updater(buttons)
        const updated = _updated === undefined ? buttons : _updated
        const result = updated && updated.length
            ? updated.map(({ action, icon, hint }) => `${action}|${icon}|${hint};`).join("")
            : ""
        this.setAttribute("window-buttons", result)
    }

    updateButton = (action, updater) => {
        this.updateButtons(buttons => {
            updater(buttons.find(btn => btn.action === action))
            return buttons
        })
    }

    toggle = (forceHide = false) => {
        if (forceHide || !this.hidden) {
            this.hide()
        } else {
            this.show()
        }
    }

    show = () => {
        if (!this.hidden && !this.classList.contains("hiding")) return
        this.hidden = false
        this.style.removeProperty("display")
        this.classList.remove("hiding")
        this.classList.add("showing")
    }

    hide = () => {
        if (this.hidden || this.classList.contains("showing")) return
        this.classList.remove("showing")
        this.classList.add("hiding")
    }

    _addEventListeners = () => {
        this.entities.titleBar.addEventListener("mousedown", this._startDrag)
        this.entities.buttonsContainer.addEventListener("click", this._onButtonClick)
        this.addEventListener("animationend", this._onAnimationEnd)
    }

    _removeEventListeners = () => {
        this.entities.titleBar.removeEventListener("mousedown", this._startDrag)
        this.entities.buttonsContainer.removeEventListener("click", this._onButtonClick)
        document.removeEventListener("mousemove", this._dragging)
        document.removeEventListener("mouseup", this._endDrag)
        this.removeEventListener("animationend", this._onAnimationEnd)
    }

    _updateButtons = () => {
        this.entities.buttonsContainer.innerHTML = ""

        const buttonEls = this._parseButtonConfig().map(({ action, icon, hint }) => {
            const el = document.createElement("div")
            el.className = `button fa ${icon}`
            el.dataset.action = action
            if (hint) {
                el.dataset.hint = hint
            }
            return el
        })

        this.entities.buttonsContainer.append(...buttonEls)
    }

    _applyInitialPosAndSize = () => {
        const x = this.getAttribute("x")
        const y = this.getAttribute("y")
        const w = this.getAttribute("width")
        const h = this.getAttribute("height")

        if (x) this.style.left = x
        if (y) this.style.top = y
        if (w) this.style.width = w
        if (h) this.style.height = h

        // If the element uses transform in external CSS
        // We need to convert it back to a left/top based positioning after connecting it to DOM,
        // so that there will be no offset when dragging.
        const { transform } = window.getComputedStyle(this)
        if (transform !== "none") {
            const { left, top } = this.getBoundingClientRect()
            this.style.left = `${left}px`
            this.style.top = `${top}px`
            this.style.transform = "none"
        }
    }

    _setResize = () => this.style.setProperty("--window-resize", this.getAttribute("window-resize"))

    _startDrag = (ev) => {
        if (ev.button !== 0 || ev.target.closest(".button")) return

        this._isDragging = true
        this.style.transition = "none"
        this.classList.add("dragging")

        const rect = this.getBoundingClientRect()
        this._offsetX = ev.clientX - rect.left
        this._offsetY = ev.clientY - rect.top

        document.addEventListener("mousemove", this._dragging)
        document.addEventListener("mouseup", this._endDrag)

        ev.preventDefault()
    }

    _dragging = (ev) => {
        if (!this._isDragging) return

        requestAnimationFrame(() => {
            let newX = ev.clientX - this._offsetX
            let newY = ev.clientY - this._offsetY
            const maxX = window.innerWidth - this.offsetWidth
            const maxY = window.innerHeight - this.offsetHeight
            newX = Math.max(0, Math.min(newX, maxX))
            newY = Math.max(0, Math.min(newY, maxY))
            this.style.left = `${newX}px`
            this.style.top = `${newY}px`
        })
    }

    _endDrag = () => {
        this._isDragging = false
        this.style.removeProperty("transition")
        this.classList.remove("dragging")

        document.removeEventListener("mousemove", this._dragging)
        document.removeEventListener("mouseup", this._endDrag)
    }

    _onButtonClick = (ev) => {
        const target = ev.target.closest(".button")
        if (target) {
            ev.stopPropagation()
            const action = target.dataset.action || ""
            const detail = { action, target, originalEvent: ev, component: this }
            this.dispatchEvent(new CustomEvent("btn-click", { bubbles: true, composed: true, detail }))
        }
    }

    _onAnimationEnd = (ev) => {
        if (ev.animationName === "hideWindow" && this.classList.contains("hiding")) {
            this.style.display = "none"
            this.hidden = true
            this.classList.remove("hiding")
        } else if (ev.animationName === "showWindow" && this.classList.contains("showing")) {
            this.classList.remove("showing")
        }
    }

    _parseButtonConfig = (config = this.getAttribute("window-buttons")) => {
        return (config || "")
            .split(";")
            .filter(cfg => cfg.trim() !== "")
            .map(cfg => {
                const parts = cfg.split("|")
                if (parts.length < 2 || parts.length > 3) {
                    console.warn(`Invalid button config: ${cfg}. Expected format "action:icon" or "action:icon:hint".`)
                    return
                }
                const action = parts[0].trim()
                const icon = parts[1].trim()
                const hint = parts[2] ? parts[2].trim() : ""
                return { action, icon, hint }
            })
            .filter(Boolean)
    }
})
