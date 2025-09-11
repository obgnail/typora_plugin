class staticMarkersPlugin extends BasePlugin {
    beforeProcess = () => {
        this.cssId = this.utils.styleTemplater.getID(this.fixedName)
        this.enableStaticMarkers = this.config.ENABLE
    }

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    styleTemplate = () => true

    getDynamicActions = () => this.i18n.fillActions([{ act_value: "toggle_state", act_state: this.enableStaticMarkers }])

    call = async (action, meta) => {
        this.enableStaticMarkers = !this.enableStaticMarkers
        if (this.enableStaticMarkers) {
            await this.utils.styleTemplater.register(this.fixedName)
        } else {
            this.utils.removeStyle(this.cssId)
        }
    }
}

module.exports = {
    plugin: staticMarkersPlugin
}
