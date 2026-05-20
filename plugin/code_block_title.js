class InfoStringParser {
    // Match any code fence opening line: ```lang rest
    static CODEFENCE_REGEX = /^```(\S+)(.*)/
    // Extract title="xxx" from the rest of the info string
    static TITLE_REGEX = /title="([^"]+)"/

    static parse(markdown) {
        const results = []
        for (const line of markdown.split('\n')) {
            const match = line.match(this.CODEFENCE_REGEX)
            if (match) {
                const lang = match[1]
                const rest = match[2] || ''
                const titleMatch = rest.match(this.TITLE_REGEX)
                results.push({
                    lang,
                    title: titleMatch ? titleMatch[1] : null
                })
            }
        }
        return results
    }
}

class TitleManager {
    constructor(plugin) {
        this.plugin = plugin
        this._cache = []
    }

    async rescan() {
        try {
            const content = await File.getContent()
            this._cache = content ? InfoStringParser.parse(content) : []
        } catch {
            this._cache = []
        }
    }

    getTitleForFence(fenceElement) {
        if (this._cache.length === 0) return null

        // Match by document order: the Nth fence in DOM = the Nth entry in cache
        const allFences = document.querySelectorAll('.md-fences')
        let index = -1
        for (let i = 0; i < allFences.length; i++) {
            if (allFences[i] === fenceElement) { index = i; break }
        }
        if (index === -1 || index >= this._cache.length) return null
        return this._cache[index].title
    }
}

class CodeBlockTitlePlugin extends BasePlugin {
    titleManager = null
    _enabled = false

    _onFocusIn = null  // bound listener reference, for cleanup

    style = () => {
        // config is available at style() call time (set in constructor)
        const { TITLE_BAR_BG_COLOR: bg, TITLE_BAR_TEXT_COLOR: color } = this.config
        let customCSS = ''
        if (bg || color) {
            customCSS = `.code-title-bar { ${bg ? `background: ${bg} !important;` : ''} ${color ? `color: ${color} !important;` : ''} }`
        }
        return `.code-title-bar {
    font-size: 0.825em;
    padding: 6px 14px;
    border-bottom: 1px solid var(--code-title-border, #d0d0d0);
    margin-bottom: 6px;
    background: transparent;
    color: var(--code-title-text, #888);
    user-select: none;
    line-height: 1.6;
    border-radius: var(--fence-radius, 4px) var(--fence-radius, 4px) 0 0;
    font-family: var(--monospace);
    letter-spacing: 0.02em;
}

body[class*="dark"] .code-title-bar {
    --code-title-text: #aaa;
    --code-title-border: #444;
}

${customCSS}`
    }

    getDynamicActions = () => [
        { act_name: this.i18n.t("act.enable"), act_value: "enable", act_disabled: this._enabled },
        { act_name: this.i18n.t("act.disable"), act_value: "disable", act_disabled: !this._enabled },
    ]

    call = (action) => {
        if (action === "enable") {
            this._enabled = true
            document.querySelectorAll('.md-fences').forEach(fence => this.renderTitleBar(fence))
        } else {
            this._enabled = false
            document.querySelectorAll('.code-title-bar').forEach(el => el.remove())
        }
        this.utils.notification.show(this.i18n.t(this._enabled ? "modeEnabled" : "modeDisabled"))
    }

    init = () => {
        this.titleManager = new TitleManager(this)
    }

    process = () => {
        this.utils.eventHub.addEventListener(
            this.utils.eventHub.eventType.fileOpened,
            () => this.titleManager.rescan()
        )
        this.utils.eventHub.addEventListener(
            this.utils.eventHub.eventType.fileContentLoaded,
            () => this.titleManager.rescan()
        )
        this.utils.eventHub.addEventListener(
            this.utils.eventHub.eventType.afterAddCodeBlock,
            (cid) => {
                const fence = document.querySelector(`.md-fences[cid="${cid}"]`)
                if (!fence) return
                this.renderTitleBar(fence)
            }
        )
        this.utils.eventHub.addEventListener(
            this.utils.eventHub.eventType.fileEdited,
            () => this.titleManager.rescan()
        )
        this.utils.exportHelper.register(this.fixedName, function() {})

        // Initial scan: populate cache first, then render existing fences
        this.titleManager.rescan().then(() => {
            document.querySelectorAll('.md-fences').forEach(fence => {
                this.cleanLangDisplay(fence)
                this.renderTitleBar(fence)
            })
        })

        // Typora re-populates the lang-input from the lang attribute on every focus.
        // Use a delegated focusin listener to strip the info string noise persistently.
        this._onFocusIn = (e) => {
            const fence = e.target.closest('.md-fences')
            if (fence) requestAnimationFrame(() => this.cleanLangDisplay(fence))
        }
        this.utils.entities.eWrite.addEventListener('focusin', this._onFocusIn)
    }

    afterProcess = () => {
        if (this._onFocusIn) {
            this.utils.entities.eWrite.removeEventListener('focusin', this._onFocusIn)
            this._onFocusIn = null
        }
    }

    renderTitleBar = (fence) => {
        if (!this._enabled) return
        if (fence.querySelector('.code-title-bar')) return

        const title = this.titleManager.getTitleForFence(fence)
        if (!title) return

        const bar = document.createElement('div')
        bar.className = 'code-title-bar'
        bar.textContent = title
        fence.insertBefore(bar, fence.firstChild)
    }

    cleanLangDisplay = (fence) => {
        if (!this._enabled) return
        // Strip the full info string from the language badge for clean UI display.
        // Only modifies the visible text, NOT the lang attribute (which would trigger Typora source rewrite).
        const langInput = fence.querySelector('.ty-cm-lang-input')
        if (!langInput) return
        const text = langInput.textContent
        if (!text || !/\s/.test(text)) return
        langInput.textContent = text.split(/\s+/)[0]
    }
}

module.exports = {
    plugin: CodeBlockTitlePlugin
}
