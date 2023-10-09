class goTopPlugin extends global._basePlugin {
    styleTemplate = () => true

    htmlTemplate = () => [{
        id: "plugin-go-top",
        children: [
            {class_: "action-item", action: "go-top", children: [{ele: "i", class_: "fa fa-angle-up"}]},
            {class_: "action-item", action: "go-bottom", children: [{ele: "i", class_: "fa fa-angle-down"}]},
        ]
    }]

    hotkey = () => [
        {hotkey: this.config.HOTKEY_GO_TOP, callback: this.call},
        {hotkey: this.config.HOTKEY_GO_BOTTOM, callback: () => this.call("go-bottom")},
    ]

    process = () => {
        document.getElementById("plugin-go-top").addEventListener("click", ev => {
            const target = ev.target.closest(".action-item");
            if (target) {
                const action = target.getAttribute("action");
                if (action) {
                    this.call(action);
                    ev.preventDefault();
                    ev.stopPropagation();
                }
            }
        });
    }

    call = direction => {
        const scrollTop = (direction === "go-bottom") ? document.querySelector("#write").getBoundingClientRect().height : "0";
        $("content").animate({scrollTop: scrollTop}, this.config.SCROLL_TIME);
    }
}

module.exports = {
    plugin: goTopPlugin,
};