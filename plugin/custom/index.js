class CustomPlugin extends BasePlugin {
    beforeProcess = async () => {
        this.plugins = {}          // enabled plugins
        this.pluginsSettings = {}  // all plugin configurations
        await new customPluginLoader(this).process()
    }

    hotkey = () => {
        const isString = s => typeof s === "string"
        const hotkeys = [];
        for (const [fixedName, plugin] of Object.entries(this.plugins)) {
            if (!plugin || !plugin.hasOwnProperty("hotkey")) continue;
            try {
                const hotkey = plugin.hotkey();
                if (isString(hotkey) || (Array.isArray(hotkey) && hotkey.every(isString))) {
                    hotkeys.push({ hotkey, callback: plugin.callback });
                } else if (Array.isArray(hotkey) && hotkey.every(this.utils.isObject)) {
                    hotkeys.push(...hotkey);
                }
            } catch (e) {
                console.error("register hotkey error:", fixedName, e);
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
        const settings = Object.entries(this.pluginsSettings).sort(([, { order: o1 = 1 }], [, { order: o2 = 1 }]) => o1 - o2)

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
                console.error("plugin selector error:", fixedName, e)
            }

            if (this.config.HIDE_DISABLE_PLUGINS && act.act_disabled) continue

            dynamicActions.push(act)
        }
        return dynamicActions
    }

    call = (fixedName, meta) => {
        const plugin = this.plugins[fixedName];
        if (!plugin) return;
        try {
            const selector = plugin.selector(true);
            const target = selector ? meta.target.closest(selector) : meta.target;
            plugin.callback(target);
        } catch (e) {
            console.error("plugin callback error", plugin.fixedName, e);
        }
    }
}

class customPluginLoader {
    constructor(plugin) {
        this.controller = plugin
        this.utils = plugin.utils
        this.i18n = plugin.i18n
        this.config = plugin.config
    }

    loadCustomPlugins = async settings => {
        const { enable, disable, stop, error, nosetting } = await global.LoadPlugins(settings)
        this.controller.plugins = enable
    }

    fixCallback = async () => {
        for (const plugin of Object.values(this.controller.plugins)) {
            if (!plugin || !plugin.hasOwnProperty("callback") || !plugin.hasOwnProperty("selector")) continue
            const originCallback = plugin.callback
            plugin.callback = anchorNode => {
                if (!anchorNode) {
                    const $anchor = this.utils.getAnchorNode()
                    const anchor = $anchor && $anchor[0]
                    const selector = plugin.selector(true)
                    anchorNode = (selector && anchor) ? anchor.closest(selector) : anchor
                }
                originCallback(anchorNode)
            }
        }
    }

    process = async () => {
        const settings = await this.utils.settings.readCustomPluginSettings()
        this.controller.pluginsSettings = settings
        await this.loadCustomPlugins(settings)
        await this.fixCallback()
        this.utils.eventHub.publishEvent(this.utils.eventHub.eventType.allCustomPluginsHadInjected)
    }
}

module.exports = {
    plugin: CustomPlugin
}
