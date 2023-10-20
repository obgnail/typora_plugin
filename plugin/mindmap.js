class mindmapPlugin extends global._basePlugin {
    process = () => {
        this.paragraphList = ["H0", "H1", "H2", "H3", "H4", "H5", "H6"];
        this.callArgs = [
            {arg_name: "复制到剪切板：mindmap", arg_value: "set_clipboard_mindmap"},
            {arg_name: "复制到剪切板：graph", arg_value: "set_clipboard_graph"},
        ];
    }

    cleanTitle = title => `("${title.replace(/"/g, "")}")`;

    wrapMermaid = (content, type) => "```mermaid\n" + this.wrapErrorMsg(type) + content + "```"

    wrapErrorMsg = type => {
        if (type === "mindmap" && !window.mermaidAPI.defaultConfig.mindmap) {
            return `%%你的mermaid组件版本过低，不支持mindmap语法。内容已复制到剪贴板，请粘贴到https://mermaid.live/查看\n`
        }
        return ""
    }

    mindmap = (pList, root) => {
        const lines = ["mindmap", "\n", "\t", `root${this.cleanTitle(root)}`, "\n"];
        pList.forEach(ele => lines.push("\t".repeat(ele.levelIdx + 1), this.cleanTitle(ele.title), "\n"))
        return this.wrapMermaid(lines.join(""), "mindmap")
    }

    graph = (pList, root) => {
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
        pList.forEach((item, idx) => {
            item.id = "item" + idx;
            levelItems[item.levelIdx] = item;
            lines.push(getParentItemTitle(item), "-->", getItemTitle(item), "\n");
        })

        return this.wrapMermaid(lines.join(""), "graph")
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
        const pList = Array.from(document.querySelectorAll("#write > .md-heading")).map(ele => ({
            tagName: ele.tagName,
            levelIdx: this.paragraphList.indexOf(ele.tagName),
            title: ele.firstElementChild.textContent,
        }))

        if (pList.length === 0) return

        let root = this.utils.getFileName();
        if (pList.filter(ele => ele.tagName === pList[0].tagName).length === 1) {
            root = pList[0].title;
            pList.shift();
        }

        const func = type.slice(type.lastIndexOf("_") + 1);
        if (func !== "mindmap" && func !== "graph") return;

        const result = this[func](pList, root);
        if (type === "set_clipboard_mindmap" || type === "set_clipboard_graph") {
            navigator.clipboard.writeText(result);
        } else if (type === "insert_mindmap" || type === "insert_graph") {
            meta.target && this.utils.insertText(meta.target, result);
        }
    }
}

module.exports = {
    plugin: mindmapPlugin
};
