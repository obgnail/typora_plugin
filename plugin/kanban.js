class kanbanPlugin extends global._basePlugin {
    process = () => {
        this.utils.decorate(
            () => (File && File.editor && File.editor.fences && File.editor.fences.tryAddLangUndo),
            "File.editor.fences.tryAddLangUndo",
            null,
            (result, ...args) => {
                const attributes = args[0];
                const span = args[1];
                const lang = span.textContent.trim().toLowerCase();
                // if (lang !== "kanban") return

                const cid = attributes.cid;
                const pre = File.editor.findElemById(cid);
                pre.addClass("md-fences-advanced");

                console.log("---------------", attributes, pre)
            }
        )
    }

    newKanban = () => {

    }
}


module.exports = {
    plugin: kanbanPlugin
};