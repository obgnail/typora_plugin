class resizeImagePlugin extends BasePlugin {
    init = () => {
        this.checklist = Object.entries(this.config.MODIFIER_KEY)
            .filter(([_, modifier]) => Boolean(modifier))
            .map(([type, modifier]) => ({ type, checker: this.utils.modifierKey(modifier) }))
    }

    process = () => {
        this.utils.runtime.autoSaveConfig(this);
        this.recordResizeState(false);

        this.utils.entities.eWrite.addEventListener("wheel", ev => {
            const zoom = this.checklist.find(e => e.checker(ev));
            if (!zoom) return;
            const target = ev.target.closest("img");
            if (!target) return;
            ev.preventDefault();
            ev.stopPropagation();
            const zoomFunc = zoom.type === "TEMPORARY" ? this.zoomTemporary : this.zoomPersistent;
            zoomFunc(target, ev.deltaY > 0);
        }, { passive: false, capture: true });
    }

    recordResizeState = (needChange = true) => {
        if (needChange) {
            this.config.RECORD_RESIZE = !this.config.RECORD_RESIZE;
        }
        const name = "recordResizeImage";
        if (this.config.RECORD_RESIZE) {
            this.utils.stateRecorder.register(name, "#write img", ele => ele.style.cssText, (ele, state) => ele.style = state);
        } else {
            this.utils.stateRecorder.unregister(name);
        }
    }

    resetImageSize = () => {
        this.config.ALLOW_OVERSIZE = !this.config.ALLOW_OVERSIZE;
        if (!this.config.ALLOW_OVERSIZE) {
            this.utils.entities.querySelectorAllInWrite("img").forEach(image => {
                if (image.style.maxWidth) {
                    const maxSize = image.parentElement.offsetWidth;
                    if (this.getWidth(image) > maxSize) {
                        image.style.removeProperty("width");
                    }
                    image.style.removeProperty("maxWidth");
                }
                image.style.removeProperty("left");
                image.style.removeProperty("position");
            })
        }
    }

    getWidth = image => image.style.width ? parseFloat(image.style.width) : image.getBoundingClientRect().width

    setAlign = (align, image, maxWidth) => {
        image.setAttribute("align", align);
        if (!maxWidth) {
            maxWidth = image.parentElement.offsetWidth;
        }
        image.style.marginRight = "";
        image.style.marginLeft = "";
        if (align !== "center") {
            const width = this.getWidth(image);
            const margin = (align === "left") ? "marginRight" : "marginLeft";
            image.style[margin] = maxWidth - width + "px";
        }
    }

    zoomTemporary = (image, zoomOut, scale = 0.1) => {
        let width = this.getWidth(image);
        width = zoomOut ? width * (1 - scale) : width * (1 + scale);
        const maxWidth = image.parentElement.offsetWidth;
        image.style.maxWidth = "";

        if (!this.config.ALLOW_OVERSIZE || width <= maxWidth) {
            width = Math.min(width, maxWidth);
            image.style.width = width + "px";
            this.setAlign(this.config.IMAGE_ALIGN, image, maxWidth);
        } else {
            Object.assign(image.style, {
                position: "relative",
                width: width + "px",
                maxWidth: width + "px",
                left: (maxWidth - width) / 2 + "px",
            })
        }
    }

    zoomPersistent = (image, zoomOut, scale = 5) => {
        const originZoom = image.style.zoom || "100%";
        const nextZoom = Math.max(10, Math.min(parseInt(originZoom) + (zoomOut ? -scale : scale), 200)) + "%";
        Object.assign(image.style, { position: "", width: "", maxWidth: "", left: "" });
        const $span = $(image.closest(".md-image.md-img-loaded"));
        if ($span.length === 1) {
            File.editor.imgEdit.zoomAction($span, nextZoom);
        }
    }

    dynamicCallArgsGenerator = (anchorNode, meta) => {
        const args = [
            { arg_name: "记住图片放缩状态", arg_value: "record_resize_state", arg_state: this.config.RECORD_RESIZE },
            { arg_name: "允许图片超出范围", arg_value: "allow_oversize", arg_state: this.config.ALLOW_OVERSIZE },
        ];

        const images = anchorNode.closest("#write .md-image");
        if (!images) return args;
        const image = images.querySelector("img");
        if (!image) return args;

        meta.target = image;

        args.push({ arg_name: "缩小20%", arg_value: "zoom_out_20_percent" })
        if (this.getWidth(image) < image.parentElement.offsetWidth) {
            args.push({ arg_name: "放大20%", arg_value: "zoom_in_20_percent" })
        }
        args.push(
            { arg_name: "靠左", arg_value: "set_align_left" },
            { arg_name: "居中", arg_value: "set_align_center" },
            { arg_name: "靠右", arg_value: "set_align_right" },
        )
        return args
    }

    call = (type, meta) => {
        const callMap = {
            record_resize_state: () => this.recordResizeState(),
            allow_oversize: () => this.resetImageSize(),
            zoom_out_20_percent: meta => this.zoomTemporary(meta.target, true, 0.2),
            zoom_in_20_percent: meta => this.zoomTemporary(meta.target, false, 0.2),
            set_align_left: meta => this.setAlign("left", meta.target),
            set_align_center: meta => this.setAlign("center", meta.target),
            set_align_right: meta => this.setAlign("right", meta.target),
        }
        const func = callMap[type];
        func && func(meta);
    }
}

module.exports = {
    plugin: resizeImagePlugin
};