(() => {
    const paragraphList = ["H0", "H1", "H2", "H3", "H4", "H5", "H6"];

    const getFileName = () => {
        let filename = File.getFileName();
        const idx = filename.lastIndexOf(".");
        if (idx !== -1) {
            filename = filename.substring(0, idx);
        }
        return filename
    }

    const cleanTitle = title => title.replace(/[()]/g, "");

    const mindmap = (list, rootLevel, rootTag) => {
        const result = [];
        result.push("mindmap", "\n");
        result.push("\t", `root((${cleanTitle(rootTag)}))`, "\n")

        const rootIdx = paragraphList.indexOf(rootLevel);
        list.forEach(ele => {
            result.push(
                "\t".repeat(paragraphList.indexOf(ele.tagName) - rootIdx + 1),
                cleanTitle(ele.title),
                "\n"
            );
        })

        return `\`\`\`mermaid\n${result.join("")}\`\`\``
    }

    const callArgs = [
        {
            arg_name: "复制到剪切板",
            arg_value: "set_clipboard"
        },
    ];

    const call = type => {
        const list = [];
        document.querySelectorAll("#write > .md-heading").forEach(ele => {
            const tagName = ele.tagName;
            const title = ele.firstElementChild.textContent;
            list.push({tagName, title});
        })

        if (list.length === 0) return

        let rootTag;
        let rootLevel;
        const tags = list.filter(ele => ele.tagName === list[0].tagName);
        if (tags.length === 1) {
            rootTag = tags[0].title;
            rootLevel = tags[0].tagName;
        } else {
            rootTag = getFileName();
            rootLevel = "H0";
        }

        if (rootLevel !== "H0") {
            list.shift();
        }

        const mermaid = mindmap(list, rootLevel, rootTag);

        if (type === "set_clipboard") {
            File.editor.UserOp.setClipboard(null, null, mermaid);
        }
    }

    module.exports = {
        call,
        callArgs,
    };

    console.log("mindmap.js had been injected");
})()