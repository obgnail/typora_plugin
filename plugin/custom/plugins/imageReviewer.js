class imageReviewerPlugin extends BaseCustomPlugin {
    styleTemplate = () => ({
        imageMaxWidth: this.config.image_max_width + "%",
        imageMaxHeight: this.config.image_max_height + "%",
        toolPosition: this.config.tool_position === "top" ? "initial" : 0,
        thumbnailPosition: this.config.tool_position === "top" ? "bottom": "top",
        blurLevel: this.config.blur_level + "px",
    })

    html = () => {
        const { tool_function, show_message, hotkey_function } = this.config;
        const keyTranslate = { arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', " ": "space" };
        const funcTranslate = {
            dummy: ['无功能', ''],
            info: ['', 'fa fa-question-circle'],
            close: ['关闭', 'fa fa-times'],
            download: ['下载网络图片', 'fa fa-download'],
            scroll: ['定位到文档', 'fa fa-crosshairs'],
            play: ['轮播图片', 'fa fa-play'],
            location: ['打开图片路径', 'fa fa-location-arrow'],
            nextImage: ['下张图', 'fa fa-angle-right'],
            previousImage: ['上张图', 'fa fa-angle-left'],
            firstImage: ['第一张图', 'fa fa-backward'],
            lastImage: ['最后一张图', 'fa fa-forward'],
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

        const getInfoHint = () => {
            const result = ["当前配置如下："];

            const modifierKey = ["", "ctrl", "shift", "alt"];
            const mouseEvent = ["mousedown_function", "wheel_function"];
            mouseEvent.forEach(event => modifierKey.forEach(modifier => {
                const cfg = modifier ? `${modifier}_${event}` : event;
                const config = this.config[cfg];
                const events = (event === "mousedown_function") ? ["鼠标左键", "鼠标中键", "鼠标右键"] : ["滚轮上滚", "滚轮下滚"];
                events.forEach((ev, idx) => {
                    const [hint, _] = funcTranslate[config[idx]];
                    if (hint && hint !== "无功能") {
                        const m = modifier ? `${modifier}+` : "";
                        result.push(m + ev + "\t" + hint);
                    }
                })
            }))
            hotkey_function.forEach(item => {
                const [key, func] = item;
                const [hint, _] = funcTranslate[func];
                if (hint && hint !== "无功能") {
                    const translateKey = keyTranslate[key.toLowerCase()] || key;
                    result.push(translateKey + "\t" + hint);
                }
            })

            return result.join("\n")
        }

        funcTranslate.info[0] = getInfoHint();

        const messageList = show_message.map(m => `<div class="review-${m}"></div>`);
        const operationList = tool_function
            .filter(option => funcTranslate.hasOwnProperty(option))
            .map(option => {
                const [hint, icon] = funcTranslate[option];
                return `<i class="${icon}" option="${option}" title="${hint}"></i>`
            })
        return `
            <div id="plugin-image-reviewer" class="plugin-cover-content plugin-common-hidden">
                <div class="review-tool">
                    <div class="review-message">${messageList.join("")}</div>
                    <div class="review-options">${operationList.join("")}</div>
                </div>
                <div class="review-nav"></div>
                <img class="review-image" alt=""/>
                <div class="review-item" action="previousImage"><i class="fa fa-angle-left"></i></div>
                <div class="review-item" action="nextImage"><i class="fa fa-angle-right"></i></div>
                <div class="plugin-cover-content review-mask"></div>
            </div>
        `
    }

    hotkey = () => [this.config.hotkey]

    callback = anchorNode => {
        if (this.utils.isHidden(this.entities.reviewer)) {
            this.show();
        } else {
            this.close();
        }
    }

    init = () => {
        this.imageGetter = null;
        this.playTimer = null;
        this.entities = {
            reviewer: document.getElementById("plugin-image-reviewer"),
            mask: document.querySelector("#plugin-image-reviewer .review-mask"),
            nav: document.querySelector("#plugin-image-reviewer .review-nav"),
            image: document.querySelector("#plugin-image-reviewer .review-image"),
            msg: document.querySelector("#plugin-image-reviewer .review-message"),
            ops: document.querySelector("#plugin-image-reviewer .review-options"),
            close: document.querySelector("#plugin-image-reviewer .close-review")
        }
    }

    process = () => {
        if (this.config.click_mask_to_exit) {
            this.entities.mask.addEventListener("click", this.callback);
        }
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.toggleSettingPage, hide => hide && this.close());
        this.entities.reviewer.querySelectorAll(".review-item").forEach(ele => {
            ele.addEventListener("click", ev => this[ev.target.closest(".review-item").getAttribute("action")]());
        })
        this.entities.reviewer.addEventListener("wheel", ev => {
            ev.preventDefault();
            const list = this.getFuncList(ev, "wheel");
            const func = list[ev.deltaY > 0 ? 1 : 0];
            (func instanceof Function) && func();
        }, { passive: false });
        this.entities.image.addEventListener("mousedown", ev => {
            const list = this.getFuncList(ev, "mousedown");
            const func = list[ev.button];
            (func instanceof Function) && func();
        })
        this.entities.ops.addEventListener("click", ev => {
            const target = ev.target.closest("[option]");
            if (!target) return;
            const option = target.getAttribute("option");
            const arg = option.indexOf("rotate") !== -1 ? 90 : undefined;
            (this[option] instanceof Function) && this[option](arg);
        })
        this.entities.nav.addEventListener("click", ev => {
            const target = ev.target.closest(".review-thumbnail");
            if (!target) return;
            const idx = parseInt(target.dataset.idx);
            this.dumpIndex(idx);
        })
        this.entities.nav.addEventListener("wheel", ev => {
            const target = ev.target.closest("#plugin-image-reviewer .review-nav");
            target.scrollLeft += ev.deltaY * 0.5;
            ev.stopPropagation();
        }, { passive: true })
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
        const { width, height } = this.entities.mask.getBoundingClientRect();
        const { width: imageWidth, height: imageHeight } = this.entities.image;
        this.entities.image.style.left = (width - imageWidth) / 2 + "px";
        this.entities.image.style.top = (height - imageHeight) / 2 + "px";
    }

    dumpImage = (direction = "next", condition = () => true) => {
        const next = direction === "next";
        while (true) {
            const curImg = this.imageGetter(next);
            if (condition(curImg)) {
                this._showImage(curImg);
                return curImg;
            }
        }
    }

    dumpIndex = targetIdx => {
        targetIdx = Math.max(targetIdx, 0);
        return this.dumpImage("next", img => img.idx === Math.min(targetIdx, img.total - 1))
    }

    _showImage = imgInfo => {
        const handleMessage = imgInfo => {
            const { src, alt, naturalWidth, naturalHeight, showIdx, idx, total } = imgInfo;
            this.entities.image.setAttribute("src", src);
            this.entities.image.setAttribute("data-idx", idx);
            const index = this.entities.msg.querySelector(".review-index");
            const title = this.entities.msg.querySelector(".review-title");
            const size = this.entities.msg.querySelector(".review-size");
            index && (index.textContent = `[ ${showIdx} / ${total} ]`);
            title && (title.textContent = alt);
            size && (size.textContent = `${naturalWidth} × ${naturalHeight}`);
        }

        const handleToolIcon = src => {
            const autoSize = this.entities.ops.querySelector(`[option="autoSize"]`);
            const download = this.entities.ops.querySelector(`[option="download"]`);
            autoSize && (autoSize.className = "fa fa-search-plus");
            download && this.utils.toggleVisible(download, !this.utils.isNetworkImage(src));
        }

        const handleThumbnail = showIdx => {
            const s = this.entities.nav.querySelector(".select");
            s && s.classList.remove("select");
            const active = this.entities.nav.querySelector(`.review-thumbnail[data-idx="${showIdx - 1}"]`);
            if (active) {
                active.classList.add("select");
                active.scrollIntoView({ inline: "nearest", behavior: "smooth" });
            }
        }

        handleMessage(imgInfo);
        handleToolIcon(imgInfo.src);
        handleThumbnail(imgInfo.showIdx);
        this.restore();
    }

    _collectImage = () => {
        let images = Array.from(this.utils.entities.querySelectorAllInWrite("img"));
        if (this.config.filter_error_image) {
            images = images.filter(this.utils.isImgEmbed);
        }
        return images
    }

    initImageMsgGetter = () => {
        if (this.imageGetter) return;

        let images = this._collectImage();
        this.imageGetter = this._imageMsgGetter(images);

        if (images.length === 0) return;

        let target = this._getTargetImage(images);
        if (!target) return;

        while (true) {
            const { img, showIdx, total } = this.imageGetter(true);
            if (!img) return;

            if (img === target) {
                return this.imageGetter(false);
            }
            // 防御代码，防止死循环
            if (showIdx === total) return;
        }
    }

    _imageMsgGetter = images => {
        let idx = -1;
        return (next = true) => {
            next ? idx++ : idx--;
            const maxIdx = images.length - 1;
            if (idx > maxIdx) {
                idx = 0;
            } else if (idx < 0) {
                idx = maxIdx;
            }
            const showIdx = (images.length === 0) ? 0 : idx + 1;
            const img = images[idx];
            return {
                img,
                idx,
                showIdx,
                src: img && img.getAttribute("src") || "",
                alt: img && img.getAttribute("alt") || "",
                naturalWidth: img && img.naturalWidth || 0,
                naturalHeight: img && img.naturalHeight || 0,
                total: images.length || 0,
                all: images,
            };
        }
    }

    _getTargetImage = images => {
        const strategies = {
            firstImage: images => images[0],
            inViewBoxImage: images => images.find(img => this.utils.isInViewBox(img)),
            closestViewBoxImage: images => {
                let closestImg = null;
                let minDistance = Number.MAX_VALUE;
                images.forEach(img => {
                    const distance = Math.abs(img.getBoundingClientRect().top - window.innerHeight / 2);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestImg = img;
                    }
                });
                return closestImg
            },
        }
        // firstImage作为兜底策略
        const funcList = [...this.config.first_image_strategies, "firstImage"].map(s => strategies[s]).filter(Boolean);
        for (const func of funcList) {
            const image = func(images);
            if (image) {
                return image
            }
        }
    }

    initThumbnailNav = current => {
        const { idx: targetIdx, all = [] } = current || {};
        const thumbnails = all.map((img, idx) => {
            const select = idx === targetIdx ? "select" : "";
            return `<img class="review-thumbnail ${select}" src="${img.src}" alt="${img.alt}" data-idx="${idx}">`
        })
        this.entities.nav.innerHTML = thumbnails.join("");
    }

    handleHotkey = (remove = false) => {
        const unregister = item => this.utils.hotkeyHub.unregister(item[0]);
        const register = item => this.utils.hotkeyHub.registerSingle(item[0], this[item[1]] || this.dummy);
        this.config.hotkey_function.forEach(remove ? unregister : register);
    }

    handlePlayTimer = (stop = false) => {
        const btn = this.entities.ops.querySelector(`[option="play"]`);
        if (!btn) return;
        if (!stop && !this.playTimer) {
            this.playTimer = setInterval(this.nextImage, this.config.play_second * 1000);
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
            clearInterval(this.playTimer);
            this.playTimer = null;
        }
    }

    play = () => this.handlePlayTimer(!!this.playTimer)
    restore = () => {
        Object.assign(this.entities.image.style, {
            maxWidth: "",
            maxHeight: "",
            transform: "scale(1) rotate(0deg) scaleX(1) scaleY(1) skewX(0deg) skewY(0deg) translateX(0px) translateY(0px)",
        })
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
        const { ok, filepath } = await this.utils.downloadImage(src);
        if (ok) {
            this.utils.showInFinder(filepath);
        } else {
            alert("download image failed");
        }
    }
    scroll = () => {
        const idx = parseInt(this.entities.image.dataset.idx);
        const image = this._collectImage()[idx];
        this.close();
        image && this.utils.scroll(image, 30);
    }
    show = () => {
        document.activeElement.blur();
        this.handleHotkey(false);
        this.utils.show(this.entities.reviewer);
        const cur = this.initImageMsgGetter();
        this.initThumbnailNav(cur);
        this.dumpImage();
    }
    close = () => {
        this.handleHotkey(true);
        this.handlePlayTimer(true);
        this.utils.hide(this.entities.reviewer);
        this.imageGetter = null;
    }
    dummy = this.utils.noop
    nextImage = () => this.dumpImage("next")
    previousImage = () => this.dumpImage("previous")
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