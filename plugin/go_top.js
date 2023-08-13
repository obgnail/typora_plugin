(() => {
    const config = global._pluginUtils.getPluginSetting("go_top");

    const goTop = document.createElement("div");
    goTop.id = config.DIV_ID;
    goTop.style.position = "fixed";
    goTop.style.right = "50px";
    goTop.style.bottom = "50px";
    goTop.style.zIndex = "99999";
    goTop.style.cursor = "pointer";
    goTop.style.fontSize = "50px";
    goTop.style.color = config.COLOR;
    goTop.style.display = "none";
    const i = document.createElement("i");
    i.classList.add("ion-arrow-up-c");
    goTop.appendChild(i);
    document.querySelector("body").appendChild(goTop);

    document.getElementById(config.DIV_ID).addEventListener("click", ev => {
        call();
        ev.preventDefault();
        ev.stopPropagation();
    });

    const content = document.querySelector("content");
    content.addEventListener("scroll", ev => {
        goTop.style.display = (content.scrollTop > config.THRESHOLD) ? "" : "none";
    })

    const call = direction => {
        let scrollTop = '0';
        if (direction === "go-bottom") {
            scrollTop = document.querySelector("#write").getBoundingClientRect().height;
        }
        $("content").animate({scrollTop: scrollTop}, config.SCROLL_TIME);
    }

    module.exports = {
        call,
    };
    console.log("go_top.js had been injected");
})()