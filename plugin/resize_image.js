class resizeImagePlugin extends global._basePlugin {
    init = () => {
        this.dynamicUtil = {target: null}
        this.dynamicCallMap = {
            zoom_out_20_percent: () => this.zoom(this.dynamicUtil.target, true, 0.2),
            zoom_in_20_percent: () => this.zoom(this.dynamicUtil.target, false, 0.2),
            set_align_left: () => this.setAlign("left", this.dynamicUtil.target),
            set_align_center: () => this.setAlign("center", this.dynamicUtil.target),
            set_align_right: () => this.setAlign("right", this.dynamicUtil.target),
        }
    }

    process = () => {
        this.init();

        document.getElementById("write").addEventListener("wheel", ev => {
            if (!this.utils.metaKeyPressed(ev)) return;

            const target = ev.target.closest("img");
            if (!target) return;

            ev.stopPropagation();

            const zoomOut = ev.deltaY > 0;
            this.zoom(target, zoomOut, this.config.SCALE);
        }, true);
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
        width = Math.min(width, maxWidth);
        image.style.width = width + "px";
        this.setAlign(this.config.IMAGE_ALIGN, image, maxWidth);
    }

    dynamicCallArgsGenerator = anchorNode => {
        const images = anchorNode.closest("#write .md-image");
        if (!images) return;

        const image = images.querySelector("img");
        if (!image) return;

        this.dynamicUtil.target = image;

        const args = [{arg_name: "缩小20%", arg_value: "zoom_out_20_percent"}];
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
        if (!this.dynamicUtil.target) return;

        const func = this.dynamicCallMap[type];
        func && func();
    }
}

module.exports = {
    plugin: resizeImagePlugin
};