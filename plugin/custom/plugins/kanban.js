class kanbanPlugin extends BaseCustomPlugin {
    styleTemplate = () => ({
        maxHeight: (this.config.KANBAN_MAX_HEIGHT < 0) ? "initial" : this.config.KANBAN_MAX_HEIGHT + "px",
        taskDescMaxHeight: (this.config.KANBAN_TASK_DESC_MAX_HEIGHT < 0) ? "initial" : this.config.KANBAN_TASK_DESC_MAX_HEIGHT + "em",
        kanbanWidth: this.config.KANBAN_WIDTH + "px",
        wrap: this.config.WRAP ? "wrap" : "initial",
    })

    init = () => {
        this.fenceStrictMode = false; // Whether a single fence uses strict mode.
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
        });

        if (this.config.CTRL_WHEEL_TO_SCROLL) {
            const that = this;
            this.utils.entities.$eWrite.on("wheel", ".plugin-kanban-content", function (ev) {
                if (that.utils.metaKeyPressed(ev.originalEvent)) {
                    this.scrollLeft += ev.originalEvent.deltaY * 0.3;
                }
            })
        }
    }

    getStyleContent = () => this.utils.styleTemplater.getStyleContent(this.fixedName)

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    render = (cid, content, $pre) => {
        let kanban = $pre.find(".plugin-kanban");
        if (kanban.length === 0) {
            kanban = $(`<div class="plugin-kanban"><div class="plugin-kanban-title"></div><div class="plugin-kanban-content"></div></div>`);
        }
        const kanban_ = this.newKanbanElement($pre, cid, content);
        if (kanban_) {
            kanban.find(".plugin-kanban-title").text(kanban_.title);
            kanban.find(".plugin-kanban-content").html(kanban_.list);
            $pre.find(".md-diagram-panel-preview").html(kanban);
        } else {
            // accident occurred
            this.throwParseError(null, this.i18n.t("error.unknown"))
        }
    }

    throwParseError = (errorLine, reason) => (this.config.STRICT_MODE || this.fenceStrictMode) && this.utils.diagramParser.throwParseError(errorLine, reason)

    // type: TASK_COLOR/KANBAN_COLOR
    getColor = (type, idx) => {
        idx %= this.config[type].length;
        return this.config[type][idx]
    }

    newKanbanElement = (pre, cid, content) => {
        const useStrict = "use strict";
        const dir = this.utils.getCurrentDirPath();

        let firstLine = 0
        const setFirstLine = this.utils.once(idx => firstLine = idx);
        this.fenceStrictMode = false;

        const kanban = { title: "", list: [] };
        const lines = content.split("\n").map(line => line.trim());
        lines.forEach((line, idx) => {
            if (!line) return;

            idx += 1;
            setFirstLine(idx);
            if (line.startsWith("# ")) {
                if (!kanban.title) {
                    if (kanban.list.length !== 0) {
                        this.throwParseError(idx, this.i18n.t("error.bodyComeBeforeTitle"))
                    }
                } else {
                    this.throwParseError(idx, this.i18n.t("error.multiTitles"))
                }
                kanban.title = line.replace("# ", "");
            } else if (line.startsWith("## ")) {
                const name = line.replace("## ", "");
                kanban.list.push({ name: name, item: [] });
            } else if (line === useStrict) {
                const strictLine = lines.indexOf(useStrict);
                if (strictLine !== -1) {
                    this.fenceStrictMode = true;
                    if (strictLine + 1 !== firstLine) {
                        this.throwParseError(idx, this.i18n.t("error.useStrictMustFirstLine"))
                    }
                } else {
                    this.throwParseError(idx, this.i18n.t("error.unknown"))
                }
            } else {
                const match = line.match(/^[\-*]\s(?<title>.*?)(\((?<desc>.*?)\))?$/);
                if (!match) {
                    this.throwParseError(idx, this.i18n.t("error.syntaxError"))
                } else {
                    const title = match.groups.title;
                    if (title) {
                        if (kanban.list.length === 0) {
                            this.throwParseError(idx, this.i18n.t("error.taskComeBeforeKanban"))
                        } else {
                            const last = kanban.list[kanban.list.length - 1];
                            let desc = (match.groups.desc || "")
                                .replace(/\\n/g, "\n")
                                .replace(/\\r/g, "\r")
                                .replace(/\\t/g, "\t");
                            if (this.config.ALLOW_MARKDOWN_INLINE_STYLE) {
                                desc = this.utils.markdownInlineStyleToHTML(desc, dir);
                            }
                            last && last.item.push({ title, desc });
                        }
                    } else {
                        this.throwParseError(idx, this.i18n.t("error.taskTitleNonExist"))
                    }
                }
            }
        })

        kanban.list = kanban.list.map((col, listIdx) => {
            const taskColor = this.getColor("TASK_COLOR", listIdx);
            const kanbanColor = this.getColor("KANBAN_COLOR", listIdx);
            const items = col.item.map(({ title, desc }) => `
                <div class="plugin-kanban-col-item kanban-item-box" style="background-color: ${taskColor}">
                    <div class="plugin-kanban-col-item-title no-wrap-title"><b>${title}</b></div>
                    <div class="plugin-kanban-col-item-desc" ${(!desc && this.config.HIDE_DESC_WHEN_EMPTY) ? 'style="display: none;"' : ""}>${desc}</div>
                </div>`);
            return $(
                `<div class="plugin-kanban-col kanban-box" style="background-color: ${kanbanColor}">
                    <div class="plugin-kanban-col-name no-wrap-title">${col.name}</div><p></p>
                    <div class="plugin-kanban-col-item-list">${items.join("")}</div>
                </div>`)
        })
        return kanban
    }
}

module.exports = {
    plugin: kanbanPlugin
}
