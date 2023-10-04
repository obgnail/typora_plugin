class goTopPlugin extends global._basePlugin {
    styleTemplate = () => true

    html = () => {
        const wrap = document.createElement("div");
        wrap.id = "plugin-go-top";
        wrap.innerHTML = `
            <div class="action-item" action="go-top"><i class="fa fa-angle-up"></i></div>
            <div class="action-item" action="go-bottom"><i class="fa fa-angle-down"></i></div>`;
        this.utils.insertDiv(wrap);
    }

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
        let scrollTop = '0';
        if (direction === "go-bottom") {
            scrollTop = document.querySelector("#write").getBoundingClientRect().height;
        }
        $("content").animate({scrollTop: scrollTop}, this.config.SCROLL_TIME);
    }
}

module.exports = {
    plugin: goTopPlugin,
};