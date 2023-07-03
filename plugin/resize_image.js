(() => {
    const config = {
        ENABLE: true,
    }

    if (!config.ENABLE) {
        return
    }

    document.getElementById("write").addEventListener("wheel", ev => {
        if (!ev.ctrlKey) {
            return
        }

        const target = ev.target.closest("img");
        if (!target) {
            return;
        }

        ev.stopPropagation();

        const scale = 0.1;
        const direction = ev.deltaY;

        let width = (!target.style.width) ? target.naturalWidth : parseInt(target.style.width.replace("px", ""));
        width = (direction > 0) ? width * (1 - scale) : width * (1 + scale);
        width = Math.min(width, target.parentElement.offsetWidth);
        target.style.width = width + "px";
    }, true);

    console.log("resize_image.js had been injected");
})()
