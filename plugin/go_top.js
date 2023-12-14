class goTopPlugin extends BasePlugin {
    hotkey = () => [
        {hotkey: this.config.HOTKEY_GO_TOP, callback: this.goTop},
        {hotkey: this.config.HOTKEY_GO_BOTTOM, callback: this.goBottom},
    ]

    call = direction => {
        const scrollTop = (direction === "go-bottom") ? document.querySelector("#write").getBoundingClientRect().height : 0;
        $("content").animate({scrollTop: scrollTop}, this.config.SCROLL_TIME);
    }

    goTop = () => this.call("go-top")

    goBottom = () => this.call("go-bottom")
}

module.exports = {
    plugin: goTopPlugin,
};