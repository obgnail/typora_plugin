class markmapPlugin extends BasePlugin {
    beforeProcess = () => {
        this.tocMarkmap = this.config.ENABLE_TOC_MARKMAP ? new tocMarkmap(this) : null;
        this.fenceMarkmap = this.config.ENABLE_FENCE_MARKMAP ? new fenceMarkmap(this) : null;
        this.transformer = null;
        this.Markmap = null;
    }

    styleTemplate = () => ({
        node_hover: !this.config.CLICK_TO_LOCALE ? "" : `#plugin-markmap-svg .markmap-node:hover { cursor: pointer; }`,
        show_outline: !this.config.SHOW_BORDER_WHEN_NODE_HOVER ? "" : `#plugin-markmap-svg .markmap-node .markmap-foreign:hover { outline: ${this.config.BORDER_STYLE_WHEN_NODE_HOVER}; }`,
        icon_wrap: !this.config.ALLOW_ICON_WRAP ? "" : `.plugin-markmap-header { flex-wrap: wrap; justify-content: flex-start; }`,
    })

    html = () => this.tocMarkmap && this.tocMarkmap.html();

    hotkey = () => [this.tocMarkmap, this.fenceMarkmap].map(p => p && p.hotkey()).filter(Boolean).flat()

    init = () => {
        this.callArgs = [];
        this.tocMarkmap && this.callArgs.push({arg_name: "思维导图", arg_value: "toggle_toc"});
        this.fenceMarkmap && this.callArgs.push(
            {arg_name: "插入markmap：大纲", arg_value: "draw_fence_outline"},
            {arg_name: "插入markmap：模板", arg_value: "draw_fence_template"},
        );
    }

    process = async () => {
        this.tocMarkmap && await this.tocMarkmap.process();
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
        const {headers} = File.editor.nodeMap.toc || {};
        if (!headers) return;

        const result = [];
        for (const header of headers) {
            const {pattern, text = ""} = (header && header.attributes) || {};
            if (pattern) {
                result.push(pattern.replace("{0}", text));
            }
        }
        return result.join("\n")
    }

    onButtonClick = () => this.tocMarkmap && this.tocMarkmap.callback()

    lazyLoad = async () => {
        if (this.transformer && this.Markmap) return;

        // markmap-lib太大了，我把他打包了
        const {markmapLib} = this.utils.requireFilePath("./plugin/markmap/resource/markmap-lib.js");
        await this.utils.insertScript("./plugin/markmap/resource/d3_6.js");
        await this.utils.insertScript("./plugin/markmap/resource/markmap-view.js");

        this.transformer = new markmapLib.Transformer();
        const {Markmap, loadCSS, loadJS} = markmap;
        this.Markmap = Markmap;
        const {styles, scripts} = this.transformer.getAssets();
        if (this.config.RESOURCE_FROM === "network") {
            if (styles) loadCSS(styles);
            if (scripts) loadJS(scripts, {getMarkmap: () => markmap});
        } else {
            this.utils.insertStyleFile("markmap-default-style", "./plugin/markmap/resource/default.min.css");
            this.utils.insertStyleFile("markmap-katex-style", "./plugin/markmap/resource/katex.min.css");

            const loadScript = scripts.filter(script => script["type"] !== "script");
            if (scripts) loadJS(loadScript, {getMarkmap: () => markmap});
            await this.utils.insertScript("./plugin/markmap/resource/webfontloader.js");
        }
    }

    getFrontMatter = content => {
        const {yamlObject} = this.utils.splitFrontMatter(content);
        if (!yamlObject) return;
        const attr = Object.keys(yamlObject).find(attr => attr.toLowerCase() === "markmap");
        const options = attr ? yamlObject[attr] : yamlObject;
        const defaultOptions = {
            colorFreezeLevel: 0, duration: 500, initialExpandLevel: -1, zoom: true, pan: true,
            height: "300px", backgroundColor: "#f8f8f8",
        };
        return Object.assign(defaultOptions, options);
    }
}

class fenceMarkmap {
    constructor(controller) {
        this.controller = controller
        this.utils = this.controller.utils;
        this.config = this.controller.config;
        this.map = {}; // {cid: instance}
        this.defaultFrontMatter = `---\nmarkmap:\n  zoom: false\n  pan: false\n  height: 300px\n  backgroundColor: "#f8f8f8"\n---\n\n`;
    }

    process = () => {
        this.utils.registerDiagramParser(
            this.config.LANGUAGE,
            false,
            this.render,
            this.cancel,
            this.destroyAll,
            null,
            this.config.INTERACTIVE_MODE
        );
    }

    call = async type => this.callback(type)

    callback = type => {
        const md = type === "draw_fence_template" ? this.config.FENCE_TEMPLATE : this.getToc();
        this.utils.insertText(null, md);
    }

    hotkey = () => [{hotkey: this.config.FENCE_HOTKEY, callback: this.callback}]

    wrapFenceCode = content => "```" + this.config.LANGUAGE + "\n" + this.defaultFrontMatter + content + "\n" + "```"
    getToc = () => this.wrapFenceCode(this.controller.getToc() || "# empty")

    render = async (cid, content, $pre) => {
        if (!this.controller.transformer || !this.controller.Markmap) {
            await this.controller.lazyLoad();
        }
        const options = this.getFrontMatter(content);
        const svg = this.createSvg($pre, options);
        if (this.map.hasOwnProperty(cid)) {
            await this.update(cid, content, options);
        } else {
            await this.create(cid, svg, content, options);
        }
    }
    cancel = cid => {
        const instance = this.map[cid];
        if (instance) {
            instance.destroy();
            delete this.map[cid];
        }
    };
    destroyAll = () => {
        for (const instance of Object.values(this.map)) {
            instance.destroy();
        }
        this.map = {};
    };

    createSvg = ($pre, options) => {
        let svg = $pre.find(".plugin-fence-markmap-svg");
        if (svg.length === 0) {
            svg = $(`<svg class="plugin-fence-markmap-svg"></svg>`);
        }
        svg.css({
            "width": parseFloat($pre.find(".md-diagram-panel").css("width")) - 10 + "px",
            "height": options.height || this.config.DEFAULT_FENCE_HEIGHT,
            "background-color": options.backgroundColor || this.config.DEFAULT_FENCE_BACKGROUND_COLOR,
        });
        $pre.find(".md-diagram-panel-preview").html(svg);
        return svg
    }

    getFrontMatter = content => this.controller.getFrontMatter(content) || this.config.DEFAULT_FENCE_OPTIONS || {};

    create = async (cid, svg, md, options) => {
        const {root} = this.controller.transformer.transform(md);
        this.map[cid] = this.controller.Markmap.create(svg[0], options, root);
        setTimeout(() => this.map[cid] && this.map[cid].fit(), 200);
    }

    update = async (cid, md, options) => {
        const instance = this.map[cid];
        const {root} = this.controller.transformer.transform(md);
        instance.setData(root);
        instance.setOptions(options);
        await instance.fit();
    }
}

class tocMarkmap {
    constructor(controller) {
        this.controller = controller
        this.utils = this.controller.utils;
        this.config = this.controller.config;
    }

    html = () => `
        <div id="plugin-markmap" class="plugin-common-modal plugin-common-hidden">
            <div class="plugin-markmap-wrap">
                <div class="plugin-markmap-grip grip-right plugin-common-hidden"></div>
                <div class="plugin-markmap-header">
                    <div class="plugin-markmap-icon ion-close" action="close" ty-hint="关闭"></div>
                    <div class="plugin-markmap-icon ion-qr-scanner" action="expand" ty-hint="全屏"></div>
                    <div class="plugin-markmap-icon ion-arrow-move" action="move" ty-hint="移动（ctrl+drag也可以移动）"></div>
                    <div class="plugin-markmap-icon ion-cube" action="fit" ty-hint="图表重新适配窗口"></div>
                    <div class="plugin-markmap-icon ion-network" action="setExpandLevel" ty-hint="展开分支等级"></div>
                    <div class="plugin-markmap-icon ion-android-hand" action="penetrateMouse" ty-hint="鼠标穿透"></div>
                    <div class="plugin-markmap-icon ion-archive" action="download" ty-hint="下载"></div>
                    <div class="plugin-markmap-icon ion-chevron-up" action="pinUp" ty-hint="固定到顶部"></div>
                    <div class="plugin-markmap-icon ion-chevron-right" action="pinRight" ty-hint="固定到右侧"></div>
                </div>
                <svg id="plugin-markmap-svg"></svg>
                <div class="plugin-markmap-icon ion-android-arrow-down-right" action="resize" ty-hint="拖动调整大小"></div>
            </div>
            <div class="plugin-markmap-grip grip-up plugin-common-hidden"></div>
        </div>
    `

    hotkey = () => [{hotkey: this.config.TOC_HOTKEY, callback: this.callback}]

    init = () => {
        this.markmap = null;
        this.editor = null;

        this.modalOriginRect = null;
        this.contentOriginRect = null;
        this.pinUtils = {
            isPinUp: false,
            isPinRight: false,
            init: async () => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        this.modalOriginRect = this.entities.modal.getBoundingClientRect();
                        this.contentOriginRect = this.entities.content.getBoundingClientRect();
                        resolve();
                    }, 200)
                })
            }
        }

        this.entities = {
            content: document.querySelector("content"),
            modal: document.querySelector("#plugin-markmap"),
            header: document.querySelector("#plugin-markmap .plugin-markmap-header"),
            gripUp: document.querySelector("#plugin-markmap .plugin-markmap-grip.grip-up"),
            gripRight: document.querySelector("#plugin-markmap .plugin-markmap-grip.grip-right"),
            svg: document.querySelector("#plugin-markmap-svg"),
            resize: document.querySelector('.plugin-markmap-icon[action="resize"]'),
            fullScreen: document.querySelector('.plugin-markmap-icon[action="expand"]'),
        }
    }

    process = async () => {
        this.init();

        this.utils.addEventListener(this.utils.eventType.outlineUpdated, () => this.utils.isShow(this.entities.modal) && this.drawToc(this.config.AUTO_FIT_WHEN_UPDATE));
        this.utils.addEventListener(this.utils.eventType.toggleSettingPage, hide => hide && this.markmap && this.onButtonClick("close"));
        this.entities.content.addEventListener("transitionend", this.fit);
        this.entities.modal.addEventListener("transitionend", this.fit);

        this.onDrag();
        this.onResize();
        this.onToggleSidebar();
        this.onHeaderClick();
        this.onSvgClick();
        this.onContextMenu();
    }

    callback = () => this.utils.isShow(this.entities.modal) ? this.onButtonClick("close") : this.drawToc()

    call = async type => type === "draw_toc" && await this.drawToc()

    close = () => {
        this.entities.modal.style = "";
        this.utils.hide(this.entities.modal);
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
        await this.redrawToc(options);
        this.entities.modal.classList.toggle("penetrateMouse", !options.zoom && !options.pan);
    }

    _setExpandLevel = async level => {
        level = parseInt(level);
        const options = this.markmap.options;
        options.initialExpandLevel = isNaN(level) ? 1 : level;
        await this.redrawToc(options);
    }

    getMaxLevel = () => {
        let maxDepth = 0;
        const getDepth = data => {
            maxDepth = Math.max(maxDepth, data.depth);
            data.children && data.children.forEach(getDepth);
        }
        getDepth(this.markmap.state.data);
        return maxDepth
    }

    setExpandLevel = async () => {
        const maxLevel = this.getMaxLevel() || 6;
        let level = this.markmap && this.markmap.options.initialExpandLevel;
        if (level === undefined) {
            level = 1;
        } else if (level < 0) {
            level = maxLevel;
        }
        const components = [{label: "", type: "range", value: level, min: 0, max: maxLevel, step: 1}];
        this.utils.modal({title: "展开分支", components}, async ([{submit: level}]) => this._setExpandLevel(level));
    }

    download = () => {
        const removeSvgForeignObject = svg => {
            svg.querySelectorAll("foreignObject").forEach(foreign => {
                const {textContent, previousSibling} = foreign;
                const text = document.createElement("text");
                const [xAttr, yAttr] = (previousSibling.tagName === "line") ? ["x2", "y2"] : ["cx", "cy"];
                const x = parseInt(previousSibling.getAttribute(xAttr)) - 12;
                const y = parseInt(previousSibling.getAttribute(yAttr)) - 5;
                text.setAttribute("x", x);
                text.setAttribute("y", y);
                text.setAttribute("text-anchor", "end");
                text.textContent = textContent;
                foreign.parentNode.replaceChild(text, foreign);
            })
        }

        const removeSvgUselessStyle = svg => {
            const style = svg.querySelector("style");
            if (style) {
                style.textContent = style.textContent.replace(".markmap-node>circle{cursor:pointer}", "");
            }
        }

        const getSvgBounding = svg => {
            const {width, height} = this.entities.svg.querySelector("g").getBoundingClientRect();
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

            return {minX: 0, maxX: realWidth, width: realWidth, minY: minY, maxY: maxY, height: realHeight}
        }

        const setSvgSize = svg => {
            const {width = 100, height = 100, minY = 0} = getSvgBounding(svg);
            const [borderX, borderY] = this.config.BORDER_WHEN_DOWNLOAD_SVG;
            const svgWidth = width + borderX;
            const svgHeight = height + borderY;
            svg.removeAttribute("id");
            svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            svg.setAttribute("class", "markmap");
            svg.setAttribute("width", svgWidth + "");
            svg.setAttribute("height", svgHeight + "");
            svg.setAttribute("viewBox", `0 ${minY} ${svgWidth} ${svgHeight}`);
            svg.querySelector("g").setAttribute("transform", `translate(${borderX / 2}, ${borderY / 2})`);
        }

        const download = svg => {
            const svgHTML = svg.outerHTML.replace(/<br>/g, "<br/>");
            const a = document.createElement("a");
            const fileName = this.utils.getFileName() || "markmap";
            a.download = fileName + ".svg";
            a.href = "data:image/svg;utf8," + encodeURIComponent(svgHTML);
            document.body.appendChild(a);
            a.click();
            setTimeout(() => document.body.removeChild(a), 100);
        }

        const svg = this.entities.svg.cloneNode(true);
        setSvgSize(svg);
        removeSvgUselessStyle(svg);
        if (this.config.REMOVE_FOREIGN_OBJECT_WHEN_DOWNLOAD_SVG) {
            removeSvgForeignObject(svg);
        }
        download(svg);
    }

    pinUp = async (draw = true) => {
        this.entities.modal.classList.toggle("pinUp");
        const button = document.querySelector('.plugin-markmap-icon[action="pinUp"]');
        this.pinUtils.isPinUp = !this.pinUtils.isPinUp;
        if (this.pinUtils.isPinUp) {
            if (this.pinUtils.isPinRight) {
                await this.pinRight(false);
            }

            await this.pinUtils.init();
            const {top, height, width, left} = this.contentOriginRect;
            const newHeight = height * this.config.HEIGHT_PRECENT_WHEN_PIN_UP / 100;
            this.entities.modal.classList.add("noBoxShadow");
            Object.assign(this.entities.modal.style, {
                left: `${left}px`,
                width: `${width}px`,
                top: `${top}px`,
                height: `${newHeight}px`,
            });
            this.entities.content.style.top = `${top + newHeight}px`;
            this.utils.show(this.entities.gripUp);
            button.classList.replace("ion-chevron-up", "ion-ios7-undo");
            button.setAttribute("ty-hint", "还原窗口");
        } else {
            this.setModalRect(this.modalOriginRect);
            this.entities.modal.classList.remove("noBoxShadow");
            this.entities.content.style.top = `${this.contentOriginRect.top}px`;
            this.utils.hide(this.entities.gripUp);
            button.classList.replace("ion-ios7-undo", "ion-chevron-up");
            button.setAttribute("ty-hint", "固定到顶部");
        }
        if (draw) {
            await this.drawToc();
        }
    }

    pinRight = async (draw = true) => {
        this.entities.modal.classList.toggle("pinRight");
        const button = document.querySelector('.plugin-markmap-icon[action="pinRight"]');
        const write = document.querySelector("#write");
        this.pinUtils.isPinRight = !this.pinUtils.isPinRight;
        if (this.pinUtils.isPinRight) {
            if (this.pinUtils.isPinUp) {
                await this.pinUp(false);
            }

            await this.pinUtils.init();
            const {top, width, height, right} = this.contentOriginRect;
            const newWidth = width * this.config.WIDTH_PRECENT_WHEN_PIN_RIGHT / 100;
            this.entities.modal.classList.add("noBoxShadow");
            Object.assign(this.entities.modal.style, {
                top: `${top}px`,
                right: `${right}px`,
                left: `${right - newWidth}px`,
                height: `${height}px`,
                width: `${newWidth}px`,
            });
            Object.assign(this.entities.content.style, {
                right: `${right - newWidth}px`,
                width: `${width - newWidth}px`
            });
            write.style.width = "initial";
            this.utils.show(this.entities.gripRight);
            button.classList.replace("ion-chevron-right", "ion-ios7-undo");
            button.setAttribute("ty-hint", "还原窗口");
        } else {
            this.setModalRect(this.modalOriginRect);
            this.entities.modal.classList.remove("noBoxShadow");
            this.entities.content.style.width = "";
            this.entities.content.style.right = "";
            write.style.width = "";
            this.utils.hide(this.entities.gripRight);

            button.classList.replace("ion-ios7-undo", "ion-chevron-right");
            button.setAttribute("ty-hint", "固定到右侧");
        }
        if (draw) {
            await this.drawToc();
        }
    }

    _waitUnpin = async () => {
        if (this.pinUtils.isPinUp) {
            await this.pinUp();
        }
        if (this.pinUtils.isPinRight) {
            await this.pinRight();
        }
    }

    cleanTransition = (run = true) => run ? this.entities.modal.style.transition = "none" : undefined
    rollbackTransition = (run = true) => run ? this.entities.modal.style.transition = "" : undefined

    toggleToolbar = show => {
        this.utils.toggleVisible(this.entities.header, !show);
        this.fit();
    }
    hideToolbar = () => this.toggleToolbar(false)
    showToolbar = () => this.toggleToolbar(true)

    onButtonClick = async (action, button) => {
        if (!["pinUp", "pinRight", "fit", "download", "penetrateMouse", "setExpandLevel"].includes(action)) {
            await this._waitUnpin();
        }
        await this[action](button);
    }

    onToggleSidebar = () => {
        this.utils.addEventListener(this.utils.eventType.afterToggleSidebar, () => {
            if (!this.markmap) return
            const func = ["pinUp", "pinRight"].find(func => this.entities.modal.classList.contains(func));
            if (!func) return
            setTimeout(async () => {
                await this[func]();
                await this[func]();
            }, 300)
        })
    }

    onContextMenu = () => {
        const menuMap = {
            expand: "全屏", shrink: "取消全屏", fit: "图形适配窗口", download: "下载", setExpandLevel: "设置展开等级",
            close: "关闭", pinUp: "固定到顶部", pinRight: "固定到右侧", hideToolbar: "隐藏工具栏", showToolbar: "显示工具栏",
        };
        const showMenu = () => {
            const fullScreen = this.entities.fullScreen.getAttribute("action");
            const toolbarVisibility = this.utils.isHidden(this.entities.header) ? "showToolbar" : "hideToolbar";
            return this.utils.fromObject(menuMap, [toolbarVisibility, "fit", fullScreen, "pinUp", "pinRight", "setExpandLevel", "download", "close"])
        }
        const callback = ({key}) => this.onButtonClick(key);
        this.utils.registerMenu("markmap", "#plugin-markmap-svg", showMenu, callback);
    }

    onDrag = () => {
        const moveElement = this.entities.header.querySelector(`.plugin-markmap-icon[action="move"]`);
        const hint = "ty-hint";
        const value = moveElement.getAttribute(hint);
        const onMouseDown = () => {
            moveElement.removeAttribute(hint);
            this.cleanTransition(!this.config.USE_ANIMATION_WHEN_DRAG);
            this._waitUnpin();
        }
        const onMouseUp = () => {
            moveElement.setAttribute(hint, value);
            this.rollbackTransition(!this.config.USE_ANIMATION_WHEN_DRAG);
        }
        const dragModal = (handleElement, withMetaKey) => {
            this.utils.dragFixedModal(handleElement, this.entities.modal, withMetaKey, onMouseDown, null, onMouseUp);
        }

        // 提供两种拖拽的方式
        dragModal(moveElement, false);
        dragModal(this.entities.modal, true);
    }

    onResize = () => {
        const getModalMinHeight = () => {
            const one = this.entities.header.firstElementChild.getBoundingClientRect().height;
            const count = (this.config.ALLOW_ICON_WRAP) ? 1 : this.entities.header.childElementCount;
            return one * count
        }

        const getModalMinWidth = () => {
            const {marginLeft, paddingRight} = document.defaultView.getComputedStyle(this.entities.header);
            const headerWidth = this.entities.header.getBoundingClientRect().width;
            const _marginRight = (this.config.ALLOW_ICON_WRAP) ? 0 : parseFloat(paddingRight);
            return parseFloat(marginLeft) + headerWidth + _marginRight
        }

        const onMouseUp = () => {
            this.rollbackTransition(!this.config.USE_ANIMATION_WHEN_RESIZE);
            this.fit();
        }

        // 自由移动时调整大小
        {
            const attr = "ty-hint";
            let deltaHeight = 0;
            let deltaWidth = 0;
            let hint = this.entities.resize.getAttribute(attr);
            const onMouseDown = (startX, startY, startWidth, startHeight) => {
                this.entities.resize.removeAttribute(attr);
                this.cleanTransition(!this.config.USE_ANIMATION_WHEN_RESIZE);
                deltaHeight = getModalMinHeight() - startHeight;
                deltaWidth = getModalMinWidth() - startWidth;
            }
            const onMouseMove = (deltaX, deltaY) => {
                deltaY = Math.max(deltaY, deltaHeight);
                deltaX = Math.max(deltaX, deltaWidth);
                return {deltaX, deltaY}
            }
            const onMouseUp = async () => {
                this.entities.resize.setAttribute(attr, hint);
                this.rollbackTransition(!this.config.USE_ANIMATION_WHEN_RESIZE);
                await this._waitUnpin();
                this.setFullScreenIcon(false);
            }
            this.utils.resizeFixedModal(this.entities.resize, this.entities.modal, true, true, onMouseDown, onMouseMove, onMouseUp);
        }

        // 固定到顶部时调整大小
        {
            let contentStartTop = 0;
            let contentMinTop = 0;
            const onMouseDown = () => {
                this.cleanTransition(!this.config.USE_ANIMATION_WHEN_RESIZE);
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
                return {deltaX, deltaY}
            }
            this.utils.resizeFixedModal(this.entities.gripUp, this.entities.modal, false, true, onMouseDown, onMouseMove, onMouseUp);
        }

        // 固定到右侧时调整大小
        {
            let contentStartRight = 0;
            let contentStartWidth = 0;
            let modalStartLeft = 0;
            let contentMaxRight = 0;
            const onMouseDown = () => {
                this.cleanTransition(!this.config.USE_ANIMATION_WHEN_RESIZE);

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
                return {deltaX, deltaY}
            }
            this.utils.resizeFixedModal(this.entities.gripRight, this.entities.modal, true, false, onMouseDown, onMouseMove, onMouseUp);
        }
    }

    onHeaderClick = () => {
        this.entities.header.addEventListener("click", ev => {
            const button = ev.target.closest(".plugin-markmap-icon");
            if (!button) return
            ev.stopPropagation();
            ev.preventDefault();
            const action = button.getAttribute("action");
            if (action !== "move" && this[action]) {
                this.onButtonClick(action, button);
            }
        })
    }

    onSvgClick = () => {
        if (!this.config.CLICK_TO_LOCALE) return;
        this.entities.svg.addEventListener("click", ev => {
            if (ev.target.closest("circle")) return;
            const target = ev.target.closest(".markmap-node");
            if (!target) return;
            ev.stopPropagation();
            ev.preventDefault();
            const headers = File.editor.nodeMap.toc.headers;
            if (!headers || headers.length === 0) return;
            const list = target.getAttribute("data-path").split(".");
            if (!list) return;
            const nodeIdx = list[list.length - 1];
            let tocIdx = parseInt(nodeIdx - 1); // markmap节点的索引从1开始，要-1
            if (!this.markmap.state.data.content) {
                tocIdx--; // 若markmap第一个节点是空节点，再-1
            }
            const header = headers[tocIdx];
            if (header) {
                const cid = header.attributes.id;
                const {height: contentHeight, top: contentTop} = this.entities.content.getBoundingClientRect();
                const height = contentHeight * this.config.LOCALE_HIGHT_RATIO + contentTop;
                this.utils.scrollByCid(cid, height);
            }
        })
    }

    expand = () => {
        this.modalOriginRect = this.entities.modal.getBoundingClientRect();
        this.setModalRect(this.entities.content.getBoundingClientRect());
        this.setFullScreenIcon(true);
    }

    shrink = () => {
        this.setModalRect(this.modalOriginRect);
        this.setFullScreenIcon(false);
    }

    setFullScreenIcon = fullScreen => {
        this.entities.modal.classList.toggle("noBoxShadow", fullScreen);
        this.entities.fullScreen.setAttribute("action", fullScreen ? "shrink" : "expand");
        this.fit();
    }

    setModalRect = rect => {
        if (!rect) return;
        const {left, top, height, width} = rect;
        Object.assign(this.entities.modal.style, {
            left: `${left}px`,
            top: `${top}px`,
            height: `${height}px`,
            width: `${width}px`
        });
    }

    drawToc = async (fit = true, options = null) => {
        const md = this.controller.getToc();
        if (md !== undefined) {
            await this.draw(md, fit, options);
        }
    }

    redrawToc = async options => {
        this.markmap.destroy();
        const md = this.controller.getToc();
        await this.create(md, options);
    }

    _initModalRect = () => {
        const {left, width, height} = this.entities.content.getBoundingClientRect();
        const {LEFT_PERCENT_WHEN_INIT, WIDTH_PERCENT_WHEN_INIT, HEIGHT_PERCENT_WHEN_INIT} = this.config;
        Object.assign(this.entities.modal.style, {
            left: `${left + width * LEFT_PERCENT_WHEN_INIT / 100}px`,
            width: `${width * WIDTH_PERCENT_WHEN_INIT / 100}px`,
            height: `${height * HEIGHT_PERCENT_WHEN_INIT / 100}px`
        });
    }

    draw = async (md, fit = true, options = null) => {
        this.utils.show(this.entities.modal);
        if (this.markmap) {
            await this.update(md, fit);
        } else {
            this._initModalRect();
            await this.controller.lazyLoad();
            await this.create(md, options);
        }
    }

    create = async (md, options) => {
        const {root} = this.controller.transformer.transform(md);
        options = options || this.config.DEFAULT_TOC_OPTIONS || null;
        this.markmap = this.controller.Markmap.create(this.entities.svg, options, root);
    }

    update = async (md, fit = true) => {
        const {root} = this.controller.transformer.transform(md);
        this.markmap.setData(root);
        if (fit) {
            await this.markmap.fit();
        }
    }
}

module.exports = {
    plugin: markmapPlugin
};