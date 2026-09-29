class KanbanPlugin extends BasePlugin {
  STRICT_MODE_STR = "use strict"
  fenceStrictMode = false  // Is a single fence using strict mode
  md = this.utils.getDefaultRenderer()

  style = () => ({
    maxHeight: (this.config.KANBAN_MAX_HEIGHT < 0) ? "initial" : this.config.KANBAN_MAX_HEIGHT + "px",
    taskDescMaxHeight: (this.config.KANBAN_TASK_DESC_MAX_HEIGHT < 0) ? "initial" : this.config.KANBAN_TASK_DESC_MAX_HEIGHT + "em",
    kanbanWidth: this.config.KANBAN_WIDTH + "px",
    wrap: this.config.WRAP ? "wrap" : "initial",
  })

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  process = () => {
    this.utils.diagramParser.register({
      lang: this.config.LANGUAGE,
      mappingLang: "markdown",
      destroyWhenUpdate: false,
      renderFunc: this.render,
      cancelFunc: null,
      destroyAllFunc: null,
      exportStyleGetter: this.getStyleContent,
      interactiveMode: this.config.INTERACTIVE_MODE,
    })
  }

  getStyleContent = () => this.utils.getStyleText(this.fixedName)

  call = () => this.utils.insertBlockCode(null, this.config.LANGUAGE, this.config.TEMPLATE)

  render = (cid, content, $pre) => {
    const el = this._toElement($pre, cid, content)
    if (el) $pre.find(".md-diagram-panel-preview").html(el)
  }

  _assertOK = (must, errorLineNum, reason) => {
    if (this.config.STRICT_MODE || this.fenceStrictMode) {
      this.utils.diagramParser.assertOK(must, errorLineNum, this.i18n.t(reason))
    }
  }

  _extractStrictMode = (content) => {
    this.fenceStrictMode = false
    const lines = content.split("\n")
    const strictIdx = lines.findIndex(l => l.trim() === this.STRICT_MODE_STR)
    if (strictIdx === -1) return content

    this.fenceStrictMode = true
    const lineNum = strictIdx + 1
    const firstNonEmptyLineNum = lines.findIndex(l => l.trim() !== "") + 1
    this._assertOK(lineNum === firstNonEmptyLineNum, lineNum, "error.useStrictMustFirstLine")
    lines[strictIdx] = ""
    return lines.join("\n")
  }

  _toElement = (pre, cid, content) => {
    content = this._extractStrictMode(content)

    const ITEM_REGEX = /^(?<title>.*?)(\((?<desc>.*?)\))?$/

    const env = {}
    const tokens = this.md.parse(content, env)
    const data = { title: "", columns: [] }

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      const lineNum = token.map ? token.map[0] + 1 : 1

      if (token.type === "heading_open" && token.tag === "h1") {
        this._assertOK(data.title === "", lineNum, "error.multiTitles")
        this._assertOK(data.columns.length === 0, lineNum, "error.bodyComeBeforeTitle")
        data.title = tokens[i + 1].content.trim()
        i += 2
        continue
      }
      if (token.type === "heading_open" && token.tag === "h2") {
        data.columns.push({ name: tokens[i + 1].content.trim(), items: [] })
        i += 2
        continue
      }
      if (token.type === "inline") {
        const inListItem = tokens[i - 1]?.type === "paragraph_open" && tokens[i - 2]?.type === "list_item_open"
        if (!inListItem) {
          this._assertOK(false, lineNum, "error.syntaxError")
          continue
        }
        const match = token.content.trim().match(ITEM_REGEX)
        if (!match) {
          this._assertOK(false, lineNum, "error.syntaxError")
          continue
        }
        const { title, desc: rawDesc = "" } = match.groups
        this._assertOK(title, lineNum, "error.taskTitleNonExist")
        this._assertOK(data.columns.length > 0, lineNum, "error.taskComeBeforeKanban")

        let desc = rawDesc.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t")
        if (this.config.ALLOW_MARKDOWN_INLINE_STYLE && desc) {
          desc = this.md.renderInline(desc)
        }
        data.columns.at(-1).items.push({ title, desc })
      }
    }

    return this._renderKanbanHtml(data)
  }

  _renderKanbanHtml = (data) => {
    const columnsHtml = data.columns.map((col, idx) => {
      const taskColor = this._getColor("TASK_COLOR", idx)
      const kanbanColor = this._getColor("KANBAN_COLOR", idx)
      const itemsHtml = col.items.map(({ title, desc }) => {
        const showDesc = desc || !this.config.HIDE_DESC_WHEN_EMPTY
        const descStyle = showDesc ? "" : `style="display: none"`
        return `
          <div class="plugin-kanban-col-item kanban-item-box" style="background-color: ${taskColor}">
            <div class="plugin-kanban-col-item-title no-wrap-title"><b>${this.utils.escape(title)}</b></div>
            <div class="plugin-kanban-col-item-desc" ${descStyle}>${desc}</div>
          </div>`
      }).join("")

      return `
        <div class="plugin-kanban-col kanban-box" style="background-color: ${kanbanColor}">
          <div class="plugin-kanban-col-name no-wrap-title">${this.utils.escape(col.name)}</div><p></p>
          <div class="plugin-kanban-col-item-list">${itemsHtml}</div>
        </div>`
    }).join("")

    const titleHtml = `<div class="plugin-kanban-title">${this.utils.escape(data.title)}</div>`
    const contentHtml = `<div class="plugin-kanban-content">${columnsHtml}</div>`
    return `<div class="plugin-kanban">${titleHtml}${contentHtml}</div>`
  }

  // type: TASK_COLOR/KANBAN_COLOR
  _getColor = (type, idx) => {
    idx %= this.config[type].length
    return this.config[type][idx]
  }
}

module.exports = {
  plugin: KanbanPlugin,
}
