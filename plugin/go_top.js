(() => {
    const config = {
        ENABLE: true,
    }

    if (!config.ENABLE) {
        return
    }

    (() => {
        const div = document.createElement("div");
        div.id = 'typora-go-top';
        div.innerHTML = `<a href="javascript:;" title="返回顶部">goTop</a>`;
        div.style.position = "fixed";
        div.style.right = "40px";
        div.style.bottom = "40px";
        div.style.zIndex = "99999";
        const body = document.querySelector("body");
        body.appendChild(div);

        document.getElementById("typora-go-top").addEventListener("click", ev => {
            $("content").animate({scrollTop: '0'}, 600);
        })
    })()

    console.log("go_top.js had been injected");
})()