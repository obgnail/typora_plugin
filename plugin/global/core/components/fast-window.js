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

        this.entities.titleBar.addEventListener("mousedown", this._startDrag)
        this.entities.buttonsContainer.addEventListener("click", (ev) => {
            const target = ev.target.closest(".button")
            if (target) {
                ev.stopPropagation()
                const action = target.dataset.action || ""
                const detail = { action, target, ev, component: this }
                this.dispatchEvent(new CustomEvent("btn-click", { bubbles: true, composed: true, detail }))
            }
        })
    }

    connectedCallback() {
        this._updateTitle()
        this._renderButtons()

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

    static get observedAttributes() {
        return ["window-title", "window-buttons"]
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return

        if (name === "window-title") {
            this._updateTitle()
        } else if (name === "window-buttons") {
            this._renderButtons()
        }
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

    _updateTitle() {
        this.entities.titleTextElement.textContent = this.getAttribute("window-title") || ""
    }

    _renderButtons() {
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

    _startDrag = (ev) => {
        if (ev.button !== 0) return

        this._isDragging = true
        this.style.transition = "none"

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
        this.style.transition = ""

        document.removeEventListener("mousemove", this._dragging)
        document.removeEventListener("mouseup", this._endDrag)
    }
})
