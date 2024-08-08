class slashCommandsPlugin extends BasePlugin {
    beforeProcess = () => {
        this.matched = new Map();
        this.type = { COMMAND: "command", SNIPPET: "snippet", GENERATE_SNIPPET: "gen-snp" };
        this.scope = { INLINE_MATH: "inline_math", PLAIN: "plain" }
        this.config.COMMANDS.forEach(cmd => cmd.scope = cmd.scope || this.scope.PLAIN);
        this.commands = new Map(this.config.COMMANDS.filter(cmd => cmd.enable && cmd.keyword).map(cmd => [cmd.keyword.toLowerCase(), cmd]));
        this.handler = { search: this._search, render: this._render, beforeApply: this._beforeApply };
        this.strategy = this._getStrategy();
        return this.commands.size ? undefined : this.utils.stopLoadPluginError
    }

    styleTemplate = () => true

    process = () => {
        this.utils.decorate(() => this.handler, "beforeApply", null, () => this.matched.clear());
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileEdited, this._onEdit);
    }

    call = () => this._showAllCommands();

    openSettingFile = async () => this.utils.showInFinder(await this.utils.getActualSettingPath("settings.user.toml"));

    _showAllCommands = () => {
        const getType = type => type === this.type.COMMAND ? "命令" : "文段";
        const th = `<tr><th>关键字</th><th>类型</th><th>功能</th></tr>`;
        const list = Array.from(this.commands.values());
        const trs = list.map(({ type, keyword, hint, callback }) => `<tr><td>${keyword}</td><td>${getType(type)}</td><td title="${callback}">${hint}</td></tr>`);
        const table = `<table>${th}${trs.join("")}</table>`;
        const onclick = ev => ev.target.closest("a") && this.openSettingFile();
        const components = [
            { label: "如需自定义斜杠命令，请 <a>修改配置文件</a>", type: "p", onclick },
            { label: table, type: "p" }
        ];
        this.utils.dialog.modal({ title: "斜杠命令", components });
    }

    _getTextAround = () => {
        const selectionRange = File.editor.selection.getRangy();
        if (selectionRange && selectionRange.collapsed) {
            const container = $(selectionRange.startContainer).closest(`[md-inline="plain"], [type="math/tex"]`)[0];
            if (container) {
                const scope = this._getScope(container);
                const bookmark = selectionRange.getBookmark(container);
                selectionRange.setStartBefore(container);
                const textBefore = selectionRange.toString();
                selectionRange.collapse(false);
                selectionRange.setEndAfter(container);
                const textAfter = selectionRange.toString();
                selectionRange.setStart(container, 0);
                return [textBefore, textAfter, bookmark, scope];
            }
        }
        return [];
    }

    _getScope = container => container.tagName === "SCRIPT" ? this.scope.INLINE_MATH : this.scope.PLAIN

    _onEdit = () => {
        if (document.activeElement.tagName === "TEXTAREA") return;

        const [textBefore, textAfter, range, scope] = this._getTextAround();
        if (!textBefore) return;
        const match = textBefore.match(new RegExp(this.config.TRIGGER_REGEXP));
        if (!match || !match.groups || match.groups.kw === undefined) return;

        const token = match.groups.kw.toLowerCase();
        this._match(token, scope);
        if (this.matched.size === 0) return;
        range.start -= (token.length + 1);
        File.editor.autoComplete.show([], range, token, this.handler);
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
        return { prefix, substr, abbr }[this.config.MATCH_STRATEGY] || abbr;
    }

    _match = (token, scope) => {
        const map = new Map();
        for (const [kw, cmd] of this.commands.entries()) {
            if (cmd.scope === scope && this.strategy.match(kw, token)) {
                map.set(kw, cmd);
            }
        }
        this.matched = map;
    }

    _search = token => Array.from(this.matched.keys())

    _render = (suggest, isActive) => {
        const cmd = this.matched.get(suggest);
        if (!cmd) return ""

        const { token } = File.editor.autoComplete.state;
        const icon = cmd.icon || ((cmd.type === this.type.COMMAND) ? "🧰" : "🧩");
        const text = this.strategy.highlight(cmd.keyword, token);
        const innerText = icon + " " + text + (cmd.hint ? ` - ${cmd.hint}` : "");
        const className = `plugin-slash-command ${isActive ? "active" : ""}`;
        return `<li class="${className}" data-content="${suggest}">${innerText}</li>`
    }

    _evalFunction = str => {
        const ret = eval(str);
        if (ret instanceof Function) {
            return (ret() || "").toString()
        }
        return str
    }

    _beforeApply = suggest => {
        const cmd = this.matched.get(suggest);
        if (!cmd) return ""

        const { anchor } = File.editor.autoComplete.state;
        const normalizeAnchor = () => anchor.containerNode.normalize();
        const refresh = () => {
            const node = this.utils.findActiveNode();
            if (!node) return;

            const parsedNode = File.editor.simpleParse(node, true);
            if (!parsedNode) return;

            parsedNode[0].undo[0] = File.editor.lastCursor;
            setTimeout(() => {
                parsedNode[0].redo.push(File.editor.selection.buildUndo());
                File.editor.findElemById(parsedNode[2]).replaceWith(parsedNode[1]);
                File.editor.undo.register(parsedNode[0], true);
                File.editor.quickRefresh();
                File.editor.selection.scrollAdjust();
                File.editor.undo.exeCommand(parsedNode[0].redo.last());
            }, 50);
        }

        switch (cmd.type) {
            case this.type.SNIPPET:
            case this.type.GENERATE_SNIPPET:
                setTimeout(() => {
                    normalizeAnchor();
                    refresh();
                }, 100);
                return cmd.type === this.type.SNIPPET ? cmd.callback : this._evalFunction(cmd.callback);
            case this.type.COMMAND:
                normalizeAnchor();
                const range = File.editor.selection.getRangy();
                const textNode = anchor.containerNode.firstChild;
                range.setStart(textNode, anchor.start);
                range.setEnd(textNode, anchor.end);
                File.editor.selection.setRange(range, true);
                File.editor.UserOp.pasteHandler(File.editor, "", true);
                setTimeout(() => this._evalFunction(cmd.callback), 50);
                break;
        }
        return ""
    }
}

module.exports = {
    plugin: slashCommandsPlugin
};
