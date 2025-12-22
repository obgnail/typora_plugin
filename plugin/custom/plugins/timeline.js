class TimelinePlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    process = () => {
        this.utils.diagramParser.register({
            lang: this.config.LANGUAGE,
            mappingLang: "markdown",
            destroyWhenUpdate: false,
            renderFunc: this.render,
            cancelFunc: null,
            destroyAllFunc: null,
            extraStyleGetter: this.getStyleContent,
            interactiveMode: this.config.INTERACTIVE_MODE
        })
    }

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    getStyleContent = () => this.utils.styleTemplater.getStyleContent(this.fixedName)

    render = (cid, content, $pre) => {
        const el = this._toElement($pre, cid, content)
        if (el) $pre.find(".md-diagram-panel-preview").html(el)
    }

    _assertOK = (must, errorLineNum, reason) => this.utils.diagramParser.assertOK(must, errorLineNum, this.i18n.t(reason))

    _toElement = (pre, cid, content) => {
        const dir = this.utils.getLocalRootUrl()
        const REGEX = {
            HEADING: /^(?<level>#{3,6})\s(?<text>.+?)$/,
            TASK: /^(\s*)(([-+*])\s*)\[(?<checked>(x|X)| )\]\s+(?<text>.*)/,
            UL: /^[\-*]\s(?<text>.*?)$/,
            OL: /^\d\.\s(?<text>.*?)$/,
            QUOTE: /^>\s(?<text>.+?)$/,
            HR: /^(\*\*\*|---)$/
        }

        const data = { title: "", buckets: [] }
        const lines = content.split("\n")

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            if (!line) continue

            const lineNum = i + 1
            if (line.startsWith("# ")) {
                this._assertOK(data.title === "", lineNum, "error.multiTitles")
                this._assertOK(data.buckets.length === 0, lineNum, "error.bodyComeBeforeTitle")
                data.title = line.slice(2).trim()
                continue
            }
            if (line.startsWith("## ")) {
                data.buckets.push({ time: line.slice(3).trim(), items: [] })
                continue
            }
            this._assertOK(data.buckets.length > 0, "error.bodyComeBeforeTime")

            const currentItems = data.buckets.at(-1).items
            const lastItem = currentItems.at(-1)
            switch (true) {
                case REGEX.HR.test(line):
                    currentItems.push({ type: "hr" })
                    break
                case REGEX.HEADING.test(line): {
                    const { level, text } = line.match(REGEX.HEADING).groups
                    currentItems.push({ type: "h" + level.length, value: text })
                    break
                }
                case REGEX.TASK.test(line): {
                    const { checked, text } = line.match(REGEX.TASK).groups
                    currentItems.push({ type: "taskList", checked: !!checked.trim(), value: text })
                    break
                }
                case REGEX.UL.test(line): {
                    const { text } = line.match(REGEX.UL).groups
                    if (lastItem && lastItem.type === "ul") {
                        lastItem.list.push(text)
                    } else {
                        currentItems.push({ type: "ul", list: [text] })
                    }
                    break
                }
                case REGEX.OL.test(line): {
                    const { text } = line.match(REGEX.OL).groups
                    if (lastItem && lastItem.type === "ol") {
                        lastItem.list.push(text)
                    } else {
                        currentItems.push({ type: "ol", list: [text] })
                    }
                    break
                }
                case REGEX.QUOTE.test(line): {
                    const { text } = line.match(REGEX.QUOTE).groups
                    currentItems.push({ type: "blockquote", value: text })
                    break
                }
                default:
                    currentItems.push({ type: "p", value: line })
            }
        }

        return this._renderTimelineHtml(data, dir)
    }

    _renderTimelineHtml = (data, dir) => {
        const fmt = (str) => this.utils.markdownInlineStyleToHTML(str, dir)
        const bucketsHtml = data.buckets.map(bucket => {
            const itemsHtml = bucket.items.map(item => {
                switch (item.type) {
                    case "h3":
                    case "h4":
                    case "h5":
                    case "h6":
                    case "p":
                    case "blockquote":
                        return `<${item.type}>${fmt(item.value)}</${item.type}>`
                    case "hr":
                        return `<hr>`
                    case "taskList":
                        const checkedAttr = item.checked ? "checked" : ""
                        return `<p class="timeline-task-list">
                                    <input type="checkbox" ${checkedAttr} disabled>
                                    <span>${fmt(item.value)}</span>
                                </p>`
                    case "ul":
                    case "ol":
                        const listItems = item.list.map(li => `<li>${fmt(li)}</li>`).join("")
                        return `<${item.type}>${listItems}</${item.type}>`
                    default:
                        return ""
                }
            }).join("")

            return `
                <div class="timeline-line"><div class="timeline-circle"></div></div>
                <div class="timeline-wrapper">
                    <div class="timeline-time">${bucket.time}</div>
                    <div class="timeline-event">${itemsHtml}</div>
                </div>`
        }).join("")

        const titleHtml = `<div class="timeline-title">${this.utils.escape(data.title)}</div>`
        const contentHtml = `<div class="timeline-content">${bucketsHtml}</div>`
        return `<div class="plugin-timeline">${titleHtml}${contentHtml}</div>`
    }
}

module.exports = {
    plugin: TimelinePlugin
}
