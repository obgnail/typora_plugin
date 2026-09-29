class TimelinePlugin extends BasePlugin {
  md = this.utils.getDefaultRenderer()

  style = () => true

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

  call = () => this.utils.insertBlockCode(null, this.config.LANGUAGE, this.config.TEMPLATE)

  getStyleContent = () => this.utils.getStyleText(this.fixedName)

  render = (cid, content, $pre) => {
    const el = this._toElement($pre, cid, content)
    if (el) $pre.find(".md-diagram-panel-preview").html(el)
  }

  _assertOK = (must, errorLineNum, reason) => this.utils.diagramParser.assertOK(must, errorLineNum, this.i18n.t(reason))

  _toElement = (pre, cid, content) => {
    const env = {}
    const tokens = this.md.parse(content, env)

    const data = { title: "", buckets: [], env }
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      const lineNum = token.map ? token.map[0] + 1 : 1

      if (token.type === "heading_open" && token.tag === "h1") {
        this._assertOK(data.title === "", lineNum, "error.multiTitles")
        this._assertOK(data.buckets.length === 0, lineNum, "error.bodyComeBeforeTitle")
        data.title = tokens[i + 1]
        i += 2
        continue
      }
      if (token.type === "heading_open" && token.tag === "h2") {
        data.buckets.push({ time: tokens[i + 1], tokens: [] })
        i += 2
        continue
      }
      this._assertOK(data.buckets.length > 0, lineNum, "error.bodyComeBeforeTime")
      data.buckets.at(-1).tokens.push(token)
    }

    return this._renderTimelineHtml(data)
  }

  _renderTimelineHtml = (data) => {
    const inline = t => this.md.renderer.renderInline(t.children, this.md.options, data.env)
    const bucketsHtml = data.buckets.map(bucket => {
      const itemsHtml = this.md.renderer.render(bucket.tokens, this.md.options, data.env)
      return `
        <div class="timeline-line"><div class="timeline-circle"></div></div>
        <div class="timeline-wrapper">
          <div class="timeline-time">${inline(bucket.time)}</div>
          <div class="timeline-event">${itemsHtml}</div>
        </div>`
    }).join("")

    const titleHtml = `<div class="timeline-title">${this.utils.escape(data.title?.content ?? "")}</div>`
    const contentHtml = `<div class="timeline-content">${bucketsHtml}</div>`
    return `<div class="plugin-timeline">${titleHtml}${contentHtml}</div>`
  }
}

module.exports = {
  plugin: TimelinePlugin,
}
