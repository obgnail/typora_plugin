class imageReviewerPlugin extends BaseCustomPlugin {
    beforeProcess = () => {
        this.keyTranslate = {arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', " ": "space"};
        this.funcTranslate = {
            dummy: ['无功能', ''],
            info: ['', 'fa fa-question-circle'],
            close: ['关闭', 'fa fa-times'],
            download: ['下载网络图片', 'fa fa-download'],
            scroll: ['定位到文档', 'fa fa-crosshairs'],
            play: ['轮播图片', 'fa fa-play'],
            location: ['打开图片路径', 'fa fa-location-arrow'],
            nextImage: ['下张图', 'fa fa-angle-right'],
            previousImage: ['上张图', 'fa fa-angle-left'],
            firstImage: ['第一张图', 'fa fa-angle-double-left'],
            lastImage: ['最后一张图', 'fa fa-angle-double-right'],
            zoomOut: ['缩小图片', 'fa fa fa-search-minus'],
            zoomIn: ['放大图片', 'fa fa fa-search-plus'],
            rotateLeft: ['图片向左旋转', 'fa fa-rotate-left'],
            rotateRight: ['图片向右旋转', 'fa fa-rotate-right'],
            hFlip: ['水平翻转图片', 'fa fa-arrows-h'],
            vFlip: ['垂直翻转图片', 'fa fa-arrows-v'],
            translateLeft: ['向左移动', 'fa fa-arrow-left'],
            translateRight: ['向右移动', 'fa fa-arrow-right'],
            translateUp: ['向上移动', 'fa fa-arrow-up'],
            translateDown: ['向下移动', 'fa fa-arrow-down'],
            incHSkew: ['图片增大水平倾斜', 'fa fa-toggle-right'],
            decHSkew: ['图片减小水平倾斜', 'fa fa-toggle-left'],
            incVSkew: ['图片增大垂直倾斜', 'fa fa-toggle-up'],
            decVSkew: ['图片减小垂直倾斜', 'fa fa-toggle-down'],
            originSize: ['还原图片大小', 'fa fa-clock-o'],
            fixScreen: ['图片大小适配屏幕', 'fa fa-codepen'],
            autoSize: ['图片大小切换', 'fa fa-search-plus'],
            restore: ['图片恢复为最初状态', 'fa fa-history'],
        }
    }

    afterProcess = () => {
        this.keyTranslate = null;
        this.funcTranslate = null;
    }

    styleTemplate = () => ({
        imageMaxWidth: this.config.image_max_width + "%",
        imageMaxHeight: this.config.image_max_height + "%",
        toolPosition: this.config.tool_position === "top" ? "initial" : 0,
    })

    htmlTemplate = () => {
        const msg = this.config.show_message.map(msg => ({class_: "review-" + msg}));
        const options = this.getTools();
        const toolbar = [{class_: "review-message", children: msg}, {class_: "review-options", children: options}];
        const children = [
            {class_: "mask plugin-cover-content"},
            {ele: "img", class_: "review-image"},
            {class_: "review-item", action: "get-previous", children: [{ele: "i", class_: "fa fa-angle-left"}]},
            {class_: "review-item", action: "get-next", children: [{ele: "i", class_: "fa fa-angle-right"}]},
            {class_: "review-tool", children: toolbar}
        ]
        return [{id: "plugin-image-reviewer", class_: "plugin-cover-content", children}]
    }

    hotkey = () => [this.config.hotkey]

    callback = () => {
        if (this.entities.reviewer.style.display === "") {
            this.show();
        } else {
            this.close();
        }
    }

    process = () => {
        this.playTimer = null;
        this.entities = {
            reviewer: document.getElementById("plugin-image-reviewer"),
            mask: document.querySelector("#plugin-image-reviewer .mask"),
            image: document.querySelector("#plugin-image-reviewer .review-image"),
            msg: document.querySelector("#plugin-image-reviewer .review-message"),
            ops: document.querySelector("#plugin-image-reviewer .review-options"),
            close: document.querySelector("#plugin-image-reviewer .close-review")
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
            list[ev.deltaY > 0 ? 1 : 0]();
        });

        this.entities.image.addEventListener("mousedown", ev => {
            const list = this.getFuncList(ev, "mousedown");
            list[ev.button]();
        })

        this.entities.ops.addEventListener("click", ev => {
            const target = ev.target.closest("[option]");
            if (!target) return
            const option = target.getAttribute("option");
            const arg = option.indexOf("rotate") !== -1 ? 90 : undefined;
            this[option] && this[option](arg);
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

    rotate = (dec, newRotate, rotateScale) => this.replaceImageTransform(/rotate\((.*?)deg\)/, (_, curRotate) => {
        if (!newRotate) {
            const currentRotate = parseFloat(curRotate);
            rotateScale = rotateScale || this.config.rotate_scale;
            newRotate = dec ? currentRotate + rotateScale : currentRotate - rotateScale;
        }
        return `rotate(${newRotate}deg)`
    })

    zoom = (dec, newScale, zoomScale) => this.replaceImageTransform(/scale\((.*?)\)/, (_, curScale) => {
        if (!newScale) {
            const currentScale = parseFloat(curScale);
            zoomScale = zoomScale || this.config.zoom_scale;
            newScale = dec ? currentScale - zoomScale : currentScale + zoomScale;
        }
        newScale = Math.max(0.1, newScale);
        return `scale(${newScale})`
    })

    skew = (dec, direction, newSkew, skewScale) => this.replaceImageTransform(new RegExp(`skew${direction}\\((.*?)deg\\)`), (_, curSkew) => {
        if (!newSkew) {
            const currentSkew = parseFloat(curSkew);
            skewScale = skewScale || this.config.skew_scale;
            newSkew = dec ? currentSkew - skewScale : currentSkew + skewScale;
        }
        return `skew${direction}(${newSkew}deg)`
    })

    translate = (dec, direction, newTranslate, translateScale) => this.replaceImageTransform(new RegExp(`translate${direction}\\((.*?)px\\)`), (_, curTranslate) => {
        if (!newTranslate) {
            const currentTranslate = parseFloat(curTranslate);
            translateScale = translateScale || this.config.translate_scale;
            newTranslate = dec ? currentTranslate - translateScale : currentTranslate + translateScale;
        }
        return `translate${direction}(${newTranslate}px)`
    }, false)

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

    moveImageCenter = () => {
        const {width, height} = this.entities.mask.getBoundingClientRect();
        const {width: imageWidth, height: imageHeight} = this.entities.image;
        this.entities.image.style.left = (width - imageWidth) / 2 + "px";
        this.entities.image.style.top = (height - imageHeight) / 2 + "px";
    }

    showImage = (next = true) => {
        this.initImageMsgGetter();
        const imgInfo = this.imageGetter(next);
        this._showImage(imgInfo);
    }

    dumpIndex = targetIdx => {
        this.initImageMsgGetter();
        let imgInfo = this.imageGetter(true);
        if (!Number.isInteger(targetIdx)) {
            targetIdx = 0;
        }
        targetIdx++;
        targetIdx = Math.max(targetIdx, 1);
        targetIdx = Math.min(targetIdx, imgInfo.total);
        while (imgInfo.showIdx !== targetIdx) {
            imgInfo = this.imageGetter(true);
        }
        this._showImage(imgInfo);
    }

    _showImage = imgInfo => {
        this.handleMessage(imgInfo);
        this.handleToolIcon(imgInfo.src);
        this.restore();
    }

    getImage = imageList => {
        const strategyFuncList = {
            firstImage: imageList => imageList[0],
            inViewBoxImage: imageList => imageList.find(img => this.utils.isInViewBox(img)),
            closestViewBoxImage: imageList => {
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
        }
        const strategies = [...this.config.first_image_strategies, "firstImage"];
        for (const strategy of strategies) {
            const func = strategyFuncList[strategy] || strategyFuncList.firstImage;
            const image = func(imageList);
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
            const {img, showIdx, total} = this.imageGetter(true);
            if (!img) return;

            if (img === target) {
                this.imageGetter(false);
                return
            }
            // 防御代码，防止死循环
            if (showIdx === total) {
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
                showIdx,
                total: imageList.length || 0,
            };
        }
    }

    getTools = () => {
        this.funcTranslate.info[0] = this.optionHint();
        const tools = Object.entries(this.funcTranslate).map(([option, [title, icon]]) => {
            return [option, {ele: "i", class_: icon, option, title}]
        })
        const map = new Map(tools);
        return this.config.tool_function.map(item => map.get(item)).filter(Boolean)
    }

    handleMessage = imgInfo => {
        const {src, alt, naturalWidth, naturalHeight, showIdx, total} = imgInfo;
        this.entities.image.setAttribute("src", src);
        const index = this.entities.msg.querySelector(".review-index");
        const title = this.entities.msg.querySelector(".review-title");
        const size = this.entities.msg.querySelector(".review-size");
        index && (index.textContent = `[ ${showIdx} / ${total} ]`);
        title && (title.textContent = alt);
        size && (size.textContent = `${naturalWidth} × ${naturalHeight}`);
    }

    handleToolIcon = src => {
        const autoSize = this.entities.ops.querySelector(`[option="autoSize"]`);
        const download = this.entities.ops.querySelector(`[option="download"]`);
        autoSize && (autoSize.className = "fa fa-search-plus");
        download && (download.style.display = this.utils.isNetworkImage(src) ? "block" : "none");
    }

    optionHint = () => {
        const result = ["当前配置如下："];
        const button = ["mousedown_function", "wheel_function"];
        const extra = ["", "ctrl", "shift", "alt"];
        button.forEach(btn => extra.forEach(ex => {
            const cfg = !ex ? btn : ex + "_" + btn;
            const config = this.config[cfg];
            const funcList = (btn === "mousedown_function") ? ["鼠标左键", "鼠标中键", "鼠标右键"] : ["滚轮上滚", "滚轮下滚"];
            funcList.forEach((ele, idx) => {
                const [info, _] = this.funcTranslate[config[idx]];
                if (info && info !== "无功能") {
                    const ex_ = !ex ? "" : ex + "+";
                    result.push(ex_ + ele + "\t" + info);
                }
            })
        }))
        this.config.hotkey_function.forEach(item => {
            const [key, func] = item;
            const [info, _] = this.funcTranslate[func];
            if (info && info !== "无功能") {
                const translateKey = this.keyTranslate[key.toLowerCase()] || key;
                result.push(translateKey + "\t" + info);
            }
        })
        return result.join("\n")
    }

    handleBlurBackground = (remove = false) => {
        if (this.config.blur_level === 0) return;
        const blurStyle = `blur(${this.config.blur_level}px)`;
        const removeFilter = ele => ele && ele.style.removeProperty("filter");
        const addFilter = ele => ele && (ele.style.filter = blurStyle);
        const func = remove ? removeFilter : addFilter;
        const selectors = ["#write", ".sidebar-menu", "#plugin-window-tab", "#plugin-quick-button"];
        selectors.forEach(selector => func(document.querySelector(selector)));
    }

    handleHotkey = (remove = false) => {
        const unregister = item => this.utils.unregisterHotkey(item[0]);
        const register = item => this.utils.registerSingleHotkey(item[0], this[item[1]] || this.dummy);
        this.config.hotkey_function.forEach(remove ? unregister : register);
    }

    handlePlayTimer = (stop = false) => {
        const btn = this.entities.ops.querySelector(`[option="play"]`);
        if (!btn) return;
        if (!stop && !this.playTimer) {
            this.playTimer = setInterval(this.showImage, this.config.play_second * 1000);
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
            clearInterval(this.playTimer);
            this.playTimer = null;
        }
    }

    play = () => this.handlePlayTimer(!!this.playTimer)
    restore = () => {
        this.entities.image.style.maxWidth = "";
        this.entities.image.style.maxHeight = "";
        this.entities.image.style.transform = "scale(1) rotate(0deg) scaleX(1) scaleY(1) skewX(0deg) skewY(0deg) translateX(0px) translateY(0px)";
        this.moveImageCenter();
    }
    location = () => {
        let src = this.entities.image.getAttribute("src");
        if (this.utils.isNetworkImage(src)) {
            this.utils.openUrl(src);
        } else if (this.utils.isSpecialImage(src)) {
            alert("this image cannot locate");
        } else {
            // src = src.replace(/^file:\/[2-3]/, "");
            src = decodeURI(src).substring(0, src.indexOf("?"));
            src && this.utils.showInFinder(src);
        }
    }
    download = async () => {
        const src = this.entities.image.getAttribute("src");
        if (!this.utils.isNetworkImage(src)) return;
        const {ok, filepath} = await this.utils.downloadImage(src);
        if (ok) {
            this.utils.showInFinder(filepath);
        } else {
            alert("download image failed");
        }
    }
    scroll = () => {
        const text = this.entities.msg.querySelector(".review-index").textContent;
        const idx = parseInt(text.substring(1, text.indexOf("/")));
        const image = Array.from(document.querySelectorAll("#write img"))[idx - 1];
        this.close();
        image && this.utils.scroll(image, 30);
    }
    show = () => {
        document.activeElement.blur();
        this.handleBlurBackground(false);
        this.handleHotkey(false);
        this.entities.reviewer.style.display = "block";
        this.showImage();
    }
    close = () => {
        this.handleBlurBackground(true);
        this.handleHotkey(true);
        this.handlePlayTimer(true);
        this.entities.reviewer.style.display = "";
        this.imageGetter = null;
    }
    dummy = () => null
    nextImage = () => this.showImage(true)
    previousImage = () => this.showImage(false)
    firstImage = () => this.dumpIndex(-1)
    lastImage = () => this.dumpIndex(Number.MAX_VALUE)
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
    translateLeft = translateScale => this.translate(true, "X", null, translateScale)
    translateRight = translateScale => this.translate(false, "X", null, translateScale)
    translateUp = translateScale => this.translate(true, "Y", null, translateScale)
    translateDown = translateScale => this.translate(false, "Y", null, translateScale)
    originSize = () => this.changeSize(true)
    fixScreen = () => this.changeSize(false)
    autoSize = () => this.changeSize(this.entities.image.style.maxWidth !== "initial")
}

module.exports = {
    plugin: imageReviewerPlugin,
};