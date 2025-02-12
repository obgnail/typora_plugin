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
        this.staticActions = [
            { act_name: "插入markmap：大纲", act_value: "draw_fence_outline", act_hotkey: this.config.FENCE_HOTKEY, act_hidden: !this.fenceMarkmap },
            { act_name: "插入markmap：模板", act_value: "draw_fence_template", act_hidden: !this.fenceMarkmap },
            { act_name: "思维导图弹窗", act_value: "toggle_toc", act_hotkey: this.config.TOC_HOTKEY, act_hidden: !this.tocMarkmap }
        ]
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
            lang: this.config.LANGUAGE,
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
            : `${backQuote}${this.config.LANGUAGE}\n${frontMatter}${this.controller.getToc() || "# empty"}\n${backQuote}`
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
        this.config = plugin.config;
        this.MarkmapLib = plugin.MarkmapLib;
    }

    html = () => `
        <div id="plugin-markmap" class="plugin-common-modal plugin-common-hidden">
            <div class="plugin-markmap-wrap">
                <div class="plugin-markmap-grip grip-right plugin-common-hidden"></div>
                <div class="plugin-markmap-header">
                    <div class="plugin-markmap-icon ion-close" action="close" ty-hint="关闭"></div>
                    <div class="plugin-markmap-icon ion-qr-scanner" action="expand" ty-hint="全屏"></div>
                    <div class="plugin-markmap-icon ion-arrow-move" action="move" ty-hint="移动"></div>
                    <div class="plugin-markmap-icon ion-cube" action="fit" ty-hint="图形适配窗口"></div>
                    <div class="plugin-markmap-icon ion-pinpoint" action="penetrateMouse" ty-hint="鼠标穿透"></div>
                    <div class="plugin-markmap-icon ion-android-settings" action="setting" ty-hint="配置"></div>
                    <div class="plugin-markmap-icon ion-archive" action="download" ty-hint="导出"></div>
                    <div class="plugin-markmap-icon ion-chevron-up" action="pinTop" ty-hint="固定到顶部"></div>
                    <div class="plugin-markmap-icon ion-chevron-right" action="pinRight" ty-hint="固定到右侧"></div>
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

            resizeWhenFree();      // 自由移动时调整大小
            resizeWhenPinTop();    // 固定到顶部时调整大小
            resizeWhenPinRight();  // 固定到右侧时调整大小
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
                let tocIdx = parseInt(nodeIdx - 1); // markmap节点的索引从1开始，要-1
                if (!this.markmap.state.data.content) {
                    tocIdx--; // 若markmap第一个节点是空节点，再-1
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
                    if (this.config.CLICK_TO_LOCALE) {
                        if (this.config.AUTO_UPDATE) {
                            const { height: contentHeight, top: contentTop } = this.entities.content.getBoundingClientRect()
                            const height = contentHeight * this.config.LOCALE_HEIGHT_RATIO + contentTop
                            const showHiddenElement = !this.config.AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD
                            this.utils.scrollByCid(cid, height, true, showHiddenElement)
                        }
                    }
                }
            })
        }
        const onContextMenu = () => {
            const menuMap = {
                expand: "全屏", shrink: "取消全屏", fit: "图形适配窗口", download: "下载", setting: "设置",
                close: "关闭", pinTop: "固定到顶部", pinRight: "固定到右侧", hideToolbar: "隐藏工具栏", showToolbar: "显示工具栏",
            };
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
        const INFO = {
            color: "如需自定义配色方案，请手动修改 CANDIDATE_COLOR_SCHEMES 选项",
            maxWidth: "0 表示无长度限制",
            AUTO_UPDATE: "如果取消勾选，则选项「点击节点跳转到文档对应章节」失效",
            CLICK_TO_LOCALE: "如果取消勾选，则选项「定位的视口高度」失效",
            LOCALE_HEIGHT_RATIO: "定位的目标章节滚动到当前视口的高度位置（百分比）",
            FIX_ERROR_LEVEL_HEADER: "如果取消勾选，则会过滤跳级标题，只显示层级连续的标题",
            AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD: "实验性特性，不建议开启。仅当插件「章节折叠」开启时可用",
            FOLDER: "如果为空或不存在，则使用 TEMP 目录",
            FILENAME: `支持变量名：filename、timestamp、random、uuid\n支持扩展名：${Downloader.getFormats()[0].extensions.join("、")}`,
            IMAGE_QUALITY: "仅适用于 jpg、webp 格式",
            BACKGROUND_COLOR: "仅适用于像素图片格式",
            KEEP_ALPHA_CHANNEL: "仅适用于携带透明通道的像素图片格式",
            REMOVE_FOREIGN_OBJECT: "牺牲样式，提高兼容性。如果导出的图片异常，请勾选此选项",
        }
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
        const inlineWidget = (label, key) => ({
            label,
            info: INFO[key],
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
            return { label: "配色方案", info: INFO.color, type: "radio", list, callback }
        }

        const chart = (fieldset = "图形") => [
            { fieldset, type: "range", min: 1, max: 6, step: 1, ...inlineWidget("固定配色的分支等级", "colorFreezeLevel") },
            { fieldset, type: "range", min: 1, max: 6, step: 1, ...inlineWidget("分支展开等级", "initialExpandLevel") },
            { fieldset, type: "range", min: 0, max: 100, step: 1, ...inlineWidget("节点内边距", "paddingX") },
            { fieldset, type: "range", min: 0, max: 200, step: 1, ...inlineWidget("节点水平间距", "spacingHorizontal") },
            { fieldset, type: "range", min: 0, max: 100, step: 1, ...inlineWidget("节点垂直间距", "spacingVertical") },
            { fieldset, type: "range", min: 0, max: 1000, step: 10, ...inlineWidget("节点最大长度", "maxWidth") },
            { fieldset, type: "range", min: 0, max: 1000, step: 10, ...inlineWidget("动画持续时间", "duration") },
        ]

        const window = (fieldset = "窗口") => [
            { fieldset, type: "range", min: 0.5, max: 1, step: 0.01, ...inlineWidget("窗口填充率", "fitRatio") },
            { fieldset, type: "range", min: 20, max: 95, step: 1, ...inlineWidget("初始的窗口宽度", "WIDTH_PERCENT_WHEN_INIT") },
            { fieldset, type: "range", min: 20, max: 95, step: 1, ...inlineWidget("初始的窗口高度", "HEIGHT_PERCENT_WHEN_INIT") },
            { fieldset, type: "range", min: 20, max: 95, step: 1, ...inlineWidget("固定顶部的窗口高度", "HEIGHT_PERCENT_WHEN_PIN_UP") },
            { fieldset, type: "range", min: 20, max: 95, step: 1, ...inlineWidget("固定右侧的窗口宽度", "WIDTH_PERCENT_WHEN_PIN_RIGHT") },
            { fieldset, type: "range", min: 0.1, max: 0.95, step: 0.01, ...inlineWidget("定位的视口高度", "LOCALE_HEIGHT_RATIO") },
        ]

        const behavior = (legend = "行为") => {
            const hasPlugin = this.utils.getPlugin("collapse_paragraph")
            const components = [
                { label: "兼容跳级标题", key: "FIX_ERROR_LEVEL_HEADER" },
                { label: "允许缩放图形", key: "zoom" },
                { label: "允许平移图形", key: "pan" },
                { label: "大纲变化后，自动更新图形", key: "AUTO_UPDATE" },
                { label: "点击节点后，跳转到文档对应章节", key: "CLICK_TO_LOCALE" },
                { label: "折叠节点后，自动调整图形大小以适配窗口", key: "autoFit" },
                { label: "更新图形后，自动调整图形大小以适配窗口", key: "AUTO_FIT_WHEN_UPDATE" },
                { label: "调整窗口后，自动调整图形大小以适配窗口", key: "AUTO_FIT_WHEN_RESIZE" },
                { label: "更新图形后，已折叠的节点保持折叠状态", key: "REMEMBER_FOLD_WHEN_UPDATE" },
                { label: "折叠节点后，自动折叠对应的章节内容", key: "AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD", disabled: !hasPlugin },
            ]
            return { label: "", legend, ...checkboxWidget(components) }
        }

        const download = (fieldset = "导出") => {
            const components = [
                { label: "保留透明信息", key: "KEEP_ALPHA_CHANNEL" },
                { label: "删除无用类名", key: "REMOVE_USELESS_CLASSES" },
                { label: "替换 &lt;foreignObject&gt; 标签", key: "REMOVE_FOREIGN_OBJECT" },
                { label: "导出前询问导出路径", key: "SHOW_PATH_INQUIRY_DIALOG" },
                { label: "导出后打开文件所在目录", key: "SHOW_IN_FINDER" },
            ]
            return [
                { fieldset, type: "number", min: 1, max: 1000, step: 1, ...inlineWidget("水平内边距", "PADDING_HORIZONTAL") },
                { fieldset, type: "number", min: 1, max: 1000, step: 1, ...inlineWidget("垂直内边距", "PADDING_VERTICAL") },
                { fieldset, type: "number", min: 0.01, max: 1, step: 0.01, ...inlineWidget("图片质量", "IMAGE_QUALITY") },
                { fieldset, type: "color", ...inlineWidget("文字颜色", "TEXT_COLOR") },
                { fieldset, type: "color", ...inlineWidget("圆圈颜色", "OPEN_CIRCLE_COLOR") },
                { fieldset, type: "color", ...inlineWidget("背景颜色", "BACKGROUND_COLOR") },
                { fieldset, type: "input", placeholder: this.utils.tempFolder, ...inlineWidget("默认文件夹", "FOLDER") },
                { fieldset, type: "input", ...inlineWidget("默认文件名", "FILENAME") },
                { fieldset, label: "", ...checkboxWidget(components) },
            ]
        }

        const components = [color(), ...chart(), ...window(), behavior(), ...download()];
        const { response } = await this.utils.dialog.modalAsync({ title: "设置", width: "500px", components })
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
                properties: ["saveFile", "showOverwriteConfirmation"],
                title: "导出",
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
        this.utils.notification.show("导出成功")
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
            const newHeight = height * this.config.HEIGHT_PERCENT_WHEN_PIN_UP / 100;
            modalRect = { left, top, width, height: newHeight };
            contentTop = top + newHeight;
            showFunc = "show";
            hint = "还原窗口";
        } else {
            toggleFunc = "remove";
            modalRect = this.modalOriginRect;
            contentTop = this.contentOriginRect.top;
            showFunc = "hide";
            hint = "固定到顶部";
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
            hint = "还原窗口";
        } else {
            toggleFunc = "remove";
            modalRect = this.modalOriginRect;
            contentRight = "";
            contentWidth = "";
            writeWidth = "";
            showFunc = "hide";
            hint = "固定到右侧";
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
        if (!this.config.REMEMBER_FOLD_WHEN_UPDATE) return

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
