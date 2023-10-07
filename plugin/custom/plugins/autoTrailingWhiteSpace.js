class autoTailingWhiteSpacePlugin extends BaseCustomPlugin {
    hotkey = () => [this.config.hotkey]

    callback = () => {
        const replaceFlag = 2;
        const tailSpace = "  ";
        document.querySelectorAll("#write p[cid]").forEach(ele => {
            const textContent = ele.textContent;
            if (!textContent.trim() || textContent.endsWith(tailSpace)) return
            const span = ele.querySelector("span");
            if (span) {
                span.textContent += tailSpace;
                File.editor.undo.addSnap(ele.getAttribute("cid"), replaceFlag);
            }
        })
    }
}

module.exports = {
    plugin: autoTailingWhiteSpacePlugin
};