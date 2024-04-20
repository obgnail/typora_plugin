class slashCommandsPlugin extends BasePlugin {
    styleTemplate = () => true

    process = () => {
        this._initState();
        this._loadCommand();
        this._handler = {search: this._search, render: this._render, beforeApply: this._beforeApply};
        this.utils.decorate(() => this._handler, "beforeApply", null, this._initState);
        this.utils.addEventListener(this.utils.eventType.fileEdited, this._onEdit);
    }

    call = () => this.utils.openUrl("https://github.com/obgnail/typora_plugin?tab=readme-ov-file#slash_commands斜杠命令");

    _onEdit = () => {
        if (document.activeElement.tagName === "TEXTAREA") return;

        const [textBefore, textAfter, range] = File.editor.selection.getTextAround();
        if (!textBefore) return
        let [isMatched, keyword] = textBefore.match(new RegExp(this.config.TRIGGER_REGEXP)) || [];
        if (!isMatched) return;

        keyword = keyword.toLowerCase();
        this.matched = this._filter(keyword);
        if (!this.matched || !this.matched.length) return;
        range.start -= (keyword.length + 1);
        File.editor.autoComplete.show([], range, keyword, this._handler);
    }

    _loadCommand = () => {
        this.commands = this.config.COMMANDS.filter(cmd => cmd.enable);
        this.commands.forEach(cmd => cmd.keyword = cmd.keyword.toLowerCase());
    };
    _filter = keyword => this.commands.filter(cmd => cmd.keyword.includes(keyword))
    _initState = () => this.matched = [];
    _search = keyword => this.matched.map(cmd => cmd.keyword)
    _render = (suggest, isActive) => {
        const cmd = this.matched.find(cmd => cmd.keyword === suggest);
        if (!cmd) return ""
        const token = File.editor.autoComplete.state.token;
        const icon = cmd.icon || ((cmd.type === "snippet") ? "🧾" : "🧰");
        const innerText = icon + " " + suggest.replace(token, `<b>${token}</b>`) + (cmd.hint ? ` - ${cmd.hint}` : "");
        const className = `plugin-slash-command ${isActive ? "active" : ""}`;
        return `<li class="${className}" data-content="${suggest}">${innerText}</li>`
    }
    _beforeApply = suggest => {
        const cmd = this.matched.find(cmd => cmd.keyword === suggest);
        if (!cmd) return ""

        const {anchor} = File.editor.autoComplete.state;
        if (cmd.type === "snippet") {
            setTimeout(() => anchor.containerNode.normalize(), 100);
            return cmd.callback;
        }
        if (cmd.type === "command") {
            anchor.containerNode.normalize();
            const range = File.editor.selection.getRangy();
            const textNode = anchor.containerNode.firstChild;
            range.setStart(textNode, anchor.start);
            range.setEnd(textNode, anchor.end);
            File.editor.selection.setRange(range, true);
            File.editor.UserOp.pasteHandler(File.editor, "", true);
            setTimeout(() => {
                const func = eval(cmd.callback);
                (func instanceof Function) && func();
            }, 50);
        }
        return ""
    }
}

module.exports = {
    plugin: slashCommandsPlugin
};
