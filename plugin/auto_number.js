const buildStyleRenderer = ({ utils, config }) => {
  // Workaround for `counter-reset` breaking change introduced in Chromium 126
  // Ref: https://issues.chromium.org/issues/346974104
  const PROP = utils.compareVersion(utils.chromeVersion, "126") >= 0 ? "counter-set" : "counter-reset"
  const NAMES = {
    c1: "content-h1", c2: "content-h2", c3: "content-h3", c4: "content-h4", c5: "content-h5", c6: "content-h6",
    o1: "outline-h1", o2: "outline-h2", o3: "outline-h3", o4: "outline-h4", o5: "outline-h5", o6: "outline-h6",
    t1: "toc-h1", t2: "toc-h2", t3: "toc-h3", t4: "toc-h4", t5: "toc-h5", t6: "toc-h6",
    t: "table", f: "fence", i: "image",
  }
  const STYLES = {
    d: "decimal", dlz: "decimal-leading-zero", lr: "lower-roman", ur: "upper-roman",
    la: "lower-alpha", ua: "upper-alpha", lg: "lower-greek", hs: "cjk-heavenly-stem",
    eb: "cjk-earthly-branch", cjk: "cjk-ideographic", scf: "simp-chinese-formal",
    tcf: "trad-chinese-formal", jf: "japanese-formal", hi: "hiragana",
    ka: "katakana", di: "disc", ci: "circle", sq: "square", no: "none",
  }
  const DEFAULT_STYLE = "d"

  const joinKeys = (obj) => Object.keys(obj).sort((a, b) => b.length - a.length).join("|")
  const regex = new RegExp(`\\{\\s*(${joinKeys(NAMES)})(?::(${joinKeys(STYLES)}))?\\s*\\}`, "gi")
  const buildCounter = (lo) => {
    let start = 0
    const content = []
    for (const match of lo.matchAll(regex)) {
      const [raw, name, style = DEFAULT_STYLE] = match
      const idx = match.index
      const text = lo.slice(start, idx)
      if (text) content.push(`"${text}"`)
      content.push(`counter(${NAMES[name]}, ${STYLES[style]})`)
      start = idx + raw.length
    }
    const remain = lo.slice(start)
    if (remain) content.push(`"${remain}"`)
    return content.length ? content.join(" ") : `""`
  }

  const getNumberingCSS = (layout) => {
    return Object.fromEntries(Object.entries(layout).map(([type, lo]) => {
      const content = buildCounter(lo) + (type === "image" ? ` " " attr(data-alt)` : "")
      const css = `counter-increment: ${type}; content: ${content};`
      return [type, css]
    }))
  }

  const generate = (inExport = false) => {
    const layout = (config.LAYOUTS.find(e => e.selected) ?? config.LAYOUTS[0]).layout
    const css = getNumberingCSS(layout)

    const baseCSS = `
#write { counter-reset: content-h1 content-h2 image table fence; }
#write > h1 { ${PROP}: content-h2; }
#write > h2 { ${PROP}: content-h3; }
#write > h3 { ${PROP}: content-h4; }
#write > h4 { ${PROP}: content-h5; }
#write > h5 { ${PROP}: content-h6; }`

    const contentCSS = `
#write > h1:before, #write > h1.md-focus.md-heading:before {${css["content-h1"]}}
#write > h2:before, #write > h2.md-focus.md-heading:before {${css["content-h2"]}}
#write > h3:before, #write > h3.md-focus.md-heading:before {${css["content-h3"]}}
#write > h4:before, #write > h4.md-focus.md-heading:before {${css["content-h4"]}}
#write > h5:before, #write > h5.md-focus.md-heading:before {${css["content-h5"]}}
#write > h6:before, #write > h6.md-focus.md-heading:before {${css["content-h6"]}}

#write > h3.md-focus:before, #write > h4.md-focus:before, #write > h5.md-focus:before, #write > h6.md-focus:before,
h3.md-focus:before, h4.md-focus:before, h5.md-focus:before, h6.md-focus:before {
  color: inherit; border: inherit; border-radius: inherit; position: inherit;
  left: initial; float: none; top: initial; font-size: inherit; padding-left: inherit;
  padding-right: inherit; vertical-align: inherit; font-weight: inherit; line-height: inherit;
  visibility: inherit;
}`

    const outlineCSS = `
.outline-content { counter-reset: outline-h1 outline-h2; }
.outline-h1 { ${PROP}: outline-h2; }
.outline-h2 { ${PROP}: outline-h3; }
.outline-h3 { ${PROP}: outline-h4; }
.outline-h4 { ${PROP}: outline-h5; }
.outline-h5 { ${PROP}: outline-h6; }

.outline-content .outline-h1 .outline-label:before {${css["outline-h1"]}}
.outline-content .outline-h2 .outline-label:before {${css["outline-h2"]}}
.outline-content .outline-h3 .outline-label:before {${css["outline-h3"]}}
.outline-content .outline-h4 .outline-label:before {${css["outline-h4"]}}
.outline-content .outline-h5 .outline-label:before {${css["outline-h5"]}}
.outline-content .outline-h6 .outline-label:before {${css["outline-h6"]}}`

    const tocCSS = `
.md-toc-content { counter-reset: toc-h1 toc-h2; }
.md-toc-h1 { ${PROP}: toc-h2; }
.md-toc-h2 { ${PROP}: toc-h3; }
.md-toc-h3 { ${PROP}: toc-h4; }
.md-toc-h4 { ${PROP}: toc-h5; }
.md-toc-h5 { ${PROP}: toc-h6; }

.md-toc-content .md-toc-h1 a:before {${css["toc-h1"]}}
.md-toc-content .md-toc-h2 a:before {${css["toc-h2"]}}
.md-toc-content .md-toc-h3 a:before {${css["toc-h3"]}}
.md-toc-content .md-toc-h4 a:before {${css["toc-h4"]}}
.md-toc-content .md-toc-h5 a:before {${css["toc-h5"]}}
.md-toc-content .md-toc-h6 a:before {${css["toc-h6"]}}`

    const tableCSS = `
#write .table-figure::${config.POSITION_TABLE} {
  ${css["table"]}
  font-family: ${config.FONT_FAMILY};
  display: block;
  text-align: ${config.ALIGN};
  margin: 4px 0;
}`

    const fenceCSS = `
#write .md-fences { margin-bottom: 2.4em }
#write .md-fences::after {
  ${css["fence"]}
  position: absolute; width: 100%; text-align: ${config.ALIGN};
  font-family: ${config.FONT_FAMILY}; margin: 0.6em 0;
  font-size: 1.1em; z-index: 9;
}
#write .md-fences.md-fences-advanced.md-focus::after { content: "" }`

    const imageSelector = (inExport && utils.supportHasSelector) ? "#write p:has(img:first-child)::after" : "#write .md-image::after"
    const imageCSS = `
${imageSelector} {
  ${css["image"]}
  font-family: ${config.FONT_FAMILY}; display: block;
  text-align: ${config.ALIGN}; margin: 4px 0;
}`

    return [
      baseCSS,
      config.ENABLE_CONTENT ? contentCSS : "",
      config.ENABLE_OUTLINE ? outlineCSS : "",
      config.ENABLE_TOC ? tocCSS : "",
      config.ENABLE_TABLE ? tableCSS : "",
      config.ENABLE_FENCE ? fenceCSS : "",
      config.ENABLE_IMAGE ? imageCSS : "",
    ].filter(Boolean).join("\n")
  }

  return { generate }
}

class AutoNumberPlugin extends BasePlugin {
  SEPARATOR = "@"
  styleRenderer = buildStyleRenderer({ utils: this.utils, config: this.config })

  style = () => this.styleRenderer.generate()

  process = () => {
    this.utils.settings.autoSave(this)
    if (this.config.ENABLE_WHEN_EXPORT) {
      this._fixExportToPDF()
    }
    this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileEdited, () => {
      if (!this.config.ENABLE_IMAGE || !this.config.SHOW_IMAGE_NAME) return
      const images = this.utils.entities.querySelectorAllInWrite(".md-image:not([data-alt]) > img")
      for (const image of images) {
        image.parentElement.dataset.alt = image.getAttribute("alt")
      }
    })
  }

  getDynamicActions = () => {
    const TOGGLE_CONFIGS = ["ENABLE_OUTLINE", "ENABLE_CONTENT", "ENABLE_TOC", "ENABLE_TABLE", "ENABLE_IMAGE", "ENABLE_FENCE"]
    const toggles = TOGGLE_CONFIGS.map(key => ({
      act_name: this.i18n.t(`$label.${key}`),
      act_value: `toggle_config${this.SEPARATOR}${key}`,
      act_state: this.config[key],
    }))
    const layouts = this.config.LAYOUTS.map(lo => ({
      act_name: lo.name,
      act_value: `set_layout${this.SEPARATOR}${lo.name}`,
      act_state: lo.selected,
    }))
    return [...toggles, ...layouts]
  }

  call = action => {
    const [actionType, payload] = action.split(this.SEPARATOR, 2)
    if (actionType === "toggle_config") {
      this.config[payload] = !this.config[payload]
    } else if (actionType === "set_layout") {
      // trigger save settings by reassigning the array
      this.config.LAYOUTS = this.config.LAYOUTS.map(lo => {
        lo.selected = lo.name === payload
        return lo
      })
    }
    this.utils.replaceStyle(this.fixedName, this.styleRenderer.generate())
  }

  // Adds CSS on export and resolves the issue of missing numbering in the PDF export table of contents.
  _fixExportToPDF = () => {
    const fn = this.utils.safeEval(this.config.APPLY_EXPORT_HEADER_NUMBERING)
    const applyHeaderNumbering = (typeof fn === "function")
      ? fn
      : (headers) => {
        const counters = Array(7).fill(0)
        headers.forEach(header => {
          const [level, text, ...rest] = header
          counters[level]++
          counters.fill(0, level + 1)
          const counter = counters.slice(2, level + 1).join(".")
          const numbering = counter ? `${counter}. ` : ""
          header[1] = numbering + text
        })
      }

    let inExport = false
    this.utils.exportHelper.register(this.fixedName, () => {
      inExport = true
      return `body {font-variant-ligatures: no-common-ligatures;} ` + this.styleRenderer.generate(true)
    })
    this.utils.decorator.afterCall(() => File?.editor?.library?.outline, "getHeaderMatrix", headers => {
      if (inExport) {
        inExport = false
        applyHeaderNumbering(headers)
      }
    })
  }
}

module.exports = {
  plugin: AutoNumberPlugin,
}
