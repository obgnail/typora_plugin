class markmapPlugin extends BasePlugin {
    beforeProcess = () => {
        this.MarkmapLib = {};
        this.tocMarkmap = this.config.ENABLE_TOC_MARKMAP ? new tocMarkmap(this) : null;
        this.fenceMarkmap = this.config.ENABLE_FENCE_MARKMAP ? new fenceMarkmap(this) : null;
    }

    styleTemplate = () => this

    html = () => this.tocMarkmap && this.tocMarkmap.html();

    hotkey = () => [this.tocMarkmap, this.fenceMarkmap].filter(Boolean).flatMap(p => p.hotkey())

    init = () => {
        this.staticActions = this.i18n.fillActions([
            { act_value: "draw_fence_outline", act_hotkey: this.config.FENCE_HOTKEY, act_hidden: !this.fenceMarkmap },
            { act_value: "draw_fence_template", act_hidden: !this.fenceMarkmap },
            { act_value: "toggle_toc", act_hotkey: this.config.TOC_HOTKEY, act_hidden: !this.tocMarkmap }
        ])
    }

    process = () => {
        if (this.tocMarkmap) {
            this.tocMarkmap.process()
        }
        if (this.fenceMarkmap) {
            this.fenceMarkmap.process()
        }
    }

    call = async action => {
        if (action === "toggle_toc") {
            if (this.tocMarkmap) {
                await this.tocMarkmap.callback(action)
            }
        } else if (action === "draw_fence_template" || action === "draw_fence_outline") {
            if (this.fenceMarkmap) {
                await this.fenceMarkmap.call(action)
            }
        }
    }

    getToc = (fixIndent = true) => {
        const tree = this.utils.getTocTree()
        const preorder = (node, list, indent) => {
            const head = "#".repeat(fixIndent ? indent : node.depth)
            list.push(`${head} ${node.text}`)
            for (const child of node.children) {
                preorder(child, list, indent + 1)
            }
            return list
        }
        return preorder(tree, [], 0).slice(1).join("\n")
    }

    onButtonClick = () => {
        if (this.tocMarkmap) {
            this.tocMarkmap.callback()
        }
    }

    assignOptions = (update, old) => {
        const update_ = this.utils.fromObject(update, ["spacingHorizontal", "spacingVertical", "fitRatio", "paddingX", "autoFit"]);
        const options = this.MarkmapLib.deriveOptions({ ...old, ...update });
        return Object.assign(options, update_)
    }

    lazyLoad = async () => {
        if (this.MarkmapLib.Markmap) return

        const { Transformer, builtInPlugins, transformerVersions } = require("./resource/markmap-lib.js")
        const markmap = require("./resource/markmap-view.js")
        const transformer = new Transformer(builtInPlugins)
        Object.assign(this.MarkmapLib, markmap, { transformer, Transformer, builtInPlugins, transformerVersions })

        const { styles, scripts } = transformer.getAssets()
        styles[0].data.href = this.utils.joinPath("./plugin/markmap/resource/katex.min.css")
        styles[1].data.href = this.utils.joinPath("./plugin/markmap/resource/default.min.css")
        scripts[1].data.src = this.utils.joinPath("./plugin/markmap/resource/webfontloader.js")

        await markmap.loadCSS(styles)
        await markmap.loadJS(scripts, { getMarkmap: () => markmap })
    }
}

class fenceMarkmap {
    constructor(plugin) {
        this.controller = plugin;
        this.utils = plugin.utils;
        this.config = plugin.config;
        this.MarkmapLib = plugin.MarkmapLib;
        this.instanceMap = new Map(); // {cid: instance}
    }

    process = () => {
        this.utils.diagramParser.register({
            lang: this.config.FENCE_LANGUAGE,
            mappingLang: "markdown",
            destroyWhenUpdate: false,
            renderFunc: this.render,
            cancelFunc: this.cancel,
            destroyAllFunc: this.destroyAll,
            extraStyleGetter: null,
            interactiveMode: this.config.INTERACTIVE_MODE
        });
    }

    call = async action => this.callback(action)

    callback = type => {
        const backQuote = "```"
        const frontMatter = `---\nmarkmap:\n  zoom: false\n  pan: false\n  height: 300px\n  backgroundColor: "#f8f8f8"\n---\n\n`
        const md = type === "draw_fence_template"
            ? this.config.FENCE_TEMPLATE
            : `${backQuote}${this.config.FENCE_LANGUAGE}\n${frontMatter}${this.controller.getToc() || "# empty"}\n${backQuote}`
        this.utils.insertText(null, md)
    }

    hotkey = () => [{ hotkey: this.config.FENCE_HOTKEY, callback: this.callback }]

    getFrontMatter = content => {
        const fenceOptions = this.config.DEFAULT_FENCE_OPTIONS || {};
        const { yamlObject } = this.utils.splitFrontMatter(content);
        if (!yamlObject) return fenceOptions;

        const attr = Object.keys(yamlObject).find(attr => attr.toLowerCase() === "markmap");
        const options = attr ? yamlObject[attr] : yamlObject;
        return Object.assign({}, fenceOptions, options);
    }

    createSvg = ($pre, options) => {
        let svg = $pre.find(".plugin-fence-markmap-svg");
        if (svg.length === 0) {
            svg = $('<svg class="plugin-fence-markmap-svg"></svg>');
        }
        svg.css({
            width: parseFloat($pre.find(".md-diagram-panel").css("width")) - 10 + "px",
            height: options.height || this.config.DEFAULT_FENCE_HEIGHT,
            "background-color": options.backgroundColor || this.config.DEFAULT_FENCE_BACKGROUND_COLOR,
        });
        $pre.find(".md-diagram-panel-preview").html(svg);
        return svg
    }

    render = async (cid, content, $pre) => {
        if (!this.MarkmapLib.Markmap) {
            await this.controller.lazyLoad();
        }
        const options = this.getFrontMatter(content);
        const svg = this.createSvg($pre, options);
        if (this.instanceMap.has(cid)) {
            await this.update(cid, content, options);
        } else {
            await this.create(cid, svg, content, options);
        }
    }

    cancel = cid => {
        const instance = this.instanceMap.get(cid);
        if (instance) {
            instance.destroy();
            this.instanceMap.delete(cid);
        }
    };

    destroyAll = () => {
        for (const instance of this.instanceMap.values()) {
            instance.destroy();
        }
        this.instanceMap.clear();
    };

    create = async (cid, svg, md, options) => {
        const { root } = this.MarkmapLib.transformer.transform(md);
        options = this.controller.assignOptions(options);
        const instance = this.MarkmapLib.Markmap.create(svg[0], options, root);
        this.instanceMap.set(cid, instance);
        setTimeout(() => {
            const instance = this.instanceMap.get(cid);
            if (instance) {
                instance.fit()
            }
        }, 200);
    }

    update = async (cid, md, options) => {
        const instance = this.instanceMap.get(cid);
        const { root } = this.MarkmapLib.transformer.transform(md);
        options = this.controller.assignOptions(options, instance.options);
        instance.setOptions(options);
        instance.setData(root);
        await instance.fit();
    }
}

class tocMarkmap {
    constructor(plugin) {
        this.controller = plugin;
        this.utils = plugin.utils;
        this.i18n = plugin.i18n;
        this.config = plugin.config;
        this.MarkmapLib = plugin.MarkmapLib;
    }

    html = () => `
        <div id="plugin-markmap" class="plugin-common-modal plugin-common-hidden">
            <div class="plugin-markmap-wrap">
                <div class="plugin-markmap-grip grip-right plugin-common-hidden"></div>
                <div class="plugin-markmap-header">
                    <div class="plugin-markmap-icon ion-close" action="close" ty-hint="${this.i18n.t('func.close')}"></div>
                    <div class="plugin-markmap-icon ion-qr-scanner" action="expand" ty-hint="${this.i18n.t('func.expand')}"></div>
                    <div class="plugin-markmap-icon ion-arrow-move" action="move" ty-hint="${this.i18n.t('func.move')}"></div>
                    <div class="plugin-markmap-icon ion-cube" action="fit" ty-hint="${this.i18n.t('func.fit')}"></div>
                    <div class="plugin-markmap-icon ion-pinpoint" action="penetrateMouse" ty-hint="${this.i18n.t('func.penetrateMouse')}"></div>
                    <div class="plugin-markmap-icon ion-android-settings" action="setting" ty-hint="${this.i18n.t('func.setting')}"></div>
                    <div class="plugin-markmap-icon ion-archive" action="download" ty-hint="${this.i18n.t('func.download')}"></div>
                    <div class="plugin-markmap-icon ion-chevron-up" action="pinTop" ty-hint="${this.i18n.t('func.pinTop')}"></div>
                    <div class="plugin-markmap-icon ion-chevron-right" action="pinRight" ty-hint="${this.i18n.t('func.pinRight')}"></div>
                </div>
                <svg id="plugin-markmap-svg"></svg>
                <div class="plugin-markmap-icon" action="resize">
                    <svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M14.228 16.227a1 1 0 0 1-.707-1.707l1-1a1 1 0 0 1 1.416 1.414l-1 1a1 1 0 0 1-.707.293zm-5.638 0a1 1 0 0 1-.707-1.707l6.638-6.638a1 1 0 0 1 1.416 1.414l-6.638 6.638a1 1 0 0 1-.707.293zm-5.84 0a1 1 0 0 1-.707-1.707L14.52 2.043a1 1 0 1 1 1.415 1.414L3.457 15.934a1 1 0 0 1-.707.293z"></path></svg>
                </div>
            </div>
            <div class="plugin-markmap-grip grip-up plugin-common-hidden"></div>
        </div>
    `

    hotkey = () => [{ hotkey: this.config.TOC_HOTKEY, callback: this.callback }]

    prepare = () => {
        this.markmap = null;
        this.transformContext = null;
        this._fixConfig();

        this.modalOriginRect = null;
        this.contentOriginRect = null;
        this.pinUtils = {
            isPinTop: false,
            isPinRight: false,
            recordRect: async () => {
                await this.utils.sleep(200);
                this.modalOriginRect = this.entities.modal.getBoundingClientRect();
                this.contentOriginRect = this.entities.content.getBoundingClientRect();
            }
        }

        this.entities = {
            content: this.utils.entities.eContent,
            modal: document.querySelector("#plugin-markmap"),
            header: document.querySelector("#plugin-markmap .plugin-markmap-header"),
            gripUp: document.querySelector("#plugin-markmap .plugin-markmap-grip.grip-up"),
            gripRight: document.querySelector("#plugin-markmap .plugin-markmap-grip.grip-right"),
            svg: document.querySelector("#plugin-markmap-svg"),
            resize: document.querySelector('.plugin-markmap-icon[action="resize"]'),
            fullScreen: document.querySelector('.plugin-markmap-icon[action="expand"]'),
            move: document.querySelector('.plugin-markmap-icon[action="move"]'),
        }
    }

    process = () => {
        const onEvent = () => {
            const { eventHub } = this.utils;
            const { content, modal } = this.entities;
            eventHub.addEventListener(eventHub.eventType.outlineUpdated, () => this.isShow() && this.draw(this.config.AUTO_FIT_WHEN_UPDATE));
            eventHub.addEventListener(eventHub.eventType.toggleSettingPage, hide => hide && this.markmap && this._onButtonClick("close"));
            content.addEventListener("transitionend", ev => (ev.target === content) && this.isInSpecialState() && this.fit());
            modal.addEventListener("transitionend", ev => (ev.target === modal) && this.fit());
        }
        const onDrag = () => {
            const hint = "ty-hint"
            const value = this.entities.move.getAttribute(hint)
            const onMouseDown = () => {
                this.entities.move.removeAttribute(hint)
                this._cleanTransition()
                this._waitUnpin()
            }
            const onMouseUp = () => {
                this.entities.move.setAttribute(hint, value)
                this._rollbackTransition()
            }
            this.utils.dragFixedModal(this.entities.move, this.entities.modal, false, onMouseDown, null, onMouseUp)
        }
        const onResize = () => {
            const getModalMinHeight = () => {
                return this.entities.header.firstElementChild.getBoundingClientRect().height
            }
            const getModalMinWidth = () => {
                const { marginLeft } = document.defaultView.getComputedStyle(this.entities.header);
                const headerWidth = this.entities.header.getBoundingClientRect().width;
                return parseFloat(marginLeft) + headerWidth
            }
            const onMouseUp = () => {
                this._rollbackTransition();
                if (this.config.AUTO_FIT_WHEN_RESIZE) {
                    this.fit()
                }
            }

            const resizeWhenFree = () => {
                let deltaHeight = 0;
                let deltaWidth = 0;
                const onMouseDown = (startX, startY, startWidth, startHeight) => {
                    this._cleanTransition();
                    deltaHeight = getModalMinHeight() - startHeight;
                    deltaWidth = getModalMinWidth() - startWidth;
                }
                const onMouseMove = (deltaX, deltaY) => {
                    deltaY = Math.max(deltaY, deltaHeight);
                    deltaX = Math.max(deltaX, deltaWidth);
                    return { deltaX, deltaY }
                }
                const onMouseUp = async () => {
                    this._rollbackTransition();
                    await this._waitUnpin();
                    this._setFullScreenIcon(false, this.config.AUTO_FIT_WHEN_RESIZE);
                }
                this.utils.resizeFixedModal(this.entities.resize, this.entities.modal, true, true, onMouseDown, onMouseMove, onMouseUp);
            }

            const resizeWhenPinTop = () => {
                let contentStartTop = 0;
                let contentMinTop = 0;
                const onMouseDown = () => {
                    this._cleanTransition();
                    contentStartTop = this.entities.content.getBoundingClientRect().top;
                    contentMinTop = getModalMinHeight() + this.entities.header.getBoundingClientRect().top;
                }
                const onMouseMove = (deltaX, deltaY) => {
                    let newContentTop = contentStartTop + deltaY;
                    if (newContentTop < contentMinTop) {
                        newContentTop = contentMinTop;
                        deltaY = contentMinTop - contentStartTop;
                    }
                    this.entities.content.style.top = newContentTop + "px";
                    return { deltaX, deltaY }
                }
                this.utils.resizeFixedModal(this.entities.gripUp, this.entities.modal, false, true, onMouseDown, onMouseMove, onMouseUp);
            }

            const resizeWhenPinRight = () => {
                let contentStartRight = 0;
                let contentStartWidth = 0;
                let modalStartLeft = 0;
                let contentMaxRight = 0;
                const onMouseDown = () => {
                    this._cleanTransition();
                    const contentRect = this.entities.content.getBoundingClientRect();
                    contentStartRight = contentRect.right;
                    contentStartWidth = contentRect.width;

                    const modalRect = this.entities.modal.getBoundingClientRect();
                    modalStartLeft = modalRect.left;
                    contentMaxRight = modalRect.right - getModalMinWidth();
                }
                const onMouseMove = (deltaX, deltaY) => {
                    deltaX = -deltaX;
                    deltaY = -deltaY;
                    let newContentRight = contentStartRight - deltaX;
                    if (newContentRight > contentMaxRight) {
                        deltaX = contentStartRight - contentMaxRight;
                    }
                    this.entities.content.style.width = contentStartWidth - deltaX + "px";
                    this.entities.modal.style.left = modalStartLeft - deltaX + "px";
                    return { deltaX, deltaY }
                }
                this.utils.resizeFixedModal(this.entities.gripRight, this.entities.modal, true, false, onMouseDown, onMouseMove, onMouseUp);
            }

            resizeWhenFree();      // Resize while freely moving
            resizeWhenPinTop();    // Resize when pin top
            resizeWhenPinRight();  // Resize when pin right
        }
        const onToggleSidebar = () => {
            const resetPosition = () => {
                if (!this.markmap) return;
                const needResetFullscreen = this.entities.fullScreen.getAttribute("action") === "shrink";
                if (needResetFullscreen) {
                    this.shrink();
                    this.expand();
                }
                const className = ["pinTop", "pinRight"].find(func => this.entities.modal.classList.contains(func));
                if (!className) return

                const { width, left, right } = this.entities.content.getBoundingClientRect();
                let source;
                if (className === "pinTop") {
                    source = { left: `${left}px`, width: `${width}px` };
                } else {
                    const { right: modalRight } = this.entities.modal.getBoundingClientRect();
                    source = { left: `${right}px`, width: `${modalRight - right}px` };
                }
                Object.assign(this.entities.modal.style, source);
            }
            const { eventHub } = this.utils;
            eventHub.addEventListener(eventHub.eventType.afterToggleSidebar, resetPosition);
            eventHub.addEventListener(eventHub.eventType.afterSetSidebarWidth, resetPosition);
        }
        const onHeaderClick = () => {
            this.entities.header.addEventListener("click", ev => {
                const button = ev.target.closest(".plugin-markmap-icon")
                if (!button) return
                const action = button.getAttribute("action")
                if (action !== "move" && this[action]) {
                    this._onButtonClick(action)
                }
            })
        }
        const onSvgClick = () => {
            const getCid = node => {
                if (!node) return;
                const headers = File.editor.nodeMap.toc.headers;
                if (!headers || headers.length === 0) return;
                const list = node.getAttribute("data-path").split(".");
                if (!list) return;
                const nodeIdx = list[list.length - 1];
                let tocIdx = parseInt(nodeIdx - 1); // Markmap node indices start from 1, so subtract 1.
                if (!this.markmap.state.data.content) {
                    tocIdx--; // If the first node of the markmap is an empty node, subtract 1 again.
                }
                const header = headers[tocIdx];
                return header && header.attributes.id
            }
            this.entities.svg.addEventListener("click", ev => {
                ev.preventDefault()
                ev.stopPropagation()
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
                } else {
                    if (this.config.CLICK_TO_POSITIONING) {
                        if (this.config.AUTO_UPDATE) {
                            const { height: contentHeight, top: contentTop } = this.entities.content.getBoundingClientRect()
                            const height = contentHeight * this.config.POSITIONING_VIEWPORT_HEIGHT + contentTop
                            const showHiddenElement = !this.config.AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD
                            this.utils.scrollByCid(cid, height, true, showHiddenElement)
                        }
                    }
                }
            })
        }
        const onContextMenu = () => {
            const fn = ["expand", "shrink", "fit", "download", "setting", "close", "pinTop", "pinRight", "hideToolbar", "showToolbar"]
            const menuMap = this.i18n.entries(fn, "func.")
            const showMenu = () => {
                const fullScreen = this.entities.fullScreen.getAttribute("action");
                const toolbarVisibility = this.utils.isHidden(this.entities.header) ? "showToolbar" : "hideToolbar";
                return this.utils.fromObject(menuMap, [toolbarVisibility, fullScreen, "fit", "pinTop", "pinRight", "setting", "download", "close"])
            }
            const callback = ({ key }) => this._onButtonClick(key);
            this.utils.contextMenu.register("markmap", "#plugin-markmap-svg", showMenu, callback);
        }

        this.prepare();
        onEvent();
        onDrag();
        onResize();
        onToggleSidebar();
        onHeaderClick();
        onSvgClick();
        onContextMenu();
    }

    callback = () => this.utils.isShow(this.entities.modal) ? this._onButtonClick("close") : this.draw()

    call = async action => {
        if (action === "draw_toc") {
            await this.draw()
        }
    }

    close = () => {
        this.entities.modal.style = "";
        this.utils.hide(this.entities.modal);
        this.utils.show(this.entities.resize);
        this.entities.modal.classList.remove("noBoxShadow");
        this.entities.fullScreen.setAttribute("action", "expand");
        this.markmap.destroy();
        this.markmap = null;
    }

    fit = () => {
        if (this.markmap) {
            this.markmap.fit()
        }
    }

    penetrateMouse = async () => {
        const options = this.markmap.options;
        options.zoom = !options.zoom;
        options.pan = !options.pan;
        this.entities.modal.classList.toggle("penetrateMouse", !options.zoom && !options.pan);
    }

    setting = async () => {
        const varNames = "filename、timestamp、random、uuid"
        const extNames = Downloader.getFormats()[0].extensions.join("、")
        const info = [
            "color", "maxWidth", "AUTO_UPDATE", "CLICK_TO_POSITIONING", "POSITIONING_VIEWPORT_HEIGHT",
            "FIX_ERROR_LEVEL_HEADER", "AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD", "FOLDER", "IMAGE_QUALITY", "BACKGROUND_COLOR",
            "KEEP_ALPHA_CHANNEL", "REMOVE_FOREIGN_OBJECT",
        ]
        const INFO = this.i18n.entries(info, "settingInfo.")
        INFO.FILENAME = this.i18n.t("settingInfo.FILENAME", { varNames, extNames })

        const { DEFAULT_TOC_OPTIONS: _tocOps, DOWNLOAD_OPTIONS: _downOps } = this.config
        const needUpdateKey = ["DEFAULT_TOC_OPTIONS", "DOWNLOAD_OPTIONS"]
        const _locateConfig = key => [_tocOps, _downOps, this.config].find(cfg => key in cfg)
        const _getConfig = key => _locateConfig(key)[key]
        const _setConfig = (key, value) => {
            const config = _locateConfig(key)
            config[key] = value
            if (config === this.config) {
                needUpdateKey.push(key)
            }
        }
        const generalWidget = (key, args) => ({
            key,
            label: this.i18n.t(`setting.${key}`),
            info: INFO[key],
            ...args,
        })
        const inlineWidget = key => ({
            ...generalWidget(key),
            inline: true,
            value: _getConfig(key),
            callback: value => _setConfig(key, value),
        })
        const checkboxWidget = components => ({
            type: "checkbox",
            list: components.map(({ label, key, disabled }) => ({ label, info: INFO[key], value: key, checked: Boolean(_getConfig(key)), disabled })),
            callback: submit => components.forEach(({ key }) => _setConfig(key, submit.includes(key))),
        })

        const color = () => {
            const label = this.i18n.t("settingGroup.color")
            const toValue = colorList => colorList.join("_")
            const fromValue = str => str.split("_")
            const toLabel = colorList => {
                const inner = colorList.map(color => `<div class="plugin-markmap-color" style="background-color: ${color}"></div>`)
                return `<div class="plugin-markmap-color-scheme">${inner.join("")}</div>`
            }
            const curValue = toValue(_tocOps.color)
            const list = this.config.CANDIDATE_COLOR_SCHEMES.map(colorList => {
                const value = toValue(colorList)
                const label = toLabel(colorList)
                const checked = value === curValue
                return { value, label, checked }
            })
            if (!list.some(e => e.checked)) {
                list.push({ value: curValue, label: toLabel(_tocOps.color), checked: true })
            }
            const callback = scheme => _tocOps.color = fromValue(scheme)
            return { label, list, type: "radio", info: INFO.color, callback }
        }

        const chart = (fieldset = this.i18n.t("settingGroup.chart")) => [
            { fieldset, type: "range", min: 1, max: 6, step: 1, ...inlineWidget("colorFreezeLevel") },
            { fieldset, type: "range", min: 1, max: 6, step: 1, ...inlineWidget("initialExpandLevel") },
            { fieldset, type: "range", min: 0, max: 100, step: 1, ...inlineWidget("paddingX") },
            { fieldset, type: "range", min: 0, max: 200, step: 1, ...inlineWidget("spacingHorizontal") },
            { fieldset, type: "range", min: 0, max: 100, step: 1, ...inlineWidget("spacingVertical") },
            { fieldset, type: "range", min: 0, max: 1000, step: 10, ...inlineWidget("maxWidth") },
            { fieldset, type: "range", min: 0, max: 1000, step: 10, ...inlineWidget("duration") },
        ]

        const window = (fieldset = this.i18n.t("settingGroup.window")) => [
            { fieldset, type: "range", min: 0.5, max: 1, step: 0.01, ...inlineWidget("fitRatio") },
            { fieldset, type: "range", min: 20, max: 95, step: 1, ...inlineWidget("WIDTH_PERCENT_WHEN_INIT") },
            { fieldset, type: "range", min: 20, max: 95, step: 1, ...inlineWidget("HEIGHT_PERCENT_WHEN_INIT") },
            { fieldset, type: "range", min: 20, max: 95, step: 1, ...inlineWidget("HEIGHT_PERCENT_WHEN_PIN_TOP") },
            { fieldset, type: "range", min: 20, max: 95, step: 1, ...inlineWidget("WIDTH_PERCENT_WHEN_PIN_RIGHT") },
            { fieldset, type: "range", min: 0.1, max: 0.95, step: 0.01, ...inlineWidget("POSITIONING_VIEWPORT_HEIGHT") },
        ]

        const behavior = (legend = this.i18n.t("settingGroup.behavior")) => {
            const hasPlugin = this.utils.getPlugin("collapse_paragraph")
            const components = [
                generalWidget("FIX_ERROR_LEVEL_HEADER"),
                generalWidget("zoom"),
                generalWidget("pan"),
                generalWidget("AUTO_UPDATE"),
                generalWidget("CLICK_TO_POSITIONING"),
                generalWidget("autoFit"),
                generalWidget("AUTO_FIT_WHEN_UPDATE"),
                generalWidget("AUTO_FIT_WHEN_RESIZE"),
                generalWidget("KEEP_FOLD_STATE_WHEN_UPDATE"),
                generalWidget("AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD", { disabled: !hasPlugin }),
            ]
            return { label: "", legend, ...checkboxWidget(components) }
        }

        const download = (fieldset = this.i18n.t("settingGroup.download")) => {
            const cpn = ["KEEP_ALPHA_CHANNEL", "REMOVE_USELESS_CLASSES", "REMOVE_FOREIGN_OBJECT", "SHOW_PATH_INQUIRY_DIALOG", "SHOW_IN_FINDER"]
            const components = cpn.map(e => generalWidget(e))
            return [
                { fieldset, type: "number", min: 1, max: 1000, step: 1, ...inlineWidget("PADDING_HORIZONTAL") },
                { fieldset, type: "number", min: 1, max: 1000, step: 1, ...inlineWidget("PADDING_VERTICAL") },
                { fieldset, type: "number", min: 0.01, max: 1, step: 0.01, ...inlineWidget("IMAGE_QUALITY") },
                { fieldset, type: "color", ...inlineWidget("TEXT_COLOR") },
                { fieldset, type: "color", ...inlineWidget("OPEN_CIRCLE_COLOR") },
                { fieldset, type: "color", ...inlineWidget("BACKGROUND_COLOR") },
                { fieldset, type: "input", placeholder: this.utils.tempFolder, ...inlineWidget("FOLDER") },
                { fieldset, type: "input", ...inlineWidget("FILENAME") },
                { fieldset, label: "", ...checkboxWidget(components) },
            ]
        }

        const components = [color(), ...chart(), ...window(), behavior(), ...download()];
        const title = this.i18n.t("func.setting")
        const op = { title, components, width: "500px" }
        const { response } = await this.utils.dialog.modalAsync(op)
        if (response === 1) {
            components.forEach(c => c.callback(c.submit));
            await this.redraw(this.markmap.options);
            const update = this.utils.fromObject(this.config, needUpdateKey);
            await this.utils.runtime.saveConfig(this.controller.fixedName, update);
        }
    }

    download = async () => {
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
                filename: this.utils.getFileName() || "markmap",
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
                filters: Downloader.getFormats(),
            }
            const { canceled, filePath } = await JSBridge.invoke("dialog.showSaveDialog", op)
            if (canceled) return
            downloadPath = filePath
        }
        const ok = await Downloader.download(this, downloadPath)
        if (!ok) return
        if (SHOW_IN_FINDER) {
            this.utils.showInFinder(downloadPath)
        }
        const msg = this.i18n.t("func.download.ok")
        this.utils.notification.show(msg)
    }

    pinTop = async (draw = true) => {
        this.pinUtils.isPinTop = !this.pinUtils.isPinTop;
        if (this.pinUtils.isPinTop) {
            if (this.pinUtils.isPinRight) {
                await this.pinRight(false);
            }
            await this.pinUtils.recordRect();
        }

        let showFunc, hint, contentTop, modalRect, toggleFunc;
        if (this.pinUtils.isPinTop) {
            toggleFunc = "add";
            const { top, height, width, left } = this.contentOriginRect;
            const newHeight = height * this.config.HEIGHT_PERCENT_WHEN_PIN_TOP / 100;
            modalRect = { left, top, width, height: newHeight };
            contentTop = top + newHeight;
            showFunc = "show";
            hint = this.i18n.t("func.pinRecover")
        } else {
            toggleFunc = "remove";
            modalRect = this.modalOriginRect;
            contentTop = this.contentOriginRect.top;
            showFunc = "hide";
            hint = this.i18n.t("func.pinTop")
        }
        this._setModalRect(modalRect);
        this.entities.modal.classList.toggle("pinTop");
        this.entities.modal.classList[toggleFunc]("noBoxShadow");
        this.entities.content.style.top = contentTop + "px";
        this.entities.fullScreen.setAttribute("action", "expand");
        this.utils[showFunc](this.entities.gripUp);
        const button = document.querySelector('.plugin-markmap-icon[action="pinTop"]');
        button.setAttribute("ty-hint", hint);
        button.classList.toggle("ion-chevron-up", !this.pinUtils.isPinTop);
        button.classList.toggle("ion-ios7-undo", this.pinUtils.isPinTop);
        this.utils.toggleVisible(this.entities.resize, this.pinUtils.isPinTop);
        if (draw) {
            await this.draw();
        }
    }

    pinRight = async (draw = true) => {
        this.pinUtils.isPinRight = !this.pinUtils.isPinRight;
        if (this.pinUtils.isPinRight) {
            if (this.pinUtils.isPinTop) {
                await this.pinTop(false);
            }
            await this.pinUtils.recordRect();
        }

        let showFunc, hint, writeWidth, modalRect, contentRight, contentWidth, toggleFunc;
        if (this.pinUtils.isPinRight) {
            toggleFunc = "add";
            const { top, width, height, right } = this.contentOriginRect;
            const newWidth = width * this.config.WIDTH_PERCENT_WHEN_PIN_RIGHT / 100;
            modalRect = { top, height, width: newWidth, left: right - newWidth };
            contentRight = `${right - newWidth}px`;
            contentWidth = `${width - newWidth}px`;
            writeWidth = "initial";
            showFunc = "show";
            hint = this.i18n.t("func.pinRecover")
        } else {
            toggleFunc = "remove";
            modalRect = this.modalOriginRect;
            contentRight = "";
            contentWidth = "";
            writeWidth = "";
            showFunc = "hide";
            hint = this.i18n.t("func.pinRight")
        }

        this._setModalRect(modalRect);
        this.entities.modal.classList.toggle("pinRight");
        this.entities.modal.classList[toggleFunc]("noBoxShadow");
        this.entities.content.style.right = contentRight;
        this.entities.content.style.width = contentWidth;
        this.entities.fullScreen.setAttribute("action", "expand");
        this.utils.entities.eWrite.style.width = writeWidth;
        this.utils[showFunc](this.entities.gripRight);
        const button = document.querySelector('.plugin-markmap-icon[action="pinRight"]');
        button.setAttribute("ty-hint", hint);
        button.classList.toggle("ion-chevron-right", !this.pinUtils.isPinRight);
        button.classList.toggle("ion-ios7-undo", this.pinUtils.isPinRight);
        this.utils.toggleVisible(this.entities.resize, this.pinUtils.isPinRight);
        if (draw) {
            await this.draw();
        }
    }

    isInSpecialState = () => ["pinTop", "pinRight", "noBoxShadow"].some(c => this.entities.modal.classList.contains(c))

    toggleToolbar = show => {
        this.utils.toggleVisible(this.entities.header, !show);
        this.fit();
    }

    hideToolbar = () => this.toggleToolbar(false)

    showToolbar = () => this.toggleToolbar(true)

    expand = () => {
        this.modalOriginRect = this.entities.modal.getBoundingClientRect();
        this._setModalRect(this.entities.content.getBoundingClientRect());
        this._setFullScreenIcon(true);
    }

    shrink = () => {
        this._setModalRect(this.modalOriginRect);
        this._setFullScreenIcon(false);
    }

    redraw = async options => {
        this.markmap.destroy();
        const md = this.controller.getToc(this.config.FIX_ERROR_LEVEL_HEADER);
        await this._create(md, options);
    }

    draw = async (fit = true, options = null) => {
        const md = this.controller.getToc(this.config.FIX_ERROR_LEVEL_HEADER);
        if (md !== undefined) {
            await this._draw(md, fit, options);
        }
    }

    isShow = () => this.utils.isShow(this.entities.modal)

    _draw = async (md, fit = true, options) => {
        this.utils.show(this.entities.modal)
        if (this.markmap) {
            if (this.config.AUTO_UPDATE) {
                await this._update(md, fit)
            }
        } else {
            this._initModalRect()
            await this.controller.lazyLoad()
            await this._create(md, options)
        }
    }

    _create = async (md, options) => {
        options = this.controller.assignOptions(this.config.DEFAULT_TOC_OPTIONS, options);
        this.transformContext = this.MarkmapLib.transformer.transform(md);
        this.markmap = this.MarkmapLib.Markmap.create(this.entities.svg, options, this.transformContext.root);
    }

    _update = async (md, fit = true) => {
        this.transformContext = this.MarkmapLib.transformer.transform(md);
        const { root } = this.transformContext;
        this._setFold(root);
        this.markmap.setData(root);
        if (fit) {
            await this.markmap.fit();
        }
    }

    _initModalRect = () => {
        const { left, width, height } = this.entities.content.getBoundingClientRect();
        const { WIDTH_PERCENT_WHEN_INIT: w, HEIGHT_PERCENT_WHEN_INIT: h } = this.config;
        const l = (100 - w) / 2;
        Object.assign(this.entities.modal.style, {
            left: `${left + width * l / 100}px`,
            width: `${width * w / 100}px`,
            height: `${height * h / 100}px`
        });
    }

    _setFold = newRoot => {
        if (!this.config.KEEP_FOLD_STATE_WHEN_UPDATE) return

        const needFold = new Set()
        const { data: oldRoot } = this.markmap.state || {}

        const preorder = (node, fn, parent) => {
            fn(node, parent)
            for (const child of node.children) {
                preorder(child, fn, node)
            }
        }
        const setPath = (node, parent) => {
            const parentPath = (parent && parent.__path) || ""
            node.__path = `${parentPath}\n${node.content}`
        }
        const getNeed = node => {
            const { payload, __path } = node
            if (payload && payload.fold && __path) {
                needFold.add(__path)
            }
        }
        const setNeed = node => {
            if (needFold.has(node.__path)) {
                node.payload.fold = 1
            }
        }

        preorder(oldRoot, setPath)
        preorder(newRoot, setPath)
        preorder(oldRoot, getNeed)
        preorder(newRoot, setNeed)
    }

    _fixConfig = () => {
        const { DEFAULT_TOC_OPTIONS: op } = this.config
        op.color = op.color.map(e => e.toUpperCase())
        if (op.initialExpandLevel < 0 || isNaN(op.initialExpandLevel)) {
            op.initialExpandLevel = 6
        } else if (op.initialExpandLevel === 0) {
            op.initialExpandLevel = 1
        }
    }

    _onButtonClick = async action => {
        const dont = ["pinTop", "pinRight", "fit", "download", "penetrateMouse", "setting", "showToolbar", "hideToolbar"]
        if (!dont.includes(action)) {
            await this._waitUnpin()
        }
        const act = (action === "pinTop" || action === "pinRight") ? false : undefined
        await this[action](act)
    }

    _setModalRect = rect => {
        if (!rect) return;
        const { left, top, height, width } = rect;
        const s = { left: `${left}px`, top: `${top}px`, height: `${height}px`, width: `${width}px` };
        Object.assign(this.entities.modal.style, s);
    }

    _setFullScreenIcon = (fullScreen, autoFit = true) => {
        this.entities.modal.classList.toggle("noBoxShadow", fullScreen);
        this.entities.fullScreen.setAttribute("action", fullScreen ? "shrink" : "expand");
        this.utils.toggleVisible(this.entities.resize, fullScreen);
        if (autoFit) {
            this.fit()
        }
    }

    _waitUnpin = async () => {
        if (this.pinUtils.isPinTop) {
            await this.pinTop();
        }
        if (this.pinUtils.isPinRight) {
            await this.pinRight();
        }
    }

    _cleanTransition = () => this.entities.modal.style.transition = "none"
    _rollbackTransition = () => this.entities.modal.style.transition = ""
}

class Downloader {
    static _toSVG = (plugin, options = {
        paddingX: plugin.config.DEFAULT_TOC_OPTIONS.paddingX,
        paddingH: plugin.config.DOWNLOAD_OPTIONS.PADDING_HORIZONTAL,
        paddingV: plugin.config.DOWNLOAD_OPTIONS.PADDING_VERTICAL,
        textColor: plugin.config.DOWNLOAD_OPTIONS.TEXT_COLOR,
        openCircleColor: plugin.config.DOWNLOAD_OPTIONS.OPEN_CIRCLE_COLOR,
        removeForeignObject: plugin.config.DOWNLOAD_OPTIONS.REMOVE_FOREIGN_OBJECT,
        removeUselessClasses: plugin.config.DOWNLOAD_OPTIONS.REMOVE_USELESS_CLASSES,
    }) => {
        const _getRect = svg => {
            const { width, height } = plugin.entities.svg.querySelector("g").getBoundingClientRect()
            const match = svg.querySelector("g").getAttribute("transform").match(/scale\((?<scale>.+?\))/)
            if (!match || !match.groups || !match.groups.scale) return {}
            const scale = parseFloat(match.groups.scale)
            const realWidth = parseInt(width / scale)
            const realHeight = parseInt(height / scale)
            let minY = 0, maxY = 0
            svg.querySelectorAll("g.markmap-node").forEach(node => {
                const match = node.getAttribute("transform").match(/translate\((?<x>.+?),\s(?<y>.+?)\)/)
                if (!match || !match.groups || !match.groups.x || !match.groups.y) return
                const y = parseInt(match.groups.y)
                minY = Math.min(minY, y)
                maxY = Math.max(maxY, y)
            })
            return { minX: 0, maxX: realWidth, width: realWidth, minY: minY, maxY: maxY, height: realHeight }
        }

        const fixAttributes = svg => {
            const { width = 100, height = 100, minY = 0 } = _getRect(svg)
            const { paddingH, paddingV } = options
            const svgWidth = width + paddingH * 2  // both sides
            const svgHeight = height + paddingV * 2
            svg.removeAttribute("id")
            svg.setAttribute("xmlns", "http://www.w3.org/2000/svg")
            svg.setAttribute("class", "markmap")
            svg.setAttribute("width", svgWidth)
            svg.setAttribute("height", svgHeight)
            svg.setAttribute("viewBox", `0 ${minY} ${svgWidth} ${svgHeight}`)
            svg.querySelector("g").setAttribute("transform", `translate(${paddingH}, ${paddingV})`)
        }

        const fixStyles = svg => {
            // remove useless styles
            const _useless1 = [
                ".markmap-dark .markmap",
                ".markmap-node > circle",
                ".markmap-foreign svg",
                ".markmap-foreign img",
                ".markmap-foreign pre",
                ".markmap-foreign pre > code",
                ".markmap-foreign-testing-max",
                ".markmap-foreign-testing-max img",
                ".markmap-foreign table, .markmap-foreign th, .markmap-foreign td",
            ]
            const _useless2 = [
                ".markmap-foreign p",
                ".markmap-foreign a",
                ".markmap-foreign code",
                ".markmap-foreign del",
                ".markmap-foreign em",
                ".markmap-foreign strong",
                ".markmap-foreign mark",
            ].filter(selector => !svg.querySelector(selector))
            const _useless3 = _useless2.includes(".markmap-foreign a") ? [".markmap-foreign a:hover"] : []
            const useless = new Set([..._useless1, ..._useless2, ..._useless3])
            const style = svg.querySelector("style")
            // The `sheet` property of <style> in cloned <svg> is undefined, parse the style text to get it
            const styleEle = new DOMParser().parseFromString(`<style>${style.textContent}</style>`, "text/html").querySelector("style")
            const usefulRules = [...styleEle.sheet.cssRules].filter(rule => !useless.has(rule.selectorText))

            // CSS variables cannot be parsed by some SVG parsers, replace them
            let cssText = usefulRules
                .map(rule => rule.cssText)
                .join(" ")
                .replace(/--[\w\-]+?\s*?:\s*?.+?;/g, "")
                .replace(/\s+/g, " ")
            const markmapClassStyleMap = usefulRules[0].styleMap  // All CSS variables are here
            markmapClassStyleMap.forEach((value, key) => {
                if (key.startsWith("--")) {
                    const regex = new RegExp(`var\\(${key}\\);?`, "g")
                    const replacement = key === "--markmap-text-color" ? options.textColor : value[0][0]
                    cssText = cssText.replace(regex, replacement + ";")
                }
            })

            // replace style element
            style.replaceChild(document.createTextNode(cssText), style.firstChild)
            // replace CSS variables `--markmap-circle-open-bg`
            svg.querySelectorAll('circle[fill="var(--markmap-circle-open-bg)"]').forEach(ele => ele.setAttribute("fill", options.openCircleColor))
        }

        const removeForeignObject = svg => {
            svg.querySelectorAll("foreignObject").forEach(foreign => {
                const x = options.paddingX
                const y = parseInt(foreign.closest("g").querySelector("line").getAttribute("y1")) - 4
                // const y = 16
                const text = document.createElement("text")
                text.setAttribute("x", x)
                text.setAttribute("y", y)

                // TODO: handle math
                const katex = foreign.querySelector(".katex")
                if (katex) {
                    const base = katex.querySelector(".katex-html")
                    katex.innerHTML = base ? base.textContent : ""
                }

                text.textContent = foreign.textContent
                foreign.parentNode.replaceChild(text, foreign)
            })
        }

        const removeUselessClasses = svg => svg.querySelectorAll(".markmap-node").forEach(ele => ele.removeAttribute("class"))

        const svg = plugin.entities.svg.cloneNode(true)
        fixAttributes(svg)
        fixStyles(svg)
        if (options.removeForeignObject) {
            removeForeignObject(svg)
        }
        if (options.removeUselessClasses) {
            removeUselessClasses(svg)
        }
        return svg
    }

    static _toImage = async (plugin, format, options = {
        imageQuality: plugin.config.DOWNLOAD_OPTIONS.IMAGE_QUALITY,
        keepAlphaChannel: plugin.config.DOWNLOAD_OPTIONS.KEEP_ALPHA_CHANNEL,
        backgroundColor: plugin.config.DOWNLOAD_OPTIONS.BACKGROUND_COLOR,
    }) => {
        const svg = this._toSVG(plugin)
        const img = new Image()
        const ok = await new Promise(resolve => {
            img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg.outerHTML)}`
            img.onerror = () => resolve(false)
            img.onload = () => resolve(true)
        })
        if (!ok) {
            return Buffer.alloc(0)
        }

        const canvas = document.createElement("canvas")
        const dpr = File.canvasratio || window.devicePixelRatio || 1
        const width = svg.getAttribute("width") * dpr
        const height = svg.getAttribute("height") * dpr
        canvas.width = width
        canvas.height = height
        canvas.style.width = width + "px"
        canvas.style.height = height + "px"

        const ctx = canvas.getContext("2d")
        if (format === "jpeg" || !options.keepAlphaChannel) {
            ctx.fillStyle = options.backgroundColor
            ctx.fillRect(0, 0, width, height)
        }
        ctx.drawImage(img, 0, 0, width, height)

        const encoderOptions = parseFloat(options.imageQuality)
        const base64 = canvas.toDataURL(`image/${format}`, encoderOptions).replace(`data:image/${format};base64,`, "")
        return Buffer.from(base64, "base64")
    }

    static svg = (plugin) => this._toSVG(plugin).outerHTML

    static png = async (plugin) => this._toImage(plugin, "png")

    static jpg = async (plugin) => this._toImage(plugin, "jpeg")

    static webp = async (plugin) => this._toImage(plugin, "webp")

    static md = (plugin) => plugin.transformContext.content

    static html = (plugin) => {
        const escapeHtml = text => text.replace(/[&<"]/g, char => ({ '&': '&amp;', '<': '&lt;', '"': '&quot;' })[char]);
        const createTag = (tagName, attributes, content) => {
            const attrList = Object.entries(attributes || {}).map(([key, value]) => {
                if (value == null || value === false) return ""
                const escapedKey = ` ${escapeHtml(key)}`;
                return value === true ? escapedKey : `${escapedKey}="${escapeHtml(value)}"`;
            })
            const tag = `<${tagName}${attrList.filter(Boolean).join("")}>`;
            return content != null ? `${tag}${content}</${tagName}>` : tag;
        }

        const handleStyles = styles => styles.map(style => {
            const tagName = (style.type === "stylesheet") ? "link" : "style"
            const attributes = (style.type === "stylesheet") ? { rel: "stylesheet", ...style.data } : style.data
            return createTag(tagName, attributes)
        })

        const handleScripts = (scripts, root, urlBuilder) => {
            const _base = ["d3@7.9.0/dist/d3.min.js", "markmap-view@0.17.3-alpha.1/dist/browser/index.js"]
            const base = _base.map(asset => ({ type: "script", data: { src: urlBuilder.getFullUrl(asset) } }))

            const entry = {
                type: "iife",
                data: {
                    getParams: ({ getMarkmap, root, options }) => [getMarkmap, root, options],
                    fn: (getMarkmap, root, options) => {
                        const markmap = getMarkmap()
                        const opt = markmap.deriveOptions(options)
                        window.mm = markmap.Markmap.create("svg#mindmap", opt, root)
                    }
                }
            }

            const context = {
                getMarkmap: () => window.markmap,
                root: root,
                options: { ...plugin.markmap.options, ...plugin.config.DEFAULT_TOC_OPTIONS },
            }
            const createIIFE = (fn, params) => {
                const args = params.map(arg =>
                    typeof arg === "function"
                        ? arg.toString().replace(/\s+/g, " ")
                        : JSON.stringify(arg)
                )
                const callFuncStr = `(${fn.toString()})(${args.join(", ")})`
                return callFuncStr.replace(/<\s*\/script\s*>/gi, "\\x3c$&")
            }

            return [...base, ...scripts, entry].map(script => {
                switch (script.type) {
                    case "script":
                        return createTag("script", { src: script.data.src }, "")
                    case "iife":
                        const { fn, getParams } = script.data
                        const params = getParams ? getParams(context) : []
                        const content = createIIFE(fn, params)
                        return createTag("script", null, content)
                    default:
                        return script
                }
            })
        }

        const toHTML = (title, styles, scripts) => `
<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>${title}</title>
        <style>* { margin: 0; padding: 0; } #mindmap { display: block; width: 100vw; height: 100vh; }</style>
        ${styles.join("\n")}
    </head>
    <body>
        <svg id="mindmap"></svg>
        ${scripts.join("\n")}
    </body>
</html>`

        const run = title => {
            const { transformer } = plugin.MarkmapLib
            const { root, features } = plugin.transformContext
            const { styles, scripts } = transformer.getUsedAssets(features)
            const styleElements = handleStyles(styles)
            const scriptElements = handleScripts(scripts, root, transformer.urlBuilder)
            return toHTML(title, styleElements, scriptElements)
        }

        return run("MINDMAP")
    }

    static getFormats() {
        const formats = Object.keys(this).filter(k => !k.startsWith("_"))
        const total = { name: "ALL", extensions: formats }
        const separate = formats.map(k => ({ name: k.toUpperCase(), extensions: [k] }))
        return [total, ...separate]
    }

    static async download(plugin, file) {
        const ext = plugin.utils.Package.Path.extname(file).toLowerCase().replace(/^\./, "")
        const func = this[ext] || this.svg
        const content = await func(plugin)
        return plugin.utils.writeFile(file, content)
    }
}

module.exports = {
    plugin: markmapPlugin
}
