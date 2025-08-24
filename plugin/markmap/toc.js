class tocMarkmap {
    constructor(plugin) {
        this.plugin = plugin
        this.utils = plugin.utils
        this.i18n = plugin.i18n
        this.config = plugin.config
        this.Lib = plugin.Lib
    }

    html = () => `
        <div id="plugin-markmap" class="plugin-common-modal plugin-common-hidden">
            <div class="plugin-markmap-header">
                <div class="plugin-markmap-icon ion-close" action="close" ty-hint="${this.i18n.t('func.close')}"></div>
                <div class="plugin-markmap-icon ion-qr-scanner" action="expand" ty-hint="${this.i18n.t('func.expand')}"></div>
                <div class="plugin-markmap-icon ion-chevron-up" action="pinTop" ty-hint="${this.i18n.t('func.pinTop')}"></div>
                <div class="plugin-markmap-icon ion-chevron-right" action="pinRight" ty-hint="${this.i18n.t('func.pinRight')}"></div>
                <div class="plugin-markmap-icon ion-cube" action="fit" ty-hint="${this.i18n.t('func.fit')}"></div>
                <div class="plugin-markmap-icon ion-android-settings" action="setting" ty-hint="${this.i18n.t('func.setting')}"></div>
                <div class="plugin-markmap-icon ion-archive" action="download" ty-hint="${this.i18n.t('func.download')}"></div>
                <div class="plugin-markmap-icon" action="resize"><svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M14.228 16.227a1 1 0 0 1-.707-1.707l1-1a1 1 0 0 1 1.416 1.414l-1 1a1 1 0 0 1-.707.293zm-5.638 0a1 1 0 0 1-.707-1.707l6.638-6.638a1 1 0 0 1 1.416 1.414l-6.638 6.638a1 1 0 0 1-.707.293zm-5.84 0a1 1 0 0 1-.707-1.707L14.52 2.043a1 1 0 1 1 1.415 1.414L3.457 15.934a1 1 0 0 1-.707.293z"></path></svg></div>
            </div>
            <svg id="plugin-markmap-svg"></svg>
            <div class="plugin-markmap-grip-top plugin-common-hidden"></div>
            <div class="plugin-markmap-grip-right plugin-common-hidden"></div>
        </div>
    `

    hotkey = () => [{ hotkey: this.config.TOC_HOTKEY, callback: this.callback }]

    init = () => {
        this._fixConfig()

        this.mm = null
        this.transformContext = null

        this.entities = {
            content: this.utils.entities.eContent,
            modal: document.querySelector("#plugin-markmap"),
            header: document.querySelector(".plugin-markmap-header"),
            gripTop: document.querySelector(".plugin-markmap-grip-top"),
            gripRight: document.querySelector(".plugin-markmap-grip-right"),
            svg: document.querySelector("#plugin-markmap-svg"),
            resize: document.querySelector('.plugin-markmap-icon[action="resize"]'),
            fullScreen: document.querySelector('.plugin-markmap-icon[action="expand"]'),
        }

        this.pinUtils = {
            isPinTop: false,
            isPinRight: false,
            originModalRect: null,
            originContentRect: null,
            recordContentRect: rect => this.pinUtils.originContentRect = rect,
            recordRects: () => {
                if (!this.entities.modal.classList.contains("pinned-window")) {
                    this.pinUtils.originModalRect = this.entities.modal.getBoundingClientRect()
                    this.pinUtils.originContentRect = this.entities.content.getBoundingClientRect()
                }
            },
        }
    }

    process = () => {
        const onEvent = () => {
            const { eventHub } = this.utils
            const { modal, content, fullScreen, header } = this.entities
            const repositioning = () => {
                if (!this.mm) return

                const isFullScreen = fullScreen.getAttribute("action") === "shrink"
                if (!this.pinUtils.isPinTop && !this.pinUtils.isPinRight && !isFullScreen) return

                const contentRect = content.getBoundingClientRect()
                const modalRect = modal.getBoundingClientRect()
                const { originContentRect } = this.pinUtils

                let newModalRect, newContentRect
                if (isFullScreen) {
                    newModalRect = contentRect
                    newContentRect = contentRect
                } else if (this.pinUtils.isPinTop) {
                    newModalRect = new DOMRect(contentRect.x, modalRect.y, contentRect.width, modalRect.height)
                    newContentRect = new DOMRect(contentRect.x, originContentRect.y, contentRect.width, originContentRect.height)
                } else if (this.pinUtils.isPinRight) {
                    newModalRect = new DOMRect(contentRect.right, modalRect.y, modalRect.right - contentRect.right, modalRect.height)
                    newContentRect = new DOMRect(contentRect.x, originContentRect.y, originContentRect.right - contentRect.left, originContentRect.height)
                }
                this.pinUtils.recordContentRect(newContentRect)
                this._setModalRect(newModalRect)
            }
            eventHub.addEventListener(eventHub.eventType.afterToggleSidebar, repositioning)
            eventHub.addEventListener(eventHub.eventType.afterSetSidebarWidth, repositioning)
            eventHub.addEventListener(eventHub.eventType.toggleSettingPage, hide => hide && this.mm && this.close())
            eventHub.addEventListener(eventHub.eventType.outlineUpdated, () => {
                if (!this.utils.isShow(modal)) return
                this.draw()
                if (this.config.AUTO_FIT_WHEN_UPDATE) {
                    this.fit()
                }
            })

            modal.addEventListener("transitionend", () => this.fit())
            header.addEventListener("click", ev => {
                const button = ev.target.closest(".plugin-markmap-icon")
                if (button) {
                    const action = button.getAttribute("action")
                    this.doAction(action)
                }
            })

            this.toggleContextMenu()
        }
        const onMove = () => {
            this.utils.dragElement({
                targetEle: this.entities.header,
                moveEle: this.entities.modal,
                onCheck: () => !this.entities.modal.classList.contains("pinned-window"),
                onMouseDown: this._cleanTransition,
                onMouseMove: null,
                onMouseUp: this._rollbackTransition,
            })
        }
        const onResize = () => {
            const { minHeight, minWidth } = window.getComputedStyle(this.entities.modal)
            const modalMinHeight = parseFloat(minHeight) || 90
            const modalMinWidth = parseFloat(minWidth) || 90
            const onMouseUp = () => {
                this._rollbackTransition()
                this.fit()
            }

            const whenUnpin = () => {
                let deltaHeight = 0
                let deltaWidth = 0
                const onMouseDown = (startX, startY, startWidth, startHeight) => {
                    this._cleanTransition()
                    deltaHeight = modalMinHeight - startHeight
                    deltaWidth = modalMinWidth - startWidth
                }
                const onMouseMove = (deltaX, deltaY) => {
                    deltaY = Math.max(deltaY, deltaHeight)
                    deltaX = Math.max(deltaX, deltaWidth)
                    return { deltaX, deltaY }
                }
                this.utils.resizeElement({
                    targetEle: this.entities.resize,
                    resizeEle: this.entities.modal,
                    resizeWidth: true,
                    resizeHeight: true,
                    onMouseDown,
                    onMouseMove,
                    onMouseUp,
                })
            }

            const whenPinTop = () => {
                let contentStartTop = 0
                let contentMinTop = 0
                const onMouseDown = () => {
                    this._cleanTransition()
                    contentStartTop = this.entities.content.getBoundingClientRect().top
                    contentMinTop = modalMinHeight + this.entities.modal.getBoundingClientRect().top
                }
                const onMouseMove = (deltaX, deltaY) => {
                    let newContentTop = contentStartTop + deltaY
                    if (newContentTop < contentMinTop) {
                        newContentTop = contentMinTop
                        deltaY = contentMinTop - contentStartTop
                    }
                    this.entities.content.style.top = newContentTop + "px"
                    return { deltaX, deltaY }
                }
                this.utils.resizeElement({
                    targetEle: this.entities.gripTop,
                    resizeEle: this.entities.modal,
                    resizeWidth: false,
                    resizeHeight: true,
                    onMouseDown,
                    onMouseMove,
                    onMouseUp,
                })
            }

            const whenPinRight = () => {
                let contentStartRight = 0
                let contentStartWidth = 0
                let modalStartLeft = 0
                let contentMaxRight = 0
                const onMouseDown = () => {
                    this._cleanTransition()
                    const contentRect = this.entities.content.getBoundingClientRect()
                    contentStartRight = contentRect.right
                    contentStartWidth = contentRect.width

                    const modalRect = this.entities.modal.getBoundingClientRect()
                    modalStartLeft = modalRect.left
                    contentMaxRight = modalRect.right - modalMinWidth
                }
                const onMouseMove = (deltaX, deltaY) => {
                    deltaX = -deltaX
                    deltaY = -deltaY
                    let newContentRight = contentStartRight - deltaX
                    if (newContentRight > contentMaxRight) {
                        deltaX = contentStartRight - contentMaxRight
                    }
                    this.entities.content.style.width = contentStartWidth - deltaX + "px"
                    this.entities.modal.style.left = modalStartLeft - deltaX + "px"
                    return { deltaX, deltaY }
                }
                this.utils.resizeElement({
                    targetEle: this.entities.gripRight,
                    resizeEle: this.entities.modal,
                    resizeWidth: true,
                    resizeHeight: false,
                    onMouseDown,
                    onMouseMove,
                    onMouseUp,
                })
            }

            whenUnpin()
            whenPinTop()
            whenPinRight()
        }
        const onSvgClick = () => {
            const getCid = node => {
                if (!node) return
                const headers = File.editor.nodeMap.toc.headers
                if (!headers || headers.length === 0) return
                const list = node.getAttribute("data-path").split(".")
                if (!list) return
                const nodeIdx = list[list.length - 1]
                let tocIdx = parseInt(nodeIdx - 1) // Markmap node indices start from 1, so subtract 1.
                if (this.mm.state.data.content === "" && headers[0].getText() !== "") {
                    tocIdx-- // If the first(root) node of the markmap is an empty node, subtract 1 again.
                }
                const header = headers[tocIdx]
                return header && header.attributes.id
            }
            this.entities.svg.addEventListener("click", ev => {
                const node = ev.target.closest(".markmap-node")
                const cid = getCid(node)
                if (!cid) return

                const circle = ev.target.closest("circle")
                if (circle) {
                    if (this.config.AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD) {
                        const head = this.utils.entities.querySelectorInWrite(`[cid="${cid}"]`)
                        const isFold = node.classList.contains("markmap-fold")
                        this.utils.callPluginFunction("collapse_paragraph", "trigger", head, !isFold)
                    }
                    if (this.config.AUTO_FIT_WHEN_FOLD) {
                        this.fit()
                    }
                } else {
                    if (this.config.CLICK_TO_POSITIONING) {
                        const { height: contentHeight, top: contentTop } = this.entities.content.getBoundingClientRect()
                        const height = contentHeight * this.config.POSITIONING_VIEWPORT_HEIGHT + contentTop
                        const showHiddenElement = !this.config.AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD
                        this.utils.scrollByCid(cid, height, true, showHiddenElement)
                    }
                }
            })
        }

        onEvent()
        onMove()
        onResize()
        onSvgClick()
    }

    callback = async () => {
        if (this.utils.isShow(this.entities.modal)) {
            this.close()
        } else {
            await this.plugin.lazyLoad()
            this.utils.show(this.entities.modal)
            this._initModalRect()
            await this.draw()
        }
    }

    close = () => {
        if (this.pinUtils.isPinTop) {
            this.pinTop()
        } else if (this.pinUtils.isPinRight) {
            this.pinRight()
        }
        this.entities.modal.style = ""
        this.utils.hide(this.entities.modal)
        this.utils.show(this.entities.resize)
        this.entities.modal.classList.remove("pinned-window")
        this._setFullScreenStyles(false)
        this.mm.destroy()
        this.mm = null
    }

    fit = (notify = false) => {
        if (!this.mm) return
        this.mm.fit()
        if (notify) {
            this.utils.notification.show(this.i18n.t("func.fit.ok"))
        }
    }

    setting = async () => {
        const attrsToSave = [
            "DEFAULT_TOC_OPTIONS", "DOWNLOAD_OPTIONS", "WIDTH_PERCENT_WHEN_INIT", "HEIGHT_PERCENT_WHEN_INIT", "HEIGHT_PERCENT_WHEN_PIN_TOP",
            "WIDTH_PERCENT_WHEN_PIN_RIGHT", "POSITIONING_VIEWPORT_HEIGHT", "FIX_SKIPPED_LEVEL_HEADERS", "REMOVE_HEADER_STYLES", "CLICK_TO_POSITIONING",
            "USE_CONTEXT_MENU", "AUTO_FIT_WHEN_UPDATE", "AUTO_FIT_WHEN_FOLD", "KEEP_FOLD_STATE_WHEN_UPDATE", "AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD",
        ]
        const arr2Str = arr => arr.join("_")
        const str2Arr = str => str.split("_")

        const getSchema = () => {
            const pluginEnabled = this.utils.getBasePlugin("collapse_paragraph")
            const colorOptions = Object.fromEntries(
                [...this.config.CANDIDATE_COLOR_SCHEMES, this.config.DEFAULT_TOC_OPTIONS.color].map(colorList => {
                    const colors = colorList
                        .map(color => `<div style="background: ${color}; width: 34px; border-radius: 2px;"></div>`)
                        .join("")
                    const label = `<div style="display: inline-flex; height: 22px;">${colors}</div>`
                    return [arr2Str(colorList), label]
                })
            )

            const field = (key, type, { tooltip, ...args } = {}) => ({
                key,
                type,
                label: this.i18n.t(`$label.${key}`),
                tooltip: tooltip ? this.i18n.t(`$tooltip.${tooltip}`) : undefined,
                ...args,
            })
            const titledBox = (title, ...fields) => ({ title: this.i18n.t(title), fields })
            const untitledBox = (...fields) => ({ title: undefined, fields })

            return [
                titledBox(
                    "settingGroup.color",
                    field("DEFAULT_TOC_OPTIONS.color", "radio", { options: colorOptions }),
                ),
                titledBox(
                    "settingGroup.chart",
                    field("DEFAULT_TOC_OPTIONS.spacingHorizontal", "range", { min: 0, max: 200, step: 1 }),
                    field("DEFAULT_TOC_OPTIONS.spacingVertical", "range", { min: 0, max: 100, step: 1 }),
                    field("DEFAULT_TOC_OPTIONS.paddingX", "range", { min: 0, max: 100, step: 1 }),
                    field("DEFAULT_TOC_OPTIONS.maxWidth", "range", "zero", { min: 0, max: 1000, step: 10 }),
                    field("DEFAULT_TOC_OPTIONS.nodeMinHeight", "range", { min: 5, max: 50, step: 1 })
                ),
                untitledBox(
                    field("DEFAULT_TOC_OPTIONS.colorFreezeLevel", "range", { min: 1, max: 7, step: 1 }),
                    field("DEFAULT_TOC_OPTIONS.initialExpandLevel", "range", { min: 1, max: 7, step: 1 }),
                    field("DEFAULT_TOC_OPTIONS.duration", "range", { min: 0, max: 1000, step: 10 }),
                ),
                titledBox(
                    "settingGroup.window",
                    field("DEFAULT_TOC_OPTIONS.fitRatio", "range", { min: 0.5, max: 1, step: 0.01 }),
                    field("DEFAULT_TOC_OPTIONS.maxInitialScale", "range", { min: 0.5, max: 5, step: 0.25 }),
                    field("WIDTH_PERCENT_WHEN_INIT", "range", { min: 20, max: 95, step: 1 }),
                    field("HEIGHT_PERCENT_WHEN_INIT", "range", { min: 20, max: 95, step: 1 }),
                    field("HEIGHT_PERCENT_WHEN_PIN_TOP", "range", { min: 20, max: 95, step: 1 }),
                    field("WIDTH_PERCENT_WHEN_PIN_RIGHT", "range", { min: 20, max: 95, step: 1 }),
                ),
                titledBox(
                    "settingGroup.interactive",
                    field("USE_CONTEXT_MENU", "switch"),
                    field("DEFAULT_TOC_OPTIONS.zoom", "switch"),
                    field("DEFAULT_TOC_OPTIONS.pan", "switch"),
                    field("DEFAULT_TOC_OPTIONS.toggleRecursively", "switch"),
                    field("CLICK_TO_POSITIONING", "switch"),
                    field("POSITIONING_VIEWPORT_HEIGHT", "range", {
                        tooltip: "positioningViewPort", min: 0.1, max: 0.95, step: 0.01, dependencies: { CLICK_TO_POSITIONING: true },
                    }),
                ),
                titledBox(
                    "settingGroup.behavior",
                    field("FIX_SKIPPED_LEVEL_HEADERS", "switch"),
                    field("REMOVE_HEADER_STYLES", "switch"),
                    field("KEEP_FOLD_STATE_WHEN_UPDATE", "switch"),
                    field("AUTO_FIT_WHEN_UPDATE", "switch"),
                    field("AUTO_FIT_WHEN_FOLD", "switch"),
                    field("AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD", "switch", { tooltip: "experimental", disabled: !pluginEnabled, readonly: pluginEnabled }),
                ),
                titledBox(
                    "settingGroup.download",
                    field("DOWNLOAD_OPTIONS.SHOW_PATH_INQUIRY_DIALOG", "switch"),
                    field("DOWNLOAD_OPTIONS.SHOW_IN_FINDER", "switch"),
                    field("DOWNLOAD_OPTIONS.FOLDER", "text", { tooltip: "tempDir", placeholder: this.utils.tempFolder }),
                    field("DOWNLOAD_OPTIONS.FILENAME", "text"),
                ),
                untitledBox(
                    field("DOWNLOAD_OPTIONS.IMAGE_SCALE", "number", { min: 0.1, step: 0.1 }),
                    field("DOWNLOAD_OPTIONS.PADDING_HORIZONTAL", "number", { min: 1, step: 1, unit: this.i18n._t("settings", "$unit.pixel") }),
                    field("DOWNLOAD_OPTIONS.PADDING_VERTICAL", "number", { min: 1, step: 1, unit: this.i18n._t("settings", "$unit.pixel") }),
                    field("DOWNLOAD_OPTIONS.TEXT_COLOR", "text"),
                    field("DOWNLOAD_OPTIONS.OPEN_CIRCLE_COLOR", "text"),
                    field("DOWNLOAD_OPTIONS.BACKGROUND_COLOR", "text", { tooltip: "jpgFormatOnly" }),
                    field("DOWNLOAD_OPTIONS.IMAGE_QUALITY", "range", { tooltip: "pixelImagesOnly", min: 0.01, max: 1, step: 0.01 }),
                ),
                untitledBox(
                    field("DOWNLOAD_OPTIONS.KEEP_ALPHA_CHANNEL", "switch"),
                    field("DOWNLOAD_OPTIONS.REMOVE_USELESS_CLASSES", "switch"),
                    field("DOWNLOAD_OPTIONS.REMOVE_FOREIGN_OBJECT", "switch", { tooltip: "removeForeignObj" }),
                ),
                untitledBox(
                    { type: "action", key: "restoreSettings", label: this.i18n._t("settings", "$label.restoreSettings") },
                ),
            ]
        }

        const getData = () => {
            const obj = this.utils.pick(this.config, attrsToSave)
            const data = JSON.parse(JSON.stringify(obj))
            data.DEFAULT_TOC_OPTIONS.color = arr2Str(data.DEFAULT_TOC_OPTIONS.color)
            return data
        }

        const save = async (result) => {
            result.DEFAULT_TOC_OPTIONS.color = str2Arr(result.DEFAULT_TOC_OPTIONS.color)
            Object.assign(this.config, result)
            await this.utils.settings.saveSettings(this.plugin.fixedName, result)
        }

        let _edited = false
        const op = {
            title: this.i18n.t("func.setting"),
            schema: getSchema(),
            data: getData(),
            actions: {
                restoreSettings: async () => {
                    const fixedName = this.plugin.fixedName
                    await this.utils.settings.handleSettings(fixedName, settingObj => {
                        const setting = settingObj[fixedName]
                        if (setting) {
                            settingObj[fixedName] = this.utils.pickBy(setting, (_, k) => !attrsToSave.includes(k))
                        }
                        return settingObj
                    })
                    const settings = await this.utils.settings.readBasePluginSettings()
                    this.config = settings[fixedName]
                    this.utils.notification.show(this.i18n._t("global", "success.restore"))
                    await this.utils.formDialog.updateModal(op => {
                        op.schema = getSchema()
                        op.data = getData()
                    })
                    _edited = true
                },
            },
            hooks: {
                onSubmit: () => _edited = true,
            },
        }
        const { response, data } = await this.utils.formDialog.modal(op)
        if (response === 1 && _edited) {
            await save(data)
            await this.draw()
            this.toggleContextMenu()
            this.utils.notification.show(this.i18n._t("global", "success.edit"))
        }
    }

    download = async () => {
        const { downloader } = require("./downloader.js")

        let {
            SHOW_PATH_INQUIRY_DIALOG,
            SHOW_IN_FINDER,
            FOLDER: folder,
            FILENAME: file = "{{filename}}.svg",
        } = this.config.DOWNLOAD_OPTIONS
        const getDownloadPath = async () => {
            if (!folder || !(await this.utils.existPath(folder))) {
                folder = this.utils.tempFolder
            }
            const tpl = {
                uuid: this.utils.getUUID(),
                random: this.utils.randomString(),
                timestamp: new Date().getTime(),
                filename: this.utils.getFileName() || "MARKMAP",
            }
            const name = file.replace(/\{\{([\S\s]+?)\}\}/g, (origin, arg) => tpl[arg.trim().toLowerCase()] || origin)
            return this.utils.Package.Path.join(folder, name)
        }

        let downloadPath = await getDownloadPath()
        if (SHOW_PATH_INQUIRY_DIALOG) {
            const op = {
                title: this.i18n.t("func.download"),
                properties: ["saveFile", "showOverwriteConfirmation"],
                defaultPath: downloadPath,
                filters: downloader.getFormats(),
            }
            const { canceled, filePath } = await JSBridge.invoke("dialog.showSaveDialog", op)
            if (canceled) return
            downloadPath = filePath
        }
        const ok = await downloader.download(this, downloadPath)
        if (!ok) return
        if (SHOW_IN_FINDER) {
            this.utils.showInFinder(downloadPath)
        }
        this.utils.notification.show(this.i18n.t("func.download.ok"))
    }

    toggleContextMenu = (register = this.config.USE_CONTEXT_MENU) => {
        if (!register) {
            this.utils.contextMenu.unregister(this.entities.svg)
        } else {
            this.utils.contextMenu.register(
                this.entities.svg,
                () => {
                    const all = ["expand", "shrink", "hideToolbar", "showToolbar", "fit", "pinTop", "pinRight", "setting", "download", "close"]
                    const menuItems = this.i18n.entries(all, "func.")
                    const fullScreen = this.entities.fullScreen.getAttribute("action")
                    const toolbarVisibility = this.utils.isHidden(this.entities.header) ? "showToolbar" : "hideToolbar"
                    const attrs = [toolbarVisibility, fullScreen, "fit", "pinTop", "pinRight", "setting", "download", "close"]
                    return this.utils.pick(menuItems, attrs)
                },
                (ev, key) => this.doAction(key),
            )
        }
    }

    pinTop = (fit = true) => {
        this.pinUtils.isPinTop = !this.pinUtils.isPinTop
        if (this.pinUtils.isPinTop) {
            if (this.pinUtils.isPinRight) {
                this.pinRight(false)
            } else {
                this.pinUtils.recordRects()
            }
        }

        let modalRect, contentTop
        if (this.pinUtils.isPinTop) {
            const { left, top, height, width } = this.pinUtils.originContentRect
            const newHeight = height * this.config.HEIGHT_PERCENT_WHEN_PIN_TOP / 100
            modalRect = { left, top, width, height: newHeight }
            contentTop = top + newHeight
        } else {
            modalRect = this.pinUtils.originModalRect
            contentTop = this.pinUtils.originContentRect.top
        }

        this._setModalRect(modalRect)
        this._setPinStyles(true)
        this.entities.content.style.top = contentTop + "px"
        if (fit) {
            this.fit()
        }
    }

    pinRight = (fit = true) => {
        this.pinUtils.isPinRight = !this.pinUtils.isPinRight
        if (this.pinUtils.isPinRight) {
            if (this.pinUtils.isPinTop) {
                this.pinTop(false)
            } else {
                this.pinUtils.recordRects()
            }
        }

        let modalRect, contentRight, contentWidth, writeWidth
        if (this.pinUtils.isPinRight) {
            const { top, height, width, right } = this.pinUtils.originContentRect
            const newWidth = width * this.config.WIDTH_PERCENT_WHEN_PIN_RIGHT / 100
            modalRect = { top, height, width: newWidth, left: right - newWidth }
            contentRight = right - newWidth + "px"
            contentWidth = width - newWidth + "px"
            writeWidth = "initial"
        } else {
            modalRect = this.pinUtils.originModalRect
            contentRight = ""
            contentWidth = ""
            writeWidth = ""
        }

        this._setModalRect(modalRect)
        this._setPinStyles(false)
        this.entities.content.style.right = contentRight
        this.entities.content.style.width = contentWidth
        this.utils.entities.eWrite.style.width = writeWidth
        if (fit) {
            this.fit()
        }
    }

    showToolbar = () => this._toggleToolbar(true)
    hideToolbar = () => this._toggleToolbar(false)
    expand = () => this._toggleFullscreen(true)
    shrink = () => this._toggleFullscreen(false)

    draw = () => {
        const md = this.plugin.getToc()
        if (md === undefined) return

        const options = this.plugin.assignOptions(this.config.DEFAULT_TOC_OPTIONS, this.mm && this.mm.options)
        this.transformContext = this.Lib.transformer.transform(md)
        const { root } = this.transformContext

        if (this.mm) {
            this._setFoldNode(root)
            this.mm.setData(root, options)
        } else {
            this.mm = this.Lib.Markmap.create(this.entities.svg, options, root)
        }
    }

    doAction = async action => {
        if (action === "fit") {
            this.fit(true)
        } else if (action !== "resize" && this[action]) {
            await this[action]()
        }
    }

    _setFoldNode = newRoot => {
        if (!this.config.KEEP_FOLD_STATE_WHEN_UPDATE) return

        const preorder = (node, fn, parent) => {
            const parentPath = (parent && parent.__path) || ""
            node.__path = `${parentPath}\n${node.content}`
            fn(node)
            for (const child of node.children) {
                preorder(child, fn, node)
            }
        }

        const needFold = new Set()
        const { data: oldRoot } = this.mm.state || {}
        preorder(oldRoot, node => {
            if (node.payload && node.payload.fold) {
                needFold.add(node.__path)
            }
        })
        preorder(newRoot, node => {
            if (node.payload && needFold.has(node.__path)) {
                node.payload.fold = 1
            }
        })
    }

    _fixConfig = () => {
        const { DEFAULT_TOC_OPTIONS: op } = this.config
        op.color = op.color.map(e => e.toUpperCase())
        if (op.initialExpandLevel <= 0 || isNaN(op.initialExpandLevel)) {
            op.initialExpandLevel = 7
        }
        if (op.colorFreezeLevel < 0 || isNaN(op.colorFreezeLevel)) {
            op.colorFreezeLevel = 7
        }
    }

    _initModalRect = () => {
        const { top: t, left: l, width: w, height: h } = this.entities.content.getBoundingClientRect()
        const { WIDTH_PERCENT_WHEN_INIT: wRatio, HEIGHT_PERCENT_WHEN_INIT: hRatio } = this.config
        const height = h * hRatio / 100
        const width = w * wRatio / 100
        const left = l + (w - width) / 2
        this._setModalRect({ top: t, height, width, left })
    }

    _setModalRect = rect => {
        if (!rect) return
        const { left, top, height, width } = rect
        const s = { left: `${left}px`, top: `${top}px`, height: `${height}px`, width: `${width}px` }
        Object.assign(this.entities.modal.style, s)
    }

    _setPinStyles = (isTop = true) => {
        const [pinned, gripEl, act, hint, icon] = (isTop === true)
            ? [this.pinUtils.isPinTop, this.entities.gripTop, "pinTop", "func.pinTop", "ion-chevron-up"]
            : [this.pinUtils.isPinRight, this.entities.gripRight, "pinRight", "func.pinRight", "ion-chevron-right"]

        this.entities.modal.classList.toggle("pinned-window", pinned)
        this.utils.toggleVisible(gripEl, !pinned)
        this.utils.toggleVisible(this.entities.resize, pinned)
        this._setFullScreenStyles(false)

        const btn = this.entities.header.querySelector(`[action="${act}"]`)
        btn.classList.toggle(icon, !pinned)
        btn.classList.toggle("ion-ios7-undo", pinned)
        btn.setAttribute("ty-hint", this.i18n.t(pinned ? "func.pinRecover" : hint))
    }

    _setFullScreenStyles = (expand = true) => {
        const btn = this.entities.fullScreen
        btn.setAttribute("action", expand ? "shrink" : "expand")
        btn.setAttribute("ty-hint", this.i18n.t(expand ? "func.shrink" : "func.expand"))
        btn.classList.toggle("ion-qr-scanner", !expand)
        btn.classList.toggle("ion-ios7-undo", expand)
    }

    _toggleFullscreen = (expand = true) => {
        if (this.pinUtils.isPinTop) {
            this.pinTop()
        } else if (this.pinUtils.isPinRight) {
            this.pinRight()
        } else {
            this.pinUtils.recordRects()
        }

        this._setModalRect(expand ? this.pinUtils.originContentRect : this.pinUtils.originModalRect)
        this._setFullScreenStyles(expand)
        this.entities.modal.classList.toggle("pinned-window", expand)
        this.utils.toggleVisible(this.entities.resize, expand)
    }

    _toggleToolbar = show => {
        this.utils.toggleVisible(this.entities.header, !show)
        this.fit()
    }

    _cleanTransition = () => this.entities.modal.style.transition = "none"
    _rollbackTransition = () => this.entities.modal.style.transition = ""
}

module.exports = {
    tocMarkmap
}
