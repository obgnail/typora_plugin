class ResizeImagePlugin extends BasePlugin {
    init = () => {
        this.checkers = Object.entries(this.config.MODIFIER_KEY)
            .filter(([_, modifier]) => Boolean(modifier))
            .map(([type, modifier]) => ({ type, check: this.utils.modifierKey(modifier) }))
    }

    process = () => {
        this.utils.settings.autoSave(this)
        this.recordResizeState(false)

        this.utils.entities.eWrite.addEventListener("wheel", ev => {
            const zoom = this.checkers.find(c => c.check(ev))
            if (!zoom) return
            const target = ev.target.closest("img")
            if (!target) return
            ev.preventDefault()
            ev.stopPropagation()
            const zoomFn = zoom.type === "TEMPORARY" ? this.zoomTemporary : this.zoomPersistent
            zoomFn(target, ev.deltaY > 0)
        }, { passive: false, capture: true })
    }

    recordResizeState = (needChange = true) => {
        if (needChange) {
            this.config.RECORD_RESIZE = !this.config.RECORD_RESIZE
        }
        if (this.config.RECORD_RESIZE) {
            this.utils.stateRecorder.register({
                name: this.fixedName,
                selector: "#write img",
                stateGetter: el => el.style.cssText,
                stateRestorer: (el, state) => el.style = state
            })
        } else {
            this.utils.stateRecorder.unregister(this.fixedName)
        }
    }

    resetImageSize = () => {
        this.config.ALLOW_EXCEED_LIMIT = !this.config.ALLOW_EXCEED_LIMIT
        if (!this.config.ALLOW_EXCEED_LIMIT) {
            this.utils.entities.querySelectorAllInWrite("img").forEach(img => {
                if (img.style.maxWidth) {
                    const maxSize = img.parentElement.offsetWidth
                    if (this.getWidth(img) > maxSize) {
                        img.style.removeProperty("width")
                    }
                    img.style.removeProperty("maxWidth")
                }
                img.style.removeProperty("left")
                img.style.removeProperty("position")
            })
        }
    }

    getWidth = img => img.style.width ? parseFloat(img.style.width) : img.getBoundingClientRect().width

    setAlign = (align, img, maxWidth) => {
        img.setAttribute("align", align)
        if (!maxWidth) {
            maxWidth = img.parentElement.offsetWidth
        }
        img.style.marginRight = ""
        img.style.marginLeft = ""
        if (align !== "center") {
            const width = this.getWidth(img)
            const margin = (align === "left") ? "marginRight" : "marginLeft"
            img.style[margin] = maxWidth - width + "px"
        }
    }

    zoomTemporary = (img, zoomOut, scale = 0.1) => {
        let width = this.getWidth(img)
        width = zoomOut ? width * (1 - scale) : width * (1 + scale)
        const maxWidth = img.parentElement.offsetWidth
        img.style.maxWidth = ""

        if (!this.config.ALLOW_EXCEED_LIMIT || width <= maxWidth) {
            width = Math.min(width, maxWidth)
            img.style.width = width + "px"
            this.setAlign(this.config.IMAGE_ALIGN, img, maxWidth)
        } else {
            Object.assign(img.style, {
                position: "relative",
                width: width + "px",
                maxWidth: width + "px",
                left: (maxWidth - width) / 2 + "px",
            })
        }
    }

    zoomPersistent = (img, zoomOut, scale = 5) => {
        const originZoom = img.style.zoom || "100%"
        const nextZoom = Math.max(10, Math.min(parseInt(originZoom) + (zoomOut ? -scale : scale), 200)) + "%"
        Object.assign(img.style, { position: "", width: "", maxWidth: "", left: "" })
        const $span = $(img.closest(".md-image.md-img-loaded"))
        if ($span.length === 1) {
            File.editor.imgEdit.zoomAction($span, nextZoom)
        }
    }

    getDynamicActions = (anchorNode, meta) => {
        const other = [
            { act_value: "zoom_out_20_percent", act_hidden: true },
            { act_value: "zoom_in_20_percent", act_hidden: true },
            { act_value: "set_align_left", act_hidden: true },
            { act_value: "set_align_center", act_hidden: true },
            { act_value: "set_align_right", act_hidden: true },
        ]
        const actions = this.i18n.fillActions([
            { act_value: "record_resize_state", act_state: this.config.RECORD_RESIZE },
            { act_value: "allow_exceed_limit", act_state: this.config.ALLOW_EXCEED_LIMIT },
            ...other
        ])

        const img = anchorNode.closest("#write .md-image")?.querySelector("img")
        if (!img) return actions

        meta.target = img
        other.forEach(a => a.act_hidden = false)
        return actions
    }

    call = (action, meta) => {
        const fnMap = {
            record_resize_state: () => this.recordResizeState(),
            allow_exceed_limit: () => this.resetImageSize(),
            zoom_out_20_percent: meta => this.zoomTemporary(meta.target, true, 0.2),
            zoom_in_20_percent: meta => this.zoomTemporary(meta.target, false, 0.2),
            set_align_left: meta => this.setAlign("left", meta.target),
            set_align_center: meta => this.setAlign("center", meta.target),
            set_align_right: meta => this.setAlign("right", meta.target),
        }
        fnMap[action]?.(meta)
    }
}

module.exports = {
    plugin: ResizeImagePlugin
}
