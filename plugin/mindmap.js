(() => {
    const config = global._pluginUtils.getPluginSetting("mindmap");

    const paragraphList = ["H0", "H1", "H2", "H3", "H4", "H5", "H6"];

    const getFileName = () => {
        let filename = File.getFileName();
        const idx = filename.lastIndexOf(".");
        if (idx !== -1) {
            filename = filename.substring(0, idx);
        }
        return filename
    }

    const cleanMindMapTitle = title => title.replace(/[(、：，（）。「」？！_)]/g, "");
    const cleanGraphTitle = title => `"${title.replace(/"/g, "")}"`;

    const wrapMermaid = content => `\`\`\`mermaid\n${content}\`\`\``;

    const mindmap = (pList, root) => {
        const lines = [
            "mindmap", "\n",
            "\t", `root(${cleanMindMapTitle(root)})`, "\n",
        ];
        pList.forEach(ele => lines.push("\t".repeat(ele.levelIdx + 1), cleanMindMapTitle(ele.title), "\n"))
        return wrapMermaid(lines.join(""))
    }

    const graph = (pList, root) => {
        const getItemTitle = item => {
            if (item.used) {
                return item.id
            }
            item.used = true;
            const title = cleanGraphTitle(item.title);
            return `${item.id}(${title})`
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

        return wrapMermaid(lines.join(""))
    }

    const dynamicCallArgsGenerator = anchorNode => {
        if (global._pluginUtils.isBetaVersion) {
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

    const callArgs = [
        {
            arg_name: "复制到剪切板：mindmap",
            arg_value: "set_clipboard_mindmap"
        },
        {
            arg_name: "复制到剪切板：graph",
            arg_value: "set_clipboard_graph"
        },
    ];

    const call = type => {
        const pList = [];
        document.querySelectorAll("#write > .md-heading").forEach(ele => {
            const tagName = ele.tagName;
            const levelIdx = paragraphList.indexOf(tagName);
            const title = ele.firstElementChild.textContent;
            pList.push({tagName, title, levelIdx});
        })

        if (pList.length === 0) return

        let root = getFileName();
        if (pList.filter(ele => ele.tagName === pList[0].tagName).length === 1) {
            root = pList[0].title;
            pList.shift();
        }

        let result;
        if (type === "set_clipboard_mindmap" || type === "insert_mindmap") {
            result = mindmap(pList, root);
        } else if (type === "set_clipboard_graph" || type === "insert_graph") {
            result = graph(pList, root);
        }

        navigator.clipboard.writeText(result).then(() => {
            if (type === "insert_mindmap" || type === "insert_graph") {
                const ele = document.querySelector("#context-menu [data-key='paste']");
                ele && ele.click();
            }
        });
    }

    module.exports = {
        call,
        callArgs,
        dynamicCallArgsGenerator,
    };

    console.log("mindmap.js had been injected");
})()