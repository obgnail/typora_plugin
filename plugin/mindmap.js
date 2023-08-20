class mindmapPlugin extends global._basePlugin {
    init = () => {
        this.paragraphList = ["H0", "H1", "H2", "H3", "H4", "H5", "H6"];
        this.callArgs = [
            {
                arg_name: "复制到剪切板：mindmap",
                arg_value: "set_clipboard_mindmap"
            },
            {
                arg_name: "复制到剪切板：graph",
                arg_value: "set_clipboard_graph"
            },
        ];
    }

    process = () => {
        this.init();
    }

    getFileName = () => {
        let filename = File.getFileName();
        const idx = filename.lastIndexOf(".");
        if (idx !== -1) {
            filename = filename.substring(0, idx);
        }
        return filename
    }

    cleanMindMapTitle = title => `("${title.replace(/"/g, "")}")`;
    cleanGraphTitle = title => `("${title.replace(/"/g, "")}")`;

    wrapMermaid = (content, type) => {
        return "```mermaid\n" + this.wrapErrorMsg(type) + content + "```"
    };

    wrapErrorMsg = type => {
        if (type === "mindmap" && !window.mermaidAPI.defaultConfig.mindmap) {
            const url = "https://mermaid.live/";
            return `%%你的mermaid组件版本过低，不支持mindmap语法。内容已复制到剪贴板，请粘贴到${url}查看\n`
        }
        return ""
    }

    mindmap = (pList, root) => {
        const lines = [
            "mindmap", "\n",
            "\t", `root${this.cleanMindMapTitle(root)}`, "\n",
        ];
        pList.forEach(ele => lines.push("\t".repeat(ele.levelIdx + 1), this.cleanMindMapTitle(ele.title), "\n"))
        return this.wrapMermaid(lines.join(""), "mindmap")
    }

    graph = (pList, root) => {
        const getItemTitle = item => {
            if (item.used) {
                return item.id
            }
            item.used = true;
            const title = this.cleanGraphTitle(item.title);
            return item.id + title
        }

        const getParentItemTitle = item => {
            for (let i = item.levelIdx - 1; i >= 0; i--) {
                const item = levelItems[i];
                if (item) {
                    return getItemTitle(item)
                }
            }
        }

        pList.forEach((ele, idx) => {
            ele.id = "item" + idx;
            ele.used = false;
        })

        const levelItems = [{id: "root", title: root, used: false}, null, null, null, null, null, null];

        const lines = ["graph LR", "\n"];
        pList.forEach(item => {
            levelItems[item.levelIdx] = item;
            lines.push(getParentItemTitle(item), "-->", getItemTitle(item), "\n");
        })

        return this.wrapMermaid(lines.join(""), "graph")
    }

    dynamicCallArgsGenerator = anchorNode => {
        if (this.utils.isBetaVersion) {
            const target = anchorNode.closest(`#write > p[mdtype="paragraph"]`);
            if (!target) return;
            if (target.querySelector("p > span")) return;
        } else {
            const target = anchorNode.closest(`#write > p[mdtype="paragraph"]:not(:has(>span))`);
            if (!target) return;
        }

        return [
            {
                arg_name: "在此处插入：mindmap",
                arg_value: "insert_mindmap"
            },
            {
                arg_name: "在此处插入：graph",
                arg_value: "insert_graph"
            },
        ]
    }

    call = type => {
        const pList = [];
        document.querySelectorAll("#write > .md-heading").forEach(ele => {
            const tagName = ele.tagName;
            const levelIdx = this.paragraphList.indexOf(tagName);
            const title = ele.firstElementChild.textContent;
            pList.push({tagName, title, levelIdx});
        })

        if (pList.length === 0) return

        let root = this.getFileName();
        if (pList.filter(ele => ele.tagName === pList[0].tagName).length === 1) {
            root = pList[0].title;
            pList.shift();
        }

        let result;
        if (type === "set_clipboard_mindmap" || type === "insert_mindmap") {
            result = this.mindmap(pList, root);
        } else if (type === "set_clipboard_graph" || type === "insert_graph") {
            result = this.graph(pList, root);
        }

        navigator.clipboard.writeText(result).then(() => {
            if (type === "insert_mindmap" || type === "insert_graph") {
                const ele = document.querySelector("#context-menu [data-key='paste']");
                ele && ele.click();
            }
        });
    }
}

module.exports = {
    plugin: mindmapPlugin
};
