class mindmapPlugin extends BasePlugin {
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

    getContent = func => {
        const headers = (File.editor.nodeMap.toc.headers || []).map(({ attributes, cid }) => {
            let { depth, text } = attributes || {};
            text = text.replace(/\[\^([^\]]+)\]/g, "");  // 去掉脚注
            return { levelIdx: depth, title: text }
        })
        let root = this.utils.getFileName();
        if (headers.length === 0) {
            const type = (func === "mindmap") ? "mindmap" : "graph LR";
            const content = [type, "\n", "\t", `root${this.cleanTitle(root)}`, "\n"].join("");
            return this.wrapMermaid(content, func)
        }
        // 第一个标签为最高级标签，且仅有一个
        if (headers.length !== 1 && headers.filter(ele => ele.levelIdx === headers[0].levelIdx).length === 1) {
            root = headers[0].title;
            headers.shift();
        }
        if (this.config.FIX_ERROR_LEVEL_HEADER) {
            this.fixLevelError(headers);
        }

        const mermaidFunc = {
            mindmap: (headers, root) => {
                const lines = ["mindmap", "\n", "\t", `root${this.cleanTitle(root)}`, "\n"];
                headers.forEach(ele => lines.push("\t".repeat(ele.levelIdx + 1), this.cleanTitle(ele.title), "\n"))
                return this.wrapMermaid(lines.join(""), "mindmap")
            },
            graph: (headers, root) => {
                const levelItems = [{ title: root, _id: "root", _used: false }, null, null, null, null, null, null];

                const getItemTitle = item => {
                    if (!item._used) {
                        item._used = true;
                        return item._id + this.cleanTitle(item.title);
                    }
                    return item._id
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
                    item._id = "item" + idx;
                    levelItems[item.levelIdx] = item;
                    lines.push(getParentItemTitle(item), "-->", getItemTitle(item), "\n");
                })

                return this.wrapMermaid(lines.join(""), "graph")
            }
        }

        return mermaidFunc[func](headers, root);
    }

    dynamicCallArgsGenerator = (anchorNode, meta) => {
        meta.target = anchorNode.closest(`#write > p[mdtype="paragraph"]`);
        const arg_disabled = !meta.target || meta.target.querySelector("p > span");
        const arg_hint = arg_disabled ? "请将光标定位到空白行" : "";
        return [
            { arg_name: "插入：mindmap", arg_value: "insert_mindmap", arg_disabled, arg_hint },
            { arg_name: "插入：graph", arg_value: "insert_graph", arg_disabled, arg_hint },
        ]
    }

    call = (type, meta) => {
        const func = type.slice(type.lastIndexOf("_") + 1);
        if (func !== "mindmap" && func !== "graph") return;
        const content = this.getContent(func);
        meta.target && this.utils.insertText(meta.target, content);
    }
}

module.exports = {
    plugin: mindmapPlugin
};
