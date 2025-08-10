const { sharedSheets } = require("./common")
const { utils } = require("../utils")
const { i18n } = require("../i18n")

customElements.define("fast-form", class extends HTMLElement {
    static _template = `<link rel="stylesheet" href="./plugin/global/styles/plugin-fast-form.css" crossorigin="anonymous"><div id="form"></div>`

    constructor() {
        super()
        const root = this.attachShadow({ mode: "open" })
        root.adoptedStyleSheets = sharedSheets
        root.innerHTML = this.constructor._template

        this.form = root.querySelector("#form")
        this.options = { objectFormat: "JSON", schema: [], data: {}, action: {}, rule: {}, dependencies: {} }
        this._bindEvents()
    }

    setOptions = (options) => {
        const ops = utils.pick(options, ["objectFormat"])
        this.options = { ...this.options, ...ops }
    }

    render = (options) => {
        const { schema = [], data = {}, action = {}, rule = {} } = options

        this.options.schema = schema
        this.options.action = action
        this.options.rule = rule
        this.options.data = JSON.parse(JSON.stringify(data))
        this.options.dependencies = this._buildDependencies(schema)

        this.form.innerHTML = this._fillForm(schema)
    }

    _dispatchAction(key) {
        const actFn = this.options.action[key]
        if (actFn) {
            actFn(this.options)
        }
    }

    // type: set/push/removeIndex
    _validateAndSubmit(key, value, type = "set") {
        const detail = { key, value, type }
        const ok = this._validate(detail)
        if (ok) {
            this._submit(detail)
        }
        return ok
    }

    _submit(detail) {
        this.dispatchEvent(new CustomEvent("form-crud", { detail }))
        utils.nestedPropertyHelpers[detail.type](this.options.data, detail.key, detail.value)
        this._toggleReadonly(detail.key)
    }

    _validate(detail) {
        try {
            const ruleFn = this.options.rule[detail.key]
            if (ruleFn) ruleFn(detail)
            return true
        } catch (err) {
            const msg = err.message || err.toString()
            utils.notification.show(msg, "error")
        }
    }

    _bindEvents() {
        const that = this
        let shownSelectOption = null

        $(this.form).on("keydown", "input:not(.hotkey-input), textarea", function (ev) {
            if (ev.key === "a" && utils.metaKeyPressed(ev)) {
                this.select()
                return false
            }
        }).on("keydown", ".array-item-input", function (ev) {
            if (ev.key === "Enter") {
                this.blur()
                return false
            } else if (ev.key === "Escape") {
                this.textContent = ""
                utils.hide(this)
                utils.show(this.nextElementSibling)
            }
        }).on("click", function () {
            if (shownSelectOption) {
                utils.hide(shownSelectOption)
            }
            shownSelectOption = null
        }).on("click", ".select-wrap", function () {
            const optionBox = this.nextElementSibling
            const boxes = [...that.form.querySelectorAll(".option-box")]
            boxes.filter(box => box !== optionBox).forEach(utils.hide)
            utils.toggleVisible(optionBox)
            const isShown = utils.isShow(optionBox)
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
            const selectedValues = isMulti ? selectEl.dataset.value.split("#").filter(Boolean) : selectEl.dataset.value
            const optionValue = optionEl.dataset.value
            if (isMulti) {
                const deselect = optionEl.dataset.choose === "true"
                const minItems = Number(selectEl.dataset.minItems)
                const maxItems = Number(selectEl.dataset.maxItems)
                const itemCount = allOptionEl.filter(op => op.dataset.choose === "true").length + (deselect ? -1 : 1)
                if (itemCount < minItems || itemCount > maxItems) {
                    const msg = itemCount < minItems
                        ? i18n.t("global", "error.minItems", { minItems })
                        : i18n.t("global", "error.maxItems", { maxItems })
                    utils.notification.show(msg, "error")
                    utils.hide(boxEl)
                    return
                }
                const idx = selectedValues.indexOf(optionValue)
                if (idx === -1) {
                    selectedValues.push(optionValue)
                } else {
                    selectedValues.splice(idx, 1)
                }
                const ok = that._validateAndSubmit(selectEl.dataset.key, selectedValues)
                if (ok) {
                    optionEl.dataset.choose = deselect ? "false" : "true"
                    const map = new Map(allOptionEl.map(op => [op.dataset.value, op]))
                    selectValueEl.textContent = selectedValues.length === 0
                        ? i18n.t("global", "empty")
                        : that._joinSelected(selectedValues.map(v => map.get(v).textContent))
                    selectEl.dataset.value = selectedValues.join("#")
                    utils.hide(boxEl)
                }
            } else {
                const ok = that._validateAndSubmit(selectEl.dataset.key, optionValue)
                if (ok) {
                    allOptionEl.forEach(op => op.dataset.choose = "false")
                    optionEl.dataset.choose = "true"
                    selectEl.dataset.value = optionEl.dataset.value
                    selectValueEl.textContent = optionEl.textContent
                    utils.hide(boxEl)
                }
            }
        }).on("click", ".table-add", async function () {
            const tableEl = this.closest(".table")
            const key = tableEl.dataset.key
            const targetBox = that.options.schema.find(box => box.fields && box.fields.length === 1 && box.fields[0].key === key)
            const { nestedBoxes, defaultValues, thMap } = targetBox.fields[0]
            const op = { title: targetBox.title, schema: nestedBoxes, data: defaultValues }
            const { response, data } = await utils.formDialog.modal(op)
            if (response === 0) return
            const ok = that._validateAndSubmit(key, data, "push")
            if (ok) {
                const row = that._createTableRow(thMap, data).map(e => `<td>${e}</td>`).join("")
                tableEl.querySelector("tbody").insertAdjacentHTML("beforeend", `<tr>${row}</tr>`)
                utils.notification.show(i18n.t("global", "success.add"))
            }
        }).on("click", ".table-edit", async function () {
            const trEl = this.closest("tr")
            const tableEl = trEl.closest(".table")
            const idx = [...tableEl.querySelectorAll("tbody tr")].indexOf(trEl)
            const key = tableEl.dataset.key
            const rowValue = that.options.data[key][idx]
            const targetBox = that.options.schema.find(box => box.fields && box.fields.length === 1 && box.fields[0].key === key)
            const { nestedBoxes, defaultValues, thMap } = targetBox.fields[0]
            const modalValues = utils.merge(defaultValues, rowValue)  // rowValue may be missing certain attributes
            const op = { title: targetBox.title, schema: nestedBoxes, data: modalValues }
            const { response, data } = await utils.formDialog.modal(op)
            if (response === 0) return
            const ok = that._validateAndSubmit(`${key}.${idx}`, data)
            if (ok) {
                const row = that._createTableRow(thMap, data)
                const tds = trEl.querySelectorAll("td")
                utils.zip(row, tds).slice(0, -1).forEach(([val, td]) => td.textContent = val)
                utils.notification.show(i18n.t("global", "success.edit"))
            }
        }).on("click", ".table-delete", utils.createConsecutiveAction({
            threshold: 2,
            timeWindow: 3000,
            getIdentifier: (ev) => ev.currentTarget,
            onConfirmed: (ev) => {
                const trEl = ev.currentTarget.closest("tr")
                const tableEl = trEl.closest(".table")
                const idx = [...tableEl.querySelectorAll("tbody tr")].indexOf(trEl)
                const ok = that._validateAndSubmit(tableEl.dataset.key, idx, "removeIndex")
                if (ok) {
                    trEl.remove()
                    utils.notification.show(i18n.t("global", "success.deleted"))
                }
            }
        })).on("click", ".object-confirm", function () {
            const textarea = this.closest(".control").querySelector(".object")
            const value = that._deserialize(textarea.value)
            if (!value) {
                const msg = i18n.t("global", "error.IncorrectFormatContent", { format: that.options.objectFormat })
                utils.notification.show(msg, "error")
                return
            }
            const ok = that._validateAndSubmit(textarea.dataset.key, value)
            if (ok) {
                utils.notification.show(i18n.t("global", "success.submit"))
            }
        }).on("click", ".hotkey-reset", function () {
            const input = this.closest(".hotkey-wrap").querySelector("input")
            const ok = that._validateAndSubmit(input.dataset.key, "")
            if (ok) {
                utils.hotkeyHub.unregister(input.value)
                input.value = ""
            }
        }).on("click", ".hotkey-undo", function () {
            const input = this.closest(".hotkey-wrap").querySelector("input")
            const value = input.getAttribute("value")
            const ok = that._validateAndSubmit(input.dataset.key, value)
            if (ok) {
                input.value = value
            }
        }).on("click", '.control[data-type="action"]', function () {
            const icon = this.querySelector(".action")
            that._dispatchAction(icon.dataset.action)
        }).on("click", ".array-item-delete", function () {
            const itemEl = this.parentElement
            const arrayEl = this.closest(".array")
            const idx = [...arrayEl.children].indexOf(itemEl)
            const ok = that._validateAndSubmit(arrayEl.dataset.key, idx, "removeIndex")
            if (ok) {
                itemEl.remove()
            }
        }).on("click", ".array-item-add", function () {
            const addEl = this
            const inputEl = addEl.previousElementSibling
            utils.hide(addEl)
            utils.show(inputEl)
            inputEl.focus()
        }).on("input", ".checkbox-input", function () {
            const checkboxInput = this
            const checkboxEl = this.closest(".checkbox")
            const checkboxValues = [...checkboxEl.querySelectorAll(".checkbox-input:checked")].map(e => e.value)
            const minItems = Number(checkboxEl.dataset.minItems)
            const maxItems = Number(checkboxEl.dataset.maxItems)
            const itemCount = checkboxValues.length
            if (itemCount < minItems || itemCount > maxItems) {
                const msg = itemCount < minItems
                    ? i18n.t("global", "error.minItems", { minItems })
                    : i18n.t("global", "error.maxItems", { maxItems })
                utils.notification.show(msg, "error")
                setTimeout(() => checkboxInput.checked = !checkboxInput.checked)
            } else {
                that._validateAndSubmit(checkboxEl.dataset.key, checkboxValues)
            }
        }).on("input", ".radio-input", function () {
            that._validateAndSubmit(this.getAttribute("name"), this.value)
        }).on("input", ".range-input", function () {
            this.nextElementSibling.textContent = that._toFixed2(Number(this.value))
        }).on("change", "input.switch-input", function () {
            that._validateAndSubmit(this.dataset.key, this.checked)
        }).on("change", ".number-input, .range-input, .unit-input", function () {
            that._validateAndSubmit(this.dataset.key, Number(this.value))
        }).on("change", ".text-input, .textarea", function () {
            that._validateAndSubmit(this.dataset.key, this.value)
        }).on("mousedown", '.control[data-type="action"]', function (ev) {
            that._rippled(this, ev.clientX, ev.clientY)
        })

        this.form.addEventListener("focusout", ev => {
            const input = ev.target.closest(".array-item-input")
            if (!input || utils.isHidden(input)) return
            const displayEl = input.parentElement
            const addEl = input.nextElementSibling
            const value = input.textContent
            const allowDuplicates = displayEl.dataset.allowDuplicates === "true"
            const arrayValues = [...displayEl.querySelectorAll(".array-item-value")].map(e => e.textContent)
            if (!allowDuplicates && arrayValues.includes(value)) {
                const msg = i18n.t("global", "error.duplicateValue")
                utils.notification.show(msg, "error")
                input.focus()
                return
            }
            const ok = this._validateAndSubmit(displayEl.dataset.key, value, "push")
            if (ok) {
                input.insertAdjacentHTML("beforebegin", this._createArrayItem(value))
                input.textContent = ""
                utils.hide(input)
                utils.show(addEl)
            }
        })

        const ignoreKeys = ["control", "alt", "shift", "meta"]
        const updateHotkey = utils.debounce(hk => this._validateAndSubmit(hk.dataset.key, hk.value), 500)
        this.form.addEventListener("keydown", ev => {
            if (ev.key === undefined) return
            const input = ev.target.closest(".hotkey-input")
            if (!input) return

            if (ev.key !== "Process") {
                const key = ev.key.toLowerCase()
                const arr = [
                    utils.metaKeyPressed(ev) ? "ctrl" : undefined,
                    utils.shiftKeyPressed(ev) ? "shift" : undefined,
                    utils.altKeyPressed(ev) ? "alt" : undefined,
                    ignoreKeys.includes(key) ? undefined : key,
                ]
                input.value = arr.filter(Boolean).join("+")
                updateHotkey(input)
            }
            ev.stopPropagation()
            ev.preventDefault()
        }, true)
    }

    _createArrayItem(value) {
        return `
            <span class="array-item">
                <span class="array-item-value">${utils.escape(value)}</span>
                <span class="array-item-delete">×</span>
            </span>
        `
    }

    _createTableRow(thMap, item) {
        const header = utils.pick(item, [...Object.keys(thMap)])
        const headerValues = [...Object.values(header)].map(h => typeof h === "string" ? utils.escape(h) : h)
        const editButtons = '<div class="table-edit fa fa-pencil"></div><div class="table-delete fa fa-trash-o"></div>'
        return [...headerValues, editButtons]
    }

    _fillForm(schema) {
        const blockControls = new Set(["textarea", "object", "array", "table", "radio", "checkbox", "hint", "custom"])
        const createTitle = (title) => `<div class="title">${title}</div>`
        const createTooltip = (item) => item.tooltip ? `<span class="tooltip"><span class="fa fa-info-circle"></span><span>${item.tooltip.replace("\n", "<br>")}</span></span>` : ""
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
                    return ctl.type === "number"
                        ? input
                        : `<div class="unit-wrap">${input}<div class="unit-value">${ctl.unit}</div></div>`
                case "range":
                    return `
                        <div class="range-wrap">
                            <input class="range-input" type="range" data-key="${ctl.key}" ${range(ctl)} ${disabled(ctl)}>
                            <div class="range-value">${this._toFixed2(value)}</div>
                        </div>
                    `
                case "action":
                    return `<div class="action fa fa-angle-right" data-action="${ctl.key}"></div>`
                case "static":
                    return `<div class="static" data-key="${ctl.key}">${utils.escape(value)}</div>`
                case "custom":
                    return `<div class="custom-wrap">${ctl.content}</div>`
                case "hint":
                    const header = ctl.hintHeader ? `<div class="hint-header">${ctl.hintHeader}</div>` : ""
                    const detail = ctl.hintDetail ? `<div class="hint-detail">${ctl.hintDetail.replace(/\n/g, "<br>")}</div>` : ""
                    return `<div class="hint-wrap">${header}${detail}</div>`
                case "select":
                    const isMulti = Array.isArray(value)
                    const show = isMulti
                        ? this._joinSelected(value.map(e => ctl.options[e]))
                        : ctl.options[value]
                    const isSelected = (option) => isMulti ? value.includes(option) : option === value
                    const options = Object.entries(ctl.options).map(([option, optionShowName]) => {
                        const choose = isSelected(option) ? "true" : "false"
                        const showName = utils.escape(optionShowName)
                        return `<div class="option-item" data-value="${option}" data-choose="${choose}">${showName}</div>`
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
                            <div class="hotkey-btn">
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
                    const cls = ctl.type + (ctl.noResize ? " no-resize" : "")
                    const textarea = `<textarea class="${cls}" rows="${rows}" ${readonly} data-key="${ctl.key}" ${placeholder(ctl)} ${disabled(ctl)}>${value_}</textarea>`
                    return isObject
                        ? `<div class="object-wrap">${textarea}<button class="object-confirm">${i18n.t("global", "confirm")}</button></div>`
                        : textarea
                case "array":
                    const items = value.map(v => this._createArrayItem(v)).join("")
                    return `
                        <div class="array" data-key="${ctl.key}" data-allow-duplicates="${Boolean(ctl.allowDuplicates)}">
                            ${items}
                            <span class="array-item-input plugin-common-hidden" contenteditable="true"></span>
                            <span class="array-item-add">+ ${i18n.t("global", "add")}</span>
                        </div>
                    `
                case "table":
                    const addButton = '<div class="table-add fa fa-plus"></div>'
                    const trs = value.map(item => this._createTableRow(ctl.thMap, item))
                    const th = [...Object.values(ctl.thMap), addButton]
                    const table = utils.buildTable([th, ...trs])
                    return `<div class="table" data-key="${ctl.key}">${table}</div>`
                case "radio":
                    const radioPrefix = utils.randomString()
                    const radioOps = Object.entries(ctl.options).map(([k, v], idx) => {
                        const id = `${radioPrefix}_${idx}`
                        const checked = k === value ? "checked" : ""
                        return `
                            <div class="radio-option">
                              <div class="radio-wrapper">
                                <input class="radio-input" type="radio" id="${id}" name="${ctl.key}" value="${k}" ${checked}>
                                <div class="radio-disc"></div>
                              </div>
                              <label class="radio-label" for="${id}">${v}</label>
                            </div>
                        `
                    })
                    return `<div class="radio" data-key="${ctl.key}">${radioOps.join("")}</div>`
                case "checkbox":
                    const minItems_ = ctl.minItems != null ? ctl.minItems : 0
                    const maxItems_ = ctl.maxItems != null ? ctl.maxItems : Infinity
                    const checkboxPrefix = utils.randomString()
                    const checkboxOps = Object.entries(ctl.options).map(([k, v], idx) => {
                        const id = `${checkboxPrefix}_${idx}`
                        const checked = value.includes(k) ? "checked" : ""
                        return `
                            <div class="checkbox-option">
                                <div class="checkbox-wrapper">
                                    <input class="checkbox-input" type="checkbox" id="${id}" name="${ctl.key}" value="${k}" ${checked}>
                                    <div class="checkbox-square"></div>
                                </div>
                                <label class="checkbox-label" for="${id}">${v}</label>
                            </div>
                        `
                    })
                    return `<div class="checkbox" data-key="${ctl.key}" data-min-items="${minItems_}" data-max-items="${maxItems_}">${checkboxOps.join("")}</div>`
                default:
                    return ""
            }
        }
        const createControl = (field) => {
            if (field.type === "number" && field.unit != null) {
                field.type = "unit"
            }
            const isBlock = blockControls.has(field.type)
            const value = utils.nestedPropertyHelpers.get(this.options.data, field.key)
            const ctl = createGeneralControl(field, value)
            const label = isBlock ? "" : `<div class="control-left">${field.label}${createTooltip(field)}</div>`
            const control = isBlock ? ctl : `<div class="control-right">${ctl}</div>`
            const readonlyCls = this._isReadonly(field) ? " plugin-common-readonly" : ""
            const cls = "control" + readonlyCls
            return `<div class="${cls}" data-type="${field.type}">${label}${control}</div>`
        }
        const createBox = ({ title, fields }) => {
            const t = title ? createTitle(title) : ""
            const items = fields.map(createControl).join("")
            const box = `<div class="box">${items}</div>`
            return t + box
        }
        return schema.map(createBox).join("")
    }

    _buildDependencies(schema) {
        const result = {}
        schema.forEach(box => {
            box.fields.forEach(field => {
                const dep = field.dependencies
                if (!dep || dep.length === 0) return
                Object.keys(dep).forEach(k => {
                    result[k] = result[k] || []
                    result[k].push(field)
                })
            })
        })
        return result
    }

    _toggleReadonly(key) {
        const fields = this.options.dependencies[key]
        if (!fields) return
        fields.forEach(field => {
            const k = field.key
            if (!this.form) return
            const el = this.form.querySelector(`[data-key="${k}"], [data-action="${k}"]`)
            if (!el) return
            const control = el.closest(".control")
            if (!control) return
            control.classList.toggle("plugin-common-readonly", this._isReadonly(field))
        })
        fields.forEach(field => this._toggleReadonly(field.key))
    }

    _isReadonly(field) {
        if (field.dependencies) {
            // TODO: supports `AND` only now
            const configurable = Object.entries(field.dependencies).every(([k, v]) => {
                return v === utils.nestedPropertyHelpers.get(this.options.data, k)
            })
            return !configurable
        }
    }

    _toFixed2(num) {
        return Number.isInteger(num) ? num : num.toFixed(2)
    }

    _joinSelected(options) {
        return options.length ? options.join(", ") : i18n.t("global", "empty")
    }

    _serialize(obj) {
        const funcMap = {
            JSON: (obj) => JSON.stringify(obj, null, "\t"),
            TOML: (obj) => utils.stringifyToml(obj),
            YAML: (obj) => utils.stringifyYaml(obj)
        }
        const f = funcMap[this.options.objectFormat] || funcMap.JSON
        return f(obj)
    }

    _deserialize(str) {
        const funcMap = {
            JSON: (str) => JSON.parse(str),
            TOML: (str) => utils.readToml(str),
            YAML: (str) => utils.readYaml(str),
        }
        try {
            const f = funcMap[this.options.objectFormat] || funcMap.JSON
            return f(str)
        } catch (e) {
            console.error(e)
        }
    }

    _rippled(el, clientX, clientY) {
        const ripple = document.createElement("span")
        ripple.classList.add("ripple")
        const diameter = Math.max(el.clientWidth, el.clientHeight) * 2
        const radius = diameter / 2
        const rect = el.getBoundingClientRect()
        const x = clientX - rect.left - radius
        const y = clientY - rect.top - radius
        ripple.style.width = `${diameter}px`
        ripple.style.height = `${diameter}px`
        ripple.style.left = `${x}px`
        ripple.style.top = `${y}px`
        el.appendChild(ripple)
        ripple.addEventListener("animationend", () => ripple.remove(), { once: true })
    }
})
