class quickButtonPlugin extends BaseCustomPlugin {
    process = () => {
        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            this.config.buttons.forEach(btn => {
                if (btn.disable) return;
                const [fixedName, func] = btn.callback.split(".");
                const plugin = this.utils.getPlugin(fixedName) || this.utils.getCustomPlugin(fixedName);
                const callback = plugin && plugin[func];
                if (callback instanceof Function) {
                    const style = btn.size ? {fontSize: btn.size} : undefined;
                    const action = btn.action || this.utils.randomString();
                    this.utils.registerQuickButton(action, btn.coordinate, btn.hint, btn.icon, style, callback);
                }
            })
        })
    }
}

module.exports = {
    plugin: quickButtonPlugin
};