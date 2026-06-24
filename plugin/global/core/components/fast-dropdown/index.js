const { sharedSheets } = require("../common")

class FastDropdown extends HTMLElement {
  static _template = `
    <link rel="stylesheet" href="./plugin/global/core/components/fast-dropdown/index.css" crossorigin="anonymous">
    <div class="dropdown-trigger"><i class="dropdown-icon"></i><span class="dropdown-label"></span></div>
    <div class="dropdown-menu"></div>`

  state = {
    isOpen: false,
    options: [],
    value: "",
    placeholder: "",
  }

  constructor() {
    super()
    const root = this.attachShadow({ mode: "open" })
    root.adoptedStyleSheets = sharedSheets
    root.innerHTML = this.constructor._template

    this.entities = {
      trigger: root.querySelector(".dropdown-trigger"),
      label: root.querySelector(".dropdown-label"),
      icon: root.querySelector(".dropdown-icon"),
      menu: root.querySelector(".dropdown-menu"),
    }
  }

  static get observedAttributes() {
    return ["value", "placeholder", "no-label", "icon"]
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    if (name === "value") {
      this.state.value = newValue
      this._renderLabel()
      this._updateActiveItem()
    } else if (name === "placeholder") {
      this.state.placeholder = newValue
      this._renderLabel()
    } else if (name === "icon") {
      this.entities.icon.className = `dropdown-icon ${newValue || ""}`
    }
  }

  connectedCallback() {
    this.entities.trigger.addEventListener("click", ev => {
      ev.stopPropagation()
      this.state.isOpen ? this.close() : this.open()
    })
    this.entities.menu.addEventListener("click", ev => {
      const val = ev.target.closest(".dropdown-item")?.dataset.value
      if (val) this._select(this.state.options.find(opt => opt.value === val))
    })
  }

  disconnectedCallback() {
    this.close()
  }

  getOptions = () => this.state.options
  getValue = () => this.state.value
  getSelectedOption = () => this.state.options.find(opt => opt.value === this.state.value) || null

  setOptions = (opts) => {
    this.state.options = Array.isArray(opts) ? opts : []
    this._renderMenu()
    this._renderLabel()
    return this
  }

  setValue = (val, emitEvent = false) => {
    if (this.state.value === val) return this

    const oldValue = this.state.value
    this.state.value = val
    this.setAttribute("value", val)
    this._renderLabel()
    this._updateActiveItem()

    if (emitEvent) this._emitChange(val, this.getSelectedOption(), oldValue)

    return this
  }

  open = () => {
    if (this.state.isOpen) return
    this.state.isOpen = true
    this.toggleAttribute("open", true)
    document.addEventListener("click", this._handleClick)
    this.entities.menu.querySelector(".active")?.scrollIntoView({ block: "nearest" })
  }

  close = () => {
    if (!this.state.isOpen) return
    this.state.isOpen = false
    this.removeAttribute("open")
    document.removeEventListener("click", this._handleClick)
  }

  _handleClick = (ev) => {
    if (!this.contains(ev.target)) this.close()
  }

  _select = (option) => {
    const oldValue = this.state.value
    if (oldValue === option.value) {
      this.close()
      return
    }
    this.setValue(option.value)
    this.close()
    this._emitChange(option.value, option, oldValue)
  }

  _emitChange = (value, option, oldValue) => {
    this.dispatchEvent(new CustomEvent("change", { detail: { value, option, oldValue }, bubbles: true, composed: true }))
  }

  _renderLabel = () => {
    const selected = this.getSelectedOption()
    const displayText = selected ? (selected.label || selected.value) : this.state.placeholder
    this.entities.label.textContent = displayText
    this.entities.label.style.display = displayText ? "" : "none"
  }

  _renderMenu = () => {
    this.entities.menu.innerHTML = ""
    const els = this.state.options.map(opt => {
      const el = document.createElement("div")
      el.classList.add("dropdown-item")
      el.classList.toggle("active", this.state.value === opt.value)
      el.dataset.value = opt.value
      el.textContent = opt.label || opt.value
      return el
    })
    this.entities.menu.append(...els)
  }

  _updateActiveItem = () => {
    this.entities.menu.querySelectorAll(".dropdown-item")
      .forEach(el => el.classList.toggle("active", el.dataset.value === String(this.state.value)))
  }
}

customElements.define("fast-dropdown", FastDropdown)
