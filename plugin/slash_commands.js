class slashCommandsPlugin extends BasePlugin {
    beforeProcess = () => {
        this.matched = new Map();
        this.commands = new Map(this.config.COMMANDS.filter(cmd => cmd.enable).map(cmd => [cmd.keyword.toLowerCase(), cmd]));
        this.handler = {search: this._search, render: this._render, beforeApply: this._beforeApply};

        return this.commands.size ? undefined : this.utils.stopLoadPluginError
    }

    styleTemplate = () => true

    process = () => {
        this.utils.decorate(() => this.handler, "beforeApply", null, () => this.matched.clear());
        this.utils.addEventListener(this.utils.eventType.fileEdited, this._onEdit);
    }

    call = () => this.utils.openUrl("https://github.com/obgnail/typora_plugin?tab=readme-ov-file#slash_commands斜杠命令");

    _onEdit = () => {
        if (document.activeElement.tagName === "TEXTAREA") return;

        const [textBefore, textAfter, range] = File.editor.selection.getTextAround();
        if (!textBefore) return;
        let [isMatched, keyword] = textBefore.match(new RegExp(this.config.TRIGGER_REGEXP)) || [];
        if (!isMatched) return;

        keyword = keyword.toLowerCase();
        this._match(keyword);
        if (this.matched.size === 0) return;
        range.start -= (keyword.length + 1);
        File.editor.autoComplete.show([], range, keyword, this.handler);
    }

    _match = keyword => {
        const map = new Map();
        for (const [k, v] of this.commands.entries()) {
            if (k.includes(keyword)) {
                map.set(k, v);
            }
        }
        this.matched = map;
    }

    _search = keyword => Array.from(this.matched.keys())

    _render = (suggest, isActive) => {
        const cmd = this.matched.get(suggest);
        if (!cmd) return ""

        const {token} = File.editor.autoComplete.state;
        const icon = cmd.icon || ((cmd.type === "snippet") ? "🧾" : "🧰");
        const innerText = icon + " " + suggest.replace(token, `<b>${token}</b>`) + (cmd.hint ? ` - ${cmd.hint}` : "");
        const className = `plugin-slash-command ${isActive ? "active" : ""}`;
        return `<li class="${className}" data-content="${suggest}">${innerText}</li>`
    }

    _beforeApply = suggest => {
        const cmd = this.matched.get(suggest);
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
