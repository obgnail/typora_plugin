class KanbanPlugin extends BaseCustomPlugin {
    styleTemplate = () => ({
        maxHeight: (this.config.KANBAN_MAX_HEIGHT < 0) ? "initial" : this.config.KANBAN_MAX_HEIGHT + "px",
        taskDescMaxHeight: (this.config.KANBAN_TASK_DESC_MAX_HEIGHT < 0) ? "initial" : this.config.KANBAN_TASK_DESC_MAX_HEIGHT + "em",
        kanbanWidth: this.config.KANBAN_WIDTH + "px",
        wrap: this.config.WRAP ? "wrap" : "initial",
    })

    init = () => {
        this.STRICT_MODE_STR = "use strict"
        this.fenceStrictMode = false  // Is a single fence using strict mode
    }

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

        if (this.config.CTRL_WHEEL_TO_SWITCH) {
            this.utils.entities.eWrite.addEventListener("wheel", ev => {
                if (!this.utils.metaKeyPressed(ev)) return
                const target = ev.target.closest(".plugin-kanban-content")
                if (target) target.scrollLeft += ev.deltaY * 0.5
            })
        }
    }

    getStyleContent = () => this.utils.styleTemplater.getStyleContent(this.fixedName)

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    render = (cid, content, $pre) => {
        const el = this._toElement($pre, cid, content)
        if (el) $pre.find(".md-diagram-panel-preview").html(el)
    }

    _assertOK = (must, errorLineNum, reason) => {
        if (this.config.STRICT_MODE || this.fenceStrictMode) {
            this.utils.diagramParser.assertOK(must, errorLineNum, this.i18n.t(reason))
        }
    }

    _toElement = (pre, cid, content) => {
        const dir = this.utils.getLocalRootUrl()
        const ITEM_REGEX = /^[\-*]\s(?<title>.*?)(\((?<desc>.*?)\))?$/

        this.fenceStrictMode = false
        let firstLineNum = -1
        const data = { title: "", columns: [] }
        const lines = content.split("\n")
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            if (!line) continue

            const lineNum = i + 1
            if (firstLineNum === -1) firstLineNum = lineNum

            if (line === this.STRICT_MODE_STR) {
                this.fenceStrictMode = true
                this._assertOK(lineNum === firstLineNum, lineNum, "error.useStrictMustFirstLine")
                continue
            }
            if (line.startsWith("# ")) {
                this._assertOK(data.title === "", lineNum, "error.multiTitles")
                this._assertOK(data.columns.length === 0, lineNum, "error.bodyComeBeforeTitle")
                data.title = line.slice(2).trim()
                continue
            }
            if (line.startsWith("## ")) {
                data.columns.push({ name: line.slice(3).trim(), items: [] })
                continue
            }
            const match = line.match(ITEM_REGEX)
            if (match) {
                const { title, desc: rawDesc = "" } = match.groups
                this._assertOK(title, lineNum, "error.taskTitleNonExist")
                this._assertOK(data.columns.length > 0, lineNum, "error.taskComeBeforeKanban")
                let desc = rawDesc.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t")
                if (this.config.ALLOW_MARKDOWN_INLINE_STYLE && desc) {
                    desc = this.utils.markdownInlineStyleToHTML(desc, dir)
                }
                data.columns.at(-1).items.push({ title, desc })
            } else {
                this._assertOK(false, lineNum, "error.syntaxError")
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
                const descStyle = showDesc ? "" : 'style="display: none"'
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
    plugin: KanbanPlugin
}
