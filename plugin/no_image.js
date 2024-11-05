class noImageModePlugin extends BasePlugin {
    init = () => {
        this.isNoImageMode = this.config.DEFAULT_NO_IMAGE_MODE;
    }

    hotkey = () => [this.config.HOTKEY]

    enableNoImageMode = async () => {
        const renderArg = {
            transition_duration: this.config.TRANSITION_DURATION,
            transition_delay: this.config.TRANSITION_DELAY,
            opacity_on_hover: this.config.RESHOW_WHEN_HOVER ? "100%" : "0",
        }
        await this.utils.styleTemplater.register(this.fixedName, renderArg);
        this.isNoImageMode = true;
    }

    disableNoImageMode = () => {
        this.utils.styleTemplater.unregister(this.fixedName);
        this.isNoImageMode = false;
    }

    toggleNoImageMode = async () => {
        const func = this.isNoImageMode ? this.disableNoImageMode : this.enableNoImageMode
        await func();
        this.utils.notification.show(this.isNoImageMode ? "无图模式已启用" : "无图模式已关闭");
    }

    process = () => this.isNoImageMode && this.enableNoImageMode();

    call = (type, meta) => this.toggleNoImageMode()
}

module.exports = {
    plugin: noImageModePlugin,
};