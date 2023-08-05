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

    const setAlign = (align, image, maxWidth) => {
        image.setAttribute("align", align);
        if (!maxWidth) {
            maxWidth = image.parentElement.offsetWidth;
        }
        image.style.marginRight = "";
        image.style.marginLeft = "";
        if (align !== "center") {
            const width = getWidth(image);
            const margin = (align === "left") ? "marginRight" : "marginLeft";
            image.style[margin] = maxWidth - width + "px";
        }
    }

    const zoom = (image, zoomOut, scale) => {
        let width = getWidth(image);
        width = zoomOut ? width * (1 - scale) : width * (1 + config.SCALE);
        const maxWidth = image.parentElement.offsetWidth;
        width = Math.min(width, maxWidth);
        image.style.width = width + "px";
        setAlign(config.IMAGE_ALIGN, image, maxWidth);
    }

    document.getElementById("write").addEventListener("wheel", ev => {
        if (!metaKeyPressed(ev)) return;

        const target = ev.target.closest("img");
        if (!target) return;

        ev.stopPropagation();

        const zoomOut = ev.deltaY > 0;
        zoom(target, zoomOut, config.SCALE);
    }, true);

    //////////////////////// 以下是声明式插件系统代码 ////////////////////////
    const dynamicUtil = {target: null}
    const dynamicCallArgsGenerator = anchorNode => {
        const images = anchorNode.closest("#write .md-image");
        if (!images) return;

        const image = images.querySelector("img");
        if (!image) return;

        dynamicUtil.target = image;

        const args = [{arg_name: "缩小20%", arg_value: "zoom_out_20_percent"}];
        if (getWidth(image) < image.parentElement.offsetWidth) {
            args.push({arg_name: "放大20%", arg_value: "zoom_in_20_percent"})
        }
        args.push(
            {arg_name: "靠左", arg_value: "set_align_left"},
            {arg_name: "居中", arg_value: "set_align_center"},
            {arg_name: "靠右", arg_value: "set_align_right"},
        )
        return args
    }

    const dynamicCallMap = {
        zoom_out_20_percent: () => zoom(dynamicUtil.target, true, 0.2),
        zoom_in_20_percent: () => zoom(dynamicUtil.target, false, 0.2),
        set_align_left: () => setAlign("left", dynamicUtil.target),
        set_align_center: () => setAlign("center", dynamicUtil.target),
        set_align_right: () => setAlign("right", dynamicUtil.target),
    }

    const call = type => {
        if (!dynamicUtil.target) return;

        const func = dynamicCallMap[type];
        func && func();
    }

    module.exports = {
        config,
        call,
        dynamicCallArgsGenerator,
    };

    console.log("resize_image.js had been injected");
})()
