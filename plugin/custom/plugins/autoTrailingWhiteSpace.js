class autoTrailingWhiteSpacePlugin extends BaseCustomPlugin {
    hotkey = () => [this.config.hotkey]

    callback = () => {
        const replaceFlag = 2;
        document.querySelectorAll("#write p[cid]").forEach(ele => {
            const textContent = ele.textContent;
            if (!textContent.trim() || textContent.endsWith("  ")) return
            const span = ele.querySelector("span");
            if (span) {
                span.textContent += "  ";
                File.editor.undo.addSnap(ele.getAttribute("cid"), replaceFlag);
            }
        })
    }
}

module.exports = {
    plugin: autoTrailingWhiteSpacePlugin
};