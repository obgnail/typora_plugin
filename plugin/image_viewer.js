class ImageViewerPlugin extends BasePlugin {
    styleTemplate = () => ({
        imageMaxWidth: this.config.IMAGE_MAX_WIDTH + "%",
        imageMaxHeight: this.config.IMAGE_MAX_HEIGHT + "%",
        toolPosition: this.config.TOOL_POSITION === "top" ? "initial" : 0,
        thumbnailPosition: this.config.TOOL_POSITION === "top" ? "bottom" : "top",
        blurLevel: this.config.BLUR_LEVEL + "px",
    })

    html = () => {
        const keyTranslate = { arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→", " ": "space" }
        const opIcons = {
            dummy: "",
            info: "fa fa-info-circle",
            thumbnailNav: "fa fa-caret-square-o-down",
            waterFall: "fa fa-list",
            close: "fa fa-times",
            download: "fa fa-download",
            scroll: "fa fa-crosshairs",
            play: "fa fa-play",
            location: "fa fa-location-arrow",
            nextImage: "fa fa-angle-right",
            previousImage: "fa fa-angle-left",
            firstImage: "fa fa-fast-backward",
            lastImage: "fa fa-fast-forward",
            zoomOut: "fa fa fa-search-minus",
            zoomIn: "fa fa fa-search-plus",
            rotateLeft: "fa fa-rotate-left",
            rotateRight: "fa fa-rotate-right",
            hFlip: "fa fa-arrows-h",
            vFlip: "fa fa-arrows-v",
            translateLeft: "fa fa-arrow-left",
            translateRight: "fa fa-arrow-right",
            translateUp: "fa fa-arrow-up",
            translateDown: "fa fa-arrow-down",
            incHSkew: "fa fa-toggle-right",
            decHSkew: "fa fa-toggle-left",
            incVSkew: "fa fa-toggle-up",
            decVSkew: "fa fa-toggle-down",
            originSize: "fa fa-clock-o",
            fixScreen: "fa fa-codepen",
            autoSize: "fa fa-search-plus",
            restore: "fa fa-history",
        }
        const opEntities = Object.fromEntries(Array.from(
            Object.entries(opIcons),
            ([op, icon]) => [op, { hint: this.i18n.t(`$option.operations.${op}`), icon }]
        ))

        const getInfoHint = () => {
            const dummy = this.i18n.t("$option.operations.dummy")
            const result = [this.i18n.t("currentConfig") + ":"]

            const mouseClicks = this.i18n.array(["leftClick", "middleClick", "rightClick"], "mouse.")
            const mouseWheels = this.i18n.array(["wheelUp", "wheelDown"], "mouse.")

            const modifierKeys = ["", "CTRL", "SHIFT", "ALT"]
            const mouseEvents = ["MOUSEDOWN_FUNCTION", "WHEEL_FUNCTION"]
            mouseEvents.forEach(event => {
                modifierKeys.forEach(modifier => {
                    const key = modifier ? `${modifier}_${event}` : event
                    const config = this.config[key]
                    const events = (event === "MOUSEDOWN_FUNCTION") ? mouseClicks : mouseWheels
                    events.forEach((ev, idx) => {
                        const op = config[idx]
                        const { hint } = opEntities[op]
                        if (hint && hint !== dummy) {
                            const keyCombo = (modifier ? `${modifier}+` : "") + ev
                            result.push(keyCombo + "\t" + hint)
                        }
                    })
                })
            })
            this.config.HOTKEY_FUNCTION.forEach(item => {
                const { hotkey, fn } = item
                const { hint } = opEntities[fn]
                if (hint && hint !== dummy) {
                    const translated = keyTranslate[hotkey.toLowerCase()] || hotkey
                    result.push(translated + "\t" + hint)
                }
            })

            return result.join("\n")
        }

        opEntities.info.hint = getInfoHint()

        const columns = '<div class="viewer-water-fall-col"></div>'.repeat(this.config.WATER_FALL_COLUMNS)
        const messageList = this.config.SHOW_MESSAGE.map(m => `<div class="viewer-${m}"></div>`)
        const operationList = this.config.TOOL_FUNCTION
            .filter(option => opEntities.hasOwnProperty(option))
            .map(option => {
                const { hint, icon } = opEntities[option]
                return `<i class="${icon}" option="${option}" title="${hint}"></i>`
            })
        const class_ = this.config.SHOW_THUMBNAIL_NAV ? "" : "plugin-common-hidden"
        return `
            <div id="plugin-image-viewer" class="plugin-viewer-cover plugin-common-hidden">
                <div class="viewer-tool">
                    <div class="viewer-message">${messageList.join("")}</div>
                    <div class="viewer-options">${operationList.join("")}</div>
                </div>
                <div class="viewer-water-fall plugin-common-hidden"><div class="viewer-water-fall-container">${columns}</div></div>
                <div class="viewer-nav ${class_}"></div>
                <img class="viewer-image" alt=""/>
                <div class="viewer-item" action="previousImage"><i class="fa fa-angle-left"></i></div>
                <div class="viewer-item" action="nextImage"><i class="fa fa-angle-right"></i></div>
                <div class="plugin-viewer-cover viewer-mask"></div>
            </div>`
    }

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    call = () => {
        if (this.utils.isHidden(this.entities.viewer)) {
            this.show()
        } else {
            this.close()
        }
    }

    init = () => {
        this.imageGetter = null
        this.playTimer = null
        this.entities = {
            viewer: document.getElementById("plugin-image-viewer"),
            mask: document.querySelector("#plugin-image-viewer .viewer-mask"),
            waterFall: document.querySelector("#plugin-image-viewer .viewer-water-fall"),
            nav: document.querySelector("#plugin-image-viewer .viewer-nav"),
            image: document.querySelector("#plugin-image-viewer .viewer-image"),
            msg: document.querySelector("#plugin-image-viewer .viewer-message"),
            ops: document.querySelector("#plugin-image-viewer .viewer-options"),
            close: document.querySelector("#plugin-image-viewer .viewer-close"),
        }
    }

    process = () => {
        if (this.config.CLICK_MASK_TO_EXIT) {
            this.entities.mask.addEventListener("click", this.call)
        }
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.toggleSettingPage, hide => hide && this.close())
        this.entities.viewer.querySelectorAll(".viewer-item").forEach(el => {
            el.addEventListener("click", ev => {
                const act = ev.target.closest(".viewer-item").getAttribute("action")
                this[act]?.()
            })
        })
        this.entities.viewer.addEventListener("wheel", ev => {
            if (this.utils.isShown(this.entities.waterFall)) return
            ev.preventDefault()
            const list = this.getFnList(ev, "WHEEL")
            const fn = list[ev.deltaY > 0 ? 1 : 0]
            if (typeof fn === "function") fn()
        }, { passive: false })
        this.entities.image.addEventListener("mousedown", ev => {
            const list = this.getFnList(ev, "MOUSEDOWN")
            const fn = list[ev.button]
            if (typeof fn === "function") fn()
        })
        this.entities.ops.addEventListener("click", ev => {
            const target = ev.target.closest("[option]")
            if (!target) return
            const option = target.getAttribute("option")
            const arg = option.indexOf("rotate") !== -1 ? 90 : undefined
            if (typeof this[option] === "function") this[option](arg)
        })
        this.entities.nav.addEventListener("click", ev => {
            const target = ev.target.closest(".viewer-thumbnail")
            if (target) this.dumpIndex(parseInt(target.dataset.idx))
        })
        this.entities.waterFall.addEventListener("click", ev => {
            const target = ev.target.closest(".viewer-water-fall-item")
            this.waterFall()
            if (target) this.dumpIndex(parseInt(target.dataset.idx))
        })
        this.entities.nav.addEventListener("wheel", ev => {
            const target = ev.target.closest("#plugin-image-viewer .viewer-nav")
            target.scrollLeft += ev.deltaY * 0.5
            ev.stopPropagation()
        }, { passive: true })
    }

    getFnList = (ev, method) => {
        const arg = []
        if (this.utils.metaKeyPressed(ev)) arg.push("CTRL")
        else if (this.utils.shiftKeyPressed(ev)) arg.push("SHIFT")
        else if (this.utils.altKeyPressed(ev)) arg.push("ALT")
        arg.push(method, "FUNCTION")
        const config = this.config[arg.join("_")]
        return config.map(e => this[e])
    }

    replaceImageTransform = (regex, fn, moveCenter = true) => {
        this.entities.image.style.transform = this.entities.image.style.transform.replace(regex, fn)
        if (moveCenter) this.moveImageCenter()
    }

    rotate = (dec, newRotate, rotateScale) => this.replaceImageTransform(/rotate\((.*?)deg\)/, (_, curRotate) => {
        if (!newRotate) {
            const currentRotate = parseFloat(curRotate)
            rotateScale = rotateScale || this.config.ROTATE_SCALE
            newRotate = dec ? currentRotate + rotateScale : currentRotate - rotateScale
        }
        return `rotate(${newRotate}deg)`
    })

    zoom = (dec, newScale, zoomScale) => this.replaceImageTransform(/scale\((.*?)\)/, (_, curScale) => {
        if (!newScale) {
            const currentScale = parseFloat(curScale)
            zoomScale = zoomScale || this.config.ZOOM_SCALE
            newScale = dec ? currentScale - zoomScale : currentScale + zoomScale
        }
        newScale = Math.max(0.1, newScale)
        return `scale(${newScale})`
    })

    skew = (dec, direction, newSkew, skewScale) => this.replaceImageTransform(new RegExp(`skew${direction}\\((.*?)deg\\)`), (_, curSkew) => {
        if (!newSkew) {
            const currentSkew = parseFloat(curSkew)
            skewScale = skewScale || this.config.SKEW_SCALE
            newSkew = dec ? currentSkew - skewScale : currentSkew + skewScale
        }
        return `skew${direction}(${newSkew}deg)`
    })

    translate = (dec, direction, newTranslate, translateScale) => this.replaceImageTransform(new RegExp(`translate${direction}\\((.*?)px\\)`), (_, curTranslate) => {
        if (!newTranslate) {
            const currentTranslate = parseFloat(curTranslate)
            translateScale = translateScale || this.config.TRANSLATE_SCALE
            newTranslate = dec ? currentTranslate - translateScale : currentTranslate + translateScale
        }
        return `translate${direction}(${newTranslate}px)`
    }, false)

    flip = direction => this.replaceImageTransform(new RegExp(`scale${direction}\\((.*?)\\)`), (_, curScale) => {
        const currentScale = parseInt(curScale)
        return `scale${direction}(${-currentScale})`
    })

    changeSize = (origin = true) => {
        const value = origin ? "initial" : ""
        const class_ = origin ? "fa fa-search-minus" : "fa fa-search-plus"
        this.entities.image.style.maxWidth = value
        this.entities.image.style.maxHeight = value
        this.entities.ops.querySelector(`[option="autoSize"]`).className = class_
        this.zoom(null, 1)
    }

    moveImageCenter = () => {
        const { width: maskWidth, height: maskHeight } = this.entities.mask.getBoundingClientRect()
        const { width: imageWidth, height: imageHeight } = this.entities.image
        this.entities.image.style.left = (maskWidth - imageWidth) / 2 + "px"
        this.entities.image.style.top = (maskHeight - imageHeight) / 2 + "px"
    }

    dumpImage = (direction = "next", condition = () => true) => {
        const next = direction === "next"
        while (true) {
            const curImg = this.imageGetter(next)
            if (condition(curImg)) {
                this._showImage(curImg)
                return curImg
            }
        }
    }

    dumpIndex = targetIdx => {
        targetIdx = Math.max(targetIdx, 0)
        return this.dumpImage("next", img => img.idx === Math.min(targetIdx, img.total - 1))
    }

    waterFall = () => {
        const columns = [...this.entities.waterFall.querySelectorAll(".viewer-water-fall-col")]

        const toggleComponent = hide => {
            [...this.entities.viewer.children]
                .filter(el => !el.classList.contains("viewer-water-fall") && !el.classList.contains("viewer-mask"))
                .forEach(el => this.utils.toggleInvisible(el, hide))
        }

        const getMinHeightColumn = () => {
            const minHeight = Math.min(...columns.map(col => col.offsetHeight))
            return columns.find(col => col.offsetHeight === minHeight)
        }

        const nav2WaterFall = () => {
            [...this.entities.nav.children]
                .map(img => {
                    img.classList.remove("viewer-thumbnail")
                    img.classList.add("viewer-water-fall-item")
                    return img
                })
                .forEach(img => getMinHeightColumn().appendChild(img))
        }

        const waterFall2Nav = () => {
            const fallChildren = [...this.entities.waterFall.querySelectorAll(".viewer-water-fall-item")]
                .sort((a, b) => parseInt(a.dataset.idx) - parseInt(b.dataset.idx))
                .map(img => {
                    img.classList.remove("viewer-water-fall-item")
                    img.classList.add("viewer-thumbnail")
                    return img
                })
            this.entities.nav.append(...fallChildren)
        }

        this.utils.toggleInvisible(this.entities.waterFall)
        if (this.utils.isHidden(this.entities.waterFall)) {
            waterFall2Nav()
            toggleComponent(false)
        } else {
            columns.forEach(e => e.innerHTML = "")
            toggleComponent(true)
            nav2WaterFall()
            this.entities.waterFall.querySelector(".viewer-water-fall-item.select")?.scrollIntoView()
        }
    }

    _showImage = imgInfo => {
        const handleMessage = imgInfo => {
            const { src, alt, naturalWidth, naturalHeight, showIdx, idx, total } = imgInfo
            this.entities.image.setAttribute("src", src)
            this.entities.image.setAttribute("data-idx", idx)
            const index = this.entities.msg.querySelector(".viewer-index")
            const title = this.entities.msg.querySelector(".viewer-title")
            const size = this.entities.msg.querySelector(".viewer-size")
            if (index) (index.textContent = `[ ${showIdx} / ${total} ]`)
            if (title) (title.textContent = alt)
            if (size) (size.textContent = `${naturalWidth} × ${naturalHeight}`)
        }

        const handleToolIcon = src => {
            const autoSize = this.entities.ops.querySelector(`[option="autoSize"]`)
            const download = this.entities.ops.querySelector(`[option="download"]`)
            if (autoSize) (autoSize.className = "fa fa-search-plus")
            if (download) this.utils.toggleInvisible(download, !this.utils.isNetworkImage(src))
        }

        const handleThumbnail = showIdx => {
            this.entities.nav.querySelector(".select")?.classList.remove("select")
            const active = this.entities.nav.querySelector(`.viewer-thumbnail[data-idx="${showIdx - 1}"]`)
            if (active) {
                active.classList.add("select")
                active.scrollIntoView({ inline: "nearest", behavior: "smooth" })
            }
        }

        handleMessage(imgInfo)
        handleToolIcon(imgInfo.src)
        handleThumbnail(imgInfo.showIdx)
        this.restore()
    }

    _collectImage = () => {
        let images = [...this.utils.entities.querySelectorAllInWrite("img")]
        if (this.config.FILTER_ERROR_IMAGE) {
            images = images.filter(this.utils.isImgEmbed)
        }
        return images
    }

    initImageMsgGetter = () => {
        if (this.imageGetter) return

        let images = this._collectImage()
        this.imageGetter = this._imageMsgGetter(images)

        if (images.length === 0) return

        let target = this._getTargetImage(images)
        if (!target) return

        while (true) {
            const { img, showIdx, total } = this.imageGetter(true)
            if (!img) return

            if (img === target) {
                return this.imageGetter(false)
            }
            // Defensive code to prevent infinite loops.
            if (showIdx === total) return
        }
    }

    _imageMsgGetter = images => {
        let idx = -1
        return (next = true) => {
            next ? idx++ : idx--
            const maxIdx = images.length - 1
            if (idx > maxIdx) {
                idx = 0
            } else if (idx < 0) {
                idx = maxIdx
            }
            const img = images[idx]
            return {
                img,
                idx,
                showIdx: (images.length === 0) ? 0 : idx + 1,
                src: img?.getAttribute("src") ?? "",
                alt: img?.getAttribute("alt") ?? "",
                naturalWidth: img?.naturalWidth ?? 0,
                naturalHeight: img?.naturalHeight ?? 0,
                total: images.length || 0,
                all: images,
            }
        }
    }

    _getTargetImage = images => {
        const strategies = {
            firstImage: images => images[0],
            inViewBoxImage: images => images.find(img => this.utils.isInViewBox(img)),
            closestViewBoxImage: images => {
                let closestImg = null
                let minDistance = Number.MAX_VALUE
                images.forEach(img => {
                    const distance = Math.abs(img.getBoundingClientRect().top - window.innerHeight / 2)
                    if (distance < minDistance) {
                        minDistance = distance
                        closestImg = img
                    }
                })
                return closestImg
            },
        }
        // firstImage as a fallback strategy
        const fnList = [...this.config.FIRST_IMAGE_STRATEGIES, "firstImage"].map(s => strategies[s]).filter(Boolean)
        for (const fn of fnList) {
            const image = fn(images)
            if (image) {
                return image
            }
        }
    }

    initThumbnailNav = current => {
        const { idx: targetIdx, all = [] } = current || {}
        const thumbnails = all.map((img, idx) => {
            const select = idx === targetIdx ? "select" : ""
            return `<img class="viewer-thumbnail ${select}" src="${img.src}" alt="${img.alt}" data-idx="${idx}">`
        })
        this.entities.nav.innerHTML = thumbnails.join("")
    }

    handleHotkey = (remove = false) => {
        const unregister = item => this.utils.hotkeyHub.unregister(item.hotkey)
        const register = item => this.utils.hotkeyHub.registerSingle(item.hotkey, this[item.fn] || this.dummy)
        this.config.HOTKEY_FUNCTION.forEach(remove ? unregister : register)
    }

    handlePlayTimer = (stop = false) => {
        const btn = this.entities.ops.querySelector(`[option="play"]`)
        if (!btn) return
        if (!stop && !this.playTimer) {
            this.playTimer = setInterval(this.nextImage, this.config.PLAY_SECONDS * 1000)
            btn.classList.add("active")
        } else {
            btn.classList.remove("active")
            clearInterval(this.playTimer)
            this.playTimer = null
        }
    }

    thumbnailNav = force => {
        this.config.SHOW_THUMBNAIL_NAV = !this.config.SHOW_THUMBNAIL_NAV
        this.utils.toggleInvisible(this.entities.nav, force)
    }
    play = () => this.handlePlayTimer(!!this.playTimer)
    restore = () => {
        const transform = "scale(1) rotate(0deg) scaleX(1) scaleY(1) skewX(0deg) skewY(0deg) translateX(0px) translateY(0px)"
        Object.assign(this.entities.image.style, { maxWidth: "", maxHeight: "", transform })
        this.moveImageCenter()
    }
    location = () => {
        let src = this.entities.image.getAttribute("src")
        if (this.utils.isNetworkImage(src)) {
            this.utils.openUrl(src)
        } else if (this.utils.isSpecialImage(src)) {
            alert("this image cannot locate")
        } else {
            // src = src.replace(/^file:\/[2-3]/, "")
            src = decodeURI(window.removeLastModifyQuery(src))
            if (src) this.utils.showInFinder(src)
        }
    }
    download = async () => {
        const src = this.entities.image.getAttribute("src")
        if (!this.utils.isNetworkImage(src)) return
        const { ok, filepath } = await this.utils.downloadImage(src)
        if (ok) {
            this.utils.showInFinder(filepath)
        } else {
            alert("download image failed")
        }
    }
    scroll = () => {
        const idx = parseInt(this.entities.image.dataset.idx)
        const image = this._collectImage()[idx]
        this.close()
        if (image) this.utils.scroll(image, 30)
    }
    show = () => {
        document.activeElement.blur()
        this.handleHotkey(false)
        this.utils.show(this.entities.viewer)
        const cur = this.initImageMsgGetter()
        this.initThumbnailNav(cur)
        this.dumpImage()
    }
    close = () => {
        this.handleHotkey(true)
        this.handlePlayTimer(true)
        this.utils.hide(this.entities.viewer)
        this.imageGetter = null
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
    plugin: ImageViewerPlugin
}
