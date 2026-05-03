const i18n = require("../../i18n")

const show = (el) => el.style.display = ""
const hide = (el) => el.style.display = "none"

customElements.define("fast-dialog", class extends HTMLElement {
    static get _template() {
        return `
            <link rel="stylesheet" href="./plugin/global/core/components/fast-dialog/index.css" crossorigin="anonymous">
            <div class="overlay" style="display: none;">
                <div class="dialog">
                    <div class="header"><div class="title">Title</div></div>
                    <div class="body"><fast-form class="form"></fast-form></div>
                    <div class="footer">
                        <button class="cancel-btn">${i18n.t("global", "cancel")}</button>
                        <button class="submit-btn">${i18n.t("global", "confirm")}</button>
                    </div>
                </div>
            </div>`
    }

    constructor() {
        super()
        const root = this.attachShadow({ mode: "open" })
        root.innerHTML = this.constructor._template

        this.entities = {
            overlay: root.querySelector(".overlay"),
            title: root.querySelector(".title"),
            form: root.querySelector(".form"),
            submit: root.querySelector(".submit-btn"),
            cancel: root.querySelector(".cancel-btn"),
        }
    }

    static get observedAttributes() {
        return ["dialog-title"]
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return
        switch (name) {
            case "dialog-title":
                this._updateTitle(newValue)
                break
        }
    }

    connectedCallback() {
        this.resolver = null
        this._toggleEvents(true)
    }

    disconnectedCallback() {
        this.resolver = null
        this._toggleEvents(false)
    }

    _updateTitle = (val) => {
        if (val) this.entities.title.textContent = val
    }

    _toggleEvents(attach) {
        const fn = attach ? "addEventListener" : "removeEventListener"
        this.entities.cancel[fn]("click", this._onCancel)
        this.entities.submit[fn]("click", this._onSubmit)
        this.entities.overlay[fn]("click", this._onClick)
        this.entities.overlay[fn]("keydown", this._onKeydown)
    }

    _onCancel = () => this._onChange(0)
    _onSubmit = () => this._onChange(1)
    _onClick = ev => !ev.target.closest(".dialog") && this._onChange(0)
    _onKeydown = ev => (ev.key === "Escape") && this._onChange(0)

    _onChange(state = 1) {
        hide(this.entities.overlay)
        this.resolver({ response: state, data: this.entities.form.options.data })
        this.resolver = null
        this.entities.form.clear()
    }

    modal = ({ title, ...options }) => {
        const { promise, resolve } = Promise.withResolvers()
        this.resolver = resolve

        this._updateTitle(title)
        this.entities.form.render(options)
        show(this.entities.overlay)
        this.entities.submit.focus()

        return promise
    }

    refresh = async fn => {
        const opts = this.entities.form.options
        await fn(opts)
        this._updateTitle(opts.title)
        this.entities.form.render(opts)
    }

    exit = () => this.entities.cancel.click()

    isPending = () => !!this.resolver
})
