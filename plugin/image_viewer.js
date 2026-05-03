class ImageOperations {
    constructor(imageEl, maskEl, config) {
        this.image = imageEl
        this.mask = maskEl
        this.config = config
        this.resetState()
    }

    resetState = () => {
        this.state = { scale: 1, rotate: 0, flipX: 1, flipY: 1, translateX: 0, translateY: 0, skewX: 0, skewY: 0 }
        this.apply()
    }
    apply = (moveCenter = true) => {
        const { style } = this.image
        const s = this.state
        style.setProperty("--v-scale", s.scale)
        style.setProperty("--v-rotate", `${s.rotate}deg`)
        style.setProperty("--v-flip-x", s.flipX)
        style.setProperty("--v-flip-y", s.flipY)
        style.setProperty("--v-trans-x", `${s.translateX}px`)
        style.setProperty("--v-trans-y", `${s.translateY}px`)
        style.setProperty("--v-skew-x", `${s.skewX}deg`)
        style.setProperty("--v-skew-y", `${s.skewY}deg`)
        style.transform = `
            translate(var(--v-trans-x), var(--v-trans-y))
            scale(var(--v-flip-x), var(--v-flip-y))
            scale(var(--v-scale))
            rotate(var(--v-rotate))
            skew(var(--v-skew-x), var(--v-skew-y))
        `.trim()
        if (moveCenter) this.moveImageCenter()
    }
    moveImageCenter = () => {
        if (!this.mask || !this.image) return
        const { width: maskWidth, height: maskHeight } = this.mask.getBoundingClientRect()
        const { width: imageWidth, height: imageHeight } = this.image
        this.image.style.left = `${(maskWidth - imageWidth) / 2}px`
        this.image.style.top = `${(maskHeight - imageHeight) / 2}px`
    }
    zoom = (isOut, scaleStep = this.config.ZOOM_SCALE) => {
        const delta = isOut ? -scaleStep : scaleStep
        this.state.scale = Math.max(0.1, this.state.scale + delta)
        this.apply()
    }
    setZoom = (targetScale) => {
        this.state.scale = Math.max(0.1, targetScale)
        this.apply()
    }
    rotate = (isRight, degStep = this.config.ROTATE_SCALE) => {
        this.state.rotate += isRight ? degStep : -degStep
        this.apply()
    }
    flip = (axis) => {
        if (axis === "X") this.state.flipX *= -1
        if (axis === "Y") this.state.flipY *= -1
        this.apply()
    }
    skew = (isInc, axis, degStep = this.config.SKEW_SCALE) => {
        const delta = isInc ? degStep : -degStep
        if (axis === "X") this.state.skewX += delta
        if (axis === "Y") this.state.skewY += delta
        this.apply()
    }
    translate = (isLeftOrUp, axis, pxStep = this.config.TRANSLATE_SCALE) => {
        const delta = isLeftOrUp ? -pxStep : pxStep
        if (axis === "X") this.state.translateX += delta
        if (axis === "Y") this.state.translateY += delta
        this.apply(false)
    }
}

class GalleryManager {
    constructor(utils, config) {
        this.utils = utils
        this.config = config
        this.imageGetter = null
    }

    _collectImage = () => {
        const images = [...this.utils.entities.querySelectorAllInWrite("img")]
        return this.config.SKIP_BROKEN_IMAGES ? images.filter(this.utils.isImgEmbed) : images
    }

    getAllImages = () => this._collectImage()

    initImageMsgGetter = () => {
        if (this.imageGetter) return

        const images = this._collectImage()
        this.imageGetter = this._createImageMsgGetter(images)
        if (images.length === 0) return

        const target = this._getTargetImage(images)
        if (!target) return

        while (true) {
            const { img, showIdx, total } = this.imageGetter(true)
            if (!img) return
            if (img === target) return this.imageGetter(false)
            if (showIdx === total) return
        }
    }

    _createImageMsgGetter = images => {
        let idx = -1
        const maxIdx = images.length - 1
        return (next = true) => {
            idx += next ? 1 : -1
            if (idx > maxIdx) idx = 0
            else if (idx < 0) idx = maxIdx

            const img = images[idx]
            return {
                img,
                idx,
                showIdx: images.length === 0 ? 0 : idx + 1,
                src: img?.getAttribute("src") ?? "",
                alt: img?.getAttribute("alt") ?? "",
                naturalWidth: img?.naturalWidth ?? 0,
                naturalHeight: img?.naturalHeight ?? 0,
                total: images.length,
                all: images,
            }
        }
    }

    _getTargetImage = images => {
        const strategies = {
            firstImage: imgs => imgs[0],
            inViewBoxImage: imgs => imgs.find(img => this.utils.isInViewBox(img)),
            closestViewBoxImage: imgs => imgs.reduce((closest, img) => {
                const distance = Math.abs(img.getBoundingClientRect().top - window.innerHeight / 2)
                return distance < closest.minDist ? { img, minDist: distance } : closest
            }, { img: null, minDist: Number.MAX_VALUE }).img,
        }

        const strategyNames = [...this.config.FIRST_IMAGE_STRATEGIES, "firstImage"]
        for (const name of strategyNames) {
            const image = strategies[name]?.(images)
            if (image) return image
        }
    }

    dumpImage = (direction = "next", condition = () => true) => {
        const isNext = direction === "next"
        while (true) {
            const curImg = this.imageGetter(isNext)
            if (condition(curImg)) {
                return curImg
            }
        }
    }

    dumpIndex = targetIdx => {
        const safeIdx = Math.max(targetIdx, 0)
        return this.dumpImage("next", img => img.total === 0 || img.idx === Math.min(safeIdx, img.total - 1))
    }
}

class CommandDispatcher {
    playTimer = null

    constructor(view, operations, gallery) {
        this.view = view
        this.operations = operations
        this.commands = {
            rotateLeft: scale => operations.rotate(false, scale),
            rotateRight: scale => operations.rotate(true, scale),
            zoomOut: scale => operations.zoom(true, scale),
            zoomIn: scale => operations.zoom(false, scale),
            hFlip: () => operations.flip("X"),
            vFlip: () => operations.flip("Y"),
            incHSkew: scale => operations.skew(true, "X", scale),
            decHSkew: scale => operations.skew(false, "X", scale),
            incVSkew: scale => operations.skew(true, "Y", scale),
            decVSkew: scale => operations.skew(false, "Y", scale),
            translateLeft: scale => operations.translate(true, "X", scale),
            translateRight: scale => operations.translate(false, "X", scale),
            translateUp: scale => operations.translate(true, "Y", scale),
            translateDown: scale => operations.translate(false, "Y", scale),
            originSize: () => this.setSize(true),
            fitScreen: () => this.setSize(false),
            autoSize: () => this.setSize(view.isOriginSize()),
            restore: () => {
                view.restoreSize()
                operations.resetState()
            },
            nextImage: () => this.onImageChange(gallery.dumpImage("next")),
            previousImage: () => this.onImageChange(gallery.dumpImage("previous")),
            firstImage: () => this.onImageChange(gallery.dumpIndex(-1)),
            lastImage: () => this.onImageChange(gallery.dumpIndex(Number.MAX_VALUE)),
            jumpToIndex: idx => this.onImageChange(gallery.dumpIndex(idx)),
            play: stop => this.play(stop),
            thumbnailNav: force => view.thumbnailNav(force),
            location: () => view.location(),
            download: () => view.download(),
            scroll: () => view.scroll(gallery.getAllImages()),
            waterfall: () => view.waterfall(),
            close: () => view.close(),
            dummy: () => null,
        }
    }

    execute = (actionName, arg) => {
        const handler = this.getHandler(actionName)
        if (typeof handler === "function") handler(arg)
    }

    getHandler = (actionName) => this.commands[actionName]

    setSize = (isOrigin) => {
        this.view.changeSize(isOrigin)
        this.operations.setZoom(1)
    }

    onImageChange = (imgInfo) => {
        if (!imgInfo) return
        this.view.renderImage(imgInfo)
        this.execute("restore")
    }

    play = (stop = false) => {
        if (!stop && !this.playTimer) {
            this.playTimer = setInterval(() => this.execute("nextImage"), this.view.config.AUTO_PLAY_INTERVAL * 1000)
            this.view.setPlayButtonState(true)
        } else {
            clearInterval(this.playTimer)
            this.playTimer = null
            this.view.setPlayButtonState(false)
        }
    }
}

class ImageViewerPlugin extends BasePlugin {
    operations = null
    gallery = null
    dispatcher = null

    static OP_ICONS = {
        dummy: "", info: "fa fa-info-circle", thumbnailNav: "fa fa-caret-square-o-down",
        waterfall: "fa fa-list", close: "fa fa-times", download: "fa fa-download",
        scroll: "fa fa-crosshairs", play: "fa fa-play", location: "fa fa-location-arrow",
        nextImage: "fa fa-angle-right", previousImage: "fa fa-angle-left",
        firstImage: "fa fa-fast-backward", lastImage: "fa fa-fast-forward",
        zoomOut: "fa fa fa-search-minus", zoomIn: "fa fa fa-search-plus",
        rotateLeft: "fa fa-rotate-left", rotateRight: "fa fa-rotate-right",
        hFlip: "fa fa-arrows-h", vFlip: "fa fa-arrows-v",
        translateLeft: "fa fa-arrow-left", translateRight: "fa fa-arrow-right",
        translateUp: "fa fa-arrow-up", translateDown: "fa fa-arrow-down",
        incHSkew: "fa fa-toggle-right", decHSkew: "fa fa-toggle-left",
        incVSkew: "fa fa-toggle-up", decVSkew: "fa fa-toggle-down",
        originSize: "fa fa-clock-o", fitScreen: "fa fa-codepen",
        autoSize: "fa fa-search-plus", restore: "fa fa-history",
    }
    static KEY_TRANSLATE = { arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→", " ": "Space" }

    styleTemplate = () => ({
        imageMaxWidth: this.config.IMAGE_MAX_WIDTH + "%",
        imageMaxHeight: this.config.IMAGE_MAX_HEIGHT + "%",
        toolPosition: this.config.TOOL_POSITION === "top" ? "initial" : 0,
        thumbnailPosition: this.config.TOOL_POSITION === "top" ? "bottom" : "top",
        blurLevel: this.config.BLUR_LEVEL + "px",
    })

    html = () => {
        const opEntities = Object.fromEntries(
            Object.entries(this.constructor.OP_ICONS).map(([op, icon]) => [
                op, { hint: this.i18n.t(`$option.operations.${op}`), icon },
            ]),
        )
        opEntities.info.hint = this._buildInfoHint(opEntities)

        const columns = `<div class="viewer-waterfall-col"></div>`.repeat(this.config.WATERFALL_COLUMNS)
        const messageList = this.config.SHOW_MESSAGE.map(m => `<div class="viewer-${m}"></div>`).join("")
        const operationList = this.config.TOOL_FUNCTION
            .filter(op => Object.hasOwn(opEntities, op))
            .map(op => `<i class="${opEntities[op].icon}" option="${op}" title="${opEntities[op].hint}"></i>`)
            .join("")

        const navClass = this.config.SHOW_THUMBNAIL_NAV ? "" : "plugin-common-hidden"

        return `
            <div id="plugin-image-viewer" class="plugin-viewer-cover plugin-common-hidden">
                <div class="viewer-tool">
                    <div class="viewer-message">${messageList}</div>
                    <div class="viewer-options">${operationList}</div>
                </div>
                <div class="viewer-waterfall plugin-common-hidden">
                    <div class="viewer-waterfall-container">${columns}</div>
                </div>
                <div class="viewer-nav ${navClass}"></div>
                <img class="viewer-image" alt=""/>
                <div class="viewer-item" action="previousImage"><i class="fa fa-angle-left"></i></div>
                <div class="viewer-item" action="nextImage"><i class="fa fa-angle-right"></i></div>
                <div class="plugin-viewer-cover viewer-mask"></div>
            </div>`
    }

    _buildInfoHint = (opEntities) => {
        const result = [`${this.i18n.t("currentConfig")}:`]
        const dummy = this.i18n.t("$option.operations.dummy")
        const modifierKeys = ["", "CTRL", "SHIFT", "ALT"]
        const mouseEvents = [
            { name: "MOUSEDOWN_FUNCTION", events: this.i18n.array(["leftClick", "middleClick", "rightClick"], "mouse.") },
            { name: "WHEEL_FUNCTION", events: this.i18n.array(["wheelUp", "wheelDown"], "mouse.") },
        ]

        for (const { name, events } of mouseEvents) {
            for (const modifier of modifierKeys) {
                const configKey = modifier ? `${modifier}_${name}` : name
                const config = this.config[configKey]
                events.forEach((evName, idx) => {
                    const op = config[idx]
                    const hint = opEntities[op]?.hint
                    if (hint && hint !== dummy) {
                        const keyCombo = (modifier ? `${modifier}+` : "") + evName
                        result.push(`${keyCombo}\t${hint}`)
                    }
                })
            }
        }

        this.config.HOTKEY_FUNCTION.forEach(({ hotkey, fn }) => {
            const hint = opEntities[fn]?.hint
            if (hint && hint !== dummy) {
                const translatedKey = this.constructor.KEY_TRANSLATE[hotkey.toLowerCase()] || hotkey
                result.push(`${translatedKey}\t${hint}`)
            }
        })

        return result.join("\n")
    }

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    call = () => this.utils.isHidden(this.entities.viewer) ? this.show() : this.close()

    init = () => {
        const root = document.getElementById("plugin-image-viewer")
        this.entities = {
            viewer: root,
            mask: root.querySelector(".viewer-mask"),
            waterfall: root.querySelector(".viewer-waterfall"),
            nav: root.querySelector(".viewer-nav"),
            image: root.querySelector(".viewer-image"),
            msg: root.querySelector(".viewer-message"),
            ops: root.querySelector(".viewer-options"),
            close: root.querySelector(".viewer-close"),
        }
        this.operations = new ImageOperations(this.entities.image, this.entities.mask, this.config)
        this.gallery = new GalleryManager(this.utils, this.config)
        this.dispatcher = new CommandDispatcher(this, this.operations, this.gallery)
    }

    process = () => {
        const { eventHub } = this.utils

        if (this.config.CLICK_MASK_TO_EXIT) {
            this.entities.mask.addEventListener("click", this.call)
        }
        eventHub.addEventListener(eventHub.eventType.toggleSettingPage, hide => hide && this.close())
        this.entities.viewer.addEventListener("click", ev => {
            const item = ev.target.closest(".viewer-item")
            if (item) {
                const act = item.getAttribute("action")
                this.dispatcher.execute(act)
            }
        })
        this.entities.viewer.addEventListener("wheel", ev => {
            if (this.utils.isShown(this.entities.waterfall)) return
            ev.preventDefault()
            const fnList = this.getFnList(ev, "WHEEL")
            const fn = fnList[ev.deltaY > 0 ? 1 : 0]
            if (typeof fn === "function") fn()
        }, { passive: false })
        this.entities.image.addEventListener("mousedown", ev => {
            const fnList = this.getFnList(ev, "MOUSEDOWN")
            const fn = fnList[ev.button]
            if (typeof fn === "function") fn()
        })
        this.entities.ops.addEventListener("click", ev => {
            const target = ev.target.closest("[option]")
            if (!target) return
            const option = target.getAttribute("option")
            const arg = option.includes("rotate") ? 90 : undefined
            this.dispatcher.execute(option, arg)
        })
        this.entities.nav.addEventListener("click", ev => {
            const target = ev.target.closest(".viewer-thumbnail")
            if (target) {
                this.dispatcher.execute("jumpToIndex", parseInt(target.dataset.idx, 10))
            }
        })
        this.entities.waterfall.addEventListener("click", ev => {
            const target = ev.target.closest(".viewer-waterfall-item")
            this.dispatcher.execute("waterfall")
            if (target) {
                this.dispatcher.execute("jumpToIndex", parseInt(target.dataset.idx, 10))
            }
        })
        this.entities.nav.addEventListener("wheel", ev => {
            const target = ev.target.closest(".viewer-nav")
            if (target) target.scrollLeft += ev.deltaY * 0.5
            ev.stopPropagation()
        }, { passive: true })
    }

    getFnList = (ev, method) => {
        const modifiers = []
        if (this.utils.metaKeyPressed(ev)) modifiers.push("CTRL")
        else if (ev.shiftKey) modifiers.push("SHIFT")
        else if (ev.altKey) modifiers.push("ALT")
        modifiers.push(method, "FUNCTION")
        const configKey = modifiers.join("_")
        return (this.config[configKey] || []).map(fnName => this.dispatcher.getHandler(fnName))
    }

    changeSize = (isOrigin = true) => {
        const value = isOrigin ? "initial" : ""
        const class_ = isOrigin ? "fa fa-search-minus" : "fa fa-search-plus"
        this.entities.image.style.maxWidth = value
        this.entities.image.style.maxHeight = value
        const autoSizeIcon = this.entities.ops.querySelector(`[option="autoSize"]`)
        if (autoSizeIcon) autoSizeIcon.className = class_
    }

    isOriginSize = () => this.entities.image.style.maxWidth !== "initial"

    restoreSize = () => {
        this.entities.image.style.maxWidth = ""
        this.entities.image.style.maxHeight = ""
    }

    renderImage = imgInfo => {
        this._updateMessageBar(imgInfo)
        this._updateToolIcons(imgInfo.src)
        this._updateThumbnailActive(imgInfo.showIdx)
    }

    _updateMessageBar = ({ src, alt, naturalWidth, naturalHeight, showIdx, idx, total }) => {
        this.entities.image.setAttribute("src", src)
        this.entities.image.setAttribute("data-idx", idx)

        const { msg } = this.entities
        const indexEl = msg.querySelector(".viewer-index")
        const titleEl = msg.querySelector(".viewer-title")
        const sizeEl = msg.querySelector(".viewer-size")

        if (indexEl) indexEl.textContent = `[ ${showIdx} / ${total} ]`
        if (titleEl) titleEl.textContent = alt
        if (sizeEl) sizeEl.textContent = `${naturalWidth} × ${naturalHeight}`
    }

    _updateToolIcons = src => {
        const autoSize = this.entities.ops.querySelector(`[option="autoSize"]`)
        const download = this.entities.ops.querySelector(`[option="download"]`)
        if (autoSize) autoSize.className = "fa fa-search-plus"
        if (download) this.utils.toggleInvisible(download, !this.utils.isNetworkImage(src))
    }

    _updateThumbnailActive = showIdx => {
        this.entities.nav.querySelector(".select")?.classList.remove("select")
        const active = this.entities.nav.querySelector(`.viewer-thumbnail[data-idx="${showIdx - 1}"]`)
        if (active) {
            active.classList.add("select")
            active.scrollIntoView({ inline: "nearest", behavior: "smooth" })
        }
    }

    initThumbnailNav = (current = {}) => {
        const { idx: targetIdx, all = [] } = current
        this.entities.nav.innerHTML = all.map((img, idx) => {
            const activeClass = idx === targetIdx ? "select" : ""
            return `<img class="viewer-thumbnail ${activeClass}" src="${img.src}" alt="${img.alt}" data-idx="${idx}">`
        }).join("")
    }

    waterfall = () => {
        const columns = [...this.entities.waterfall.querySelectorAll(".viewer-waterfall-col")]

        const toggleComponent = isHide => {
            [...this.entities.viewer.children]
                .filter(el => !el.classList.contains("viewer-waterfall") && !el.classList.contains("viewer-mask"))
                .forEach(el => this.utils.toggleInvisible(el, isHide))
        }

        const navToWaterfall = () => {
            const getMinHeightCol = () => columns.reduce((min, col) => col.offsetHeight < min.offsetHeight ? col : min, columns[0])
            ;[...this.entities.nav.children].forEach(img => {
                img.classList.replace("viewer-thumbnail", "viewer-waterfall-item")
                getMinHeightCol().appendChild(img)
            })
        }

        const waterfallToNav = () => {
            const items = [...this.entities.waterfall.querySelectorAll(".viewer-waterfall-item")]
                .sort((a, b) => parseInt(a.dataset.idx, 10) - parseInt(b.dataset.idx, 10))
            items.forEach(img => img.classList.replace("viewer-waterfall-item", "viewer-thumbnail"))
            this.entities.nav.append(...items)
        }

        this.utils.toggleInvisible(this.entities.waterfall)
        if (this.utils.isHidden(this.entities.waterfall)) {
            waterfallToNav()
            toggleComponent(false)
        } else {
            columns.forEach(col => col.innerHTML = "")
            toggleComponent(true)
            navToWaterfall()
            this.entities.waterfall.querySelector(".viewer-waterfall-item.select")?.scrollIntoView()
        }
    }

    thumbnailNav = force => {
        this.config.SHOW_THUMBNAIL_NAV = !this.config.SHOW_THUMBNAIL_NAV
        this.utils.toggleInvisible(this.entities.nav, force)
    }

    setPlayButtonState = (isActive) => this.entities.ops.querySelector(`[option="play"]`)?.classList.toggle("active", isActive)

    location = () => {
        let src = this.entities.image.getAttribute("src")
        if (this.utils.isNetworkImage(src)) {
            this.utils.openUrl(src)
        } else if (this.utils.isSpecialImage(src)) {
            alert("This Image Cannot Locate")
        } else {
            src = decodeURI(window.removeLastModifyQuery(src))
            if (src) this.utils.showInFinder(src)
        }
    }

    download = async () => {
        const src = this.entities.image.getAttribute("src")
        if (!this.utils.isNetworkImage(src)) return
        const { ok, filepath } = await this.utils.downloadImage(src)
        ok ? this.utils.showInFinder(filepath) : alert("Download Image Failed")
    }

    scroll = (allImages) => {
        const idx = parseInt(this.entities.image.dataset.idx, 10)
        const image = allImages[idx]
        this.close()
        if (image) this.utils.scroll(image, { height: 30 })
    }

    handleHotkey = (isRemove = false) => {
        const { hotkeyHub } = this.utils
        this.config.HOTKEY_FUNCTION.forEach(item => {
            if (isRemove) {
                hotkeyHub.unregister(item.hotkey)
            } else {
                const handler = this.dispatcher.getHandler(item.fn) || this.utils.noop
                hotkeyHub.registerSingle(item.hotkey, handler)
            }
        })
    }

    show = () => {
        document.activeElement.blur()
        this.handleHotkey(false)
        this.utils.show(this.entities.viewer)
        const currentInfo = this.gallery.initImageMsgGetter()
        this.initThumbnailNav(currentInfo)
        this.dispatcher.execute("nextImage")
    }

    close = () => {
        this.handleHotkey(true)
        this.dispatcher.execute("play", true)
        this.utils.hide(this.entities.viewer)
        this.gallery.imageGetter = null
    }
}

module.exports = {
    plugin: ImageViewerPlugin,
}
