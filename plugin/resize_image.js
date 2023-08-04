(() => {
    const config = {
        // 滚动的放缩倍率
        SCALE: 0.1,
        // 图片水平位置：center/left/right
        IMAGE_ALIGN: "center",
    }

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;

    const getWidth = image => {
        const {width} = image.getBoundingClientRect();
        return (!image.style.width) ? width : parseInt(image.style.width.replace("px", ""));
    }

    const zoom = (target, width, zoomOut, scale) => {
        width = zoomOut ? width * (1 - scale) : width * (1 + config.SCALE);
        const maxWidth = target.parentElement.offsetWidth
        width = Math.min(width, maxWidth);
        target.style.width = width + "px";

        if (config.IMAGE_ALIGN !== "center") {
            target.setAttribute("align", config.IMAGE_ALIGN);
            const margin = (config.IMAGE_ALIGN === "left") ? "marginRight" : "marginLeft";
            target.style[margin] = maxWidth - width + "px";
        }
    }

    document.getElementById("write").addEventListener("wheel", ev => {
        if (!metaKeyPressed(ev)) return;

        const target = ev.target.closest("img");
        if (!target) return;

        ev.stopPropagation();

        const width = getWidth(target);
        const zoomOut = ev.deltaY > 0;
        zoom(target, width, zoomOut, config.SCALE);
    }, true);

    //////////////////////// 以下是声明式插件系统代码 ////////////////////////
    const dynamicUtil = {target: null}
    const dynamicCallArgsGenerator = anchorNode => {
        const images = anchorNode.closest("#write .md-image");
        if (!images) return;

        const target = images.querySelector("img");
        if (!target) return;

        dynamicUtil.target = target;

        const args = [{arg_name: "缩小20%", arg_value: "zoom_out_20_percent"}]
        if (getWidth(target) < target.parentElement.offsetWidth) {
            args.push({arg_name: "放大20%", arg_value: "zoom_in_20_percent"})
        }
        return args
    }

    const call = type => {
        if (!dynamicUtil.target) return;

        const width = getWidth(dynamicUtil.target);

        if (type === "zoom_out_20_percent") {
            zoom(dynamicUtil.target, width, true, 0.2)
        } else if (type === "zoom_in_20_percent") {
            zoom(dynamicUtil.target, width, false, 0.2)
        }

        dynamicUtil.target = null;
    }

    module.exports = {
        config,
        call,
        dynamicCallArgsGenerator,
    };

    console.log("resize_image.js had been injected");
})()
