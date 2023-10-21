class quickButtonPlugin extends BaseCustomPlugin {
    process = () => {
        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            this.config.buttons.forEach(btn => {
                const [fixedName, func] = btn.callback.split(".");
                const plugin = this.utils.getPlugin(fixedName) || this.utils.getCustomPlugin(fixedName);
                if (plugin && plugin[func]) {
                    const style = btn.font_size ? {fontSize: btn.font_size} : undefined;
                    this.utils.registerQuickButton(btn.action, btn.coordinate, btn.hint, btn.icon, style, plugin[func]);
                }
            })
        })
    }
}

module.exports = {
    plugin: quickButtonPlugin
};