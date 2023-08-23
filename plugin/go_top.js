class goTopPlugin extends global._basePlugin {
    html = () => {
        const goTop = document.createElement("div");
        goTop.id = this.config.DIV_ID;
        goTop.style.position = "fixed";
        goTop.style.right = "50px";
        goTop.style.bottom = "50px";
        goTop.style.zIndex = "99999";
        goTop.style.cursor = "pointer";
        goTop.style.fontSize = "50px";
        goTop.style.color = this.config.COLOR;
        goTop.style.display = "none";
        const i = document.createElement("i");
        i.classList.add("ion-arrow-up-c");
        goTop.appendChild(i);
        this.utils.insertDiv(goTop);
    }

    init = () => {
        this.goTop = document.getElementById(this.config.DIV_ID);
    }

    process = () => {
        this.init();

        document.getElementById(this.config.DIV_ID).addEventListener("click", ev => {
            this.call();
            ev.preventDefault();
            ev.stopPropagation();
        });

        const content = document.querySelector("content");
        content.addEventListener("scroll", () => {
            this.goTop.style.display = (content.scrollTop > this.config.THRESHOLD) ? "" : "none";
        })
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