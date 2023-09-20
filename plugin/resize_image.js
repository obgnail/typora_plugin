class resizeImagePlugin extends global._basePlugin {
    init = () => {
        this.dynamicUtil = {target: null}
        this.dynamicCallMap = {
            allow_oversize: () => this.resetImageSize(),
            zoom_out_20_percent: () => this.zoom(this.dynamicUtil.target, true, 0.2),
            zoom_in_20_percent: () => this.zoom(this.dynamicUtil.target, false, 0.2),
            set_align_left: () => this.setAlign("left", this.dynamicUtil.target),
            set_align_center: () => this.setAlign("center", this.dynamicUtil.target),
            set_align_right: () => this.setAlign("right", this.dynamicUtil.target),
        }
    }

    process = () => {
        this.init();

        if (this.config.RECORD_RESIZE) {
            new resizeRecorder(this).process();
        }

        document.getElementById("write").addEventListener("wheel", ev => {
            if (!this.utils.metaKeyPressed(ev)) return;

            const target = ev.target.closest("img");
            if (!target) return;

            ev.stopPropagation();

            const zoomOut = ev.deltaY > 0;
            this.zoom(target, zoomOut, this.config.SCALE);
        }, true);
    }

    resetImageSize = () => {
        this.config.ALLOW_OVERSIZE = !this.config.ALLOW_OVERSIZE;

        if (!this.config.ALLOW_OVERSIZE) {
            document.querySelectorAll("#write img").forEach(image => {
                if (image.style.maxWidth) {
                    const maxSize = image.parentElement.offsetWidth;
                    if (this.getWidth(image) > maxSize) {
                        image.style.width = "";
                    }
                    image.style.maxWidth = "";
                }
                if (image.style.left) {
                    image.style.left = "";
                }
                if (image.style.position) {
                    image.style.position = "";
                }
            })
        }
    }

    getWidth = image => {
        const {width} = image.getBoundingClientRect();
        return (!image.style.width) ? width : parseInt(image.style.width.replace("px", ""));
    }

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

    zoom = (image, zoomOut, scale) => {
        let width = this.getWidth(image);
        width = zoomOut ? width * (1 - scale) : width * (1 + this.config.SCALE);
        const maxWidth = image.parentElement.offsetWidth;
        image.style.maxWidth = "";

        if (!this.config.ALLOW_OVERSIZE || width <= maxWidth) {
            width = Math.min(width, maxWidth);
            image.style.width = width + "px";
            this.setAlign(this.config.IMAGE_ALIGN, image, maxWidth);
        } else {
            image.style.width = width + "px";
            image.style.maxWidth = width + "px";
            image.style.left = (maxWidth - width) / 2 + "px";
            image.style.position = "relative";
        }
    }

    dynamicCallArgsGenerator = anchorNode => {
        const args = [{arg_name: `${this.config.ALLOW_OVERSIZE ? "禁止" : "允许"}图片超出范围`, arg_value: "allow_oversize"}];

        const images = anchorNode.closest("#write .md-image");
        if (!images) return args;

        const image = images.querySelector("img");
        if (!image) return args;

        this.dynamicUtil.target = image;

        args.push({arg_name: "缩小20%", arg_value: "zoom_out_20_percent"})
        if (this.getWidth(image) < image.parentElement.offsetWidth) {
            args.push({arg_name: "放大20%", arg_value: "zoom_in_20_percent"})
        }
        args.push(
            {arg_name: "靠左", arg_value: "set_align_left"},
            {arg_name: "居中", arg_value: "set_align_center"},
            {arg_name: "靠右", arg_value: "set_align_right"},
        )
        return args
    }

    call = type => {
        const func = this.dynamicCallMap[type];
        func && func();
    }
}

class resizeRecorder {
    constructor(controller) {
        this.utils = controller.utils;
    }

    collect = () => {
        const resizeIdxMap = new Map();
        document.querySelectorAll("#write img").forEach((img, idx) => {
            const style = img.style.cssText;
            style && resizeIdxMap.set(idx, style);
        })
        if (resizeIdxMap.size) {
            return resizeIdxMap
        }
    }

    resizeImage = (filepath, resizeIdxMap) => {
        let targetIdx = 0
        document.querySelectorAll("#write img").forEach((img, idx) => {
            const style = resizeIdxMap.get(idx);
            if (style) {
                img.style = style;
                targetIdx++;
            }
        })
    }

    process = () => this.utils.registerStateRecorder(this.collect, this.resizeImage);
}


module.exports = {
    plugin: resizeImagePlugin
};