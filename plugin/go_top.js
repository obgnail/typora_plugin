class goTopPlugin extends global._basePlugin {
    style = () => {
        return `
            #${this.config.DIV_ID} {
                position: fixed;
                right: 30px;
                bottom: 50px;
                z-index: 9998;
                font-size: 28px;
                text-align: center;
                color: ${this.config.COLOR};
            }
            
            #${this.config.DIV_ID} .action-item {
                width: 35px;
                height: 35px;
                margin-top: 10px;
                cursor: pointer;
                box-shadow: rgba(0, 0, 0, 0.07) 0px 0px 10px;
                border-radius: 4px;
            }
            
            #${this.config.DIV_ID} .action-item:hover {
                background-color: ${this.config.HOVER_COLOR};
            }
            
            #${this.config.DIV_ID} .action-item i {
                display: block;
                line-height: 35px;
            }
        `
    }

    html = () => {
        const wrap = document.createElement("div");
        wrap.id = this.config.DIV_ID;
        wrap.innerHTML = `
            <div class="action-item" action="go-top"><i class="fa fa-angle-up"></i></div>
            <div class="action-item" action="go-bottom"><i class="fa fa-angle-down"></i></div>`;
        this.utils.insertDiv(wrap);
    }

    process = () => {
        document.getElementById(this.config.DIV_ID).addEventListener("click", ev => {
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