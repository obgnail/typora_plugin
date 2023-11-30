class goTopPlugin extends BasePlugin {
    hotkey = () => [
        {hotkey: this.config.HOTKEY_GO_TOP, callback: this.call},
        {hotkey: this.config.HOTKEY_GO_BOTTOM, callback: () => this.call("go-bottom")},
    ]

    process = () => {
        if (this.config.USE_BUTTON) {
            const call_ = (ev, target, action) => this.call(action);
            this.utils.registerQuickButton("go-top", [1, 0], "到顶部", "fa fa-angle-up", null, call_);
            this.utils.registerQuickButton("go-bottom", [0, 0], "到底部", "fa fa-angle-down", null, call_);
        }
    }

    call = direction => {
        const scrollTop = (direction === "go-bottom") ? document.querySelector("#write").getBoundingClientRect().height : "0";
        $("content").animate({scrollTop: scrollTop}, this.config.SCROLL_TIME);
    }
}

module.exports = {
    plugin: goTopPlugin,
};