const { sharedSheets } = require("./common")
const { utils } = require("../utils")
const { i18n } = require("../i18n")

class FastForm extends HTMLElement {
    static template = `<link rel="stylesheet" href="./plugin/global/styles/plugin-fast-form.css" crossorigin="anonymous"><div id="form"></div>`
    static fields = new Set([
        "text", "number", "switch", "select", "textarea", "object", "array", "table", "radio", "checkbox",
        "hint", "custom", "composite", "action", "static", "hotkey", "range", "unit",
    ])
    static blockFields = new Set(["textarea", "object", "array", "table", "radio", "checkbox", "hint", "custom", "composite"])
    static serializers = {
        JSON: {
            parse: (str) => JSON.parse(str),
            stringify: (obj) => JSON.stringify(obj, null, "\t"),
        },
        TOML: {
            parse: (str) => utils.readToml(str),
            stringify: (obj) => utils.stringifyToml(obj),
        },
        YAML: {
            parse: (str) => utils.readYaml(str),
            stringify: (obj) => utils.stringifyYaml(obj),
        },
    }
    static hooks = {
        onRender: (form) => void 0,
        onParseValue: (key, rawValue, type) => rawValue,
        onBeforeValidate: (detail) => void 0,         // return true or [] for success; return Error or [Error, ...] for failure
        onAfterValidate: (detail, errors) => void 0,  // return true or [] for success; return Error or [Error, ...] for failure
        onValidateFailed: (key, errors, control) => {
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

    static registerValidator(name, validatorDefinition) {
        if (typeof validatorDefinition !== "function") {
            throw new Error(`Validator Error: validator '${name}' must be a function.`)
        }
        if (this.validators.hasOwnProperty(name)) {
            console.warn(`FastForm Warning: Overwriting validator definition for type '${name}'.`)
        }
        this.validators[name] = validatorDefinition
    }

    static registerSerializer(name, serializerDefinition) {
        if (!serializerDefinition || typeof serializerDefinition.parse !== "function" || typeof serializerDefinition.stringify !== "function") {
            throw new Error(`Serializer Error: '${name}'.`)
        }
        if (this.serializers.hasOwnProperty(name)) {
            console.warn(`FastForm Warning: Overwriting serializer definition for type '${name}'.`)
        }
        this.serializers[name] = serializerDefinition
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
            ignoreDependencies: false,
            hooks: this.constructor.hooks,
            schema: [],
            data: {},
            actions: {},
            rules: {},
            _dependencies: {},
            _compositeMap: {},
        }
    }

    connectedCallback() {
        this._bindEvents()
    }

    setFormatOptions = (options) => {
        const pickAttrs = ["objectFormat", "disableEffect", "selectValueSeparator", "selectLabelJoiner", "ignoreDependencies"]
        const picked = utils.pick(options, pickAttrs)
        this.options = { ...this.options, ...picked }
    }

    render = (options) => {
        const { schema = [], data = {}, actions = {}, rules = {}, hooks = {} } = options

        this._checkSchema(schema)
        this.options.data = this._normalizeData(data)           // `data` must be a JSON-like object
        this.options.schema = this._normalizeSchema(schema)     // `schema` must be a JSON-like object
        this.options.actions = this._normalizeActions(actions)  // map[fieldKey]actionFunc
        this.options.hooks = this._normalizeHooks(hooks)        // map[fieldKey]hookFunc
        this.options.rules = this._normalizeRules(rules)        // map[fieldKey][]validateFunc
        this.options._dependencies = this._buildDependencies()  // map[filedKey][]field
        this.options._compositeMap = this._buildCompositeMap()  // map[fieldKey]{subSchema,cache}

        this.form.innerHTML = this._createBoxes()
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
        const validators = this.options.rules[detail.key]
        if (!validators) return []

        return validators
            .map(validator => validator(detail, this.options.data))
            .filter(e => e !== true && e != null)
            .map(e => e instanceof Error ? e : new Error(e.toString()))
    }

    // type: set/push/removeIndex
    _validateAndSubmit(key, value, type = "set") {
        let errors = []
        const detail = { key, value, type }
        if (type !== "removeIndex") {
            detail.value = this._invokeHook("onParseValue", key, value, type)
            errors = this._validate(detail)
        }
        const isValid = Array.isArray(errors) && errors.length === 0
        if (isValid) {
            this._submit(detail)
        } else {
            const control = this.form.querySelector(`[data-key="${key}"]`)
            this._invokeHook("onValidateFailed", key, errors, control)
        }
        return isValid
    }

    _validate(detail) {
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
        const hasBeforeSubmitHook = this.options.hooks.onBeforeSubmit !== this.constructor.hooks.onBeforeSubmit
        const hasAfterSubmitHook = this.options.hooks.onAfterSubmit !== this.constructor.hooks.onAfterSubmit

        if (hasBeforeSubmitHook || hasAfterSubmitHook) {
            oldData = utils.naiveCloneDeep(this.options.data)
        }
        if (hasBeforeSubmitHook) {
            this._invokeHook("onBeforeSubmit", oldData)
        }

        utils.nestedPropertyHelpers[detail.type](this.options.data, detail.key, detail.value)
        this._updateDependentStates(detail.key)
        this._invokeHook("onSubmit", this, detail)

        if (hasAfterSubmitHook) {
            newData = utils.naiveCloneDeep(this.options.data)
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
                return false
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
        }).on("change", "input.switch-input:not(.composite-switch)", function () {
            that._validateAndSubmit(this.dataset.key, this.checked)
        }).on("change", "input.switch-input.composite-switch", function () {
            const input = this
            const key = input.dataset.key
            const isChecked = input.checked
            const container = input.closest('[data-type="composite"]').querySelector(".sub-box-wrapper")
            const { subSchema, cache } = that.options._compositeMap[key] || {}
            const valueToSubmit = isChecked ? cache : false
            const successAction = isChecked
                ? () => container.innerHTML = that._createBoxes(subSchema)
                : () => undefined
            const ok = that._validateAndSubmit(key, valueToSubmit)
            if (ok) {
                successAction()
                utils.toggleVisible(container, !isChecked)
            } else {
                input.checked = !isChecked  // rollback
            }
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

    _createBoxes(schema = this.options.schema, data = this.options.data) {
        const getValue = (field) => utils.nestedPropertyHelpers.get(data, field.key)
        const createTitle = (title) => `<div class="title">${title}</div>`
        const createTooltip = (item) => item.tooltip
            ? `<span class="tooltip"><span class="fa fa-info-circle"></span><span>${utils.escape(item.tooltip).replace("\n", "<br>")}</span></span>`
            : ""
        const createControlCore = (ctl, value) => {
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
                case "composite":
                    const isChecked = typeof value === "object" && value != null
                    const checkAttr = isChecked ? "checked" : ""
                    const hideCls = isChecked ? "" : " " + "plugin-common-hidden"
                    const subBoxes = isChecked ? this._createBoxes(ctl.subSchema) : ""
                    const compositeCls = "sub-box-wrapper" + hideCls
                    return `
                        <div class="control" data-type="switch">
                            <div class="control-left">${ctl.label}${createTooltip(ctl)}</div>
                            <div class="control-right"><input class="switch-input composite-switch" type="checkbox" data-key="${ctl.key}" ${checkAttr} ${disabled(ctl)} /></div>
                        </div>
                        <div class="${compositeCls}" data-parent-key="${ctl.key}">${subBoxes}</div>
                    `
                default:
                    return ""
            }
        }
        const createControl = (field) => {
            const isBlock = this.constructor.blockFields.has(field.type)
            const value = getValue(field)
            const ctl = createControlCore(field, value)
            const label = isBlock ? "" : `<div class="control-left">${field.label}${createTooltip(field)}</div>`
            const control = isBlock ? ctl : `<div class="control-right">${ctl}</div>`
            const disabledCls = this._shouldBeEnabled(field) ? "" : (" " + this._getDisabledClass())
            const cls = "control" + disabledCls
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

    _traverseFields(fn, schema = this.options.schema) {
        for (const box of schema) {
            for (const field of box.fields || []) {
                fn(field, box)
                if (Array.isArray(field.subSchema)) {
                    this._traverseFields(fn, field.subSchema)
                }
            }
        }
    }

    // TODO: Check all field types
    _checkSchema(schema) {
        const checker = {
            select: (field) => !field.options || (typeof field.options !== "object" && !Array.isArray(field.options)),
            radio: (field) => checker.select(field),
            checkbox: (field) => checker.select(field),
            composite: (field) => !Array.isArray(field.subSchema) || typeof field.defaultValues !== "object",
            table: (field) => !Array.isArray(field.nestedBoxes) || typeof field.defaultValues !== "object" || typeof field.thMap !== "object",
        }
        this._traverseFields(field => {
            if (!this.constructor.fields.has(field.type)) {
                throw new Error(`No such Field type: ${field.type}`)
            }
            const check = checker[field.type]
            if (check && check(field)) {
                throw new Error(`Error Field: ${JSON.stringify(field)}`)
            }
        }, schema)
    }

    _normalizeData(data) {
        data = utils.naiveCloneDeep(data)
        this._traverseFields(field => {
            if (field.type === "composite") {
                const key = field.key
                const val = data[key]
                if (val === false || val == null) {
                    data[key] = false
                } else if (typeof val === "object") {
                    data[key] = { ...field.defaultValues, ...val }
                } else {
                    data[key] = field.defaultValues
                }
            }
        })
        return data
    }

    _normalizeSchema(schema) {
        this._traverseFields(field => {
            if (field.type === "number" && field.unit != null) {
                field.type = "unit"
            }
            if (field.options && Array.isArray(field.options) && field.options.every(e => typeof e === "string")) {
                field.options = Object.fromEntries(field.options.map(op => [op, op]))
            }
            if (this.options.ignoreDependencies && field.dependencies) {
                field.dependencies = undefined
            }
        }, schema)
        return schema
    }

    _normalizeActions(actions) {
        this._traverseFields(field => {
            if (field.type === "action") {
                const act = actions[field.key]
                if (typeof act !== "function") {
                    actions[field.key] = () => console.warn(`No such action: ${field.key}`)
                }
            }
        })
        return actions
    }

    _normalizeHooks(hooks) {
        if (hooks == null) {
            return this.constructor.hooks
        }
        if (typeof hooks !== "object") {
            throw new Error("Error: Hooks is not a Object")
        }
        Object.keys(hooks).forEach(key => {
            if (this.constructor.hooks.hasOwnProperty(key) && typeof hooks[key] !== "function") {
                throw new Error(`Hook is not Function: ${key}`)
            }
        })
        return { ...this.constructor.hooks, ...hooks }
    }

    _normalizeRules(rules) {
        const validatorMap = {}
        Object.entries(rules).forEach(([key, validators]) => {
            validators = Array.isArray(validators) ? validators : [validators]
            validatorMap[key] = validators.map(validator => {
                switch (typeof validator) {
                    case "function":
                        return validator
                    case "string":
                        const builtin = this.constructor.validators[validator]
                        if (builtin) {
                            return builtin
                        }
                        break
                    case "object":
                        if (typeof validator.validate === "function") {
                            return validator.validate
                        }
                        const builtinFn = this.constructor.validators[validator.name]
                        if (builtinFn) {
                            return builtinFn(...validator.args)
                        }
                        break
                }
                const msg = typeof validator === "object" ? JSON.stringify(validator) : validator
                throw new Error(`Invalid Rule: ${msg}`)
            })
        })
        return validatorMap
    }

    _buildDependencies() {
        const dep = {}
        this._traverseFields(field => {
            if (field.dependencies) {
                Object.keys(field.dependencies).forEach(key => {
                    if (!dep.hasOwnProperty(key)) {
                        dep[key] = []
                    }
                    dep[key].push(field)
                })
            }
        })
        return dep
    }

    /**
     * Recursively initializes the state for 'composite' type fields, setting up the data-caching mechanism for when they are toggled.
     *
     * This function enables the "memory" feature for composite fields by leveraging JavaScript's pass-by-reference behavior for objects.
     *
     * For each composite field, it ensures that `this.options.data[key]` and `this.options._compositeMap[key].cache`
     * point to the *exact same object* when the field is active. This keeps them perfectly in sync.
     *
     * When the field is toggled off, the event handler sets `this.options.data[key]` to `false`. This only changes the live data's reference.
     * The `cache` reference remains intact, effectively preserving the sub-form's state.
     * When toggled back on, this cached reference is restored.
     */
    _buildCompositeMap() {
        const map = {}
        const { get, set } = utils.nestedPropertyHelpers
        this._traverseFields(field => {
            if (field.type === "composite") {
                const val = get(this.options.data, field.key)
                const _defaultValues = utils.naiveCloneDeep({ ...field.defaultValues, ...val })
                if (val === true || typeof val === "object" && val != null) {
                    set(this.options.data, field.key, _defaultValues)
                }
                map[field.key] = { subSchema: field.subSchema, cache: _defaultValues }
            }
        })
        return map
    }

    _updateDependentStates(key) {
        const depFields = this.options._dependencies[key]
        if (!depFields) return
        const disabledCls = this._getDisabledClass()
        depFields.forEach(field => {
            const el = this.form.querySelector(`[data-key="${field.key}"], [data-action="${field.key}"]`)
            if (!el) return
            const ctl = el.closest(".control")
            if (!ctl) return
            ctl.classList.toggle(disabledCls, !this._shouldBeEnabled(field))
        })
        depFields.forEach(field => this._updateDependentStates(field.key))
    }

    // TODO: supports `AND` only now
    _shouldBeEnabled(field) {
        if (field.dependencies) {
            return Object.entries(field.dependencies).every(([key, val]) => {
                return val === utils.nestedPropertyHelpers.get(this.options.data, key)
            })
        }
        return true
    }

    _getDisabledClass() {
        return this.options.disableEffect === "hide" ? "plugin-common-hidden" : "plugin-common-readonly"
    }

    _toFixed2(num) {
        return Number.isInteger(num) ? num : num.toFixed(2)
    }

    _joinSelected(options) {
        return options.length ? options.join(this.options.selectLabelJoiner) : i18n.t("global", "empty")
    }

    _serialize(obj) {
        const { serializers } = this.constructor
        const fn = serializers[this.options.objectFormat] || serializers.JSON
        return fn.stringify(obj)
    }

    _deserialize(str) {
        const { serializers } = this.constructor
        const fn = serializers[this.options.objectFormat] || serializers.JSON
        try {
            return fn.parse(str)
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
}

function Try(fn, buildErr) {
    try {
        fn()
    } catch (err) {
        return new Error(buildErr(err))
    }
}

const validators = {
    url: ({ value }) => {
        if (!value) return true
        const pattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/
        return pattern.test(value) ? true : i18n.t("global", "error.invalidURL")
    },
    regex: ({ value }) => Try(
        () => value && new RegExp(value),
        () => `Error Regex: ${value}`,
    ),
    path: ({ value }) => Try(
        () => value && utils.Package.Fs.accessSync(utils.Package.Path.resolve(value)),
        () => `No such path: ${utils.Package.Path.resolve(value)}`,
    ),
}
Object.entries(validators).forEach(([name, fn]) => FastForm.registerValidator(name, fn))

customElements.define("fast-form", FastForm)
