class pluginForm extends HTMLElement {
    init = (utils, options) => {
        this.utils = utils
        this.i18n = utils.i18n
        this.options = options
        this._initShadow()
        this._bindEvents()
    }

    render = (schemas, values) => this.form.innerHTML = this._fillForm(schemas, values)

    _initShadow = () => {
        const awesomeCSS = this.utils.joinPath("./style/font-awesome-4.1.0/css/font-awesome.min.css")
        const formCSS = this.utils.joinPath("./plugin/global/styles/dialog-form.css")
        const shadowRoot = this.attachShadow({ mode: "open" })
        shadowRoot.innerHTML = `
            <link rel="stylesheet" href="${awesomeCSS}" crossorigin="anonymous">
            <link rel="stylesheet" href="${formCSS}" crossorigin="anonymous">
            <div id="form"></div>
        `
        this.form = shadowRoot.querySelector("#form")
    }

    // type: set/remove/push/action
    _onEvent = (key, value, type = "set") => this.dispatchEvent(new CustomEvent("form-event", { detail: { key, value, type } }))

    _bindEvents = () => {
        const that = this
        let shownSelectOption = null

        $(this.form).on("click", function () {
            if (shownSelectOption) {
                that.utils.hide(shownSelectOption)
            }
            shownSelectOption = null
        }).on("click", ".select-wrap", function () {
            const optionBox = this.nextElementSibling
            const boxes = [...that.form.querySelectorAll(".option-box")]
            boxes.filter(box => box !== optionBox).forEach(that.utils.hide)
            that.utils.toggleVisible(optionBox)
            const isShown = that.utils.isShow(optionBox)
            if (isShown) {
                optionBox.scrollIntoView({ block: "nearest" })
            }
            shownSelectOption = isShown ? optionBox : null
            return false
        }).on("click", ".option-item", function () {
            const optionEl = this
            const boxEl = optionEl.closest(".option-box")
            const selectEl = optionEl.closest(".select")
            const selectValueEl = selectEl.querySelector(".select-value")
            const allOptionEl = [...boxEl.querySelectorAll(".option-item")]
            const isMulti = selectEl.dataset.multi === "true"
            const values = isMulti ? selectEl.dataset.value.split("#").filter(Boolean) : selectEl.dataset.value
            const optionValue = optionEl.dataset.value
            if (isMulti) {
                const deselect = optionEl.dataset.choose === "true"
                const minItems = Number(selectEl.dataset.minItems)
                const maxItems = Number(selectEl.dataset.maxItems)
                const itemCount = allOptionEl.filter(op => op.dataset.choose === "true").length + (deselect ? -1 : 1)
                if (itemCount < minItems || itemCount > maxItems) {
                    const msg = itemCount < minItems
                        ? that.i18n.t("global", "error.minItems", { minItems })
                        : that.i18n.t("global", "error.maxItems", { maxItems })
                    that.utils.notification.show(msg, "error")
                    that.utils.hide(boxEl)
                    return
                }
                optionEl.dataset.choose = deselect ? "false" : "true"
                const idx = values.indexOf(optionValue)
                if (idx === -1) {
                    values.push(optionValue)
                } else {
                    values.splice(idx, 1)
                }
                const map = new Map(allOptionEl.map(op => [op.dataset.value, op]))
                selectValueEl.textContent = values.length === 0
                    ? that.i18n.t("global", "empty")
                    : that._joinSelected(values.map(v => map.get(v).textContent))
                selectEl.dataset.value = values.join("#")
                that.utils.hide(boxEl)
                that._onEvent(selectEl.dataset.key, values)
            } else {
                allOptionEl.forEach(op => op.dataset.choose = "false")
                optionEl.dataset.choose = "true"
                selectEl.dataset.value = optionEl.dataset.value
                selectValueEl.textContent = optionEl.textContent
                that.utils.hide(boxEl)
                that._onEvent(selectEl.dataset.key, optionValue)
            }
        }).on("click", ".object-btn", function () {
            const textarea = this.closest(".control").querySelector(".object")
            try {
                const value = that._deserialize(textarea.value)
                that._onEvent(textarea.dataset.key, value)
                const msg = that.i18n.t("global", "notification.changesSubmitted")
                that.utils.notification.show(msg)
            } catch (e) {
                console.error(e)
                const msg = that.i18n.t("global", "error.IncorrectFormatContent", { format: that.options.objectFormat })
                that.utils.notification.show(msg, "error")
            }
        }).on("click", ".hotkey-reset", function () {
            const input = this.closest(".hotkey-wrap").querySelector("input")
            that._onEvent(input.dataset.key, "")
            that.utils.hotkeyHub.unregister(input.value)
            input.value = ""
        }).on("click", ".hotkey-undo", function () {
            const input = this.closest(".hotkey-wrap").querySelector("input")
            input.value = input.getAttribute("value")
            that._onEvent(input.dataset.key, input.value)
        }).on("click", '.control[data-type="action"]', function () {
            const icon = this.querySelector(".action")
            that._onEvent(icon.dataset.action, null, "action")
        }).on("click", ".array-item-delete", function () {
            const itemEl = this.parentElement
            const valueEl = this.previousElementSibling
            const displayEl = this.closest(".array")
            that._onEvent(displayEl.dataset.key, valueEl.textContent, "remove")
            itemEl.remove()
        }).on("click", ".array-item-add", function () {
            const addEl = this
            const inputEl = this.previousElementSibling
            that.utils.hide(addEl)
            that.utils.show(inputEl)
            inputEl.focus()
        }).on("input", ".range-input", function () {
            this.nextElementSibling.textContent = that._toFixed2(Number(this.value))
        }).on("change", "input.switch-input", function () {
            that._onEvent(this.dataset.key, this.checked)
        }).on("change", ".number-input, .range-input, .unit-input", function () {
            that._onEvent(this.dataset.key, Number(this.value))
        }).on("change", ".text-input, .textarea", function () {
            that._onEvent(this.dataset.key, this.value)
        })

        this.form.addEventListener("focusout", ev => {
            const input = ev.target.closest(".array-item-input")
            if (!input) return
            const displayEl = input.parentElement
            const addEl = input.nextElementSibling
            const value = input.textContent
            const values = [...displayEl.querySelectorAll(".array-item-value")].map(e => e.textContent)
            if (values.includes(value)) {
                const msg = this.i18n.t("global", "error.duplicateValue")
                this.utils.notification.show(msg, "error")
                input.focus()
                return
            }
            input.insertAdjacentHTML("beforebegin", this._createArrayItem(value))
            input.textContent = ""
            this.utils.hide(input)
            this.utils.show(addEl)
            this._onEvent(displayEl.dataset.key, value, "push")
        })

        const ignoreKeys = ["control", "alt", "shift", "meta"]
        const updateHotkey = this.utils.debounce(hk => this._onEvent(hk.dataset.key, hk.value), 500)
        this.form.addEventListener("keydown", ev => {
            if (ev.key === undefined) return
            const input = ev.target.closest(".hotkey-input")
            if (!input) return

            if (ev.key !== "Process") {
                const key = ev.key.toLowerCase()
                const arr = [
                    this.utils.metaKeyPressed(ev) ? "ctrl" : undefined,
                    this.utils.shiftKeyPressed(ev) ? "shift" : undefined,
                    this.utils.altKeyPressed(ev) ? "alt" : undefined,
                    ignoreKeys.includes(key) ? undefined : key,
                ]
                input.value = arr.filter(Boolean).join("+")
                updateHotkey(input)
            }
            ev.stopPropagation()
            ev.preventDefault()
        }, true)
    }

    _createArrayItem = (value) => `
        <span class="array-item">
            <span class="array-item-value">${this.utils.escape(value)}</span>
            <span class="array-item-delete">×</span>
        </span>
    `

    _fillForm = (schemas, values) => {
        const isBlockControl = type => type === "textarea" || type === "object" || type === "array"
        const createTitle = (title) => `<div class="title">${title}</div>`
        const createTooltip = (item) => item.tooltip ? `<span class="tooltip"><span class="fa fa-info-circle"></span><span>${item.tooltip}</span></span>` : ""
        const createGeneralControl = (ctl, value) => {
            const disabled = ctl => ctl.disabled ? "disabled" : ""
            const checked = () => value === true ? "checked" : ""
            const placeholder = ctl => ctl.placeholder ? `placeholder="${ctl.placeholder}"` : ""
            const range = ctl => {
                const arr = [
                    ctl.min != null ? `min="${ctl.min}"` : "",
                    ctl.max != null ? `max="${ctl.max}"` : "",
                    ctl.step != null ? `step="${ctl.step}"` : "",
                    `value="${value != null ? value : 1}"`,
                ]
                return arr.join(" ")
            }
            switch (ctl.type) {
                case "switch":
                    return `<input class="switch-input" type="checkbox" data-key="${ctl.key}" ${checked()} ${disabled(ctl)} />`
                case "text":
                    return `<input class="text-input" type="text" data-key="${ctl.key}" value="${value}" ${placeholder(ctl)} ${disabled(ctl)}>`
                case "number":
                case "unit":
                    const input = `<input class="${ctl.type}-input" type="number" data-key="${ctl.key}" ${range(ctl)} ${disabled(ctl)}>`
                    if (ctl.type === "number") {
                        return input
                    }
                    const unit = `<div class="unit-value">${ctl.unit}</div>`
                    return input + unit
                case "range":
                    return `
                        <div class="range-wrap">
                            <input class="range-input" type="range" data-key="${ctl.key}" ${range(ctl)} ${disabled(ctl)}>
                            <div class="range-value">${this._toFixed2(value)}</div>
                        </div>
                    `
                case "action":
                    return `<div class="action fa fa-angle-right" data-action="${ctl.act}"></div>`
                case "static":
                    return `<div class="static">${value}</div>`
                case "select":
                    const isMulti = Array.isArray(value)
                    const show = isMulti
                        ? this._joinSelected(value.map(e => ctl.options[e]))
                        : ctl.options[value]
                    const isSelected = (option) => isMulti ? value.includes(option) : option === value
                    const options = Object.entries(ctl.options).map(([option, optionShowName]) => {
                        const choose = isSelected(option) ? "true" : "false"
                        return `<div class="option-item" data-value="${option}" data-choose="${choose}">${optionShowName}</div>`
                    })
                    const val = isMulti ? value.join("#") : value
                    const minItems = (isMulti && ctl.minItems != null) ? ctl.minItems : 0
                    const maxItems = (isMulti && ctl.maxItems != null) ? ctl.maxItems : Infinity
                    return `
                        <div class="select" data-multi="${isMulti}" data-min-items="${minItems}" data-max-items="${maxItems}" data-key="${ctl.key}" data-value="${val}">
                            <div class="select-wrap"><span class="select-value">${show}</span>
                                <span class="select-icon fa fa-caret-down"></span>
                            </div>
                            <div class="option-box plugin-common-hidden" data-name="${ctl.key}">${options.join("")}</div>
                        </div>`
                case "hotkey":
                    return `
                        <div class="hotkey-wrap">
                            <input type="text" class="hotkey-input" data-key="${ctl.key}" value="${value}" placeholder="" ${disabled(ctl)}>
                            <div>
                                <div class="hotkey-undo">↺</div>
                                <div class="hotkey-reset">×</div>
                            </div>
                        </div>
                        `
                case "textarea":
                case "object":
                    const isObject = ctl.type === "object"
                    const rows = ctl.rows || 3
                    const readonly = ctl.readonly ? "readonly" : ""
                    const value_ = isObject ? this._serialize(value) : value
                    const textarea = `<textarea class="${ctl.type}" rows="${rows}" ${readonly} data-key="${ctl.key}" ${placeholder(ctl)} ${disabled(ctl)}>${value_}</textarea>`
                    const btn = isObject ? `<button class="object-btn">${this.i18n.t("global", "confirm")}</button>` : ""
                    return textarea + btn
                case "array":
                    const items = value.map(this._createArrayItem).join("")
                    return `
                        <div class="array" data-key="${ctl.key}">
                            ${items}
                            <span class="array-item-input plugin-common-hidden" contenteditable="true"></span>
                            <span class="array-item-add">+ ${this.i18n.t("global", "add")}</span>
                        </div>
                    `
                default:
                    return ""
            }
        }
        const createControl = (field) => {
            if (field.type === "number" && field.unit != null) {
                field.type = "unit"
            }
            const isBlock = isBlockControl(field.type)
            const value = values[field.key]

            const control = createGeneralControl(field, value)
            const wrappedControl = isBlock ? control : `<div>${control}</div>`
            const wrappedLabel = isBlock ? "" : `<div>${field.label}${createTooltip(field)}</div>`
            return `<div class="control" data-type="${field.type}">${wrappedLabel}${wrappedControl}</div>`
        }
        const createBox = ({ title, fields }) => {
            const t = title ? createTitle(title) : ""
            const items = fields.map(createControl).join("")
            const box = `<div class="box">${items}</div>`
            return t + box
        }
        return schemas.map(createBox).join("")
    }

    _toFixed2 = (num) => Number.isInteger(num) ? num : num.toFixed(2)

    _joinSelected = (options) => options.join(", ")

    _serialize = (obj) => {
        const funcMap = {
            JSON: (obj) => JSON.stringify(obj, null, "\t"),
            TOML: (obj) => this.utils.stringifyToml(obj),
            YAML: (obj) => this.utils.stringifyYaml(obj)
        }
        const f = funcMap[this.options.objectFormat] || funcMap.JSON
        return f(obj)
    }

    _deserialize = (str) => {
        const funcMap = {
            JSON: (str) => JSON.parse(str),
            TOML: (str) => this.utils.readToml(str),
            YAML: (str) => this.utils.readYaml(str),
        }
        const f = funcMap[this.options.objectFormat] || funcMap.JSON
        return f(str)
    }
}

customElements.define("dialog-form", pluginForm)
