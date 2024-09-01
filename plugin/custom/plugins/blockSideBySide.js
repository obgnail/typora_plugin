class blockSideBySidePlugin extends BaseCustomPlugin {
    hotkey = () => [this.config.hotkey]

    styleTemplate = () => true

    callback = async anchorNode => {
        const enable = this.utils.styleTemplater.getStyleContent(this.fixedName);
        const func = enable ? "unregister" : "register";
        await this.utils.styleTemplater[func](this.fixedName);
    }
}

module.exports = {
    plugin: blockSideBySidePlugin,
};