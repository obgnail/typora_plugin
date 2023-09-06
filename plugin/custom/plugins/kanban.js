class kanbanPlugin extends BaseCustomPlugin {
    selector = () => {
        if (!this.utils.isBetaVersion) {
            return `#write > p[mdtype="paragraph"]:not(:has(>span))`
        }
    }

    style = () => {
        const maxHeight = (this.config.KANBAN_MAX_HEIGHT < 0) ? "" : `max-height: ${this.config.KANBAN_MAX_HEIGHT}px;`;
        let text = `
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
        if (this.utils.isBetaVersion) {
            text = `.plugin-kanban { font-family: sans-serif; } ${text} .md-fences-advanced:not(.md-focus) .CodeMirror { display: none; }`
        }
        return text
    }

    init = () => {
        this.badChars = ["%E2%80%8B", "%C2%A0", "%0A"];
        this.replaceChars = ["", "%20", ""];
    }

    process = () => {
        this.utils.decorateAddCodeBlock(null, (result, ...args) => File.editor.diagrams.updateDiagram(args[0]))
        this.utils.decorate(
            () => (File && File.editor && File.editor.fences && File.editor.fences.tryAddLangUndo),
            "File.editor.fences.tryAddLangUndo",
            null,
            (result, ...args) => File.editor.diagrams.updateDiagram(args[0].cid)
        )
        this.utils.decorate(
            // black magic
            () => (File && File.editor && File.editor.diagrams && File.editor.diagrams.constructor && File.editor.diagrams.constructor.isDiagramType),
            "File.editor.diagrams.constructor.isDiagramType",
            null,
            (result, ...args) => {
                if (result === true) return true;
                try {
                    const lang = args[0];
                    const type = typeof lang;
                    if (type === "string") {
                        return lang.toLowerCase() === "kanban"
                    } else if (type === "object" && lang["name"]) {
                        return lang["name"].toLowerCase() === "kanban"
                    }
                } catch (e) {
                    console.error(e)
                }
                return result
            },
            true
        )
        this.utils.decorate(
            () => (File && File.editor && File.editor.diagrams && File.editor.diagrams.updateDiagram),
            "File.editor.diagrams.updateDiagram",
            null,
            async (result, ...args) => {
                const cid = args[0];
                cid && this.newKanban(cid);
            }
        )

        const that = this;
        $("#write").on("wheel", ".plugin-kanban-content", function (ev) {
            if (that.utils.metaKeyPressed(ev.originalEvent)) {
                this.scrollLeft += ev.originalEvent.deltaY;
            }
        })
    }

    callback = anchorNode => {
        const content = this.config.TEMPLATE;
        navigator.clipboard.writeText(content).then(() => {
            const ele = document.querySelector("#context-menu [data-key='paste']");
            ele && ele.click();
        });
    }

    rollback = pre => {
        pre.children(".plugin-kanban").remove();
        pre.children(".fence-enhance").show();
        if (this.utils.isBetaVersion) {
            pre.removeClass("md-fences-advanced");
        }
    }

    newKanban = cid => {
        const pre = File.editor.findElemById(cid);
        const lang = pre.attr("lang").trim().toLowerCase();
        if (lang !== "kanban") {
            this.rollback(pre);
            return;
        }

        pre.children(".fence-enhance").hide();
        pre.addClass("md-fences-advanced");

        let kanban = pre.find(".plugin-kanban");
        if (kanban.length === 0) {
            kanban = $(`<div class="plugin-kanban"><div class="plugin-kanban-title"></div><div class="plugin-kanban-content"></div></div>`);
            const preview = pre.find(".md-diagram-panel-preview");
            preview.length && preview.append(kanban);
        }
        const kanban_ = this.newKanbanElement(pre, cid);
        if (kanban_) {
            kanban.find(".plugin-kanban-title").text(kanban_.title);
            kanban.find(".plugin-kanban-content").html(kanban_.list);
        } else {
            // accident occurred
            this.rollback(pre);
        }
    }

    // TASK_COLOR or KANBAN_COLOR
    getColor = (type, idx) => {
        idx %= this.config[type].length;
        return this.config[type][idx]
    }

    newKanbanElement = (pre, cid) => {
        let content = this.getFenceContentFromElement(pre[0]);
        if (!content) {
            content = this.getFenceContentFromQueue(cid);
            if (!content) return;
        }

        const kanban = {title: "", list: []};
        const lines = content.split("\n").map(line => line.trim()).filter(Boolean);
        lines.forEach(line => {
            if (line.startsWith("# ")) {
                kanban.title = line.replace("# ", "");
            } else if (line.startsWith("## ")) {
                const name = line.replace("## ", "");
                kanban.list.push({name: name, item: []});
            } else {
                const match = line.match(/^[\-\*]\s(?<title>.*?)(\((?<desc>.*?)\))?$/);
                if (!match) return;
                const title = match.groups.title;
                if (title) {
                    const last = kanban.list[kanban.list.length - 1];
                    const desc = (match.groups.desc || "").replace(/\\n/g, "\n");
                    last && last.item.push({title, desc});
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

    getFenceContentFromElement = pre => {
        const lines = pre.querySelectorAll(".CodeMirror-code .CodeMirror-line");
        if (lines.length === 0) return;

        const contentList = [];
        lines.forEach(line => {
            let encodeText = encodeURI(line.textContent);
            for (let i = 0; i < this.badChars.length; i++) {
                if (encodeText.indexOf(this.badChars[i]) !== -1) {
                    encodeText = encodeText.replace(new RegExp(this.badChars[i], "g"), this.replaceChars[i]);
                }
            }
            const decodeText = decodeURI(encodeText);
            contentList.push(decodeText);
        })
        return contentList.join("\n")
    }

    getFenceContentFromQueue = cid => {
        const fence = File.editor.fences.queue[cid];
        if (fence) {
            return fence.options.value
        }
    }
}

module.exports = {
    plugin: kanbanPlugin
};