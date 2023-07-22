(() => {
    const config = {
        // 距顶部50像素开始显示
        THRESHOLD: 50,
    }

    const goTopDiv = document.createElement("div");
    goTopDiv.id = 'typora-go-top';
    goTopDiv.innerHTML = `<i class="ion-arrow-up-c"></i>`;
    goTopDiv.style.position = "fixed";
    goTopDiv.style.right = "50px";
    goTopDiv.style.bottom = "50px";
    goTopDiv.style.zIndex = "99999";
    goTopDiv.style.cursor = "pointer"
    goTopDiv.style.fontSize = "50px";
    goTopDiv.style.color = "#ffafa3";
    goTopDiv.style.display = "none";
    const body = document.querySelector("body");
    body.appendChild(goTopDiv);

    document.getElementById("typora-go-top").addEventListener("click", ev => {
        $("content").animate({scrollTop: '0'}, 600);
    })

    const content = document.querySelector("content");
    content.addEventListener("scroll", ev => {
        goTopDiv.style.display = (content.scrollTop > config.THRESHOLD) ? "block" : "none";
    })

    console.log("go_top.js had been injected");
})()