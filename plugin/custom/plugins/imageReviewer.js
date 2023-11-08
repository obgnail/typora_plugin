class imageReviewerPlugin extends BaseCustomPlugin {
    styleTemplate = () => ({
        imageMaxWidth: this.config.image_max_width + "%",
        imageMaxHeight: this.config.image_max_height + "%",
        toolPosition: this.config.tool_position === "top" ? "initial" : 0,
    })

    htmlTemplate = () => {
        const messages = [{class_: "review-index"}, {class_: "review-title"}, {class_: "review-size"}];
        const options = [
            {ele: "i", class_: "fa fa-question-circle", title: this.optionHint()},
            {ele: "i", class_: "fa fa-download", option: "download", title: "下载图片"},
            {ele: "i", class_: "fa fa-arrows-v", option: "vFlip", title: "垂直翻转"},
            {ele: "i", class_: "fa fa-arrows-h", option: "hFlip", title: "水平翻转"},
            {ele: "i", class_: "fa fa-search-plus", option: "autoSize", title: "放缩"},
            {ele: "i", class_: "fa fa-rotate-right", option: "rotateRight", title: "旋转"},
            {ele: "i", class_: "fa fa-crosshairs", option: "target", title: "定位到文档"},
            {ele: "i", class_: "fa fa-location-arrow", option: "location", title: "资源管理器打开"},
            {ele: "i", class_: "fa fa-times", option: "close", title: "退出"},
        ]
        const tool = [{class_: "review-message", children: messages}, {class_: "review-options", children: options}];
        const children = [
            {class_: "mask plugin-cover-content"},
            {ele: "img", class_: "review-image"},
            {class_: "review-item", action: "get-previous", children: [{ele: "i", class_: "fa fa-angle-left"}]},
            {class_: "review-item", action: "get-next", children: [{ele: "i", class_: "fa fa-angle-right"}]},
            {class_: "review-tool", children: tool}
        ]
        return [{id: "plugin-image-reviewer", class_: "plugin-cover-content", children}]
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
            ops: document.querySelector("#plugin-image-reviewer .review-options"),
            close: document.querySelector("#plugin-image-reviewer .close-review")
        }

        if (this.config.use_button) {
            this.utils.registerQuickButton("image-reviewer", [1, 1], "查看图片", "fa fa-image", {fontSize: "17px"}, this.callback)
        }
        if (this.config.click_mask_to_exit) {
            this.entities.mask.addEventListener("click", this.callback);
        }

        const that = this;
        $("#plugin-image-reviewer .review-item").on("click", function () {
            that.showImage(this.getAttribute("action") === "get-next");
        })

        this.entities.reviewer.addEventListener("wheel", ev => {
            ev.preventDefault();
            const list = this.getFuncList(ev, "wheel");
            list[ev.deltaY > 0 ? 0 : 1]();
        });

        this.entities.image.addEventListener("mousedown", ev => {
            const list = this.getFuncList(ev, "mousedown");
            list[ev.button]();
        })

        this.entities.ops.addEventListener("click", ev => {
            const target = ev.target.closest("[option]");
            if (!target) return
            const option = target.getAttribute("option");
            if (option === "rotateRight") {
                this.rotateRight(90);
            } else {
                this[option]();
            }
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

    rotate = (isOut, newRotate, rotateScale) => this.replaceImageTransform(/rotate\((.*?)deg\)/, (_, curRotate) => {
        if (!newRotate) {
            const currentRotate = parseFloat(curRotate);
            rotateScale = rotateScale || this.config.rotate_scale;
            newRotate = isOut ? currentRotate + rotateScale : currentRotate - rotateScale;
        }
        return `rotate(${newRotate}deg)`
    })

    zoom = (isOut, newScale, zoomScale) => this.replaceImageTransform(/scale\((.*?)\)/, (_, curScale) => {
        if (!newScale) {
            const currentScale = parseFloat(curScale);
            zoomScale = zoomScale || this.config.zoom_scale;
            newScale = isOut ? currentScale - zoomScale : currentScale + zoomScale;
        }
        newScale = Math.max(0.1, newScale);
        return `scale(${newScale})`
    })

    skew = (isOut, direction, newSkew, skewScale) => this.replaceImageTransform(new RegExp(`skew${direction}\\((.*?)deg\\)`), (_, curSkew) => {
        if (!newSkew) {
            const currentSkew = parseFloat(curSkew);
            skewScale = skewScale || this.config.skew_scale;
            newSkew = isOut ? currentSkew + skewScale : currentSkew - skewScale;
        }
        return `skew${direction}(${newSkew}deg)`
    })

    flip = direction => this.replaceImageTransform(new RegExp(`scale${direction}\\((.*?)\\)`), (_, curScale) => {
        const currentScale = parseInt(curScale);
        return `scale${direction}(${-currentScale})`
    })

    changeSize = (origin = true) => {
        const value = origin ? "initial" : "";
        const class_ = origin ? "fa fa-search-minus" : "fa fa-search-plus";
        this.entities.image.style.maxWidth = value;
        this.entities.image.style.maxHeight = value;
        this.entities.ops.querySelector(`[option="autoSize"]`).className = class_;
        this.zoom(null, 1);
    }

    restore = () => {
        this.entities.image.style.maxWidth = "";
        this.entities.image.style.maxHeight = "";
        this.entities.image.style.transform = "scale(1) rotate(0deg) scaleX(1) scaleY(1) skewX(0deg) skewY(0deg)";
        this.moveImageCenter();
    }

    moveImageCenter = () => {
        const {width, height} = this.entities.mask.getBoundingClientRect();
        const {width: imageWidth, height: imageHeight} = this.entities.image;
        this.entities.image.style.left = (width - imageWidth) / 2 + "px";
        this.entities.image.style.top = (height - imageHeight) / 2 + "px";
    }

    showImage = (next = true) => {
        this.initImageMsgGetter();
        const {src, alt, naturalWidth, naturalHeight, idx, total} = this.imageGetter(next);
        this.entities.msg.querySelector(".review-index").textContent = `[ ${idx} / ${total} ]`;
        this.entities.msg.querySelector(".review-title").textContent = alt;
        this.entities.msg.querySelector(".review-size").textContent = `${naturalWidth} × ${naturalHeight}`;
        this.entities.ops.querySelector(`[option="autoSize"]`).className = "fa fa-search-plus";
        this.entities.ops.querySelector(`[option="download"]`).style.display = this.utils.isNetworkImage(src) ? "block" : "none";
        this.entities.image.setAttribute("src", src);
        this.restore();
    }

    closestViewBoxImage = imageList => {
        let closestImg = null;
        let minDistance = Number.MAX_VALUE;
        imageList.forEach(img => {
            const distance = Math.abs(img.getBoundingClientRect().top - window.innerHeight / 2);
            if (distance < minDistance) {
                minDistance = distance;
                closestImg = img;
            }
        });
        return closestImg
    }

    inViewBoxImage = imageList => imageList.find(img => this.utils.isInViewBox(img))

    firstImage = imageList => imageList[0]

    getImage = imageList => {
        const strategies = [...this.config.first_image_strategies, "firstImage"];
        for (const strategy of strategies) {
            const image = this[strategy](imageList);
            if (image) {
                return image
            }
        }
    }

    initImageMsgGetter = () => {
        if (this.imageGetter) return;

        this.imageGetter = this.imageMsgGetter();
        const imageList = Array.from(document.querySelectorAll("#write img"));
        if (imageList.length === 0) return;

        let target = this.getImage(imageList);
        if (!target) return;

        while (true) {
            const {img, idx, total} = this.imageGetter(true);
            if (!img) return;

            if (img === target) {
                this.imageGetter(false);
                return
            }
            // 防御代码，防止死循环
            if (idx === total) {
                return img;
            }
        }
    }

    imageMsgGetter = () => {
        let idx = -1;
        const imageList = Array.from(document.querySelectorAll("#write img"));
        return (next = true) => {
            (next) ? idx++ : idx--;
            if (idx > imageList.length - 1) {
                idx = 0;
            } else if (idx < 0) {
                idx = imageList.length - 1;
            }
            const showIdx = (imageList.length === 0) ? 0 : idx + 1;
            const img = imageList[idx];
            return {
                img,
                src: img && img.getAttribute("src") || "",
                alt: img && img.getAttribute("alt") || "",
                naturalWidth: img && img.naturalWidth || 0,
                naturalHeight: img && img.naturalHeight || 0,
                idx: showIdx,
                total: imageList.length || 0,
            };
        }
    }

    location = () => {
        let src = this.entities.image.getAttribute("src");
        if (this.utils.isNetworkImage(src)) {
            this.utils.openUrl(src);
        } else if (this.utils.isSpecialImage(src)) {
            console.log("this image cannot locate");
        } else {
            // src = src.replace(/^file:\/[2-3]/, "");
            src = decodeURI(src).substring(0, src.indexOf("?"));
            JSBridge.showInFinder(src);
        }
    }

    download = async () => {
        const src = this.entities.image.getAttribute("src");
        if (!this.utils.isNetworkImage(src)) return;
        const {ok, filepath} = await this.utils.downloadImage(src);
        if (ok) {
            JSBridge.showInFinder(filepath);
        } else {
            alert("download image failed");
        }
    }

    optionHint = () => {
        const translate = {
            dummy: '无功能',
            close: '关闭',
            location: '打开图片路径',
            nextImage: '下张图',
            previousImage: '上张图',
            zoomOut: '放大图片',
            zoomIn: '缩小图片',
            rotateLeft: '图片向左旋转',
            rotateRight: '图片向右旋转',
            hFlip: '水平翻转图片',
            vFlip: '垂直翻转图片',
            incHSkew: '图片增大水平倾斜',
            decHSkew: '图片减小水平倾斜',
            incVSkew: '图片增大垂直倾斜',
            decVSkew: '图片减小垂直倾斜',
            originSize: '还原图片大小',
            fixScreen: '图片大小适配屏幕',
            autoSize: '图片大小切换',
            restore: '图片恢复为最初状态',
        }

        const result = [];
        const button = ["mousedown_function", "wheel_function"];
        const extra = ["", "ctrl", "shift", "alt"];
        button.forEach(btn => extra.forEach(ex => {
            const cfg = !ex ? btn : ex + "_" + btn;
            const config = this.config[cfg];
            const funcs = (btn === "mousedown_function") ? ["鼠标左键", "鼠标中键", "鼠标右键"] : ["滚轮上滚", "滚轮下滚"];
            funcs.forEach((ele, idx) => {
                const info = translate[config[idx]];
                if (info !== "无功能") {
                    const ex_ = !ex ? "" : ex + "+";
                    result.push(ex_ + ele + "\t" + info);
                }
            })
        }))
        return result.join("\n")
    }

    target = () => {
        const text = this.entities.msg.querySelector(".review-index").textContent;
        const idx = parseInt(text.substring(1, text.indexOf("/")));
        const image = Array.from(document.querySelectorAll("#write img"))[idx - 1];
        this.close();
        image && this.utils.scroll(image, 30);
    }

    close = () => {
        this.entities.reviewer.style.display = "";
        this.imageGetter = null;
    }
    dummy = () => null
    nextImage = () => this.showImage(true)
    previousImage = () => this.showImage(false)
    rotateLeft = rotateScale => this.rotate(false, null, rotateScale)
    rotateRight = rotateScale => this.rotate(true, null, rotateScale)
    zoomOut = zoomScale => this.zoom(true, null, zoomScale)
    zoomIn = zoomScale => this.zoom(false, null, zoomScale)
    hFlip = () => this.flip("X")
    vFlip = () => this.flip("Y")
    incHSkew = skewScale => this.skew(true, "X", null, skewScale)
    decHSkew = skewScale => this.skew(false, "X", null, skewScale)
    incVSkew = skewScale => this.skew(true, "Y", null, skewScale)
    decVSkew = skewScale => this.skew(false, "Y", null, skewScale)
    originSize = () => this.changeSize(true)
    fixScreen = () => this.changeSize(false)
    autoSize = () => this.changeSize(this.entities.image.style.maxWidth !== "initial")
}

module.exports = {
    plugin: imageReviewerPlugin,
};