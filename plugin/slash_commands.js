class slashCommandsPlugin extends BasePlugin {
    beforeProcess = () => {
        this.SCOPE = { INLINE_MATH: "inline_math", PLAIN: "plain" }
        this.TYPE = { COMMAND: "command", SNIPPET: "snippet", GENERATE_SNIPPET: "gen-snp" }

        const defaultOffset = [0, 0]
        const { COMMANDS, TRIGGER_REGEXP, MATCH_STRATEGY, ORDER_STRATEGY } = this.config
        COMMANDS.forEach(c => {
            c.scope = c.scope || this.SCOPE.PLAIN
            c.icon = c.icon || (c.type === this.TYPE.COMMAND ? "🧰" : "🧩")
            c.cursorOffset = c.cursorOffset || defaultOffset
            c.hint = this.utils.escape(c.hint || "")
        })

        this.inputs = { kw: "", command: "", params: [], textBefore: "", textAfter: "", scope: "", bookmark: null }
        this.matched = new Map()
        this.regexp = new RegExp(TRIGGER_REGEXP)
        this.matchStrategy = this._getMatchStrategy(MATCH_STRATEGY)
        this.orderStrategy = this._getOrderStrategy(ORDER_STRATEGY)
        this.commands = new Map(COMMANDS.filter(c => c.enable && c.keyword && /[A-Za-z0-9]+/.test(c.keyword)).map(c => [c.keyword.toLowerCase(), c]))
        this.handler = { search: this._search, render: this._render, beforeApply: this._beforeApply }

        return this.commands.size ? undefined : this.utils.stopLoadPluginError
    }

    styleTemplate = () => true

    process = () => {
        if (this.config.SUGGESTION_TIMING === "on_input") {
            this.utils.decorate(() => File && File.editor && File.editor.brush, "triggerAutoComplete", null, this._onEdit)
        } else {
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileEdited, this._onEdit)
        }
    }

    call = () => this._showAllCommands()

    _showAllCommands = () => {
        const i18n = {
            unknown: this.i18n.t("unknown"),
            types: {
                [this.TYPE.COMMAND]: this.i18n.t("type.command"),
                [this.TYPE.SNIPPET]: this.i18n.t("type.snippet"),
                [this.TYPE.GENERATE_SNIPPET]: this.i18n.t("type.generateSnippet"),
            },
            scopes: {
                [this.SCOPE.PLAIN]: this.i18n.t("scope.plain"),
                [this.SCOPE.INLINE_MATH]: this.i18n.t("scope.inlineMath"),
            },
        }
        const getType = type => i18n.types[type] || i18n.unknown
        const getScope = scope => i18n.scopes[scope] || i18n.unknown
        const getHint = hint => hint || ""

        const th = this.i18n.array(["keyword", "type", "scope", "hint"], "modal.")
        const trs = [...this.commands.values()].map(c => [c.keyword, getType(c.type), getScope(c.scope), getHint(c.hint)])
        const table = this.utils.buildTable([th, ...trs])
        const components = [{ label: table, type: "p" }]
        const op = { title: this.pluginName, components, width: "550px" }
        this.utils.dialog.modal(op)
    }

    _getTextAround = () => {
        const range = File.editor.selection.getRangy()
        if (range && range.collapsed) {
            const container = $(range.startContainer).closest(`[md-inline="plain"], [type="math/tex"]`)[0]
            if (container) {
                const scope = this._getScope(container)
                const bookmark = range.getBookmark(container)
                range.setStartBefore(container)
                const textBefore = range.toString()
                range.collapse(false)
                range.setEndAfter(container)
                const textAfter = range.toString()
                range.setStart(container, 0)
                return [textBefore, textAfter, bookmark, scope]
            }
        }
        return []
    }

    _getScope = container => container.tagName === "SCRIPT" ? this.SCOPE.INLINE_MATH : this.SCOPE.PLAIN

    _onEdit = () => {
        if (document.activeElement.tagName === "TEXTAREA") return

        const [textBefore, textAfter, bookmark, scope] = this._getTextAround()
        if (!textBefore) return
        const match = textBefore.match(this.regexp)
        const kw = match && match.groups && match.groups.kw
        if (kw == null) return

        const [command, ...params] = kw.split(this.config.FUNC_PARAM_SEPARATOR)
        const lowerCommand = command.toLowerCase()

        const matchResult = this._match(scope, lowerCommand)
        if (matchResult.size === 0) return

        this.inputs = { kw, command, params, textBefore, textAfter, scope, bookmark }

        bookmark.start -= (kw.length + 1)
        File.editor.autoComplete.attachToRange()
        File.editor.autoComplete.show([], bookmark, lowerCommand, this.handler)
    }

    _getMatchStrategy = (type) => {
        const prefix = {
            match: (target, input) => target.startsWith(input),
            highlight: (target, input) => `<b>${target.slice(0, input.length)}</b>` + target.slice(input.length),
        }
        const substr = {
            match: (target, input) => target.includes(input),
            highlight: (target, input) => target.replace(new RegExp(`(${input})`, "i"), "<b>$1</b>"),
        }
        const abbr = {
            match: (target, input) => {
                let from = 0
                for (const char of input) {
                    from = target.indexOf(char, from)
                    if (from === -1) {
                        return false
                    }
                    from++
                }
                return true
            },
            highlight: (target, input) => {
                const result = []
                let hit = []
                let idx = 0
                for (const char of target) {
                    if (char.toLowerCase() === input[idx]) {
                        hit.push(char)
                        idx++
                    } else {
                        if (hit.length) {
                            result.push(`<b>${hit.join("")}</b>`)
                            hit = []
                        }
                        result.push(char)
                    }
                }
                if (hit.length) {
                    result.push(`<b>${hit.join("")}</b>`)
                }
                return result.join("")
            }
        }
        return { prefix, substr, abbr }[type] || abbr
    }

    _getOrderStrategy = (type) => {
        const _getIndexScore = (keyword, input) => {
            let score = 0
            let from = 0
            for (const char of input) {
                from = keyword.indexOf(char, from)
                score = input.length * score + from
                from++
            }
            return score
        }
        const predefined = (commands, input) => commands
        const lexicographic = (commands) => commands.sort()
        const length_based = (commands) => commands.sort((a, b) => a.length - b.length)
        const earliest_hit = (commands, input) => {
            return input
                ? commands.sort((a, b) => _getIndexScore(a, input) - _getIndexScore(b, input))
                : commands
        }
        return { predefined, lexicographic, length_based, earliest_hit }[type] || predefined
    }

    _match = (scope, input) => {
        this.matched.clear()
        for (const [kw, cmd] of this.commands.entries()) {
            if (cmd.scope === scope && this.matchStrategy.match(kw, input)) {
                this.matched.set(kw, cmd)
            }
        }
        return this.matched
    }

    _search = input => this.orderStrategy([...this.matched.keys()], input)

    _render = (suggest, isActive) => {
        const cmd = this.matched.get(suggest)
        if (!cmd) return ""

        const { keyword, icon, hint } = cmd
        const { token } = File.editor.autoComplete.state
        const command = this.matchStrategy.highlight(keyword, token)
        const hint_ = hint ? `- ${hint}` : ""
        const active = isActive ? "active" : ""
        return `<li class="plugin-slash-command ${active}" data-content="${suggest}">${icon} ${command} ${hint_}</li>`
    }

    _evalFunction = (fnString, ...args) => {
        const ret = eval(fnString)
        return ret instanceof Function ? (ret(...args) || "").toString() : fnString
    }

    _clearAnchor = (anchor) => {
        const range = File.editor.selection.getRangy()
        if (range) {
            const textNode = anchor.containerNode.firstChild
            range.setStart(textNode, anchor.start)
            range.setEnd(textNode, anchor.end)
            File.editor.selection.setRange(range, true)
            File.editor.UserOp.pasteHandler(File.editor, "", true)
        }
    }

    _normalizeAnchor = (anchor) => anchor.containerNode.normalize()

    _refresh = () => {
        const node = this.utils.findActiveNode()
        if (!node) return

        const parsedNode = File.editor.simpleParse(node, true)
        if (!parsedNode) return

        parsedNode[0].undo[0] = File.editor.lastCursor
        setTimeout(() => {
            parsedNode[0].redo.push(File.editor.selection.buildUndo())
            File.editor.findElemById(parsedNode[2]).replaceWith(parsedNode[1])
            File.editor.undo.register(parsedNode[0], true)
            File.editor.quickRefresh()
            File.editor.selection.scrollAdjust()
            File.editor.undo.exeCommand(parsedNode[0].redo.last())
        }, 50)
    }

    _selectRange = (offset) => {
        const [start, end] = offset
        if (start === 0 && end === 0) return

        const { range, bookmark } = this.utils.getRangy()
        bookmark.start += start
        bookmark.end += end
        range.moveToBookmark(bookmark)
        range.select()
    }

    _runCommand = suggest => {
        let result = ""
        const cmd = this.matched.get(suggest)
        if (cmd) {
            const { anchor } = File.editor.autoComplete.state
            if (cmd.type === this.TYPE.SNIPPET) {
                result = cmd.callback
            } else if (cmd.type === this.TYPE.GENERATE_SNIPPET) {
                result = this._evalFunction(cmd.callback, ...this.inputs.params)
            } else if (cmd.type === this.TYPE.COMMAND) {
                this._clearAnchor(anchor)
                setTimeout(() => this._evalFunction(cmd.callback, ...this.inputs.params), 50)
            }
            setTimeout(() => {
                this._normalizeAnchor(anchor)
                this._refresh()
                this._selectRange(cmd.cursorOffset)
            }, 100)
        }
        return result
    }

    _beforeApply = suggest => {
        const ret = this._runCommand(suggest)
        this.matched.clear()
        return ret
    }
}

module.exports = {
    plugin: slashCommandsPlugin
}
