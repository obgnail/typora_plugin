(() => {
    const config = {
        // 滚动的放缩倍率
        SCALE: 0.1,
    }

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;

    document.getElementById("write").addEventListener("wheel", ev => {
        if (!metaKeyPressed(ev)) {
            return
        }

        const target = ev.target.closest("img");
        if (!target) {
            return;
        }

        ev.stopPropagation();

        const direction = ev.deltaY;

        let width = (!target.style.width) ? target.naturalWidth : parseInt(target.style.width.replace("px", ""));
        width = (direction > 0) ? width * (1 - config.SCALE) : width * (1 + config.SCALE);
        width = Math.min(width, target.parentElement.offsetWidth);
        requestAnimationFrame(() => target.style.width = width + "px");
    }, true);

    console.log("resize_image.js had been injected");
})()
