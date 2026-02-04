class CollapseParagraphPlugin extends BasePlugin {
    styleTemplate = () => true

    init = () => {
        this.className = "plugin-collapsed-paragraph"
        this.selector = `#write > [mdtype="heading"]`
        this.HEADERS = ["H1", "H2", "H3", "H4", "H5", "H6"]
        this.staticActions = this.i18n.fillActions([{ act_value: "collapse_all" }, { act_value: "expand_all" }])
    }

    process = () => {
        this.utils.settings.autoSave(this)
        this.disableExpandSimpleBlock()
        this.recordCollapseState(false)

        const collapseFns = this.getCollapseFns()
        const write = this.utils.entities.eWrite
        write.addEventListener("click", ev => {
            const header = this.getTargetHeader(ev.target)
            if (!header) return
            const collapseFn = collapseFns.find(fn => fn.filter(ev))
            if (!collapseFn) return
            if (ev.target.closest(".md-link")) return

            document.activeElement.blur()
            const collapsed = header.classList.contains(this.className)
            collapseFn.callback(header).forEach(el => this.trigger(el, collapsed))
            this.callbackOtherPlugin()
        })

        document.querySelector(".sidebar-menu").addEventListener("click", ev => {
            const ref = ev.target.closest(".outline-item")?.querySelector(".outline-label")?.dataset.ref
            if (!ref) return
            let el = write.querySelector(`[cid=${ref}]`)
            if (!el || el.style.display !== "none") return
            this.expandCollapsedParent(el)
        })
    }

    // The option `expandSimpleBlock` will affect this plugin, disable it
    disableExpandSimpleBlock = () => File.option.expandSimpleBlock = false

    getTargetHeader = (target, forceLoose = false) => {
        if (this.config.STRICT_MODE && !forceLoose) {
            return target.closest(this.selector)
        }
        let el = target.closest("#write > [cid]")
        while (el) {
            if (el.getAttribute("mdtype") === "heading") {
                return el
            }
            el = el.previousElementSibling
        }
    }

    getCollapseFns = () => {
        const fns = {
            COLLAPSE_SINGLE: el => [el],
            COLLAPSE_SIBLINGS: this.findSiblings,
            COLLAPSE_ALL_SIBLINGS: this.findAllSiblings,
            COLLAPSE_RECURSIVE: this.findSubSiblings,
        }
        return Object.entries(fns)
            .filter(([key]) => this.config.MODIFIER_KEY[key])
            .flatMap(([key, callback]) => {
                const modifier = this.config.MODIFIER_KEY[key]
                return { filter: this.utils.modifierKey(modifier), callback }
            })
    }

    callbackOtherPlugin = () => this.utils.callPluginFunction("toc", "refresh")

    trigger = (node, collapsed) => {
        const _trigger = (node, display) => {
            const idx = this.HEADERS.indexOf(node.tagName)
            const stop = this.HEADERS.slice(0, idx + 1)

            let el = node.nextElementSibling
            while (el && stop.indexOf(el.tagName) === -1) {
                const need = this.HEADERS.indexOf(el.tagName) !== -1 && el.classList.contains(this.className) && display === ""
                if (need) {
                    el.style.display = ""
                    el = _trigger(el, "none")
                    continue
                }

                el.style.display = display
                el = el.nextElementSibling
            }
            return el
        }

        node.classList.toggle(this.className, !collapsed)
        _trigger(node, collapsed ? "" : "none")
    }

    expandCollapsedParent = node => {
        let currentLevel = this.HEADERS.indexOf(node.tagName)
        while (node) {
            if (node.getAttribute("mdtype") === "heading" && node.classList.contains(this.className)) {
                const level = this.HEADERS.indexOf(node.tagName)
                if (level < currentLevel) {
                    this.trigger(node, true)
                    currentLevel = level
                }
            }
            node = node.previousElementSibling
        }
    }

    collapseOther = node => {
        let currentLevel = this.HEADERS.indexOf(node.tagName)
        if (currentLevel === -1) return
        this.rangeSiblings(node, el => {
            const level = this.HEADERS.indexOf(el.tagName)
            if (level === -1) return
            if (level < currentLevel) {
                this.trigger(el, true)
                currentLevel = level
            } else {
                this.trigger(el, false)
            }
        })
    }

    rollback = start => {
        if (!this.utils.entities.querySelectorInWrite(`:scope > .${this.className}`)) return

        const headers = []
        let el = start.closest("#write > [cid]")
        while (el) {
            const idx = this.HEADERS.indexOf(el.tagName)
            if (idx !== -1) {
                if (headers.length === 0 || (headers.at(-1).idx > idx && el.classList.contains(this.className))) {
                    headers.push({ el, idx })
                    if (headers.at(-1).idx === 0) break
                }
            }
            el = el.previousElementSibling
        }
        if (headers.length > 0) {
            for (let i = headers.length - 1; i >= 0; i--) {
                this.trigger(headers[i].el, true)
            }
        }
    }

    rangeSiblings = (node, rangeFunc) => {
        ["previousElementSibling", "nextElementSibling"].forEach(direction => {
            for (let el = node[direction]; !!el; el = el[direction]) {
                const stop = rangeFunc(el)
                if (stop) return
            }
        })
    }

    findSiblings = node => {
        const idx = this.HEADERS.indexOf(node.tagName)
        const stop = this.HEADERS.slice(0, idx)
        const result = [node]
        this.rangeSiblings(node, el => {
            if (stop.indexOf(el.tagName) !== -1) return true
            if (el.tagName === node.tagName) result.push(el)
        })
        return result
    }

    findSubSiblings = node => {
        const idx = this.HEADERS.indexOf(node.tagName)
        const stop = this.HEADERS.slice(0, idx + 1)
        const result = [node]
        this.rangeSiblings(node, el => {
            if (stop.indexOf(el.tagName) !== -1) return true
            if (idx < this.HEADERS.indexOf(el.tagName)) result.push(el)
        })
        return result
    }

    findAllSiblings = node => this.utils.entities.querySelectorAllInWrite(`:scope > ${node.tagName}`)

    recordCollapseState = (needChange = true) => {
        if (needChange) {
            this.config.RECORD_COLLAPSE = !this.config.RECORD_COLLAPSE
        }
        if (this.config.RECORD_COLLAPSE) {
            this.utils.stateRecorder.register({
                name: this.fixedName,
                selector: this.selector,
                stateGetter: el => el.classList.contains(this.className),
                stateRestorer: el => this.trigger(el, false),
            })
        } else {
            this.utils.stateRecorder.unregister(this.fixedName)
        }
    }

    collapseAll = () => {
        for (let i = this.HEADERS.length - 1; i >= 0; i--) {
            document.getElementsByTagName(this.HEADERS[i]).forEach(el => this.trigger(el, false))
        }
    }
    expandAll = () => {
        this.HEADERS.forEach(tag => document.getElementsByTagName(tag).forEach(el => this.trigger(el, true)))
    }

    getDynamicActions = (anchorNode, meta) => {
        const getHotkey = key => {
            const modifier = this.config.MODIFIER_KEY[key]
            return modifier ? `${modifier}+click` : undefined
        }
        const target = this.getTargetHeader(anchorNode, !this.config.STRICT_MODE_IN_CONTEXT_MENU)
        const act_disabled = !target
        meta.target = target
        return this.i18n.fillActions([
            { act_value: "collapse_other", act_disabled },
            { act_value: "call_current", act_disabled, act_hotkey: getHotkey("COLLAPSE_SINGLE") },
            { act_value: "call_recursive", act_disabled, act_hotkey: getHotkey("COLLAPSE_RECURSIVE") },
            { act_value: "call_siblings", act_disabled, act_hotkey: getHotkey("COLLAPSE_SIBLINGS") },
            { act_value: "call_all_siblings", act_disabled, act_hotkey: getHotkey("COLLAPSE_ALL_SIBLINGS") },
            { act_value: "record_collapse_state", act_state: this.config.RECORD_COLLAPSE },
        ])
    }

    dynamicCall = (type, meta) => {
        const { target } = meta
        if (!target) return
        if (type === "collapse_other") {
            this.collapseOther(target)
            return
        }
        const finders = {
            call_current: el => [el],
            call_siblings: this.findSiblings,
            call_all_siblings: this.findAllSiblings,
            call_recursive: this.findSubSiblings,
        }
        const finder = finders[type]
        if (!finder) return
        const collapsed = target.classList.contains(this.className)
        finder(target)?.forEach(el => this.trigger(el, collapsed))
    }

    call = (action, meta) => {
        if (action === "collapse_all") {
            this.collapseAll()
        } else if (action === "expand_all") {
            this.expandAll()
        } else if (action === "record_collapse_state") {
            this.recordCollapseState()
        } else {
            this.dynamicCall(action, meta)
        }
        this.callbackOtherPlugin()
    }
}

module.exports = {
    plugin: CollapseParagraphPlugin
}
