class mindmapPlugin extends BasePlugin {
    process = () => {
        this.headerList = ["H0", "H1", "H2", "H3", "H4", "H5", "H6"];
        this.callArgs = [
            {arg_name: "复制到剪切板：mindmap", arg_value: "set_clipboard_mindmap"},
            {arg_name: "复制到剪切板：graph", arg_value: "set_clipboard_graph"},
        ];
    }

    cleanTitle = title => `("${title.replace(/"/g, "")}")`

    wrapMermaid = (content, type) => ["```", "mermaid", "\n", this.wrapErrorMsg(type), content, "```"].join("")

    wrapErrorMsg = type => (type === "mindmap" && !window.mermaidAPI.defaultConfig.mindmap)
        ? "%%你的mermaid组件版本过低，不支持mindmap语法。内容已复制到剪贴板，请粘贴到https://mermaid.live/查看\n"
        : ""

    fixLevelError = headers => {
        for (let idx = 1; idx < headers.length; idx++) {
            let startIdx = idx;
            const current = headers[startIdx];
            const maxLevel = headers[startIdx - 1].levelIdx + 1;
            if (current.levelIdx > maxLevel) {
                const needFix = [current];
                while (headers[startIdx + 1] && headers[startIdx + 1].levelIdx > maxLevel) {
                    needFix.push(headers[startIdx + 1]);
                    startIdx++;
                }
                const dec = Math.max(...needFix.map(header => header.levelIdx)) - maxLevel;
                needFix.forEach(header => header.levelIdx -= dec);
            }
        }
    }

    mindmap = (headers, root) => {
        const lines = ["mindmap", "\n", "\t", `root${this.cleanTitle(root)}`, "\n"];
        headers.forEach(ele => lines.push("\t".repeat(ele.levelIdx + 1), this.cleanTitle(ele.title), "\n"))
        return this.wrapMermaid(lines.join(""), "mindmap")
    }

    graph = (headers, root) => {
        const levelItems = [{id: "root", title: root, used: false}, null, null, null, null, null, null];

        const getItemTitle = item => {
            if (!item.used) {
                item.used = true;
                return item.id + this.cleanTitle(item.title);
            }
            return item.id
        }

        const getParentItemTitle = item => {
            for (let i = item.levelIdx - 1; i >= 0; i--) {
                const item = levelItems[i];
                if (item) {
                    return getItemTitle(item)
                }
            }
        }

        const lines = ["graph LR", "\n"];
        headers.forEach((item, idx) => {
            item.id = "item" + idx;
            levelItems[item.levelIdx] = item;
            lines.push(getParentItemTitle(item), "-->", getItemTitle(item), "\n");
        })

        return this.wrapMermaid(lines.join(""), "graph")
    }

    getContent = func => {
        const headers = Array.from(document.querySelectorAll("#write > .md-heading"), ele => ({
            tagName: ele.tagName,
            levelIdx: this.headerList.indexOf(ele.tagName),
            title: ele.firstElementChild.textContent,
        }))

        let root = this.utils.getFileName();
        if (headers.length === 0) {
            const type = (func === "mindmap" ? "mindmap" : "graph LR");
            const content = [type, "\n", "\t", `root${this.cleanTitle(root)}`, "\n"];
            return this.wrapMermaid(content.join(""), func)
        }
        if (headers.length !== 1 && headers.filter(ele => ele.tagName === headers[0].tagName).length === 1) {
            root = headers[0].title;
            headers.shift();
        }
        if (this.config.FIX_ERROR_LEVEL_HEADER) {
            this.fixLevelError(headers);
        }
        return this[func](headers, root);
    }

    dynamicCallArgsGenerator = (anchorNode, meta) => {
        meta.target = anchorNode.closest(`#write > p[mdtype="paragraph"]`);
        const disabled = !meta.target || meta.target.querySelector("p > span");
        return [
            {arg_name: "在此处插入：mindmap", arg_value: "insert_mindmap", arg_disabled: disabled},
            {arg_name: "在此处插入：graph", arg_value: "insert_graph", arg_disabled: disabled},
        ]
    }

    call = (type, meta) => {
        const func = type.slice(type.lastIndexOf("_") + 1);
        if (func !== "mindmap" && func !== "graph") return;

        const content = this.getContent(func);
        if (type === "set_clipboard_mindmap" || type === "set_clipboard_graph") {
            navigator.clipboard.writeText(content);
        } else if (type === "insert_mindmap" || type === "insert_graph") {
            meta.target && this.utils.insertText(meta.target, content);
        }
    }
}

module.exports = {
    plugin: mindmapPlugin
};
