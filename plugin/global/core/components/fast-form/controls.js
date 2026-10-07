const utils = require("../../utils")
const i18n = require("../../i18n")
const { uniqueNum } = require("./helpers")

function setRandomKey(field) {
  field.key = field.key || `_field_${uniqueNum()}`
}

function getCommonHTMLAttrs(field, allowEmpty) {
  return {
    key: `data-key="${field.key}"`,
    placeholder: (field.placeholder || allowEmpty) ? `placeholder="${field.placeholder || ""}"` : "",
  }
}

function getNumericalHTMLAttr(field) {
  const step = (field.step === undefined && field.isInteger) ? 1 : field.step
  return [
    typeof field.min === "number" ? `min=${field.min}` : "",
    typeof field.max === "number" ? `max=${field.max}` : "",
    typeof step === "number" ? `step=${step}` : "",
  ].join(" ")
}

function updateInputNumericalAttr(input, field) {
  const step = (field.step === undefined && field.isInteger) ? 1 : field.step
  input.min = typeof field.min === "number" ? field.min : ""
  input.max = typeof field.max === "number" ? field.max : ""
  input.step = typeof step === "number" ? step : ""
}

function updateInputState(input, field, value) {
  input.value = value
  input.disabled = !!field.disabled
  input.readOnly = !!field.readonly
}

function normalizeOptionsAttr(field) {
  if (Array.isArray(field.options) && field.options.every(op => typeof op === "string")) {
    field.options = Object.fromEntries(field.options.map(op => [op, op]))
  }
}

function defaultBlockLayout(field) {
  if (!Object.hasOwn(field, "isBlockLayout")) {
    field.isBlockLayout = true
  }
}

function registerRules({ form, field }, rules) {
  form.getApi("validation")?.addRule(field.key, rules)
}

function registerNumericalDefaultRules({ field, form }) {
  const { min, max, isInteger } = field
  const [required, integer, minFactory, maxFactory] = form.constructor.validator.get("required", "integer", "min", "max")
  const rules = [required]
  if (isInteger === true) {
    rules.push(integer)
  }
  if (typeof min === "number") {
    rules.push(minFactory(min))
  }
  if (typeof max === "number") {
    rules.push(maxFactory(max))
  }
  registerRules({ field, form }, { $self: rules })
}

function registerItemLengthLimitRule({ field, form }) {
  const lengthRule = ({ key, value, type }) => {
    const isSelf = (key === field.key)

    let effectiveLength
    if (isSelf && type === "set") {
      effectiveLength = Array.isArray(value) ? value.length : 0
    } else {
      const containerData = form.getData(field.key)
      const currentLen = Array.isArray(containerData) ? containerData.length : 0
      const deltaMap = { push: 1, removeIndex: -1 }
      const delta = isSelf ? (deltaMap[type] || 0) : 0
      effectiveLength = Math.max(0, currentLen + delta)
    }

    const { minItems, maxItems } = field
    if (typeof minItems === "number" && effectiveLength < minItems) {
      return new Error(i18n.t("global", "error.minItems", { minItems }))
    }
    if (typeof maxItems === "number" && effectiveLength > maxItems) {
      return new Error(i18n.t("global", "error.maxItems", { maxItems }))
    }
  }
  registerRules({ field, form }, { $self: [lengthRule] })
}

const Control_Switch = {
  controlOptions: {
    className: "native-switch",
  },
  create: ({ field }) => {
    const { key } = getCommonHTMLAttrs(field)
    return `<input class="switch-input" type="checkbox" ${key}/>`
  },
  update: ({ element, value, field }) => {
    const input = element.querySelector(".switch-input")
    if (input) {
      input.checked = !!value
      input.disabled = !!field.disabled
      input.readOnly = !!field.readonly
    }
  },
  bindEvents: ({ form }) => {
    form.onEvent("change", ".native-switch .switch-input", function () {
      form.validateAndCommit(this.dataset.key, this.checked)
    })
  },
}

const Control_Text = {
  create: ({ field }) => {
    const { key, placeholder } = getCommonHTMLAttrs(field)
    return `<input class="text-input" type="text" ${key} ${placeholder}>`
  },
  update: ({ element, value, field }) => {
    const input = element.querySelector(".text-input")
    if (input) updateInputState(input, field, value || "")
  },
  bindEvents: ({ form }) => {
    form.onEvent("change", ".text-input", function () {
      form.validateAndCommit(this.dataset.key, this.value)
    })
  },
}

const Control_Password = {
  create: ({ field }) => {
    const { key, placeholder } = getCommonHTMLAttrs(field)
    return `<input class="password-input" type="password" ${key} ${placeholder}>`
  },
  update: ({ element, value, field }) => {
    const input = element.querySelector(".password-input")
    if (input) {
      updateInputState(input, field, value || "")
    }
  },
  bindEvents: ({ form }) => {
    form.onEvent("change", ".password-input", function () {
      form.validateAndCommit(this.dataset.key, this.value)
    })
  },
}

const Control_Color = {
  create: ({ field }) => {
    const { key, placeholder } = getCommonHTMLAttrs(field)
    return `
      <div class="color-wrap" ${key}>
        <label class="color-swatch-trigger"><div class="color-swatch-inner"></div><input class="color-picker-input" type="color" tabindex="-1"></label>
        <input class="color-text-input" type="text" ${placeholder} spellcheck="false" maxlength="7">
      </div>`
  },
  update: ({ element, value, field }) => {
    const wrap = element.querySelector(".color-wrap")
    const text = element.querySelector(".color-text-input")
    const picker = element.querySelector(".color-picker-input")
    const validHex = Control_Color._normalize(value) || "#FFFFFF"
    Control_Color._syncUI(wrap, validHex)
    if (text) {
      text.disabled = !!field.disabled
      text.readOnly = !!field.readonly
    }
    if (picker) {
      picker.disabled = !!field.disabled
    }
  },
  bindEvents: ({ form }) => {
    form.onEvent("input", ".color-picker-input", function () {
      Control_Color._syncUI(this.closest(".color-wrap"), this.value)
    }).onEvent("input", ".color-text-input", function () {
      const validHex = Control_Color._normalize(this.value)
      if (validHex) Control_Color._syncUI(this.closest(".color-wrap"), validHex, false)
    }).onEvent("change", ".color-picker-input", function () {
      form.validateAndCommit(this.closest(".color-wrap").dataset.key, this.value)
    }).onEvent("change", ".color-text-input", function () {
      const wrap = this.closest(".color-wrap")
      const key = wrap.dataset.key
      const validHex = Control_Color._normalize(this.value)
      if (validHex) {
        form.validateAndCommit(key, validHex)
      } else {
        Control_Color._syncUI(wrap, form.getData(key) || "#FFFFFF")
      }
    })
  },
  _normalize: (val) => {
    if (typeof val !== "string") return null
    const hex = val.trim().replace(/^#/, "").toUpperCase()
    if (/^[0-9A-F]{3}$/.test(hex)) return "#" + Array.from(hex).map(c => c + c).join("")
    if (/^[0-9A-F]{6}$/.test(hex)) return "#" + hex
    return null
  },
  _syncUI: (wrap, hex, syncText = true) => {
    if (!wrap || !hex) return
    const swatch = wrap.querySelector(".color-swatch-inner")
    const picker = wrap.querySelector(".color-picker-input")
    const text = wrap.querySelector(".color-text-input")
    if (swatch) swatch.style.backgroundColor = hex
    if (picker && picker.value !== hex) picker.value = hex
    if (syncText && text && text.value !== hex) text.value = hex
  },
}

const Control_Number = {
  setup: registerNumericalDefaultRules,
  create: ({ field }) => {
    const { key, placeholder } = getCommonHTMLAttrs(field)
    return `<input class="number-input" type="number" ${key} ${placeholder} ${getNumericalHTMLAttr(field)}>`
  },
  update: ({ element, value, field }) => {
    const input = element.querySelector(".number-input")
    if (input) {
      updateInputState(input, field, value)
      updateInputNumericalAttr(input, field)
    }
  },
  bindEvents: ({ form }) => {
    form.onEvent("change", ".number-input", function () {
      const value = this.value === "" ? null : Number(this.value)
      form.validateAndCommit(this.dataset.key, value)
    })
  },
}

const Control_Unit = {
  setup: registerNumericalDefaultRules,
  create: ({ field }) => {
    const { key, placeholder } = getCommonHTMLAttrs(field)
    const input = `<input class="unit-input" type="number" ${key} ${placeholder} ${getNumericalHTMLAttr(field)}>`
    return `<div class="unit-wrap">${input}<div class="unit-value">${field.unit}</div></div>`
  },
  update: ({ element, value, field }) => {
    const input = element.querySelector(".unit-input")
    if (input) {
      updateInputState(input, field, value)
      updateInputNumericalAttr(input, field)
    }
  },
  bindEvents: ({ form }) => {
    form.onEvent("change", ".unit-input", function () {
      const value = this.value === "" ? null : Number(this.value)
      form.validateAndCommit(this.dataset.key, value)
    })
  },
}

const Control_Icon = {
  controlOptions: {
    placeholder: "fa fa-home",
  },
  create: ({ field, controlOptions }) => {
    const { key } = getCommonHTMLAttrs(field)
    const placeholderText = field.placeholder || controlOptions.placeholder
    const input = `<input class="icon-input" type="text" ${key} placeholder="${placeholderText}">`
    const preview = `<div class="icon-preview"><i class="icon-display"></i></div>`
    return `<div class="icon-wrap">${input}${preview}</div>`
  },
  update: ({ element, value, field }) => {
    const input = element.querySelector(".icon-input")
    const display = element.querySelector(".icon-display")
    if (input && display) {
      value = value || ""
      updateInputState(input, field, value)
      Control_Icon._syncIcon(display, value)
    }
  },
  bindEvents: ({ form }) => {
    form.onEvent("input", ".icon-input", function () {
      const display = this.nextElementSibling.querySelector(".icon-display")
      Control_Icon._syncIcon(display, this.value)
    }).onEvent("change", ".icon-input", function () {
      form.validateAndCommit(this.dataset.key, this.value)
    })
  },
  _syncIcon: (display, value) => display.className = `icon-display ${value}`,
}

const Control_Range = {
  setup: registerNumericalDefaultRules,
  create: ({ field }) => {
    const { key } = getCommonHTMLAttrs(field)
    const unitHtml = field.unit ? `<span class="range-unit">${utils.escape(field.unit)}</span>` : ""
    return `
      <div class="range-wrap" ${key}>
        <input class="range-input" type="range" ${getNumericalHTMLAttr(field)}>
        <div class="range-badge"><span class="range-value"></span>${unitHtml}</div>
      </div>`
  },
  update: ({ element, value, field }) => {
    const wrap = element.querySelector(".range-wrap")
    const input = element.querySelector(".range-input")
    const val = value != null ? value : (field.min ?? 0)
    if (input && wrap) {
      updateInputState(input, field, val)
      updateInputNumericalAttr(input, field)
      Control_Range._syncUI(wrap, val, field.min, field.max)
    }
  },
  bindEvents: ({ form }) => {
    form.onEvent("input", ".range-input", function () {
      const wrap = this.closest(".range-wrap")
      const field = form.getField(wrap.dataset.key)
      Control_Range._syncUI(wrap, this.value, field.min, field.max)
    }).onEvent("change", ".range-input", function () {
      form.validateAndCommit(this.closest(".range-wrap").dataset.key, Number(this.value))
    })
  },
  _syncUI: (wrap, value, min = 0, max = 100) => {
    if (!wrap) return
    const input = wrap.querySelector(".range-input")
    const badge = wrap.querySelector(".range-value")
    const num = Number(value)
    if (badge) {
      badge.textContent = Number.isInteger(num) ? String(num) : String(num.toFixed(2))
    }
    if (input) {
      const percent = max > min ? ((num - min) / (max - min)) * 100 : 0
      input.style.setProperty("--progress", `${Math.max(0, Math.min(100, percent))}%`)
    }
  },
}

const Control_Action = {
  controlOptions: {
    actionType: "function", // function | toggle | trigger
    activeClass: "active",  // Style class name activated in toggle mode
  },
  create: ({ field }) => `<div class="action fa fa-angle-right" data-action="${field.key}"></div>`,
  update: ({ element, value, controlOptions }) => {
    if (controlOptions.actionType === "toggle") {
      element.classList.toggle(controlOptions.activeClass, !!value)
    }
  },
  bindEvents: ({ form }) => {
    form.onEvent("mousedown", `.control[data-type="action"]`, function (ev) {
      Control_Action._ripple(this, ev)
    }).onEvent("click", `.control[data-type="action"]`, function (ev) {
      Control_Action._doAction(this, form, ev)
    })
  },
  _ripple: (el, ev) => {
    let mask = el.querySelector(".action-ripple-mask")
    if (!mask) {
      mask = document.createElement("div")
      mask.classList.add("action-ripple-mask")
      el.appendChild(mask)
    }
    const ripple = document.createElement("span")
    ripple.classList.add("ripple")
    const diameter = Math.max(el.clientWidth, el.clientHeight) * 2
    const radius = diameter / 2
    const rect = el.getBoundingClientRect()
    const x = ev.clientX - rect.left - radius
    const y = ev.clientY - rect.top - radius
    ripple.style.width = `${diameter}px`
    ripple.style.height = `${diameter}px`
    ripple.style.left = `${x}px`
    ripple.style.top = `${y}px`
    mask.appendChild(ripple)
    ripple.addEventListener("animationend", () => {
      ripple.remove()
      if (mask.childNodes.length === 0) mask.remove()
    }, { once: true })
  },
  _doAction: (el, form, ev) => {
    const key = el.querySelector(".action").dataset.action
    const actionType = form.getControlOptionsFromKey(key).actionType || "function"
    if (actionType === "toggle") {
      form.reactiveCommit(key, !form.getData(key))  // Toggle mode: reverse the current value, submit data
    } else if (actionType === "trigger") {
      form.reactiveCommit(key, Date.now())  // Trigger mode: Update to timestamp to signal watchers
    } else {
      form.options.actions[key]?.(ev)  // Function mode: Execute callbacks
    }
  },
}

const Control_Static = {
  setup: ({ field }) => {
    field.isBlockLayout = false
    setRandomKey(field)
  },
  create: () => `<div class="static"></div>`,
  update: ({ element, value, field }) => {
    const wrap = element.querySelector(".static")
    if (wrap) {
      wrap.textContent = value ?? field.content ?? ""
    }
  },
}

const Control_Custom = {
  setup: ({ field }) => {
    defaultBlockLayout(field)
    setRandomKey(field)
  },
  create: () => `<div class="custom-wrap"></div>`,
  update: ({ element, value, field }) => {
    const wrap = element.querySelector(".custom-wrap")
    if (wrap) {
      const val = value ?? field.content ?? ""
      wrap.innerHTML = (field.unsafe === true) ? val : utils.escape(val)
    }
  },
}

const Control_Hint = {
  setup: ({ field }) => {
    defaultBlockLayout(field)
    setRandomKey(field)
  },
  create: () => `<div class="hint-wrap"></div>`,
  update: ({ element, value, field }) => {
    const wrap = element.querySelector(".hint-wrap")
    if (wrap) {
      const getData = (prop) => {
        const val = value?.[prop] ?? field[prop] ?? ""
        return (field.unsafe === true) ? val : utils.escape(val)
      }
      const hintHeader = getData("hintHeader")
      const hintDetail = getData("hintDetail").replace(/\n/g, "<br>")
      const headerHTML = hintHeader ? `<div class="hint-header">${hintHeader}</div>` : ""
      const detailHTML = hintDetail ? `<div class="hint-detail">${hintDetail}</div>` : ""
      wrap.innerHTML = headerHTML + detailHTML
    }
  },
}

const Control_Divider = {
  controlOptions: {
    position: "center",  // center | left | right
    dashed: true,
  },
  setup: ({ field }) => {
    field.isBlockLayout = true
    setRandomKey(field)
  },
  create: () => `<div class="divider-wrap"></div>`,
  update: ({ element, field, controlOptions }) => {
    const wrap = element.querySelector(".divider-wrap")
    if (wrap) {
      const line = `<div class="divider-line"></div>`
      wrap.classList.add(controlOptions.position, controlOptions.dashed ? "dashed" : undefined)
      wrap.innerHTML = field.divider ? `${line}<div class="divider-text">${utils.escape(field.divider)}</div>${line}` : line
    }
  },
}

const Control_Hotkey = {
  create: ({ field }) => {
    const { key } = getCommonHTMLAttrs(field)
    const idle = utils.escape(field.idlePlaceholder || "Click to record...")
    const listen = utils.escape(field.listenPlaceholder || "Listening...")
    return `
      <div class="hotkey-wrap" data-value="" ${key}>
        <div class="hotkey-recorder" tabindex="0" data-placeholder-idle="${idle}" data-placeholder-listen="${listen}"><div class="hotkey-display"></div></div>
        <div class="hotkey-clear plugin-common-close"></div>
      </div>`
  },
  update: ({ element, value, field }) => {
    const wrap = element.querySelector(".hotkey-wrap")
    Control_Hotkey._display(wrap, value || "")
    wrap.classList.toggle("plugin-common-readonly", !!(field.disabled || field.readonly))
  },
  bindEvents: ({ form }) => {
    form.onEvent("click", ".hotkey-clear", function () {
      form.reactiveCommit(this.closest(".hotkey-wrap").dataset.key, "")
      return false
    }).onEvent("focusin", ".hotkey-recorder", function () {
      utils.hotkeyHub.pause()
    }).onEvent("focusout", ".hotkey-recorder", function () {
      utils.hotkeyHub.resume()
      const { key, value } = this.closest(".hotkey-wrap").dataset
      form.reactiveCommit(key, value)
    }).onEvent("keydown", ".hotkey-recorder", function (ev) {
      if (!ev.key || ev.key === "Process") return false
      const hotkey = Control_Hotkey._parse(ev)
      if (hotkey) Control_Hotkey._display(this.closest(".hotkey-wrap"), hotkey)
      return false
    }, true)
  },
  _parse: (ev) => {
    const ignoreKeys = ["control", "alt", "shift", "meta"]
    const key = ev.key.toLowerCase()
    const combo = [
      (ev.ctrlKey || ev.metaKey) ? "ctrl" : undefined,
      ev.shiftKey ? "shift" : undefined,
      ev.altKey ? "alt" : undefined,
      ignoreKeys.includes(key) ? undefined : key,
    ]
    return combo.filter(Boolean).join("+")
  },
  _display: (wrap, hotkey) => {
    wrap.dataset.value = hotkey
    wrap.querySelector(".hotkey-display").innerHTML = hotkey
      .split("+")
      .map(key => key.trim())
      .filter(Boolean)
      .map(key => `<kbd class="hotkey-kbd">${key.charAt(0).toUpperCase() + key.slice(1)}</kbd>`)
      .join("+")
  },
}

const Control_Textarea = {
  controlOptions: {
    rows: 3,
    cols: -1,
    noResize: false,
  },
  setup: ({ field }) => defaultBlockLayout(field),
  create: ({ field, controlOptions }) => {
    const { rows, cols, noResize } = controlOptions
    const { key, placeholder } = getCommonHTMLAttrs(field)
    const rowsAttr = rows > 0 ? `rows="${rows}"` : ""
    const colsAttr = cols > 0 ? `cols="${cols}"` : ""
    const cls = "textarea" + (noResize ? " no-resize" : "")
    return `<textarea class="${cls}" ${rowsAttr} ${colsAttr} ${key} ${placeholder}></textarea>`
  },
  update: ({ element, value, field }) => {
    const textarea = element.querySelector(".textarea")
    if (textarea) updateInputState(textarea, field, value || "")
  },
  bindEvents: ({ form }) => {
    form.onEvent("keydown", ".textarea", function (ev) {
      if (utils.metaKeyPressed(ev) && ev.key === "Enter") {
        form.validateAndCommit(this.dataset.key, this.value)
        return false
      }
    }, true).onEvent("change", ".textarea", function () {
      form.validateAndCommit(this.dataset.key, this.value)
    })
  },
}

const Control_CodeEditor = {
  controlOptions: {
    tabSize: 4,
    lineNumbers: true,
  },
  setup: ({ field }) => defaultBlockLayout(field),
  create: ({ field, controlOptions }) => {
    const { lineNumbers } = controlOptions
    const { key, placeholder } = getCommonHTMLAttrs(field)
    const gutterClass = lineNumbers ? "code-gutter" : "code-gutter plugin-common-hidden"
    const textarea = `<textarea class="code-textarea" ${placeholder} spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>`
    return `<div class="code-editor-wrap" ${key}><div class="${gutterClass}"></div><div class="code-grow-wrap"><div class="code-ghost"></div>${textarea}</div></div>`
  },
  update: ({ element, value, field, controlOptions }) => {
    const textarea = element.querySelector(".code-textarea")
    if (!textarea) return
    const ghost = element.querySelector(".code-ghost")
    const gutter = element.querySelector(".code-gutter")
    const val = value || ""
    if (textarea.value !== val) textarea.value = val
    if (ghost) ghost.textContent = val + "\n"
    updateInputState(textarea, field, val)
    if (controlOptions.lineNumbers && gutter) {
      Control_CodeEditor._updateLineNumbers(textarea, gutter)
    }
  },
  bindEvents: ({ form }) => {
    const syncState = (textarea) => {
      const wrap = textarea.closest(".code-editor-wrap")
      const ghost = wrap.querySelector(".code-ghost")
      const gutter = wrap.querySelector(".code-gutter")
      ghost.textContent = textarea.value + "\n"
      if (gutter && !gutter.classList.contains("plugin-common-hidden")) {
        Control_CodeEditor._updateLineNumbers(textarea, gutter)
      }
    }

    form.onEvent("input", ".code-textarea", function () {
      syncState(this)
    }).onEvent("change", ".code-textarea", function () {
      form.validateAndCommit(this.closest(".code-editor-wrap").dataset.key, this.value)
    }).onEvent("scroll", ".code-textarea", function () {
      const gutter = this.closest(".code-editor-wrap").querySelector(".code-gutter")
      if (gutter) gutter.scrollTop = this.scrollTop
    }).onEvent("keydown", ".code-textarea", function (ev) {
      const key = this.closest(".code-editor-wrap").dataset.key
      const { tabSize } = form.getControlOptionsFromKey(key)
      if (ev.key === "Tab") {
        ev.preventDefault()
        const spaces = " ".repeat(tabSize)
        Control_CodeEditor._insertText(this, spaces)
        syncState(this)
        form.validateAndCommit(key, this.value)
      } else if (ev.key === "Enter") {
        const cursor = this.selectionStart
        const currentLineStart = this.value.lastIndexOf("\n", cursor - 1) + 1
        const currentLine = this.value.substring(currentLineStart, cursor)
        const match = currentLine.match(/^\s+/)
        const indentation = match ? match[0] : ""
        Control_CodeEditor._insertText(this, "\n" + indentation)
        syncState(this)
        this.blur()
        this.focus()
        form.validateAndCommit(key, this.value)
        return false
      }
    }, true)
  },
  _updateLineNumbers: (textarea, gutter) => {
    const lineCount = textarea.value.split("\n").length
    if (gutter.childElementCount === lineCount) return
    gutter.innerHTML = Array.from({ length: lineCount }, (_, i) => `<div>${i + 1}</div>`).join("")
  },
  _insertText: (textarea, text) => {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    textarea.setRangeText(text, start, end, "end")
  },
}

const Control_Object = {
  controlOptions: {
    format: "JSON",
    rows: 3,
    noResize: false,
  },
  setup: (context) => {
    defaultBlockLayout(context.field)
    registerRules(context, { $self: ["arrayOrObject"] })
  },
  create: ({ field, controlOptions }) => {
    const { key, placeholder } = getCommonHTMLAttrs(field)
    const rows = controlOptions.rows
    const cls = "object" + (controlOptions.noResize ? " no-resize" : "")
    const textarea = `<textarea class="${cls}" rows="${rows}" ${key} ${placeholder}></textarea>`
    return `<div class="object-wrap">${textarea}<button class="object-confirm">${i18n.t("global", "confirm")}</button></div>`
  },
  update: ({ element, value, field, controlOptions }) => {
    const textarea = element.querySelector("textarea")
    if (textarea) {
      const serializer = Control_Object._getSerializer(controlOptions.format)
      updateInputState(textarea, field, serializer.stringify(value))
    }
  },
  bindEvents: ({ form }) => {
    form.onEvent("click", ".object-confirm", function () {
      const textarea = this.closest(".object-wrap").querySelector("textarea")
      const key = textarea.dataset.key
      const controlOptions = form.getControlOptionsFromKey(key)
      const serializer = Control_Object._getSerializer(controlOptions.format)

      let parsedValue
      try {
        parsedValue = serializer.parse(textarea.value || "{}")
      } catch (e) {
        console.error(e)
        const msg = i18n.t("global", "error.incorrectFormat", { format: controlOptions.format })
        utils.notification.show(msg, "error")
        return
      }
      const ok = form.validateAndCommit(key, parsedValue)
      if (ok) {
        utils.notification.show(i18n.t("global", "success.submit"))
      }
    })
  },
  _getSerializer: (format) => Control_Object._serializers[format] || Control_Object._serializers.JSON,
  _serializers: {
    JSON: {
      parse: (str) => JSON.parse(str),
      stringify: (obj) => JSON.stringify(obj, null, "  "),
    },
    TOML: {
      parse: (str) => utils.readToml(str),
      stringify: (obj) => utils.stringifyToml(obj),
    },
    YAML: {
      parse: (str) => utils.readYaml(str),
      stringify: (obj) => utils.stringifyYaml(obj),
    },
  },
}

const Control_Array = {
  controlOptions: {
    allowDuplicates: false,
    dataType: "string",  // number | string
  },
  setup: ({ field, form }) => {
    defaultBlockLayout(field)
    const correctType = ({ value }) => {
      const { dataType } = form.getControlOptions(field)
      if (typeof value !== dataType) {
        return i18n.t("global", "error.pattern")
      }
    }
    const repeatable = ({ key, value, type }) => {
      const { allowDuplicates } = form.getControlOptions(field)
      if (allowDuplicates) return

      const currentArray = form.getData(field.key) || []
      let previewArray = []
      if (type === "push") {
        previewArray = [...currentArray, value]
      } else if (type === "set") {
        if (key === field.key) {
          previewArray = Array.isArray(value) ? value : []
        } else {
          const parts = key.split(".")
          const index = parseInt(parts.at(-1), 10)
          if (!isNaN(index)) {
            previewArray = [...currentArray]
            previewArray[index] = value
          } else {
            previewArray = currentArray
          }
        }
      } else {
        return
      }
      const count = previewArray.filter(v => v === value).length
      if (count > 1) {
        return new Error(i18n.t("global", "error.duplicateValue"))
      }
    }
    registerRules({ form, field }, { $each: [correctType, repeatable] })
  },
  create: ({ field }) => {
    const { key } = getCommonHTMLAttrs(field)
    return `
      <div class="array" ${key}>
        <div class="array-list"></div>
        <div class="array-footer">
          <div class="array-item-input plugin-common-hidden" contenteditable="true"></div>
          <div class="array-item-add">+ ${i18n.t("global", "add")}</div>
        </div>
      </div>`
  },
  update: ({ element, value }) => {
    const listContainer = element.querySelector(".array-list")
    if (listContainer) {
      listContainer.innerHTML = Control_Array._createItems(value)
    }
    const inputEl = element.querySelector(".array-item-input")
    const addEl = element.querySelector(".array-item-add")
    if (inputEl && addEl) {
      inputEl.textContent = ""
      utils.hide(inputEl)
      utils.show(addEl)
    }
  },
  bindEvents: ({ form }) => {
    const selector = ".array-item-val[contenteditable], .array-item-input[contenteditable]"
    form.onEvent("click", ".array-item", function (ev) {
      if (ev.target.closest(".array-item-del")) return
      const valueEl = this.querySelector(".array-item-val")
      if (valueEl.isContentEditable) return

      this.classList.add("editing")
      valueEl.contentEditable = "true"
      valueEl.focus()
      Control_Array._moveCursor(valueEl)
    }).onEvent("keydown", selector, function (ev) {
      if (ev.key === "Enter") {
        this.blur()
        return false
      } else if (ev.key === "Escape") {
        form._updateControl(this.closest(".array").dataset.key)
        return false
      }
    }, true).onEvent("focusout", selector, function () {
      Control_Array._commitChange(this, form)
    }).onEvent("click", ".array-item-del", function (ev) {
      ev.stopPropagation()
      const itemEl = this.parentElement
      const arrayEl = this.closest(".array")
      const idx = Array.prototype.indexOf(this.closest(".array-list").children, itemEl)
      const ok = form.validateAndCommit(arrayEl.dataset.key, idx, "removeIndex")
      if (ok) itemEl.remove()
    }).onEvent("click", ".array-item-add", function () {
      const addEl = this
      const inputEl = addEl.previousElementSibling
      utils.hide(addEl)
      utils.show(inputEl)
      inputEl.focus()
    })
  },
  _moveCursor: (node, toStart = false) => {
    const range = document.createRange()
    range.selectNodeContents(node)
    range.collapse(toStart)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  },
  _createItem: (value) => `
    <div class="array-item">
      <div class="array-item-val">${utils.escape(String(value ?? ""))}</div>
      <div class="array-item-del plugin-common-close"></div>
    </div>`,
  _createItems: (items) => (Array.isArray(items) ? items : []).map(Control_Array._createItem).join(""),
  _commitChange: (target, form) => {
    const rawValue = target.textContent
    const isNewItem = target.classList.contains("array-item-input")
    const arrayEl = target.closest(".array")
    const key = arrayEl.dataset.key
    const controlOptions = form.getControlOptionsFromKey(key)
    const val = controlOptions.dataType === "number" ? Number(rawValue) : rawValue
    if (isNewItem) {
      const ok = form.reactiveCommit(key, val, "push")
      if (ok) {
        target.textContent = ""
        utils.hide(target)
        utils.show(target.nextElementSibling || target.parentElement.querySelector(".array-item-add"))
      }
    } else {
      const itemEl = target.closest(".array-item")
      const listContainer = arrayEl.querySelector(".array-list")
      const idx = Array.prototype.indexOf.call(listContainer.children, itemEl)
      target.removeAttribute("contenteditable")
      itemEl.classList.remove("editing")
      form.validateAndCommit(`${key}.${idx}`, val, "set")
    }
  },
}

const Control_Select = {
  setupType: ({ initState }) => initState(new Map()),
  controlOptions: {
    labelJoiner: ", ",
  },
  setup: (context) => {
    normalizeOptionsAttr(context.field)
    registerItemLengthLimitRule(context)
  },
  create: ({ field }) => {
    const toOptionItem = ([optionKey, optionShowName]) => {
      const readonlyCls = field.disabledOptions?.includes(optionKey) ? "plugin-common-readonly" : ""
      const cls = `option-item${readonlyCls ? " " + readonlyCls : ""}`
      return `<div class="${cls}" data-option-key="${optionKey}">${utils.escape(optionShowName)}</div>`
    }
    const selectOptions = Object.entries(field.options).map(toOptionItem).join("")
    const { key } = getCommonHTMLAttrs(field)
    return `
      <div class="select" ${key}>
        <div class="select-wrap"><span class="select-value"></span><span class="select-icon fa fa-caret-down"></span></div>
        <div class="option-box plugin-common-hidden">${selectOptions}</div>
      </div>`
  },
  update: ({ element, value, field, controlOptions }) => {
    const selectEl = element.querySelector(".select")
    const selectValueEl = element.querySelector(".select-value")
    const optionItems = element.querySelectorAll(".option-item")
    if (!selectEl || !selectValueEl) return

    const isMulti = Array.isArray(value)
    const selectedKeys = isMulti ? (value || []) : (value != null ? [String(value)] : [])
    optionItems.forEach(item => item.dataset.choose = selectedKeys.includes(item.dataset.optionKey) ? "true" : "false")
    const validSelectedLabels = selectedKeys.map(key => field.options[key]).filter(op => op != null)
    selectValueEl.textContent = validSelectedLabels.length > 0
      ? (isMulti ? Control_Select._joinSelected(validSelectedLabels, controlOptions.labelJoiner) : validSelectedLabels[0])
      : i18n.t("global", "empty")
  },
  bindEvents: ({ form, state }) => {
    const SHOWN_OPTION_BOX = "shownOptionBox"
    form.onEvent("click", function () {
      const shownOptionBox = state.get(SHOWN_OPTION_BOX)
      if (shownOptionBox) utils.hide(shownOptionBox)
      state.set(SHOWN_OPTION_BOX, null)
    }).onEvent("click", ".select-wrap", function () {
      const optionBox = this.nextElementSibling
      const boxes = [...form.getFormEl().querySelectorAll(".option-box")]
      boxes.filter(box => box !== optionBox).forEach(utils.hide)
      utils.toggleInvisible(optionBox)
      const isShown = utils.isShown(optionBox)
      if (isShown) {
        optionBox.scrollIntoView({ block: "nearest" })
      }
      state.set(SHOWN_OPTION_BOX, isShown ? optionBox : null)
      return false
    }, true).onEvent("click", ".option-item", function () {
      const optionEl = this
      const toggleOptionKey = optionEl.dataset.optionKey
      const fieldKey = optionEl.closest(".select").dataset.key
      const value = form.getData(fieldKey)
      let commitValue = toggleOptionKey
      if (Array.isArray(value)) {
        if (optionEl.dataset.choose === "true") {
          const idx = value.indexOf(toggleOptionKey)
          commitValue = value.toSpliced(idx, 1)
        } else {
          commitValue = [...value, toggleOptionKey]
        }
      }
      form.reactiveCommit(fieldKey, commitValue)
      utils.hide(optionEl.closest(".option-box"))
    })
  },
  _joinSelected: (labels, labelJoiner) => labels.length ? labels.join(labelJoiner) : i18n.t("global", "empty"),
}

const Control_Segment = {
  setup: (context) => {
    normalizeOptionsAttr(context.field)
    registerItemLengthLimitRule(context)
  },
  create: ({ field }) => {
    const disabledOpts = Array.isArray(field.disabledOptions) ? field.disabledOptions.map(String) : []
    const items = Object.entries(field.options || {}).map(([val, label]) => {
      const isDisabled = disabledOpts.includes(String(val))
      const readonlyCls = isDisabled ? "plugin-common-readonly" : ""
      const cls = `segment-item ${readonlyCls}`.trim()
      return `<button type="button" class="${cls}" data-value="${utils.escape(String(val))}">${utils.escape(label)}</button>`
    }).join("")
    const { key } = getCommonHTMLAttrs(field)
    return `<div class="segment-wrap" ${key}>${items}</div>`
  },
  update: ({ element, value }) => {
    const wrap = element.querySelector(".segment-wrap")
    if (!wrap) return
    const isMulti = Array.isArray(value)
    const selectedKeys = isMulti ? (value || []).map(String) : (value != null ? [String(value)] : [])
    wrap.querySelectorAll(".segment-item").forEach(item => {
      item.classList.toggle("active", selectedKeys.includes(item.dataset.value))
    })
  },
  bindEvents: ({ form }) => {
    form.onEvent("click", ".segment-item", function () {
      if (this.classList.contains("plugin-common-readonly")) return
      const wrap = this.closest(".segment-wrap")
      const key = wrap.dataset.key
      const clickedValue = this.dataset.value
      const currentValue = form.getData(key)
      let nextValue = clickedValue
      if (Array.isArray(currentValue)) {
        const idx = currentValue.map(String).indexOf(clickedValue)
        nextValue = idx > -1 ? currentValue.toSpliced(idx, 1) : [...currentValue, clickedValue]
      } else {
        if (String(currentValue) === clickedValue) return
      }
      form.reactiveCommit(key, nextValue)
    })
  },
}

const Control_ModifierKey = {
  create: ({ field }) => {
    const { key } = getCommonHTMLAttrs(field)
    const items = Object.entries(Control_ModifierKey.MODIFIERS)
      .map(([k, v]) => `<button type="button" class="modifier-key-item" data-value="${k}">${v}</button>`)
      .join("")
    return `<div class="modifier-key-wrap" ${key}>${items}</div>`
  },
  update: ({ element, value }) => {
    const wrap = element.querySelector(".modifier-key-wrap")
    if (!wrap) return
    const selected = String(value || "").toLowerCase().split("+").map(s => s.trim()).filter(Boolean)
    wrap.querySelectorAll(".modifier-key-item").forEach(item => item.classList.toggle("active", selected.includes(item.dataset.value)))
  },
  bindEvents: ({ form }) => {
    form.onEvent("click", ".modifier-key-item", function () {
      const key = this.closest(".modifier-key-wrap").dataset.key
      const clicked = this.dataset.value
      const current = String(form.getData(key) || "").toLowerCase().split("+").map(s => s.trim()).filter(Boolean)
      const idx = current.indexOf(clicked)
      const next = idx > -1 ? current.toSpliced(idx, 1) : [...current, clicked]
      const nextValue = Object.keys(Control_ModifierKey.MODIFIERS).filter(k => next.includes(k)).join("+")
      form.reactiveCommit(key, nextValue)
    })
  },
  MODIFIERS: { ctrl: "Ctrl", shift: "Shift", alt: "Alt" },
}

const Control_Radio = {
  controlOptions: {
    columns: 1,
  },
  setup: ({ field }) => {
    normalizeOptionsAttr(field)
    defaultBlockLayout(field)
  },
  create: ({ field, controlOptions }) => {
    const prefix = utils.randomString()
    const disabledOpts = Array.isArray(field.disabledOptions) ? field.disabledOptions.map(String) : []
    const toItem = ([k, v], idx) => {
      const id = `${prefix}_${idx}`
      const isDisabled = disabledOpts.includes(String(k))
      const attr = isDisabled ? "disabled" : ""
      const cls = "radio-option" + (isDisabled ? " plugin-common-readonly" : "")
      return `
        <div class="${cls}">
          <div class="radio-wrapper">
            <input class="radio-input" type="radio" id="${id}" name="${field.key}" value="${k}" ${attr}>
            <div class="radio-disc"></div>
          </div>
          <label class="radio-label" for="${id}">${v}</label>
        </div>`
    }
    const options = Object.entries(field.options).map(toItem).join("")
    const { key } = getCommonHTMLAttrs(field)
    const style = controlOptions.columns > 1 ? `style="display: grid; grid-template-columns: repeat(${controlOptions.columns}, 1fr);"` : ""
    return `<div class="radio" ${key} ${style}>${options}</div>`
  },
  update: ({ element, value }) => {
    const radioInputs = element.querySelectorAll(".radio-input")
    radioInputs.forEach(input => input.checked = (input.value === String(value)))
  },
  bindEvents: ({ form }) => {
    form.onEvent("input", ".radio-input", function () {
      const name = this.getAttribute("name")
      form.validateAndCommit(name, this.value)
    })
  },
}

const Control_Checkbox = {
  controlOptions: {
    columns: 1,
  },
  setup: (context) => {
    normalizeOptionsAttr(context.field)
    defaultBlockLayout(context.field)
    registerItemLengthLimitRule(context)
  },
  create: ({ field, controlOptions }) => {
    const prefix = utils.randomString()
    const disabledOpts = Array.isArray(field.disabledOptions) ? field.disabledOptions.map(String) : []
    const toItem = ([key, label], idx) => {
      const id = `${prefix}_${idx}`
      const isDisabled = disabledOpts.includes(String(key))
      const attr = isDisabled ? "disabled" : ""
      const cls = "checkbox-option" + (isDisabled ? " plugin-common-readonly" : "")
      return `
        <div class="${cls}">
          <div class="checkbox-wrapper">
            <input class="checkbox-input" type="checkbox" id="${id}" name="${field.key}" value="${key}" ${attr}>
            <div class="checkbox-square"></div>
          </div>
          <label class="checkbox-label" for="${id}">${label}</label>
        </div>`
    }
    const options = Object.entries(field.options).map(toItem).join("")
    const { key } = getCommonHTMLAttrs(field)
    const style = controlOptions.columns > 1 ? `style="display: grid; grid-template-columns: repeat(${controlOptions.columns}, 1fr);"` : ""
    return `<div class="checkbox" ${key} ${style}>${options}</div>`
  },
  update: ({ element, value }) => {
    const inputs = element.querySelectorAll(".checkbox-input")
    const selectedValues = Array.isArray(value) ? value.map(String) : []
    inputs.forEach(input => input.checked = selectedValues.includes(input.value))
  },
  bindEvents: ({ form }) => {
    form.onEvent("input", ".checkbox-input", function () {
      const checkboxEl = this.closest(".checkbox")
      const checkboxValues = [...checkboxEl.querySelectorAll(".checkbox-input:checked")].map(e => e.value)
      form.validateAndCommit(checkboxEl.dataset.key, checkboxValues)
    })
  },
}

const Control_ToggleSort = {
  setupType: () => {
    Control_ToggleSort._ghostImg = new Image()
    Control_ToggleSort._ghostImg.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
  },
  setup: (context) => {
    normalizeOptionsAttr(context.field)
    defaultBlockLayout(context.field)
    registerItemLengthLimitRule(context)
  },
  create: ({ field }) => {
    const { key } = getCommonHTMLAttrs(field)
    return `<div class="togglesort-wrap" data-is-dragging="false" ${key}></div>`
  },
  update: ({ element, value, field }) => {
    const wrap = element.querySelector(".togglesort-wrap")
    if (!wrap || wrap.dataset.isDragging === "true") return
    const selectedKeys = Array.isArray(value) ? value.map(String) : []
    const allKeys = Object.keys(field.options || {})
    const unselectedKeys = allKeys.filter(k => !selectedKeys.includes(k))
    const disabledOpts = Array.isArray(field.disabledOptions) ? field.disabledOptions.map(String) : []
    const createItem = (key, isSelected) => {
      const isReadonly = disabledOpts.includes(key)
      const cls = `togglesort-item${isReadonly ? " plugin-common-readonly" : ""}`
      return `
        <div class="${cls}" draggable="${!isReadonly}" data-key="${key}">
          <i class="fa fa-bars togglesort-handle"></i>
          <span class="togglesort-label">${utils.escape(field.options[key])}</span>
          <input type="checkbox" class="switch-input" ${isSelected ? "checked" : ""} ${isReadonly ? "disabled" : ""}>
        </div>`
    }
    const els = [
      ...selectedKeys.filter(k => allKeys.includes(k)).map(k => createItem(k, true)),
      ...unselectedKeys.map(k => createItem(k, false)),
    ]
    wrap.innerHTML = els.join("")
  },

  bindEvents: ({ form }) => {
    const rafManager = utils.getRafManager()

    form.onEvent("change", ".togglesort-item .switch-input", function () {
      const wrap = this.closest(".togglesort-wrap")
      const targetKey = this.closest(".togglesort-item").dataset.key
      const isChecked = this.checked
      const newValue = [...wrap.querySelectorAll(".togglesort-item:not(.is-ghost)")]
        .filter(el => el.dataset.key === targetKey ? isChecked : el.querySelector(".switch-input").checked)
        .map(el => el.dataset.key)
      form.validateAndCommit(wrap.dataset.key, newValue)
    }).onEvent("dragstart", ".togglesort-item", function (ev) {
      if (this.getAttribute("draggable") !== "true") return false
      const active = this
      const wrap = active.closest(".togglesort-wrap")
      const items = [...wrap.querySelectorAll(".togglesort-item")]
      wrap.dataset.isDragging = "true"
      ev.dataTransfer.setData("text/plain", active.dataset.key)
      ev.dataTransfer.setDragImage(Control_ToggleSort._ghostImg, 0, 0)
      ev.dataTransfer.effectAllowed = "move"
      wrap._dragState = {
        active,
        ghost: Control_ToggleSort._createGhost(active),
        startY: ev.clientY,
        startX: active.offsetLeft,
        startTop: active.offsetTop,
        currentIndex: items.indexOf(active),
        cachedLayout: items.map(el => ({ el, midY: el.offsetTop + el.offsetHeight / 2 })),
      }
      wrap.appendChild(wrap._dragState.ghost)
      requestAnimationFrame(() => active.classList.add("togglesort-placeholder"))
    }).onEvent("dragend", ".togglesort-item", function () {
      rafManager.cancel()
      const wrap = this.closest(".togglesort-wrap")
      const state = wrap._dragState
      if (!state) return

      const { active, ghost, startX } = state
      const targetY = active.offsetTop

      const cleanup = () => {
        ghost?.remove()
        active.classList.remove("togglesort-placeholder")
        delete wrap.dataset.isDragging
        delete wrap._dragState
        const newValue = [...wrap.querySelectorAll(".togglesort-item:not(.is-ghost)")]
          .filter(item => item.querySelector(".switch-input").checked)
          .map(item => item.dataset.key)
        form.validateAndCommit(wrap.dataset.key, newValue)
      }
      const anim = ghost.animate(
        [{ transform: ghost.style.transform }, { transform: `translate3d(${startX}px, ${targetY}px, 0)` }],
        { duration: 150, easing: "ease-out" },
      )
      anim.onfinish = cleanup
      anim.oncancel = cleanup
    }).onEvent("dragover", ".togglesort-wrap", function (ev) {
      ev.preventDefault()
      ev.dataTransfer.dropEffect = "move"

      const state = this._dragState
      if (!state) return false

      const deltaY = ev.clientY - state.startY
      const activeY = state.startTop + deltaY
      rafManager.schedule(() => {
        if (state.ghost) state.ghost.style.transform = `translate3d(${state.startX}px, ${activeY}px, 0)`
      })

      let newIdx = state.currentIndex
      const activeMidY = activeY + state.active.offsetHeight / 2
      while (newIdx > 0 && activeMidY < state.cachedLayout[newIdx - 1].midY) {
        newIdx--
      }
      while (newIdx < state.cachedLayout.length - 1 && activeMidY > state.cachedLayout[newIdx + 1].midY) {
        newIdx++
      }
      if (newIdx !== state.currentIndex) {
        const items = state.cachedLayout.map(c => c.el)
        const prevTops = new Map(items.map(el => [el, el.offsetTop]))
        const targetEl = items[newIdx]
        const fn = newIdx > state.currentIndex ? "after" : "before"
        targetEl[fn](state.active)
        items.forEach(el => {
          const dy = prevTops.get(el) - el.offsetTop
          if (dy !== 0 && el !== state.active) {
            if (el._flipAnim) el._flipAnim.cancel()
            el._flipAnim = el.animate(
              [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
              { duration: 150, easing: "ease-out" },
            )
          }
        })

        const updatedItems = [...this.querySelectorAll(".togglesort-item:not(.is-ghost)")]
        state.cachedLayout = updatedItems.map(el => ({ el, midY: el.offsetTop + el.offsetHeight / 2 }))
        state.currentIndex = newIdx
      }
      return false
    })
      .onEvent("dragenter", ".togglesort-wrap", () => false)
      .onEvent("drop", ".togglesort-wrap", () => false)
  },
  _createGhost: (sourceEl) => {
    const ghost = sourceEl.cloneNode(true)
    ghost.classList.add("is-ghost")
    const sourceInput = sourceEl.querySelector(".switch-input")
    if (sourceInput) ghost.querySelector(".switch-input").checked = sourceInput.checked
    Object.assign(ghost.style, {
      position: "absolute",
      zIndex: "1000",
      pointerEvents: "none",
      margin: "0",
      left: "0px",
      top: "0px",
      width: `${sourceEl.offsetWidth}px`,
      height: `${sourceEl.offsetHeight}px`,
      transform: `translate3d(${sourceEl.offsetLeft}px, ${sourceEl.offsetTop}px, 0)`,
    })
    return ghost
  },
}

const Control_Transfer = {
  controlOptions: {
    titles: ["Available", "Selected"],
    defaultHeight: "300px",
  },
  setupType: () => {
    Control_Transfer._ghostImg = new Image()
    Control_Transfer._ghostImg.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
  },
  setup: (context) => {
    normalizeOptionsAttr(context.field)
    defaultBlockLayout(context.field)
    registerItemLengthLimitRule(context)
  },
  create: ({ field, controlOptions }) => {
    const { key } = getCommonHTMLAttrs(field)
    const [srcTitle, dstTitle] = controlOptions.titles
    return `
      <div class="transfer-wrap" ${key}>
        <div class="transfer-container" style="height: ${controlOptions.defaultHeight}">
          <div class="transfer-column source-column">
            <div class="transfer-header">${srcTitle}</div>
            <div class="transfer-list-wrapper source-list"></div>
          </div>
          <div class="transfer-exchange-icon"><i class="fa fa-angle-right"></i></div>
          <div class="transfer-column target-column">
            <div class="transfer-header">${dstTitle}</div>
            <div class="transfer-list-wrapper target-list"></div>
          </div>
        </div>
        <div class="transfer-resize-handle"><i class="fa fa-ellipsis-h"></i></div>
      </div>`
  },
  update: ({ element, value, field }) => {
    if (element.querySelector(".transfer-card-placeholder")) return
    const selectedKeys = Array.isArray(value) ? value.map(String) : []
    const toSelectKeys = Object.keys(field.options).filter(key => !selectedKeys.includes(key))
    const disabledOptions = Array.isArray(field.disabledOptions) ? field.disabledOptions.map(String) : []
    element.querySelector(".target-list").innerHTML = Control_Transfer._createItems(selectedKeys, field.options, disabledOptions)
    element.querySelector(".source-list").innerHTML = Control_Transfer._createItems(toSelectKeys, field.options, disabledOptions)
  },
  bindEvents: ({ form }) => {
    const rafManager = utils.getRafManager()
    let activeDraggable = null
    let dragGhost = null
    let grabOffsetX = 0
    let grabOffsetY = 0
    let ghostX = 0
    let ghostY = 0

    let lastSortTime = 0
    const SORT_THROTTLE_MS = 50

    form.onEvent("dragstart", ".transfer-card", function (ev) {
      activeDraggable = this
      const rect = activeDraggable.getBoundingClientRect()

      ev.dataTransfer.setDragImage(Control_Transfer._ghostImg, 0, 0)
      ev.dataTransfer.effectAllowed = "move"
      ev.dataTransfer.dropEffect = "move"
      ev.dataTransfer.setData("text/plain", this.dataset.val)

      grabOffsetX = ev.clientX - rect.left
      grabOffsetY = ev.clientY - rect.top

      dragGhost = activeDraggable.cloneNode(true)
      dragGhost.classList.add("transfer-card-ghost")
      dragGhost.style.width = `${rect.width}px`
      dragGhost.style.height = `${rect.height}px`
      form.getFormEl().appendChild(dragGhost)

      const originRect = dragGhost.getBoundingClientRect()
      dragGhost._originX = originRect.left
      dragGhost._originY = originRect.top
      ghostX = rect.left - dragGhost._originX
      ghostY = rect.top - dragGhost._originY
      dragGhost.style.transform = `translate3d(${ghostX}px, ${ghostY}px, 0)`

      // Delay styling to keep ghost visible during drag initiation
      requestAnimationFrame(() => activeDraggable?.classList.add("transfer-card-placeholder"))
    }).onEvent("dragend", ".transfer-card", function () {
      rafManager.cancel()
      if (!activeDraggable || !dragGhost) return

      const destRect = activeDraggable.getBoundingClientRect()
      const targetX = destRect.left - dragGhost._originX
      const targetY = destRect.top - dragGhost._originY
      const animation = dragGhost.animate(
        [{ transform: `translate3d(${ghostX}px, ${ghostY}px, 0)` }, { transform: `translate3d(${targetX}px, ${targetY}px, 0)` }],
        { duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" },
      )

      animation.onfinish = () => {
        dragGhost?.remove()
        dragGhost = null
        if (activeDraggable) {
          activeDraggable.classList.remove("transfer-card-placeholder")
          const root = activeDraggable.closest(".transfer-wrap")
          const targetList = root.querySelector(".target-list")
          const newOrder = [...targetList.querySelectorAll(".transfer-card")].map(item => item.dataset.val)
          form.validateAndCommit(root.dataset.key, newOrder)
          activeDraggable = null
        }
      }
    }).onEvent("dragover", ".transfer-container", function (ev) {
      ev.preventDefault()
      ev.stopPropagation()
      ev.dataTransfer.dropEffect = "move"

      if (!dragGhost || !activeDraggable) return

      const currentX = ev.clientX
      const currentY = ev.clientY
      rafManager.schedule(() => {
        ghostX = currentX - grabOffsetX - dragGhost._originX
        ghostY = currentY - grabOffsetY - dragGhost._originY
        dragGhost.style.transform = `translate3d(${ghostX}px, ${ghostY}px, 0)`
      })

      const now = Date.now()
      if (now < SORT_THROTTLE_MS + lastSortTime) return
      lastSortTime = now

      const hoverList = ev.target.closest(".transfer-list-wrapper")
      if (!hoverList) return

      const siblings = [...hoverList.querySelectorAll(".transfer-card")].filter(i => i !== activeDraggable)
      const insertBeforeEl = Control_Transfer._findInsertionPoint(siblings, ev.clientY)
      if (insertBeforeEl === activeDraggable.nextElementSibling) return

      const allCards = [...hoverList.closest(".transfer-wrap").querySelectorAll(".transfer-card")]
      const prevRects = new Map(allCards.map(el => [el, el.getBoundingClientRect()]))
      const hasMoved = Control_Transfer._applyDOMMove(hoverList, activeDraggable, insertBeforeEl)
      if (hasMoved) Control_Transfer._animateFLIP(allCards, prevRects, activeDraggable, dragGhost)
    })
      .onEvent("dragenter", ".transfer-container", () => false)
      .onEvent("drop", ".transfer-container", () => false)

    form.onEvent("mousedown", ".transfer-resize-handle", function (ev) {
      ev.preventDefault()
      const handle = this
      const container = handle.previousElementSibling
      const startY = ev.clientY
      const startHeight = container.getBoundingClientRect().height
      handle.classList.add("active")

      const onMouseMove = (moveEv) => {
        const currentY = moveEv.clientY
        rafManager.schedule(() => {
          const dy = currentY - startY
          const newHeight = Math.max(150, startHeight + dy)
          container.style.height = `${newHeight}px`
        })
      }
      const onMouseUp = () => {
        handle.classList.remove("active")
        rafManager.cancel()
        document.removeEventListener("mousemove", onMouseMove)
        document.removeEventListener("mouseup", onMouseUp)
      }
      document.addEventListener("mousemove", onMouseMove)
      document.addEventListener("mouseup", onMouseUp)
    })
  },
  _createItems: (keys, options, disabledOptions) => keys
    .map(key => {
      if (!key || !options[key]) return ""
      const isDisabled = disabledOptions.includes(key)
      const cls = `transfer-card${isDisabled ? " plugin-common-readonly" : ""}`
      return `<div class="${cls}" draggable="${!isDisabled}" data-val="${key}"><i class="fa fa-bars handle"></i><span>${utils.escape(options[key])}</span></div>`
    })
    .join(""),
  _findInsertionPoint: (siblings, mouseY) => siblings
    .reduce((closest, child) => {
      const box = child.getBoundingClientRect()
      const offset = mouseY - box.top - box.height / 2
      return (offset < 0 && offset > closest.offset)
        ? { offset, element: child }
        : closest
    }, { offset: Number.NEGATIVE_INFINITY })
    .element,
  _applyDOMMove: (container, draggable, insertBeforeEl) => {
    if (insertBeforeEl) {
      if (insertBeforeEl.previousElementSibling !== draggable) {
        container.insertBefore(draggable, insertBeforeEl)
        return true
      }
    } else {
      if (container.lastElementChild !== draggable) {
        container.appendChild(draggable)
        return true
      }
    }
    return false
  },
  _animateFLIP: (allElements, prevRects, activeDraggable, dragGhost) => {
    allElements.forEach(item => {
      if (item === activeDraggable || item === dragGhost) return
      const prev = prevRects.get(item)
      if (!prev) return
      const curr = item.getBoundingClientRect()
      const dx = prev.left - curr.left
      const dy = prev.top - curr.top
      if (dx !== 0 || dy !== 0) {
        item.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
          { duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "both" },
        )
      }
    })
  },
}

const Control_Dict = {
  controlOptions: {
    keyPlaceholder: "Key",
    valuePlaceholder: "Value",
    allowAddItem: true,
  },
  setup: ({ field }) => defaultBlockLayout(field),
  create: ({ field, controlOptions }) => {
    const { key } = getCommonHTMLAttrs(field)
    const list = `<div class="dict-list"></div>`
    const add = controlOptions.allowAddItem ? `<div class="dict-btn-add">+ ${i18n.t("global", "add")}</div>` : ""
    return `<div class="dict-wrap" ${key}>${list}${add}</div>`
  },
  update: ({ element, value, controlOptions }) => {
    const listEl = element.querySelector(".dict-list")
    if (!listEl) return
    listEl.innerHTML = Object.entries(value || {}).map(([k, v]) => Control_Dict._createRow(k, v, controlOptions)).join("")
    Control_Dict._initDropdowns(listEl)
  },
  bindEvents: ({ form }) => {
    form.onEvent("change", ".dict-type-dropdown", function (ev) {
      const wrapEl = this.closest(".dict-row")
      const valInput = wrapEl.querySelector(".dict-val")
      const typeHandler = Control_Dict._types[this.getValue()]
      if (!typeHandler.validate(valInput.value)) {
        valInput.classList.add("input-error")
        setTimeout(() => valInput.classList.remove("input-error"), 500)
        this.setValue(ev.detail.oldValue)
        return
      }
      Control_Dict._collectAndCommit(wrapEl, form)
    }).onEvent("change", ".dict-input", function () {
      Control_Dict._collectAndCommit(this, form)
    }).onEvent("click", ".dict-btn-del", utils.createConsecutiveAction({
      threshold: 2,
      timeWindow: 3000,
      getIdentifier: (ev) => ev.target,
      onConfirmed: (ev) => {
        const row = ev.target.closest(".dict-row")
        const wrap = ev.target.closest(".dict-wrap")
        row.remove()
        Control_Dict._collectAndCommit(wrap, form)
      },
    })).onEvent("click", ".dict-btn-add", function () {
      const wrap = this.parentElement
      const listEl = wrap.querySelector(".dict-list")
      const fieldKey = wrap.getAttribute("data-key")
      const controlOptions = form.getControlOptionsFromKey(fieldKey)
      listEl.insertAdjacentHTML("beforeend", Control_Dict._createRow("", "", controlOptions))
      Control_Dict._initDropdowns(listEl.lastElementChild)
      listEl.lastElementChild.querySelector(".dict-key")?.focus()
    })
  },
  _initDropdowns: (container) => {
    const opts = Object.entries(Control_Dict._types).map(([k, v]) => ({ value: k, label: v.label }))
    container.querySelectorAll(".dict-type-dropdown").forEach(d => d.setOptions(opts))
  },
  _createRow: (key, val, options) => {
    let currentType = "string"
    if (typeof val === "number") currentType = "number"
    else if (typeof val === "boolean") currentType = "boolean"
    else if (typeof val === "object" && val !== null) currentType = "json"

    let displayVal
    if (currentType === "json") displayVal = JSON.stringify(val)
    else if (val == null) displayVal = ""
    else displayVal = String(val)

    const k = utils.escape(String(key || ""))
    const v = utils.escape(displayVal)
    return `
      <div class="dict-row">
        <input class="dict-input dict-key" type="text" value="${k}" placeholder="${options.keyPlaceholder}">
        <div class="dict-val-wrapper">
          <input class="dict-input dict-val" type="text" value="${v}" placeholder="${options.valuePlaceholder}">
          <div class="dict-type-wrap">
            <fast-dropdown class="dict-type-dropdown" value="${currentType}"></fast-dropdown>
          </div>
        </div>
        <div class="dict-actions"><i class="dict-btn-del fa fa-trash-o"></i></div>
      </div>`
  },
  _collectAndCommit: (targetEl, form) => {
    const wrap = targetEl.closest(".dict-wrap")
    if (!wrap) return
    const result = {}
    const typeConfig = Control_Dict._types
    wrap.querySelectorAll(".dict-row").forEach(row => {
      const k = row.querySelector(".dict-key").value.trim()
      if (!k) return

      const valInput = row.querySelector(".dict-val")
      const dropdown = row.querySelector(".dict-type-dropdown")

      const rawVal = valInput.value
      let handler = typeConfig[dropdown.getValue() || "string"]
      if (!handler.validate(rawVal)) {
        handler = typeConfig.string
        dropdown.setValue("string")
        valInput.classList.add("input-warn")
        setTimeout(() => valInput.classList.remove("input-warn"), 500)
      }
      result[k] = handler.parse(rawVal)
    })
    form.validateAndCommit(wrap.getAttribute("data-key"), result)
  },
  _types: {
    string: { label: "STR", validate: () => true, parse: String },
    number: { label: "NUM", validate: (v) => !isNaN(Number(v)) && v.trim() !== "", parse: Number },
    boolean: { label: "BOOL", validate: (v) => v === "true" || v === "false", parse: (v) => v === "true" },
    json: {
      label: "JSON",
      validate: (v) => {
        try {
          JSON.parse(v)
          return true
        } catch (e) {
          return false
        }
      },
      parse: JSON.parse,
    },
  },
}

const Control_Palette = {
  controlOptions: {
    defaultColor: "#FFFFFF",
    dimensions: 1,
    allowJagged: true,
  },
  setup: ({ field }) => defaultBlockLayout(field),
  create: ({ field }) => {
    const { key } = getCommonHTMLAttrs(field)
    return `<div class="palette-wrapper" ${key}><div class="palette-content-layer"></div><input type="color" class="palette-shared-input" tabindex="-1"></div>`
  },
  update: ({ element, value, controlOptions }) => {
    const wrapper = element.querySelector(".palette-wrapper")
    if (!wrapper) return

    let data = value || []
    let { dimensions, defaultColor, allowJagged } = controlOptions
    if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
      dimensions = 2
    } else if (Array.isArray(data) && data.length > 0 && !Array.isArray(data[0])) {
      dimensions = 1
    }
    const isJagged = (dimensions === 1) ? true : (allowJagged !== false)

    wrapper.dataset.mode = dimensions
    wrapper.dataset.jagged = isJagged

    let html = ""
    if (dimensions === 1) {
      const items = data.map(color => Control_Palette._createItem(color || defaultColor)).join("")
      const addBtn = Control_Palette._createAddBtn("item")
      html = `<div class="palette-grid">${items}${addBtn}</div>`
    } else {
      const rows = data.map((row, rIdx) => {
        const rowData = Array.isArray(row) ? row : []
        const items = rowData.map((color, cIdx) => Control_Palette._createItem(color || defaultColor, rIdx, cIdx)).join("")
        const rowAddBtn = isJagged ? Control_Palette._createAddBtn("item", rIdx) : ""
        return `
          <div class="palette-row-group">
            <div class="palette-grid">${items}${rowAddBtn}</div>
            <div class="palette-row-actions"><div class="palette-btn-del-row"><i class="fa fa-trash-o"></i></div></div>
          </div>`
      }).join("")

      let footer = `<div class="palette-footer-item">${Control_Palette._createAddBtn("row")} <span>Add Row</span></div>`
      if (!isJagged) {
        footer += `<div class="palette-footer-item">${Control_Palette._createAddBtn("col")} <span>Add Column</span></div>`
      }
      html = `<div class="palette-stack">${rows}<div class="palette-footer">${footer}</div></div>`
    }
    wrapper.querySelector(".palette-content-layer").innerHTML = html
  },
  bindEvents: ({ form }) => {
    let activeItem = null

    form.onEvent("click", ".palette-swatch", function () {
      const item = this.closest(".palette-item")
      const wrapper = this.closest(".palette-wrapper")
      const sharedInput = wrapper.querySelector(".palette-shared-input")
      if (item && sharedInput) {
        activeItem = item
        const itemRect = item.getBoundingClientRect()
        const wrapperRect = wrapper.getBoundingClientRect()
        Object.assign(sharedInput.style, {
          top: `${itemRect.top - wrapperRect.top}px`,
          left: `${itemRect.left - wrapperRect.left}px`,
          width: `${itemRect.width}px`,
          height: `${itemRect.height}px`,
        })
        sharedInput.offsetHeight  // Force Reflow
        sharedInput.value = item.dataset.val || "#FFFFFF"
        sharedInput.click()
      }
    }).onEvent("input", ".palette-shared-input", function () {
      activeItem?.style.setProperty("--pl-color", this.value)
    }).onEvent("change", ".palette-shared-input", function () {
      if (activeItem) {
        const color = this.value
        activeItem.dataset.val = color
        activeItem.style.setProperty("--pl-color", color)
        Control_Palette._commit(this.closest(".palette-wrapper"), form)
        activeItem = null
      }
    }).onEvent("click", ".palette-del", function () {
      const item = this.closest(".palette-item")
      const wrapper = this.closest(".palette-wrapper")
      const mode = parseInt(wrapper.dataset.mode)
      const isJagged = wrapper.dataset.jagged === "true"
      if (mode === 2 && !isJagged) {
        const colIdx = parseInt(item.dataset.col)
        const currentData = utils.naiveCloneDeep(form.getData(wrapper.dataset.key))
        currentData.forEach(row => row.splice(colIdx, 1))
        form.reactiveCommit(wrapper.dataset.key, currentData)
      } else {
        item.remove()
        Control_Palette._commit(wrapper, form)
      }
    }).onEvent("click", ".palette-btn-del-row", utils.createConsecutiveAction({
      threshold: 2,
      timeWindow: 3000,
      getIdentifier: (ev) => ev.target,
      onConfirmed: (ev) => {
        const wrapper = ev.target.closest(".palette-wrapper")
        ev.target.closest(".palette-row-group").remove()
        Control_Palette._commit(wrapper, form)
      },
    })).onEvent("click", ".palette-btn-add", function () {
      const type = this.dataset.type
      const wrapper = this.closest(".palette-wrapper")
      const { defaultColor } = form.getControlOptionsFromKey(wrapper.dataset.key)
      const isJagged = wrapper.dataset.jagged === "true"
      const currentData = utils.naiveCloneDeep(form.getData(wrapper.dataset.key) || [])
      if (type === "item") {
        const mode = parseInt(wrapper.dataset.mode)
        if (mode === 1) {
          currentData.push(defaultColor)
        } else {
          const rowIdx = parseInt(this.dataset.row)
          if (!currentData[rowIdx]) {
            currentData[rowIdx] = []
          }
          currentData[rowIdx].push(defaultColor)
        }
      } else if (type === "row") {
        if (isJagged) {
          currentData.push([defaultColor])
        } else {
          const colCount = currentData.length > 0 ? currentData[0].length : 1
          currentData.push(new Array(colCount).fill(defaultColor))
        }
      } else if (type === "col") {
        if (currentData.length === 0) {
          currentData.push([])
        }
        currentData.forEach(row => row.push(defaultColor))
      }
      form.reactiveCommit(wrapper.dataset.key, currentData)
    })
  },
  _createItem: (color, rIdx, cIdx) => {
    const coords = (rIdx !== undefined) ? `data-row="${rIdx}" data-col="${cIdx}"` : ""
    return `
      <div class="palette-item" ${coords} data-val="${color}" style="--pl-color: ${color};">
        <div class="palette-swatch"></div>
        <div class="palette-del plugin-common-close"></div>
      </div>`
  },
  _createAddBtn: (type, rowIdx) => {
    const rowAttr = (rowIdx !== undefined) ? `data-row="${rowIdx}"` : ""
    return `<div class="palette-btn-add ${type}" data-type="${type}" ${rowAttr}><i class="fa fa-plus"></i></div>`
  },
  _commit: (wrapper, form) => {
    if (!wrapper) return
    const key = wrapper.dataset.key
    const mode = parseInt(wrapper.dataset.mode)
    const getVal = i => i.dataset.val
    const newData = (mode === 1)
      ? Array.from(wrapper.querySelectorAll(".palette-grid .palette-item"), getVal)
      : Array.from(wrapper.querySelectorAll(".palette-row-group"), row => Array.from(row.querySelectorAll(".palette-item"), getVal))
    form.validateAndCommit(key, newData)
  },
}

const Control_Table = {
  setup: ({ field }) => defaultBlockLayout(field),
  create: ({ field }) => {
    const isReadonly = !!field.readonly
    const lines = Object.values(field.thMap || {})
    if (!isReadonly) {
      lines.push(`<div class="table-add fa fa-plus"></div>`)
    }
    const table = Control_Table._buildTable([lines])
    const { key } = getCommonHTMLAttrs(field)
    return `<div class="table ${isReadonly ? "is-readonly" : ""}" ${key}>${table}</div>`
  },
  update: ({ element, value, field }) => {
    const tbodyEl = element.querySelector("tbody")
    if (!tbodyEl) return
    const isReadonly = !!field.readonly
    tbodyEl.innerHTML = (value || [])
      .map(item => `<tr>${Control_Table._createTableRow(field.thMap, item, isReadonly).map(e => `<td>${e}</td>`).join("")}</tr>`)
      .join("")
  },
  bindEvents: ({ form }) => {
    form.onEvent("click", ".table-add", async function () {
      const tableEl = this.closest(".table")
      const key = tableEl.dataset.key
      const { nestedBoxes, defaultValues, thMap, subFormOptions = {} } = form.getField(key)
      const op = { title: i18n.t("global", "add"), validateForm: true, schema: nestedBoxes, data: defaultValues, ...subFormOptions }
      const { response, data } = await utils.formDialog.modal(op)
      if (response === 0) return
      const ok = form.validateAndCommit(key, data, "push")
      if (ok) {
        const row = Control_Table._createTableRow(thMap, data).map(e => `<td>${e}</td>`).join("")
        tableEl.querySelector("tbody").insertAdjacentHTML("beforeend", `<tr>${row}</tr>`)
        utils.notification.show(i18n.t("global", "success.add"))
      }
    }).onEvent("click", ".table-edit", async function () {
      const trEl = this.closest("tr")
      const tableEl = trEl.closest(".table")
      const idx = [...tableEl.querySelectorAll("tbody tr")].indexOf(trEl)
      const key = tableEl.dataset.key
      const rowValue = form.options.data[key][idx]
      const { nestedBoxes, defaultValues, thMap, subFormOptions = {} } = form.getField(key)
      const modalValues = utils.merge(defaultValues, rowValue)  // rowValue may be missing some attributes
      const op = { title: i18n.t("global", "edit"), validateForm: true, schema: nestedBoxes, data: modalValues, ...subFormOptions }
      const { response, data } = await utils.formDialog.modal(op)
      if (response === 0) return
      const ok = form.validateAndCommit(`${key}.${idx}`, data, "set")
      if (ok) {
        const row = Control_Table._createTableRow(thMap, data)
        const tds = trEl.querySelectorAll("td")
        utils.zip(row, tds).slice(0, -1).forEach(([val, td]) => td.textContent = val)
        utils.notification.show(i18n.t("global", "success.edit"))
      }
    }).onEvent("click", ".table-del", utils.createConsecutiveAction({
      threshold: 2,
      timeWindow: 3000,
      getIdentifier: (ev) => ev.target,
      onConfirmed: (ev) => {
        const trEl = ev.target.closest("tr")
        const tableEl = trEl.closest(".table")
        const idx = [...tableEl.querySelectorAll("tbody tr")].indexOf(trEl)
        const ok = form.validateAndCommit(tableEl.dataset.key, idx, "removeIndex")
        if (ok) {
          trEl.remove()
          utils.notification.show(i18n.t("global", "success.deleted"))
        }
      },
    }))
  },
  _createTableRow: (thMap, item, isReadonly) => {
    const header = utils.pick(item, Object.keys(thMap || {}))
    const headerValues = Object.values(header).map(headerValue => typeof headerValue === "string" ? utils.escape(headerValue) : headerValue)
    if (isReadonly) {
      return headerValues
    }
    const editButtons = `<div class="table-edit fa fa-pencil"></div><div class="table-del fa fa-trash-o"></div>`
    return [...headerValues, editButtons]
  },
  _buildTable: ([headers = [], ...bodyRows] = []) => {
    if (headers.length === 0) return "<table></table>"
    const thead = `<tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>`
    const tbody = bodyRows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")
    return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`
  },
}

const Control_Composite = {
  setupType: ({ initState }) => initState(new Map()),
  setup: ({ field, form, options, state }) => {
    defaultBlockLayout(field)

    const originValue = form.getData(field.key)
    const fixedValue = (originValue === false || originValue == null)
      ? false
      : typeof originValue !== "object"
        ? field.defaultValues
        : { ...field.defaultValues, ...originValue }

    form.setData(field.key, fixedValue)  // Fix data
    state.set(field.key, { ...field.defaultValues, ...fixedValue })  // Set cache

    Control_Composite._setCacheWatcher(form, field, state)
    Control_Composite._setDependencies(field)
  },
  getNestedSchemas: (field) => Array.isArray(field.subSchema) ? [field.subSchema] : [],
  create: ({ field, form }) => {
    const switchControlDef = form.options.controls["switch"]

    const newSwitchField = { ...field, type: "switch", isBlockLayout: false }
    const newSwitchControlOptions = { ...switchControlDef.controlOptions, className: "composite-switch" }
    const newSwitchFieldContext = { form, field: newSwitchField, controlOptions: newSwitchControlOptions }

    const toggleControlHtml = switchControlDef.create(newSwitchFieldContext)
    const fullToggleHtml = form.options.layout.renderFieldWrapper(newSwitchField, toggleControlHtml, newSwitchControlOptions.className)
    const subBoxWrapper = `<div class="sub-box-wrapper" data-parent-key="${field.key}"></div>`
    return fullToggleHtml + subBoxWrapper
  },
  update: ({ element, value, field, form }) => {
    const input = element.querySelector(".composite-switch .switch-input")
    const container = element.querySelector(".sub-box-wrapper")
    if (input && container) {
      input.checked = typeof value === "object" && value != null
      input.disabled = !!field.disabled
      input.readOnly = !!field.readonly
    }
    const isChecked = typeof value === "object" && value != null
    utils.toggleInvisible(container, !isChecked)
    if (isChecked && container.childElementCount === 0) {
      form.fillForm(field.subSchema, container)  // Lazy rendering
    }
  },
  bindEvents: ({ form, state }) => {
    form.onEvent("change", ".composite-switch .switch-input", function () {
      const key = this.dataset.key
      const valueToCommit = this.checked ? state.get(key) : false
      form.reactiveCommit(key, valueToCommit)
    })
  },
  _setDependencies: (field) => {
    const fieldDeps = { $follow: field.key }
    const fieldEnabled = { [field.key]: { $bool: true } }
    for (const box of field.subSchema || []) {
      for (const subField of box.fields || []) {
        const subFieldDeps = subField.dependencies ? [subField.dependencies] : []
        subField.dependencies = { $and: [fieldEnabled, fieldDeps, ...subFieldDeps] }
      }
    }
  },
  _setCacheWatcher: (form, field, state) => {
    const subFieldKeys = Control_Composite._collectAllKeys(field.subSchema)
    if (subFieldKeys.length === 0) return
    const watcherKey = `_composite_cache_sync_${field.key}`
    form.getApi("watchers")?.register(watcherKey, {
      triggers: subFieldKeys,
      when: { [field.key]: { $typeof: "object" } },
      affects: [],
      effect: (isMet, ctx) => {
        if (isMet) state.set(field.key, { ...field.defaultValues, ...ctx.getValue(field.key) })
      },
    })
  },
  _collectAllKeys: (schema, prefix) => {
    const keys = []
    for (const box of schema || []) {
      for (const field of (box.fields || [])) {
        if (!field.key) continue
        const fullKey = prefix ? `${prefix}.${field.key}` : field.key
        keys.push(fullKey)
        if (field.type === "composite" && Array.isArray(field.subSchema)) {
          keys.push(...Control_Composite._collectAllKeys(field.subSchema, fullKey))
        }
      }
    }
    return keys
  },
}

const Control_Tabs = {
  controlOptions: {
    tabStyle: "line",  // line | card | segment
    tabPosition: "top",  // top | left
    defaultSelectedTab: "0",
    defaultTabLabel: "Untitled Tab",
  },
  setupType: ({ initState }) => initState(new Map()),  // Map<FieldKey, SelectedTabValue>
  setup: ({ field, state, form }) => {
    field.isBlockLayout = true

    const tabs = field.tabs || []
    tabs.forEach((tab, idx) => tab.value = String(tab.value ?? idx))

    let targetValue = state.get(field.key) ?? String(form.getControlOptions(field).defaultSelectedTab)
    const isValid = targetValue && tabs.some(t => t.value === targetValue)
    if (!isValid && tabs.length > 0) {
      targetValue = tabs[0].value
    }
    if (targetValue != null) {
      state.set(field.key, targetValue)
    }
  },
  getNestedSchemas: (field) => (field.tabs || []).map(tab => tab.schema).filter(schema => Array.isArray(schema)),
  create: ({ field, controlOptions }) => {
    const { key } = getCommonHTMLAttrs(field)
    const tabs = field.tabs || []

    const headers = tabs.map(tab => {
      const label = utils.escape(tab.label || controlOptions.defaultTabLabel)
      const iconHtml = tab.icon ? `<i class="${tab.icon}"></i>` : ""
      const labelHtml = `<div>${label}</div>`
      return `<div class="tab-header-item" data-tab-value="${tab.value}">${iconHtml}${labelHtml}</div>`
    })
    const panes = tabs.map(tab => `<div class="tab-pane" data-tab-value="${tab.value}"></div>`)
    const styleMap = { line: "tabs-style-line", card: "tabs-style-card", segment: "tabs-style-segment" }
    const styleClass = styleMap[controlOptions.tabStyle] || "tabs-style-line"
    const posClass = controlOptions.tabPosition === "left" ? "tabs-pos-left" : "tabs-pos-top"
    return `
      <div class="tabs-wrapper ${styleClass} ${posClass}" ${key}>
        <div class="tabs-header-list">${headers.join("")}</div>
        <div class="tabs-content-wrapper">${panes.join("")}</div>
      </div>`
  },
  update: ({ element, field, form, state }) => {
    const active = state.get(field.key)
    if (active == null) return
    const wrapper = element.querySelector(".tabs-wrapper")
    if (!wrapper) return

    wrapper.querySelectorAll(".tab-header-item").forEach(header => {
      const isActive = header.dataset.tabValue === active
      header.classList.toggle("active", isActive)
    })
    wrapper.querySelectorAll(".tab-pane").forEach(pane => {
      const val = pane.dataset.tabValue
      const isActive = val === active
      pane.classList.toggle("plugin-common-hidden", !isActive)
      if (isActive && pane.childElementCount === 0) {
        const tabConfig = (field.tabs || []).find(t => t.value === val)
        if (tabConfig && Array.isArray(tabConfig.schema)) {
          form.fillForm(tabConfig.schema, pane)
        }
      }
    })
  },
  bindEvents: ({ form, state }) => {
    form.onEvent("click", ".tab-header-item", function () {
      if (!this.classList.contains("active")) {
        const key = this.closest(".tabs-wrapper").dataset.key
        state.set(key, this.dataset.tabValue)
        form._updateControl(key)
      }
    })
  },
}

module.exports = {
  Control_Switch, Control_Text, Control_Password, Control_Color,
  Control_Number, Control_Unit, Control_Icon, Control_Range,
  Control_Action, Control_Static, Control_Custom, Control_Hint,
  Control_Divider, Control_Hotkey, Control_Textarea, Control_CodeEditor,
  Control_Object, Control_Array, Control_Select, Control_Segment,
  Control_ModifierKey, Control_Radio, Control_Checkbox, Control_ToggleSort,
  Control_Transfer, Control_Dict, Control_Palette, Control_Table,
  Control_Composite, Control_Tabs,
}
