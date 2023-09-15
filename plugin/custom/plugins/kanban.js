class kanbanPlugin extends BaseCustomPlugin {
    selector = () => ""

    style = () => {
        const maxHeight = (this.config.KANBAN_MAX_HEIGHT < 0) ? "" : `max-height: ${this.config.KANBAN_MAX_HEIGHT}px;`;
        return `
            .plugin-kanban {
                font-family: sans-serif;
            }

            .plugin-kanban .plugin-kanban-title {
                font-size: 1.5rem;
                font-weight: bold;
            }
            
            .plugin-kanban .plugin-kanban-content {
                display: flex;
                overflow-x: auto;
            }
            
            .plugin-kanban-content .no-wrap-title {
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                text-align: left;
                padding-left: 4px;
            }
            
            .plugin-kanban-content .kanban-box {
                border-radius: 4px;
                box-shadow: 0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12);
            }
            
            .plugin-kanban-content .kanban-item-box {
                border-radius: 4px;
                box-shadow: 0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 3px 0px rgba(0,0,0,0.12);
            } 
            
            .plugin-kanban-content .plugin-kanban-col {
                width: 250px !important;
                margin: 8px;
            }
            
            .plugin-kanban-col p {
                margin: 4px;
            }
                        
            .plugin-kanban-content .plugin-kanban-col-item-list {
                display: flex;
                flex-direction: column;
                ${maxHeight}
                overflow-y: overlay;
                padding: 0 4px 4px 4px;
            }
            
            .plugin-kanban-content .plugin-kanban-col-name {
                font-size: 1rem;
                font-weight: bold;
                border-color: rgba(0, 0, 0, 0.08);
                border-bottom-style: solid;
                border-width: 1px;
                padding: 8px 8px 4px 10px;
            }

            .plugin-kanban-content .plugin-kanban-col-item {
                margin: 4px;
                padding: 8px;
            }
            
            .plugin-kanban-content .plugin-kanban-col-item-desc {
                overflow: hidden;
                margin-top: 5px;
                height: 5rem;
                padding-left: 4px;
                text-align: left;
                white-space: break-spaces;
                word-wrap: break-word;
            }
        `
    }

    init = () => {
        this.fenceStrictMode = false; // 单个fence是否使用严格模式
    }

    process = () => {
        this.utils.registerDiagramParser("kanban", this.render);

        if (this.config.CTRL_WHEEL_TO_SCROLL) {
            const that = this;
            $("#write").on("wheel", ".plugin-kanban-content", function (ev) {
                if (that.utils.metaKeyPressed(ev.originalEvent)) {
                    this.scrollLeft += ev.originalEvent.deltaY;
                }
            })
        }
    }

    callback = anchorNode => this.utils.insertFence(anchorNode, this.config.TEMPLATE)

    render = (cid, lang, content, $pre) => {
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
            this.utils.throwParseError("null", "未知错误！请联系开发者");
        }
    }

    throwParseError = (errorLine, reason) => (this.config.STRICT_MODE || this.fenceStrictMode) && this.utils.throwParseError(errorLine, reason)

    // type: TASK_COLOR/KANBAN_COLOR
    getColor = (type, idx) => {
        idx %= this.config[type].length;
        return this.config[type][idx]
    }

    newKanbanElement = (pre, cid, content) => {
        this.fenceStrictMode = false;

        let firstLine = 0
        const setFirstLine = this.utils.once(idx => firstLine = idx);

        const kanban = {title: "", list: []};
        const lines = content.split("\n").map(line => line.trim());
        lines.forEach((line, idx) => {
            if (!line) return;

            idx += 1;
            setFirstLine(idx);
            if (line.startsWith("# ")) {
                if (!kanban.title) {
                    if (kanban.list.length !== 0) {
                        this.throwParseError(idx, "【看板标题】必须先于【看板】");
                    }
                } else {
                    this.throwParseError(idx, "存在两个【看板标题】");
                }
                kanban.title = line.replace("# ", "");
            } else if (line.startsWith("## ")) {
                const name = line.replace("## ", "");
                kanban.list.push({name: name, item: []});
            } else if (line === "use strict") {
                const strictLine = lines.indexOf("use strict");
                if (strictLine !== -1) {
                    this.fenceStrictMode = true;
                    if (strictLine + 1 !== firstLine) {
                        this.throwParseError(idx, "use strict 必须位于首行");
                    }
                } else {
                    this.utils.throwParseError(idx, "未知错误！请联系开发者");
                }
            } else {
                const match = line.match(/^[\-*]\s(?<title>.*?)(\((?<desc>.*?)\))?$/);
                if (!match) {
                    this.throwParseError(idx, "无法匹配语法");
                } else {
                    const title = match.groups.title;
                    if (title) {
                        if (kanban.list.length === 0) {
                            this.throwParseError(idx, "【任务】不能先于【看板】出现");
                        } else {
                            const last = kanban.list[kanban.list.length - 1];
                            const desc = (match.groups.desc || "").replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
                            last && last.item.push({title, desc});
                        }
                    } else {
                        this.throwParseError(idx, "【任务】标题不存在");
                    }
                }
            }
        })

        kanban.list = kanban.list.map((col, listIdx) => {
            const items = col.item.map(item => `
                <div class="plugin-kanban-col-item kanban-item-box" style="background-color: ${this.getColor("TASK_COLOR", listIdx)}">
                    <div class="plugin-kanban-col-item-title no-wrap-title"><b>${item.title}</b></div>
                    <div class="plugin-kanban-col-item-desc" ${(!item.desc && this.config.HIDE_DESC_WHEN_EMPTY) ? 'style="display: none;"' : ""}>${item.desc}</div>
                </div>`);

            return $(
                `<div class="plugin-kanban-col kanban-box" style="background-color: ${this.getColor("KANBAN_COLOR", listIdx)}">
                    <div class="plugin-kanban-col-name no-wrap-title">${col.name}</div><p></p>
                    <div class="plugin-kanban-col-item-list">${items.join("")}</div>
                </div>`)
        })
        return kanban
    }
}

module.exports = {
    plugin: kanbanPlugin
};