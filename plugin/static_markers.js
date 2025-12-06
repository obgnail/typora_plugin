class StaticMarkersPlugin extends BasePlugin {
    beforeProcess = () => {
        this.enabled = this.config.ENABLE
        this.SELECTORS = {
            strong: '.md-pair-s[md-inline="strong"] .md-meta',
            em: '.md-pair-s[md-inline="em"] .md-meta',
            del: '.md-pair-s[md-inline="del"] .md-meta',
            underline: '.md-pair-s[md-inline="underline"] .md-meta',
            highlight: '.md-pair-s[md-inline="highlight"] .md-meta',
            superscript: '.md-pair-s[md-inline="superscript"] .md-meta',
            subscript: '.md-pair-s[md-inline="subscript"] .md-meta',
            code: '.md-pair-s[md-inline="code"] .md-meta',
            inlineMath: '.md-inline-math[md-inline="inline_math"] .md-meta',
            image: '.md-image.md-img-loaded[md-inline="image"] .md-meta',
            // errorImage: '.md-image.md-img-error[md-inline="image"] .md-meta',
            link: '.md-link[md-inline="link"] .md-meta, .md-link[md-inline="link"] .md-content',
            emoji: '.md-emoji[md-inline="emoji"] .md-meta',
            footnote: '.md-footnote[md-inline="footnote"] .md-meta',
            inlineHTML: '.md-html-inline[md-inline="html_inline"] .md-meta',
        }
        this._reloadCSS()
    }

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    getDynamicActions = () => {
        const general = { act_value: "ENABLE", act_state: this.enabled, act_name: this.i18n.t("act.toggle_state") }
        const specific = Object.keys(this.SELECTORS).map(s => {
            const act_name = this.i18n.t(`$option.STATIC_MARKERS.${s}`)
            const act_state = this.config.STATIC_MARKERS.includes(s)
            return { act_value: s, act_name, act_state }
        })
        return this.enabled ? [general, ...specific] : [general]
    }

    call = async (action, meta) => {
        if (action === "ENABLE") {
            this.enabled = !this.enabled
        } else {
            const set = new Set(this.config.STATIC_MARKERS)
            set.has(action) ? set.delete(action) : set.add(action)
            this.config.STATIC_MARKERS = [...set]
            await this.utils.settings.saveSettings(this.fixedName, { STATIC_MARKERS: this.config.STATIC_MARKERS })
        }
        this._reloadCSS()
    }

    _getCSS = (staticMarkers = this.config.STATIC_MARKERS) => {
        if (!this.enabled) return ""
        const selector = staticMarkers.map(marker => this.SELECTORS[marker]).filter(Boolean).join(", ")
        return selector ? `${selector} { display: inline !important; opacity: inherit !important; }` : ""
    }

    _reloadCSS = () => {
        const id = this.utils.styleTemplater.getID(this.fixedName)
        this.utils.removeStyle(id)
        this.utils.insertStyle(id, this._getCSS())
    }
}

module.exports = {
    plugin: StaticMarkersPlugin
}
