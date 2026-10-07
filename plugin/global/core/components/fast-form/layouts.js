const utils = require("../../utils")

const Layout_Default = {
  base: null,
  containerClass: "",
  setup(base, config) {
    return {
      findBox(key, formEl) {
        return formEl.querySelector(`.box-container[data-box="${CSS.escape(key)}"]`)
      },
      findControl(key, formEl) {
        return formEl.querySelector(`.control[data-control="${CSS.escape(key)}"]`)
      },
      render({ schema, container, form }) {
        const createControl = (field) => {
          const controlDef = form.options.controls[field.type]
          if (!controlDef) {
            console.warn(`FastForm Warning: No control registered for type "${field.type}".`)
            return ""
          }
          const controlOptions = form.getControlOptions(field)
          const controlContext = { field, controlOptions, form }
          const controlHTML = controlDef.create(controlContext)
          return this.renderFieldWrapper(field, controlHTML, controlOptions.className)
        }
        const createBox = (box) => {
          const titleHTML = this.renderBoxTitle(box)
          const controlHTMLs = (box.fields || []).map(createControl).join("")
          const boxHTML = this.renderBoxContent(controlHTMLs, box)
          return this.renderBoxWrapper(box, titleHTML, boxHTML)
        }
        this.updateRootContainer(container)
        container.innerHTML = schema.map(createBox).join("")
      },
      updateRootContainer(container) {
        const cls = config.containerClass
        if (cls) container.className = cls
      },
      renderBoxWrapper(box, titleHTML, contentHTML, extraClass = "") {
        const userClass = box.className || ""
        const cls = ["box-container", userClass, extraClass].filter(Boolean).join(" ")
        return `<div class="${cls}" data-box="${box.id}">${titleHTML}${contentHTML}</div>`
      },
      renderBoxContent(fieldsHTML, box, extraClass = "") {
        const cls = ["box", extraClass].filter(Boolean).join(" ")
        return `<div class="${cls}">${fieldsHTML}</div>`
      },
      renderBoxTitle(box) {
        return box.title ? `<div class="title"><div class="title-text">${box.title}</div>${this.renderTooltip(box)}</div>` : ""
      },
      renderFieldWrapper(field, controlHTML, extraClass = "") {
        const isBlock = field.isBlockLayout || false
        const labelHTML = isBlock ? "" : `<div class="control-left">${this.renderLabel(field)}</div>`
        const inputWrapHTML = isBlock ? controlHTML : `<div class="control-right">${controlHTML}</div>`
        const clsList = ["control"]
        if (isBlock) clsList.push("control-block")
        if (field.hidden) clsList.push("plugin-common-hidden")
        if (extraClass) clsList.push(extraClass)
        return `<div class="${clsList.join(" ")}" data-type="${field.type}" data-control="${field.key}">${labelHTML}${inputWrapHTML}</div>`
      },
      renderLabel(field) {
        const label = field.label || ""
        return field.explain
          ? `<div><div>${label}${this.renderTooltip(field)}</div>${this.renderExplain(field)}</div>`
          : label + this.renderTooltip(field)
      },
      renderExplain(field) {
        return `<div class="explain">${utils.escape(field.explain)}</div>`
      },
      renderTooltip(item) {
        if (!item.tooltip) return ""
        const tips = Array.isArray(item.tooltip) ? item.tooltip : [item.tooltip]
        const toHTML = (tip, idx) => {
          if (!tip) return ""
          const cfg = typeof tip === "string" ? { text: tip } : tip
          cfg.icon = cfg.icon || "fa fa-info-circle"
          const cls = cfg.action ? "tooltip has-action" : "tooltip"
          const actionAttrs = cfg.action ? `data-action="${cfg.action}" data-trigger-id="${item.key || item.id}" data-index="${idx}"` : ""
          const triggerHTML = `<div class="tooltip-trigger"><i class="${cfg.icon}"></i></div>`
          const contentHTML = cfg.text ? `<div class="tooltip-content">${utils.escape(cfg.text).replace(/\n/g, "<br>")}</div>` : ""
          return `<div class="${cls}" ${actionAttrs}>${triggerHTML}${contentHTML}</div>`
        }
        return tips.map(toHTML).join("")
      },
    }
  },
}

const Layout_Grid = {
  base: "default",
  defaultCol: 12,
  setup(base, config) {
    return {
      updateRootContainer(container) {
        base.updateRootContainer.call(this, container)
        container.classList.add("ff-row")
      },
      renderBoxContent(fieldsHTML, box) {
        return base.renderBoxContent.call(this, fieldsHTML, box, "ff-row")
      },
      renderBoxWrapper(box, titleHTML, contentHTML) {
        const col = box.col || config.defaultCol
        const colClass = `ff-col-${col}`
        return base.renderBoxWrapper.call(this, box, titleHTML, contentHTML, colClass)
      },
      renderFieldWrapper(field, controlHTML, extraClass = "") {
        const col = field.col || config.defaultCol
        const colClass = `ff-col-${col}`
        const combinedClass = `${extraClass} ${colClass}`.trim()
        return base.renderFieldWrapper.call(this, field, controlHTML, combinedClass)
      },
    }
  },
}

module.exports = { Layout_Default, Layout_Grid }
