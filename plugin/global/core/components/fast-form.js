const { sharedSheets } = require("./common")
const { utils } = require("../utils")
const { i18n } = require("../i18n")

customElements.define("fast-form", class extends HTMLElement {
    static template = `<link rel="stylesheet" href="./plugin/global/styles/plugin-fast-form.css" crossorigin="anonymous"><div id="form"></div>`
    static hooks = {
        onRender: (form) => void 0,
        onParseValue: (key, rawValue, type) => rawValue,
        onBeforeValidate: (detail) => void 0,         // return true or [] for success; return Error or [Error, ...] for failure
        onAfterValidate: (detail, errors) => void 0,  // return true or [] for success; return Error or [Error, ...] for failure
        onValidateFailed: (key, errors, targetEl) => {
            if (!Array.isArray(errors) || errors.length === 0) return
            errors.forEach(err => {
                const msg = err instanceof Error
                    ? err.message || err.toString()
                    : typeof err === "string"
                        ? err
                        : "Verification Failed"  // fallback
                utils.notification.show(msg, "error")
            })
        },
        onBeforeSubmit: (data) => void 0,
        onSubmit: (form, detail) => form.dispatchEvent(new CustomEvent("form-crud", { detail })),
        onAfterSubmit: (newData, oldData) => void 0,
    }
    static validators = {
        required: ({ value }, data) => {
            const isEmpty = value == null
                || (typeof value === "string" && value.trim() === "")
                || (Array.isArray(value) && value.length === 0)
            return !isEmpty ? true : i18n.t("global", "error.required")
        },
        isURL: ({ value }, data) => {
            if (!value) return true
            const pattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/
            return pattern.test(value) ? true : i18n.t("global", "error.invalidURL")
        },
        pattern: (pattern) => ({ value }, data) => {
            if (!value) return true
            return pattern.test(value) ? true : i18n.t("global", "error.pattern")
        },
        notEqual: (target) => ({ value }, data) => {
            if (value == null) return true
            return value !== target ? true : i18n.t("global", "error.invalid", { value: target })
        },
        min: (min) => ({ value }, data) => {
            if (value == null || value === "") return true
            if (isNaN(value)) return i18n.t("global", "error.isNaN")
            return Number(value) >= min ? true : i18n.t("global", "error.min", { min })
        },
        max: (max) => ({ value }, data) => {
            if (value == null || value === "") return true
            if (isNaN(value)) return i18n.t("global", "error.isNaN")
            return Number(value) <= max ? true : i18n.t("global", "error.max", { max })
        },
    }

    constructor() {
        super()
        const root = this.attachShadow({ mode: "open" })
        root.adoptedStyleSheets = sharedSheets
        root.innerHTML = this.constructor.template

        this.form = root.querySelector("#form")
        this.options = {
            objectFormat: "JSON",
            disableEffect: "readonly",
            selectValueSeparator: "\u001F",
            selectLabelJoiner: ", ",
            hooks: this.constructor.hooks,
            schema: [],
            data: {},
            actions: {},
            rules: {},
            dependencies: {},
        }
    }

    connectedCallback() {
        this._bindEvents()
    }

    setFormatOptions = (options) => {
        const picked = utils.pick(options, ["objectFormat", "disableEffect", "selectValueSeparator", "selectLabelJoiner"])
        this.options = { ...this.options, ...picked }
    }

    render = (options) => {
        const { schema = [], data = {}, actions = {}, rules = {}, hooks = {} } = options

        this.options.schema = schema
        this.options.actions = actions
        this.options.rules = rules
        this.options.hooks = { ...this.constructor.hooks, ...hooks }
        this.options.data = JSON.parse(JSON.stringify(data))
        this.options.dependencies = this._buildDependencies(schema)

        this.form.innerHTML = this._fillForm(schema)
        this._invokeHook("onRender", this)
    }

    _invokeAction(key) {
        const fn = this.options.actions[key]
        if (typeof fn === "function") {
            return fn(this.options)
        }
    }

    _invokeHook(hookName, ...args) {
        const fn = this.options.hooks[hookName]
        if (typeof fn === "function") {
            return fn(...args)
        }
    }

    _invokeRules(detail) {
        const rules = this.options.rules[detail.key]
        if (!rules) return []

        const data = this.options.data
        return (Array.isArray(rules) ? rules : [rules])
            .map(rule => {
                switch (typeof rule) {
                    case "string":
                        const validator = this.constructor.validators[rule]
                        if (validator) {
                            return validator(detail, data)
                        }
                        break
                    case "function":
                        return rule(detail, data)
                    case "object":
                        if (typeof rule.validate === "function") {
                            return rule.validate(detail, data)
                        }
                        const builtinFn = this.constructor.validators[rule.name]
                        if (builtinFn) {
                            return builtinFn(...rule.args)(detail, data)
                        }
                }
                const msg = typeof rule === "object" ? JSON.stringify(rule) : rule
                return new Error(`Invalid Rule: ${msg}`)
            })
            .filter(e => e !== true && e != null)
            .map(e => e instanceof Error ? e : new Error(e.toString()))
    }

    // type: set/push/removeIndex
    _validateAndSubmit(key, value, type = "set") {
        value = this._invokeHook("onParseValue", key, value, type)
        const detail = { key, value, type }
        const errors = this._validate(detail)
        const isValid = Array.isArray(errors) && errors.length === 0
        if (isValid) {
            this._submit(detail)
        } else {
            const targetEl = this.form.querySelector(`[data-key="${key}"]`)
            this._invokeHook("onValidateFailed", key, errors, targetEl)
        }
        return isValid
    }

    _validate(detail) {
        // `removeIndex` need not validate
        if (detail.type === "removeIndex") return []

        const beforeHookResult = this._invokeHook("onBeforeValidate", detail)
        if (beforeHookResult === true) return []
        if (beforeHookResult instanceof Error) return [beforeHookResult]
        if (Array.isArray(beforeHookResult)) return beforeHookResult

        let errors = this._invokeRules(detail)

        const afterHookResult = this._invokeHook("onAfterValidate", detail, errors)
        if (afterHookResult === true) return []
        if (afterHookResult instanceof Error) return [afterHookResult]
        if (Array.isArray(afterHookResult)) return afterHookResult

        return errors
    }

    _submit(detail) {
        let oldData, newData
        const noopOnBefore = this.options.hooks.onBeforeSubmit === this.constructor.hooks.onBeforeSubmit
        const noopOnAfter = this.options.hooks.onAfterSubmit === this.constructor.hooks.onAfterSubmit

        if (!noopOnBefore || !noopOnAfter) {
            oldData = JSON.parse(JSON.stringify(this.options.data))
        }
        if (!noopOnBefore) {
            this._invokeHook("onBeforeSubmit", oldData)
        }

        utils.nestedPropertyHelpers[detail.type](this.options.data, detail.key, detail.value)
        this._toggleDisable(detail.key)
        this._invokeHook("onSubmit", this, detail)

        if (!noopOnAfter) {
            newData = JSON.parse(JSON.stringify(this.options.data))
            this._invokeHook("onAfterSubmit", newData, oldData)
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
            const _selectValue = selectEl.dataset.value || ""
            const selectedValues = isMulti
                ? _selectValue.split(that.options.selectValueSeparator).filter(Boolean)
                : _selectValue
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
                    selectEl.dataset.value = selectedValues.join(that.options.selectValueSeparator)
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
            that._invokeAction(icon.dataset.action)
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
            const value = Number(this.value)
            const min = this.getAttribute("min")
            const max = this.getAttribute("max")
            if (min && Number(min) > value) {
                const msg = i18n.t("global", "error.min", { min })
                utils.notification.show(msg, "error")
            } else if (max && Number(max) < value) {
                const msg = i18n.t("global", "error.max", { max })
                utils.notification.show(msg, "error")
            } else {
                that._validateAndSubmit(this.dataset.key, value)
            }
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
                const keyCombination = [
                    utils.metaKeyPressed(ev) ? "ctrl" : undefined,
                    utils.shiftKeyPressed(ev) ? "shift" : undefined,
                    utils.altKeyPressed(ev) ? "alt" : undefined,
                    ignoreKeys.includes(key) ? undefined : key,
                ]
                input.value = keyCombination.filter(Boolean).join("+")
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
        const createTooltip = (item) => item.tooltip
            ? `<span class="tooltip"><span class="fa fa-info-circle"></span><span>${utils.escape(item.tooltip).replace("\n", "<br>")}</span></span>`
            : ""
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
                    const val = isMulti ? value.join(this.options.selectValueSeparator) : value
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
                    const displayValue = isObject ? this._serialize(value) : value
                    const cls = ctl.type + (ctl.noResize ? " no-resize" : "")
                    const textarea = `<textarea class="${cls}" rows="${rows}" ${readonly} data-key="${ctl.key}" ${placeholder(ctl)} ${disabled(ctl)}>${displayValue}</textarea>`
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
            const disableCls = this._isDisable(field) ? " " + this._getDisableClass() : ""
            const cls = "control" + disableCls
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
                if (!dep) return
                Object.keys(dep).forEach(k => {
                    result[k] = result[k] || []
                    result[k].push(field)
                })
            })
        })
        return result
    }

    _toggleDisable(key) {
        const fields = this.options.dependencies[key]
        if (!fields) return
        const disableCls = this._getDisableClass()
        fields.forEach(field => {
            const k = field.key
            if (!this.form) return
            const el = this.form.querySelector(`[data-key="${k}"], [data-action="${k}"]`)
            if (!el) return
            const control = el.closest(".control")
            if (!control) return
            control.classList.toggle(disableCls, this._isDisable(field))
        })
        fields.forEach(field => this._toggleDisable(field.key))
    }

    _isDisable(field) {
        if (field.dependencies) {
            // TODO: supports `AND` only now
            const shouldBeEnabled = Object.entries(field.dependencies).every(([k, v]) => {
                return v === utils.nestedPropertyHelpers.get(this.options.data, k)
            })
            return !shouldBeEnabled
        }
    }

    _getDisableClass() {
        return this.options.disableEffect === "hide" ? "plugin-common-hidden" : "plugin-common-readonly"
    }

    _toFixed2(num) {
        return Number.isInteger(num) ? num : num.toFixed(2)
    }

    _joinSelected(options) {
        return options.length ? options.join(this.options.selectLabelJoiner) : i18n.t("global", "empty")
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
