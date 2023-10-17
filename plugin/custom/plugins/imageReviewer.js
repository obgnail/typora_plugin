class imageReviewerPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    htmlTemplate = () => {
        const template = [{
            id: "plugin-image-reviewer", class_: "plugin-cover-content", children: [
                {class_: "mask plugin-cover-content"},
                {ele: "img", class_: "review-image"},
                {class_: "review-item", action: "get-previous", children: [{ele: "i", class_: "fa fa-angle-left"}]},
                {class_: "review-item", action: "get-next", children: [{ele: "i", class_: "fa fa-angle-right"}]},
                {class_: "review-message"}
            ]
        }]
        if (this.config.use_button) {
            template.push({
                class_: "plugin-image-reviewer-button", children: [{
                    class_: "reviewer-button-item", "ty-hint": "查看图片", children: [{ele: "i", class_: "fa fa-image"}]
                }]
            })
        }
        return template
    }

    hotkey = () => [this.config.hotkey]

    callback = () => {
        if (this.entities.reviewer.style.display === "") {
            this.entities.reviewer.style.display = "block";
            this.showImage();
        } else {
            this.close();
        }
    }

    process = () => {
        this.entities = {
            reviewer: document.getElementById("plugin-image-reviewer"),
            mask: document.querySelector("#plugin-image-reviewer .mask"),
            image: document.querySelector("#plugin-image-reviewer .review-image"),
            msg: document.querySelector("#plugin-image-reviewer .review-message"),
            button: document.querySelector(".plugin-image-reviewer-button")
        }

        this.entities.mask.addEventListener("click", this.callback);
        if (this.config.use_button) {
            this.entities.button.addEventListener("click", this.callback);
        }

        const that = this;
        $("#plugin-image-reviewer .review-item").on("click", function () {
            that.showImage(this.getAttribute("action") === "get-next");
        })

        this.entities.image.addEventListener("wheel", ev => {
            ev.preventDefault();
            const list = this.getFuncList(ev, "wheel");
            list[ev.deltaY > 0 ? 0 : 1]();
        });

        this.entities.image.addEventListener("mousedown", ev => {
            const list = this.getFuncList(ev, "mousedown");
            list[ev.button]();
        })
    }

    getFuncList = (ev, method) => {
        let arg = [];
        if (this.utils.metaKeyPressed(ev)) arg.push("ctrl");
        else if (this.utils.shiftKeyPressed(ev)) arg.push("shift");
        else if (this.utils.altKeyPressed(ev)) arg.push("alt");
        arg.push(method, "function");
        const config = this.config[arg.join("_")];
        return config.map(ele => this[ele]);
    }

    replaceImageTransform = (regex, func, moveCenter = true) => {
        this.entities.image.style.transform = this.entities.image.style.transform.replace(regex, func);
        moveCenter && this.moveImageCenter();
    }

    rotate = isOut => this.replaceImageTransform(/rotate\((.*?)deg\)/, (_, curRotate) => {
        const currentRotate = parseFloat(curRotate);
        let newRotate = isOut ? currentRotate + this.config.totate_scale : currentRotate - this.config.totate_scale;
        return `rotate(${newRotate}deg)`
    })

    zoom = isOut => this.replaceImageTransform(/scale\((.*?)\)/, (_, curScale) => {
        const currentScale = parseFloat(curScale);
        let newScale = isOut ? currentScale - this.config.zoom_scale : currentScale + this.config.zoom_scale;
        newScale = Math.max(0.1, newScale);
        return `scale(${newScale})`
    })

    flip = direction => this.replaceImageTransform(new RegExp(`scale${direction}\\((.*?)\\)`), (_, curScale) => {
        const currentScale = parseInt(curScale);
        return `scale${direction}(${-currentScale})`
    })

    skew = (isOut, direction) => this.replaceImageTransform(new RegExp(`skew${direction}\\((.*?)deg\\)`), (_, curSkew) => {
        const currentSkew = parseFloat(curSkew);
        let newSkew = isOut ? currentSkew + this.config.skew_scale : currentSkew - this.config.skew_scale;
        return `skew${direction}(${newSkew}deg)`
    })

    moveImageCenter = () => {
        const {width, height} = this.entities.mask.getBoundingClientRect();
        const {width: imageWidth, height: imageHeight} = this.entities.image;
        this.entities.image.style.left = (width - imageWidth) / 2 + "px";
        this.entities.image.style.top = (height - imageHeight) / 2 + "px";
    }

    showImage = (next = true) => {
        this.imageGetter = this.imageGetter || this.imageSrGetter();
        const {src, idx, total} = this.imageGetter(next);
        this.entities.image.setAttribute("src", src);
        this.entities.image.style.transform = "scale(1) rotate(0deg) scaleX(1) scaleY(1) skewX(0deg) skewY(0deg)";
        this.entities.msg.textContent = `${idx} / ${total}`;
        this.moveImageCenter();
    }

    imageSrGetter = () => {
        let idx = -1;
        const imageList = Array.from(document.querySelectorAll("#write img")).map(img => img.getAttribute("src"));
        return (next = true) => {
            (next) ? idx++ : idx--;
            if (idx > imageList.length - 1) {
                idx = 0;
            } else if (idx < 0) {
                idx = imageList.length - 1;
            }
            const showIdx = (imageList.length === 0) ? 0 : idx + 1;
            return {src: imageList[idx] || "", idx: showIdx, total: imageList.length};
        }
    }

    close = () => {
        this.entities.reviewer.style.display = "";
        this.imageGetter = null;
    }
    dummy = () => null
    nextImage = () => this.showImage(true)
    previousImage = () => this.showImage(false)
    rotateLeft = () => this.rotate(false)
    rotateRight = () => this.rotate(true)
    zoomOut = () => this.zoom(true)
    zoomIn = () => this.zoom(false)
    hFlip = () => this.flip("X")
    vFlip = () => this.flip("Y")
    incHSkew = () => this.skew(true, "X")
    decHSkew = () => this.skew(false, "X")
    incVSkew = () => this.skew(true, "Y")
    decVSkew = () => this.skew(false, "Y")
}

module.exports = {
    plugin: imageReviewerPlugin,
};