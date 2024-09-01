class noImageModePlugin extends BaseCustomPlugin {
    init = () => {
        this.isNoImageMode = this.config.default_no_image_mode;
    }

    hotkey = () => [this.config.hotkey]

    enableNoImageMode = async () => {
        const renderArg = {
            transition_duration: this.config.transition_duration,
            transition_delay: this.config.transition_delay,
            opacity_on_hover: this.config.reshow_when_hover ? "100%" : "0",
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

    callback = anchorNode => this.toggleNoImageMode()
}

module.exports = {
    plugin: noImageModePlugin,
};