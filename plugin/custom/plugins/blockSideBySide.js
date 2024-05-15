class blockSideBySide extends BaseCustomPlugin {
    styleTemplate = () => true

    callback = async () => {
        const enable = this.utils.getStyleContent(this.fixedName);
        const func = enable ? "unregisterStyleTemplate" : "registerStyleTemplate";
        await this.utils[func](this.fixedName);
    }
}

module.exports = {
    plugin: blockSideBySide,
};