customElements.define("fast-window", class extends HTMLElement {
    constructor() {
        super()
        const shadowRoot = this.attachShadow({ mode: "open" })
        const template = document.getElementById("plugin-fast-window")
        shadowRoot.appendChild(template.content.cloneNode(true))

        this.entities = {
            titleBar: shadowRoot.querySelector(".title-bar"),
            titleTextElement: shadowRoot.getElementById("window-title"),
            buttonsContainer: shadowRoot.querySelector(".buttons-container"),
            contentArea: shadowRoot.querySelector(".content-area"),
        }

        this._isDragging = false
        this._offsetX = 0
        this._offsetY = 0

        this._addEventListeners()
    }

    connectedCallback() {
        this._updateTitle()
        this._renderButtons()
        this._setResize()
        this._applyInitialPosAndSize()
        if (this.hasAttribute("hidden")) {
            this.style.display = "none"
        }
    }

    static get observedAttributes() {
        return ["window-title", "window-buttons", "window-resize", "initial-x", "initial-y", "initial-width", "initial-height"]
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return

        switch (name) {
            case "window-title":
                this._updateTitle()
                break
            case "window-buttons":
                this._renderButtons()
                break
            case "window-resize":
                this._setResize()
                break
            case "initial-x":
            case "initial-y":
            case "initial-width":
            case "initial-height":
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

    show = () => {
        if (!this.hidden && !this.classList.contains("hiding")) return
        this.hidden = false
        this.style.display = "flex"
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

    _updateTitle = () => this.entities.titleTextElement.textContent = this.getAttribute("window-title") || ""

    _renderButtons = () => {
        this.entities.buttonsContainer.innerHTML = ""

        const buttonConfigs = this.getAttribute("window-buttons")
        if (!buttonConfigs) return

        const buttons = buttonConfigs
            .split(" ")
            .filter(cfg => cfg.trim() !== "")
            .map(cfg => {
                const parts = cfg.split(":")
                if (parts.length < 2 || parts.length > 3) {
                    console.warn(`Invalid button config: ${cfg}. Expected format "action:icon" or "action:icon:hint".`)
                    return
                }
                const action = parts[0].trim()
                const iconClass = parts[1].trim()
                const hint = parts[2] ? parts[2].trim() : ""

                const btn = document.createElement("div")
                btn.className = `button fa ${iconClass}`
                btn.dataset.action = action
                if (hint) {
                    btn.dataset.hint = hint
                }
                return btn
            })
            .filter(Boolean)

        this.entities.buttonsContainer.append(...buttons)
    }

    _applyInitialPosAndSize = () => {
        const initialX = this.getAttribute("initial-x")
        const initialY = this.getAttribute("initial-y")
        const initialWidth = this.getAttribute("initial-width")
        const initialHeight = this.getAttribute("initial-height")

        if (initialX) this.style.left = `${initialX}px`
        if (initialY) this.style.top = `${initialY}px`
        if (initialWidth) this.style.width = `${initialWidth}px`
        if (initialHeight) this.style.height = `${initialHeight}px`

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
})
