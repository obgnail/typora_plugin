const { LoadPlugins } = require("../global/core/plugin")

class CustomPlugin extends BasePlugin {
    beforeProcess = async () => {
        const settings = await this.utils.settings.readCustomPluginSettings()
        const { enable } = await LoadPlugins(settings)
        this.settings = settings  // all plugin settings
        this.plugins = enable     // all enabled plugins
        await this.fixCallback()
    }

    hotkey = () => {
        const isStr = s => typeof s === "string"
        const hotkeys = []
        for (const [fixedName, plugin] of Object.entries(this.plugins)) {
            if (!plugin || !this.utils.hasOverrideCustomPluginFn(plugin, "hotkey")) continue
            try {
                const hotkey = plugin.hotkey()
                const isArr = Array.isArray(hotkey)
                if (isStr(hotkey) || (isArr && hotkey.every(isStr))) {
                    hotkeys.push({ hotkey, callback: plugin.callback })
                } else if (isArr && hotkey.every(this.utils.isObject)) {
                    hotkeys.push(...hotkey)
                }
            } catch (e) {
                console.error(`Register ${fixedName} hotkey error: ${e}`)
            }
        }
        return hotkeys
    }

    getDynamicActions = (anchorNode, meta, notInContextMenu) => {
        const actHint = {
            unknown: this.i18n._t("global", "error.unknown"),
            disabledForever: this.i18n.t("actHint.disabledForever"),
            disabledTemp: this.i18n.t("actHint.disabledTemp")
        }
        const settings = Object.entries(this.settings).sort(([, { order: o1 = 1 }], [, { order: o2 = 1 }]) => o1 - o2)

        meta.target = anchorNode
        const dynamicActions = []
        for (const [fixedName, setting] of settings) {
            if (!notInContextMenu && setting.hide) continue

            const plugin = this.plugins[fixedName]
            if (!plugin) continue

            const act = {
                act_name: plugin.pluginName,
                act_value: plugin.fixedName,
                act_disabled: true,
                act_hidden: false,
                act_hint: actHint.unknown,
                act_hotkey: plugin.config.hotkey,
            }
            try {
                const selector = plugin.selector(false)
                if (selector === this.utils.disableForeverSelector) {
                    act.act_hint = actHint.disabledForever
                } else {
                    act.act_disabled = selector && !anchorNode.closest(selector)
                    act.act_hint = plugin.hint(act.act_disabled)
                    if (act.act_disabled) {
                        act.act_hint = act.act_hint || actHint.disabledTemp
                    }
                }
            } catch (e) {
                console.error(`Plugin ${fixedName} selector error: ${e}`)
            }

            if (this.config.HIDE_DISABLE_PLUGINS && act.act_disabled) continue

            dynamicActions.push(act)
        }
        return dynamicActions
    }

    call = (fixedName, meta) => {
        const plugin = this.plugins[fixedName]
        if (!plugin) return
        try {
            const selector = plugin.selector(true)
            const target = selector ? meta.target.closest(selector) : meta.target
            plugin.callback(target)
        } catch (e) {
            console.error(`Plugin ${plugin.fixedName} callback error: ${e}`)
        }
    }

    fixCallback = async () => {
        const { hasOverrideCustomPluginFn: hasOverride } = this.utils
        for (const plugin of Object.values(this.plugins)) {
            if (!plugin || !hasOverride(plugin, "callback") || !hasOverride(plugin, "selector")) continue
            const originCallback = plugin.callback
            plugin.callback = anchorNode => {
                if (!anchorNode) {
                    const anchor = this.utils.getAnchorNode()?.[0]
                    const selector = plugin.selector(true)
                    anchorNode = (selector && anchor) ? anchor.closest(selector) : anchor
                }
                originCallback(anchorNode)
            }
        }
    }
}

module.exports = {
    plugin: CustomPlugin
}
