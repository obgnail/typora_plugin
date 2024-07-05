class autoTrailingWhiteSpacePlugin extends BaseCustomPlugin {
    hotkey = () => [this.config.hotkey]

    callback = () => {
        const replaceFlag = 2;
        const tailSpace = "  ";
        this.utils.entities.querySelectorAllInWrite("p[cid]").forEach(ele => {
            const textContent = ele.textContent;
            if (!textContent.trim() || textContent.endsWith(tailSpace)) return
            const span = ele.querySelector(":scope > span:last-child");
            if (span) {
                const textContent = span.textContent;
                if (!textContent.trim() || textContent.endsWith(tailSpace)) return
                span.textContent += tailSpace;
                const cid = ele.getAttribute("cid");
                File.editor.undo.addSnap(cid, replaceFlag);
                File.editor.brush.brushNode(cid);
            }
        })
    }
}

module.exports = {
    plugin: autoTrailingWhiteSpacePlugin
};