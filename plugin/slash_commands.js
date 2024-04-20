class slashCommandsPlugin extends BasePlugin {
    beforeProcess = () => {
        this.matched = new Map();
        this.commands = new Map(this.config.COMMANDS.filter(cmd => cmd.enable && cmd.keyword).map(cmd => [cmd.keyword.toLowerCase(), cmd]));
        this.handler = {search: this._search, render: this._render, beforeApply: this._beforeApply};
        this.strategy = this._getStrategy();
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
        const match = textBefore.match(new RegExp(this.config.TRIGGER_REGEXP));
        if (!match || !match.groups || match.groups.kw === undefined) return;

        const keyword = match.groups.kw.toLowerCase();
        this._match(keyword);
        if (this.matched.size === 0) return;
        range.start -= (keyword.length + 1);
        File.editor.autoComplete.show([], range, keyword, this.handler);
    }

    _getStrategy = () => {
        const prefix = {
            match: (keyword, token) => keyword.startsWith(token),
            highlight: (keyword, token) => `<b>${keyword.slice(0, token.length)}</b>` + keyword.slice(token.length),
        }
        const substr = {
            match: (keyword, token) => keyword.includes(token),
            highlight: (keyword, token) => keyword.replace(new RegExp(`(${token})`, "i"), "<b>$1</b>"),
        }
        const abbr = {
            match: (keyword, token) => token.split("").every(char => {
                const idx = keyword.indexOf(char);
                if (idx === -1) return false;
                keyword = keyword.slice(idx + 1, keyword.length);
                return true
            }),
            highlight: (keyword, token) => {
                const result = [];
                let highlight = [];
                let tokenIdx = 0;
                for (let i = 0; i <= keyword.length - 1; i++) {
                    const char = keyword[i];
                    if (char.toLowerCase() === token[tokenIdx]) {
                        highlight.push(char);
                        tokenIdx++;
                    } else {
                        if (highlight.length) {
                            result.push(`<b>${highlight.join("")}</b>`);
                            highlight = [];
                        }
                        result.push(char);
                    }
                }
                if (highlight.length) {
                    result.push(`<b>${highlight.join("")}</b>`);
                }
                return result.join("");
            }
        }
        return {prefix, substr, abbr}[this.config.MATCH_STRATEGY] || abbr;
    }

    _match = token => {
        const map = new Map();
        for (const [kw, cmd] of this.commands.entries()) {
            if (this.strategy.match(kw, token)) {
                map.set(kw, cmd);
            }
        }
        this.matched = map;
    }

    _search = keyword => Array.from(this.matched.keys())

    _render = (suggest, isActive) => {
        const cmd = this.matched.get(suggest);
        if (!cmd) return ""

        const {token} = File.editor.autoComplete.state;
        const icon = cmd.icon || ((cmd.type === "snippet") ? "🧩" : "🧰");
        const text = this.strategy.highlight(cmd.keyword, token);
        const innerText = icon + " " + text + (cmd.hint ? ` - ${cmd.hint}` : "");
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
