class kanbanPlugin extends global._basePlugin {
    style = () => {
        const text = `
            #write .plugin-kanban {
                display: flex;
                justify-content: flex-start;
                
                width: 100%;
                margin-top: 10px;
                text-align: center;
                padding-top: 0;
                padding-bottom: 8px;
                overflow-x: auto;
            }
            
            .plugin-kanban .no-wrap {
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                text-align: left;
                padding-left: 3px;
            }
            
            .plugin-kanban .kanban-box {
                border-radius: 4px;
                box-shadow: 0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12);
            }
            
            .plugin-kanban .kanban-item-box {
                border-radius: 4px;
                box-shadow: 0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 3px 0px rgba(0,0,0,0.12);
            } 
            
            .plugin-kanban .plugin-kanban-col {
                width: 250px;
                margin: 8px;
                padding: 8px;
            }
            
            .plugin-kanban-col p {
                margin: 5px;
            }
                        
            .plugin-kanban .plugin-kanban-col-item-list {
                display: flex;
                flex-direction: column;
                font-family: 'Nunito', sans-serif;
            }
            
            .plugin-kanban .plugin-kanban-col-name {
                font-family: 'Nunito', sans-serif;
                font-size: 1rem;
                font-weight: bold;
                border-color: rgba(0, 0, 0, 0.08);
                border-bottom-style: solid;
                border-width: 1px;
                padding-bottom: 4px;
            }

            .plugin-kanban .plugin-kanban-col-item {
                margin: 5px 8px;
                padding: 8px;
            }
            
            .plugin-kanban .plugin-kanban-col-item-title {
                margin-bottom: 5px;
            }
            
            .plugin-kanban .plugin-kanban-col-item-desc {
                overflow: hidden;
                height: 5rem;
                padding-left: 5px;
                text-align: left;
            }
        `
        return {textID: "plugin-kanban-style", text: text}
    }

    init = () => {
        this.badChars = ["%E2%80%8B", "%C2%A0", "%0A"];
        this.replaceChars = ["", "%20", ""];
        this.kanbanColor = [
            "rgb(255, 224, 178)",
            "rgb(255, 205, 210)",
            "rgb(200, 230, 201)",
            // "rgb(144, 202, 249)",
            // "rgb(255, 204, 128)",
        ]
        this.itemColor = [
            "rgb(255, 245, 157)",
            "rgb(206, 147, 216)",
            "rgb(159, 168, 218)",
            // "rgb(239, 154, 154)",
            // "rgb(165, 214, 167)",
        ]
    }

    process = () => {
        this.init();

        this.utils.decorateAddCodeBlock(null, (result, ...args) => this.newKanban(args[0]))
        this.utils.decorate(
            () => (File && File.editor && File.editor.fences && File.editor.fences.tryAddLangUndo),
            "File.editor.fences.tryAddLangUndo",
            null,
            (result, ...args) => this.newKanban(args[0].cid)
        )
    }

    newKanban = cid => {
        const pre = File.editor.findElemById(cid);
        const lang = pre.attr("lang").trim().toLowerCase();
        if (lang !== "kanban") {
            pre.children(".plugin-kanban").remove();
            pre.children(".fence-enhance").show();
            return;
        }
        pre.children(".fence-enhance").hide();
        pre.addClass("md-fences-advanced");
        let kanban = pre.find(".plugin-kanban");
        if (kanban.length === 0) {
            kanban = $(`<div class="plugin-kanban"></div>`);
            pre.append(kanban);
        }
        const kanbanList = this.newKanbanList(pre);
        kanban.html(kanbanList);
    }

    getColor = (type, idx) => {
        if (idx <= this[type].length - 1) {
            return this[type][idx]
        }
        return "rgba(0,0,0,0)"
    }

    newKanbanList = pre => {
        const content = this.getFenceContent(pre[0]);
        const lines = content.split("\n").map(line => line.trim()).filter(Boolean);

        const list = [];
        lines.forEach(line => {
            if (line.startsWith("# ")) {
                const name = line.replace("# ", "");
                list.push({name: name, item: []});
            } else {
                const match = line.match(/^[\-\*]\s(?<title>.*?)(\((?<desc>.*?)\))?$/);
                if (!match) return;
                const title = match.groups.title;
                if (title) {
                    list[list.length - 1].item.push({title: title, desc: match.groups.desc || ""});
                }
            }
        })

        return list.map((col, listIdx) => {
            const items = col.item.map(item => `
                <div class="plugin-kanban-col-item kanban-item-box" style="background-color: ${this.getColor("itemColor", listIdx)}">
                    <div class="plugin-kanban-col-item-title no-wrap"><b>${item.title}</b></div>
                    <div class="plugin-kanban-col-item-desc">${item.desc}</div>
                </div>`);

            return $(
                `<div class="plugin-kanban-col kanban-box" style="background-color: ${this.getColor("kanbanColor", listIdx)}">
                    <div class="plugin-kanban-col-name no-wrap">${col.name}</div><p></p>
                    <div class="plugin-kanban-col-item-list">${items.join("")}</div>
                </div>`)
        })
    }

    getFenceContent = pre => {
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
}

module.exports = {
    plugin: kanbanPlugin
};