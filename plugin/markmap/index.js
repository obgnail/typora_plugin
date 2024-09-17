class markmapPlugin extends BasePlugin {
    beforeProcess = () => {
        this.MarkmapLib = {};
        this.tocMarkmap = this.config.ENABLE_TOC_MARKMAP ? new tocMarkmap(this) : null;
        this.fenceMarkmap = this.config.ENABLE_FENCE_MARKMAP ? new fenceMarkmap(this) : null;
    }

    styleTemplate = () => ({
        node_hover: !this.config.CLICK_TO_LOCALE ? "" : `#plugin-markmap-svg .markmap-node:hover { cursor: pointer; }`,
        show_outline: !this.config.SHOW_BORDER_WHEN_NODE_HOVER ? "" : `#plugin-markmap-svg .markmap-node .markmap-foreign:hover { outline: ${this.config.BORDER_STYLE_WHEN_NODE_HOVER}; }`,
        icon_wrap: !this.config.ALLOW_ICON_WRAP ? "" : `.plugin-markmap-header { flex-wrap: wrap; justify-content: flex-start; }`,
    })

    html = () => this.tocMarkmap && this.tocMarkmap.html();

    hotkey = () => [this.tocMarkmap, this.fenceMarkmap].map(p => p && p.hotkey()).filter(Boolean).flat()

    init = () => {
        this.callArgs = this.fenceMarkmap
            ? [{ arg_name: "插入markmap：大纲", arg_value: "draw_fence_outline", arg_hotkey: this.config.FENCE_HOTKEY }, { arg_name: "插入markmap：模板", arg_value: "draw_fence_template" }]
            : []
    }

    process = () => {
        this.tocMarkmap && this.tocMarkmap.process();
        this.fenceMarkmap && this.fenceMarkmap.process();
    }

    call = async type => {
        if (type === "toggle_toc") {
            this.tocMarkmap && await this.tocMarkmap.callback(type);
        } else if (type === "draw_fence_template" || type === "draw_fence_outline") {
            this.fenceMarkmap && await this.fenceMarkmap.call(type);
        }
    }

    getToc = () => {
        const { headers } = File.editor.nodeMap.toc || {};
        if (!headers) return;

        const result = [];
        for (const header of headers) {
            const { pattern, depth, text = "" } = (header && header.attributes) || {};
            if (pattern) {
                result.push(pattern.replace("{0}", text));
            } else if (depth) {
                result.push("#".repeat(parseInt(depth)) + " " + text);
            }
        }
        return result.join("\n")
    }

    onButtonClick = () => this.tocMarkmap && this.tocMarkmap.callback()

    assignOptions = (update, old) => {
        const update_ = this.utils.fromObject(update, ["spacingHorizontal", "spacingVertical", "fitRatio", "paddingX", "autoFit"]);
        const options = this.MarkmapLib.deriveOptions({ ...old, ...update });
        return Object.assign(options, update_)
    }

    dynamicCallArgsGenerator = () => {
        return this.tocMarkmap
            ? [{ arg_name: "思维导图弹窗", arg_value: "toggle_toc", arg_hotkey: this.config.TOC_HOTKEY }]
            : []
    }

    lazyLoad = async () => {
        if (this.MarkmapLib.Markmap) return;

        const { Transformer, builtInPlugins } = require("./resource/markmap-lib.js");
        const markmap = require("./resource/markmap-view.js");
        const transformer = new Transformer(builtInPlugins);
        Object.assign(this.MarkmapLib, markmap, { transformer, Transformer, builtInPlugins });

        const { loadCSS, loadJS } = markmap;
        const { styles, scripts } = transformer.getAssets();
        if (this.config.RESOURCE_FROM !== "network") {
            styles[0].data.href = this.utils.joinPath("./plugin/markmap/resource/katex.min.css");
            styles[1].data.href = this.utils.joinPath("./plugin/markmap/resource/default.min.css");
            scripts[1].data.src = this.utils.joinPath("./plugin/markmap/resource/webfontloader.js");
        }
        await loadCSS(styles);
        await loadJS(scripts, { getMarkmap: () => markmap });
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

    call = async type => this.callback(type)

    callback = type => {
        const backQuote = "```"
        const defaultFrontMatter = `---\nmarkmap:\n  zoom: false\n  pan: false\n  height: 300px\n  backgroundColor: "#f8f8f8"\n---\n\n`;
        const md = type === "draw_fence_template"
            ? this.config.FENCE_TEMPLATE
            : `${backQuote}${this.config.LANGUAGE}\n${defaultFrontMatter}${this.controller.getToc() || "# empty"}\n${backQuote}`;
        this.utils.insertText(null, md);
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
            instance && instance.fit();
        }, 200);
    }

    update = async (cid, md, options) => {
        const instance = this.instanceMap.get(cid);
        const { root } = this.MarkmapLib.transformer.transform(md);
        instance.setData(root);
        options = this.controller.assignOptions(options);
        instance.setOptions(options);
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
        this.candidateColorSchemes = {
            PASTEL2: ['#B3E2CD', '#FDCDAC', '#CBD5E8', '#F4CAE4', '#E6F5C9', '#FFF2AE', '#F1E2CC', '#CCCCCC'],
            SET2: ['#66C2A5', '#FC8D62', '#8DA0CB', '#E78AC3', '#A6D854', '#FFD92F', '#E5C494', '#B3B3B3'],
            DARK2: ['#1B9E77', '#D95F02', '#7570B3', '#E7298A', '#66A61E', '#E6AB02', '#A6761D', '#666666'],
            ACCENT: ['#7FC97F', '#BEAED4', '#FDC086', '#FFFF99', '#386CB0', '#F0027F', '#BF5B17', '#666666'],
            PASTEL1: ['#FBB4AE', '#B3CDE3', '#CCEBC5', '#DECBE4', '#FED9A6', '#FFFFCC', '#E5D8BD', '#FDDAEC', '#F2F2F2'],
            SET1: ['#E41A1C', '#377EB8', '#4DAF4A', '#984EA3', '#FF7F00', '#FFFF33', '#A65628', '#F781BF', '#999999'],
            TABLEAU10: ['#4E79A7', '#F28E2C', '#E15759', '#76B7B2', '#59A14F', '#EDC949', '#AF7AA1', '#FF9DA7', '#9C755F', '#BAB0AB'],
            CATEGORY10: ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F', '#BCBD22', '#17BECF'],
            PAIRED: ['#A6CEE3', '#1F78B4', '#B2DF8A', '#33A02C', '#FB9A99', '#E31A1C', '#FDBF6F', '#FF7F00', '#CAB2D6', '#6A3D9A', '#FFFF99', '#B15928'],
            SET3: ['#8DD3C7', '#FFFFB3', '#BEBADA', '#FB8072', '#80B1D3', '#FDB462', '#B3DE69', '#FCCDE5', '#D9D9D9', '#BC80BD', '#CCEBC5', '#FFED6F'],
        }
        this._fixConfig();

        this.recoverColorScheme = this.candidateColorSchemes.CATEGORY10;
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
        }
    }

    process = () => {
        const onEvent = () => {
            const { eventHub } = this.utils;
            eventHub.addEventListener(eventHub.eventType.outlineUpdated, () => this.isShow() && this.draw(this.config.AUTO_FIT_WHEN_UPDATE));
            eventHub.addEventListener(eventHub.eventType.toggleSettingPage, hide => hide && this.markmap && this._onButtonClick("close"));
            this.entities.content.addEventListener("transitionend", this.fit);
            this.entities.modal.addEventListener("transitionend", this.fit);
        }
        const onDrag = () => {
            const moveElement = this.entities.header.querySelector(`.plugin-markmap-icon[action="move"]`);
            const hint = "ty-hint";
            const value = moveElement.getAttribute(hint);
            const onMouseDown = () => {
                moveElement.removeAttribute(hint);
                this._cleanTransition();
                this._waitUnpin();
            }
            const onMouseUp = () => {
                moveElement.setAttribute(hint, value);
                this._rollbackTransition();
            }
            this.utils.dragFixedModal(moveElement, this.entities.modal, false, onMouseDown, null, onMouseUp);
        }
        const onResize = () => {
            const getModalMinHeight = () => {
                const one = this.entities.header.firstElementChild.getBoundingClientRect().height;
                const count = this.config.ALLOW_ICON_WRAP ? 1 : this.entities.header.childElementCount;
                return one * count
            }
            const getModalMinWidth = () => {
                const { marginLeft, paddingRight } = document.defaultView.getComputedStyle(this.entities.header);
                const headerWidth = this.entities.header.getBoundingClientRect().width;
                const _marginRight = this.config.ALLOW_ICON_WRAP ? 0 : parseFloat(paddingRight);
                return parseFloat(marginLeft) + headerWidth + _marginRight
            }
            const onMouseUp = () => {
                this._rollbackTransition();
                this.fit();
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
                    this._setFullScreenIcon(false);
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
                        newContentRight = contentMaxRight;
                        deltaX = contentStartRight - contentMaxRight;
                    }
                    this.entities.content.style.right = newContentRight + "px";
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
                const button = ev.target.closest(".plugin-markmap-icon");
                if (!button) return
                ev.stopPropagation();
                ev.preventDefault();
                const action = button.getAttribute("action");
                if (action !== "move" && this[action]) {
                    this._onButtonClick(action, button);
                }
            })
        }
        const onSvgClick = () => {
            const getCidFromNode = node => {
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
                ev.stopPropagation();
                ev.preventDefault();

                const circle = ev.target.closest("circle");
                const node = ev.target.closest(".markmap-node");
                if (circle) {
                    if (this.config.AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD) {
                        const cid = getCidFromNode(node);
                        if (cid) {
                            const paragraph = this.utils.entities.querySelectorInWrite(`[cid="${cid}"]`);
                            const fold = node.classList.contains("markmap-fold");
                            this.utils.callPluginFunction("collapse_paragraph", "trigger", paragraph, !fold);
                        }
                    }
                    return;
                }

                if (this.config.CLICK_TO_LOCALE) {
                    const cid = getCidFromNode(node);
                    if (cid) {
                        const { height: contentHeight, top: contentTop } = this.entities.content.getBoundingClientRect();
                        const height = contentHeight * this.config.LOCALE_HEIGHT_RATIO + contentTop;
                        const showHiddenElement = !this.config.AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD;
                        this.utils.scrollByCid(cid, height, true, showHiddenElement);
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

    call = async type => type === "draw_toc" && await this.draw()

    close = () => {
        this.entities.modal.style = "";
        this.utils.hide(this.entities.modal);
        this.utils.show(this.entities.resize);
        this.entities.modal.classList.remove("noBoxShadow");
        this.entities.fullScreen.setAttribute("action", "expand");
        this.markmap.destroy();
        this.markmap = null;
    };

    fit = () => this.markmap && this.markmap.fit();

    penetrateMouse = async () => {
        const options = this.markmap.options;
        options.zoom = !options.zoom;
        options.pan = !options.pan;
        // await this.redraw(options);
        this.entities.modal.classList.toggle("penetrateMouse", !options.zoom && !options.pan);
    }

    setting = async () => {
        const INFO = {
            color: "如需自定义配色方案请前往配置文件",
            maxWidth: "0 表示无长度限制",
            LOCALE_HEIGHT_RATIO: "定位的目标章节滚动到当前视口的高度位置（百分比）",
            REMEMBER_FOLD_WHEN_UPDATE: "图形更新时不会展开已折叠节点",
            AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD: "实验性特性，依赖「章节折叠」插件，不推荐开启",
            FOLDER_WHEN_DOWNLOAD_SVG: "为空则使用 TAMP 目录",
            FILENAME_WHEN_DOWNLOAD_SVG: "支持变量：filename、timestamp、uuid",
            COMPATIBLE_STYLE_WHEN_DOWNLOAD_SVG: "有些SVG解析器无法解析CSS变量，勾选此选项会自动替换CSS变量",
            REMOVE_USELESS_CLASS_NAME_WHEN_DOWNLOAD_SVG: "若非需要手动修改导出的SVG文件，请勿勾选此选项",
            REMOVE_FOREIGN_OBJECT_WHEN_DOWNLOAD_SVG: "牺牲样式提高兼容性。若图片显示异常，请勾选此选项",
        }
        const { DEFAULT_TOC_OPTIONS: _ops, BORDER_WHEN_DOWNLOAD_SVG: _border } = this.config;
        const needUpdateKey = ["DEFAULT_TOC_OPTIONS", "BORDER_WHEN_DOWNLOAD_SVG"];
        const _getConfig = key => (key in _ops) ? _ops[key] : this.config[key];
        const _setConfig = (key, value) => {
            const isOPS = key in _ops;
            (isOPS ? _ops : this.config)[key] = value;
            !isOPS && needUpdateKey.push(key);
        }
        const inputKV = (label, key) => ({
            label,
            info: INFO[key],
            value: _getConfig(key),
            callback: value => _setConfig(key, value),
        });
        const checkboxKV = components => ({
            type: "checkbox",
            list: components.map(({ label, key }) => ({ label, info: INFO[key], value: key, checked: Boolean(_getConfig(key)) })),
            callback: submit => components.forEach(({ key }) => _setConfig(key, submit.includes(key))),
        })
        const borderKV = (label, idx) => ({ label, value: _border[idx], callback: value => _border[idx] = value });

        const color = () => {
            const toValue = colorList => colorList.join("_");
            const fromValue = str => str.split("_");
            const toLabel = colorList => {
                const inner = colorList.map(color => `<div class="plugin-markmap-color" style="background-color: ${color}"></div>`);
                return `<div class="plugin-markmap-color-scheme">${inner.join("")}</div>`;
            }
            const curValue = toValue(_ops.color);
            const list = Object.values(this.candidateColorSchemes).map(colorList => {
                const value = toValue(colorList);
                const label = toLabel(colorList);
                const checked = value === curValue;
                return { value, label, checked };
            })
            if (!list.some(e => e.checked)) {
                list.push({ value: curValue, label: toLabel(_ops.color), checked: true });
            }
            list.push({ value: toValue(this.recoverColorScheme), label: "恢复默认", info: INFO.RECOVER_COLOR });
            const callback = scheme => _ops.color = fromValue(scheme);
            return { label: "配色方案", info: INFO.color, type: "radio", list, callback };
        }

        const ranges = () => [
            { type: "range", inline: true, min: 1, max: 6, step: 1, ...inputKV("固定配色的分支等级", "colorFreezeLevel") },
            { type: "range", inline: true, min: 1, max: 6, step: 1, ...inputKV("分支展开等级", "initialExpandLevel") },
            { type: "range", inline: true, min: 0, max: 100, step: 1, ...inputKV("节点内边距", "paddingX") },
            { type: "range", inline: true, min: 0, max: 200, step: 1, ...inputKV("节点水平间距", "spacingHorizontal") },
            { type: "range", inline: true, min: 0, max: 100, step: 1, ...inputKV("节点垂直间距", "spacingVertical") },
            { type: "range", inline: true, min: 0, max: 1000, step: 10, ...inputKV("节点最大长度", "maxWidth") },
            { type: "range", inline: true, min: 0, max: 1000, step: 10, ...inputKV("动画持续时间", "duration") },
            { type: "range", inline: true, min: 0.5, max: 1, step: 0.01, ...inputKV("窗口填充率", "fitRatio") },
            { type: "range", inline: true, min: 0.1, max: 1, step: 0.01, ...inputKV("定位的视口高度", "LOCALE_HEIGHT_RATIO") },
            { type: "range", inline: true, min: 20, max: 95, step: 1, ...inputKV("初始的窗口宽度", "WIDTH_PERCENT_WHEN_INIT") },
            { type: "range", inline: true, min: 20, max: 95, step: 1, ...inputKV("初始的窗口高度", "HEIGHT_PERCENT_WHEN_INIT") },
            { type: "range", inline: true, min: 20, max: 95, step: 1, ...inputKV("固定顶部的窗口高度", "HEIGHT_PERCENT_WHEN_PIN_UP") },
            { type: "range", inline: true, min: 20, max: 95, step: 1, ...inputKV("固定右侧的窗口宽度", "WIDTH_PERCENT_WHEN_PIN_RIGHT") },
        ]

        const ability = () => {
            const components = [
                { label: "鼠标滚轮进行缩放", key: "zoom" },
                { label: "鼠标滚轮进行平移", key: "pan" },
                { label: "折叠时自动适配窗口", key: "autoFit" },
                { label: "更新时自动适配窗口", key: "AUTO_FIT_WHEN_UPDATE" },
                { label: "记住已折叠的节点", key: "REMEMBER_FOLD_WHEN_UPDATE" },
                { label: "折叠时自动折叠章节", key: "AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD" },
            ]
            return { label: "", legend: "能力", ...checkboxKV(components) }
        }

        const download = () => {
            const fieldset = "导出";
            const components = [
                { label: "删除无用的类名", key: "REMOVE_USELESS_CLASS_NAME_WHEN_DOWNLOAD_SVG" },
                { label: "替换 &lt;foreignObject&gt; 标签", key: "REMOVE_FOREIGN_OBJECT_WHEN_DOWNLOAD_SVG" },
                { label: "尽力解决样式兼容性问题", key: "COMPATIBLE_STYLE_WHEN_DOWNLOAD_SVG" },
                { label: "导出后自动打开文件所在目录", key: "SHOW_IN_FINDER_WHEN_DOWNLOAD_SVG" },
            ]
            return [
                { fieldset, type: "number", inline: true, min: 1, max: 1000, step: 1, ...borderKV("水平内边距", 0) },
                { fieldset, type: "number", inline: true, min: 1, max: 1000, step: 1, ...borderKV("垂直内边距", 1) },
                { fieldset, type: "input", inline: true, placeholder: this.utils.tempFolder, ...inputKV("导出目录", "FOLDER_WHEN_DOWNLOAD_SVG") },
                { fieldset, type: "input", inline: true, ...inputKV("导出文件", "FILENAME_WHEN_DOWNLOAD_SVG") },
                { fieldset, label: "", ...checkboxKV(components) },
            ]
        }

        const components = [color(), ...ranges(), ability(), ...download()];
        const { response } = await this.utils.dialog.modalAsync({ title: "设置", width: "500px", components });
        if (response === 1) {
            components.forEach(c => c.callback(c.submit));
            await this.redraw(this.markmap.options);
            const update = this.utils.fromObject(this.config, needUpdateKey);
            await this.utils.saveConfig(this.controller.fixedName, update);
        }
    }

    download = async () => {
        const _parseCSS = css => new DOMParser().parseFromString(`<style>${css}</style>`, "text/html").querySelector("style");
        const _replaceStyleContent = (el, cssText) => {
            el.innerHTML = "";
            el.appendChild(document.createTextNode(cssText));
        }

        const removeForeignObject = svg => {
            svg.querySelectorAll("foreignObject").forEach(foreign => {
                const x = parseInt(foreign.getAttribute("width")) + parseInt(foreign.getAttribute("x")) - 2;
                const y = parseInt(foreign.closest("g").querySelector("line").getAttribute("y1")) - 4;
                // const y = 16;

                const text = document.createElement("text");
                text.setAttribute("x", x);
                text.setAttribute("y", y);
                text.setAttribute("text-anchor", "end");
                const katex = foreign.querySelector(".katex-html");
                text.textContent = katex ? katex.textContent : foreign.textContent;
                foreign.parentNode.replaceChild(text, foreign);
            })
        }

        const removeClassName = svg => svg.querySelectorAll(".markmap-node").forEach(ele => ele.removeAttribute("class"))

        // 有些SVG解析器无法解析CSS变量
        const compatibleStyle = svg => {
            svg.querySelectorAll('circle[fill="var(--markmap-circle-open-bg)"]').forEach(ele => ele.setAttribute("fill", "#fff"));
            const style = svg.querySelector("style");
            let css = style.textContent;
            _parseCSS(css).sheet.cssRules[0].styleMap.forEach((value, key) => {
                if (key.startsWith("--")) {
                    css = css.replace(new RegExp(`var\\(${key}\\);?`, "g"), value[0][0] + ";");
                }
            })
            css = css.replace(/--[a-zA-Z\-]+?\s*?:\s*?.+?;/g, "").replace(/\s+/g, " ");
            _replaceStyleContent(style, css);
        }

        const removeUselessStyle = svg => {
            const sheet = [];
            const filter = new Set([
                ".markmap-dark .markmap",
                ".markmap-node > circle",
                ".markmap-foreign svg",
                ".markmap-foreign img",
                ".markmap-foreign pre",
                ".markmap-foreign pre > code",
                ".markmap-foreign-testing-max",
                ".markmap-foreign-testing-max img",
                ".markmap-foreign table, .markmap-foreign th, .markmap-foreign td",
            ])
            const rules = _parseCSS(this.controller.MarkmapLib.globalCSS).sheet.cssRules;
            for (const rule of rules) {
                if (!filter.has(rule.selectorText)) {
                    sheet.push(rule.cssText);
                }
            }
            _replaceStyleContent(svg.querySelector("style"), sheet.join(" "));
        }

        const getBounding = svg => {
            const { width, height } = this.entities.svg.querySelector("g").getBoundingClientRect();
            const match = svg.querySelector("g").getAttribute("transform").match(/scale\((?<scale>.+?\))/);
            if (!match || !match.groups || !match.groups.scale) return {};
            const scale = parseFloat(match.groups.scale);
            const realWidth = parseInt(width / scale);
            const realHeight = parseInt(height / scale);

            let minY = 0, maxY = 0;
            svg.querySelectorAll("g.markmap-node").forEach(node => {
                const match = node.getAttribute("transform").match(/translate\((?<x>.+?),\s(?<y>.+?)\)/);
                if (!match || !match.groups || !match.groups.x || !match.groups.y) return;
                const y = parseInt(match.groups.y);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            })

            return { minX: 0, maxX: realWidth, width: realWidth, minY: minY, maxY: maxY, height: realHeight }
        }

        const settAttr = svg => {
            svg.removeAttribute("id");
            svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            svg.setAttribute("class", "markmap");
        }

        const setSize = svg => {
            const { width = 100, height = 100, minY = 0 } = getBounding(svg);
            const [borderX, borderY] = this.config.BORDER_WHEN_DOWNLOAD_SVG;
            const svgWidth = width + borderX;
            const svgHeight = height + borderY;
            svg.setAttribute("width", svgWidth + "");
            svg.setAttribute("height", svgHeight + "");
            svg.setAttribute("viewBox", `0 ${minY} ${svgWidth} ${svgHeight}`);
            svg.querySelector("g").setAttribute("transform", `translate(${borderX / 2}, ${borderY / 2})`);
        }

        const getFileFolder = () => this.config.FOLDER_WHEN_DOWNLOAD_SVG || this.utils.tempFolder

        const getFileName = () => {
            const tpl = {
                filename: this.utils.getFileName() || "markmap",
                timestamp: new Date().getTime().toString(),
                uuid: this.utils.getUUID(),
            }
            const filename = this.config.FILENAME_WHEN_DOWNLOAD_SVG || "{{filename}}.svg";
            return filename.replace(/\{\{([\S\s]+?)\}\}/g, (origin, arg) => tpl[arg.trim().toLowerCase()] || origin)
        }

        const download = async svg => {
            const content = svg.outerHTML.replace(/&gt;/g, ">");
            const path = this.utils.Package.Path.join(getFileFolder(), getFileName());
            const ok = await this.utils.writeFile(path, content);
            if (!ok) return;
            if (this.config.SHOW_IN_FINDER_WHEN_DOWNLOAD_SVG) {
                this.utils.showInFinder(path);
            } else {
                this.utils.notification.show("已导出到指定目录");
            }
        }

        const svg = this.entities.svg.cloneNode(true);
        settAttr(svg);
        setSize(svg);
        removeUselessStyle(svg);
        if (this.config.COMPATIBLE_STYLE_WHEN_DOWNLOAD_SVG) {
            compatibleStyle(svg);
        }
        if (this.config.REMOVE_FOREIGN_OBJECT_WHEN_DOWNLOAD_SVG) {
            removeForeignObject(svg);
        }
        if (this.config.REMOVE_USELESS_CLASS_NAME_WHEN_DOWNLOAD_SVG) {
            removeClassName(svg);
        }
        await download(svg);
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
        const md = this.controller.getToc();
        await this._create(md, options);
    }

    draw = async (fit = true, options = null) => {
        const md = this.controller.getToc();
        if (md !== undefined) {
            await this._draw(md, fit, options);
        }
    }

    isShow = () => this.utils.isShow(this.entities.modal)

    _draw = async (md, fit = true, options) => {
        this.utils.show(this.entities.modal);
        if (this.markmap) {
            await this._update(md, fit);
        } else {
            this._initModalRect();
            await this.controller.lazyLoad();
            await this._create(md, options);
        }
    }

    _create = async (md, options) => {
        options = this.controller.assignOptions(this.config.DEFAULT_TOC_OPTIONS, options);
        const { root } = this.MarkmapLib.transformer.transform(md);
        this.markmap = this.MarkmapLib.Markmap.create(this.entities.svg, options, root);
    }

    _update = async (md, fit = true) => {
        const { root } = this.MarkmapLib.transformer.transform(md);
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
        if (!this.config.REMEMBER_FOLD_WHEN_UPDATE) return;

        const _walk = (fn, node, parent) => {
            fn(node, parent);
            for (const child of node.children) {
                _walk(fn, child, node);
            }
        }

        const _setPath = (node, parent) => {
            const parentPath = (parent && parent.__path) || "";
            node.__path = parentPath + "\n" + node.content;
        }

        const fold = new Set();
        const _collect = node => {
            const { payload, __path } = node;
            if (payload && payload.fold && __path) {
                fold.add(__path);
            }
        }
        const _reset = node => {
            if (fold.has(node.__path)) {
                node.payload.fold = 1;
            }
        }

        const { data: oldRoot } = this.markmap.state || {};
        _walk(_setPath, oldRoot);
        _walk(_setPath, newRoot);
        _walk(_collect, oldRoot);
        _walk(_reset, newRoot);
    }

    _fixConfig = () => {
        const { DEFAULT_TOC_OPTIONS: op } = this.config;
        op.color = op.color.map(e => e.toUpperCase());
        if (op.initialExpandLevel < 0) {
            op.initialExpandLevel = 6;
        } else if (op.initialExpandLevel === 0) {
            op.initialExpandLevel = 1;
        }
    }

    _onButtonClick = async (action, button) => {
        if (!["pinTop", "pinRight", "fit", "download", "penetrateMouse", "setting", "showToolbar", "hideToolbar"].includes(action)) {
            await this._waitUnpin();
        }
        const arg = (action === "pinTop" || action === "pinRight") ? false : undefined;
        await this[action](arg);
    }

    _setModalRect = rect => {
        if (!rect) return;
        const { left, top, height, width } = rect;
        const s = { left: `${left}px`, top: `${top}px`, height: `${height}px`, width: `${width}px` };
        Object.assign(this.entities.modal.style, s);
    }

    _setFullScreenIcon = fullScreen => {
        this.entities.modal.classList.toggle("noBoxShadow", fullScreen);
        this.entities.fullScreen.setAttribute("action", fullScreen ? "shrink" : "expand");
        this.utils.toggleVisible(this.entities.resize, fullScreen);
        this.fit();
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

module.exports = {
    plugin: markmapPlugin
};