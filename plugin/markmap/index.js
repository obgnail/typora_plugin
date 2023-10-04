class markmapPlugin extends global._basePlugin {
    beforeProcess = () => {
        this.tocMarkmap = (this.config.ENABLE_TOC_MARKMAP) ? new tocMarkmap(this) : null;
        this.fenceMarkmap = (this.config.ENABLE_FENCE_MARKMAP) ? new fenceMarkmap(this) : null;
        this.transformer = null;
        this.Markmap = null;
    }

    styleTemplate = () => ({
        icon_wrap: (!this.config.ALLOW_ICON_WRAP) ? "" : `
            .plugin-markmap-header { flex-wrap: wrap; justify-content: flex-start; }
            .plugin-markmap-header .plugin-markmap-icon { padding-right: 0.5em; }
            `
    })

    html = () => this.tocMarkmap && this.tocMarkmap.html();

    init = () => {
        this.callArgs = [];
        this.tocMarkmap && this.callArgs.push({arg_name: "展示思维导图", arg_value: "draw_toc"});
        this.fenceMarkmap && this.callArgs.push({arg_name: "插入markmap", arg_value: "draw_fence"});
    }

    process = async () => {
        this.init();
        this.tocMarkmap && await this.tocMarkmap.process();
        this.fenceMarkmap && this.fenceMarkmap.process();
    }

    call = async type => {
        if (type === "draw_toc") {
            this.tocMarkmap && await this.tocMarkmap.call(type);
        } else if (type === "draw_fence") {
            this.fenceMarkmap && await this.fenceMarkmap.call(type);
        }
    }

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
}

class fenceMarkmap {
    constructor(controller) {
        this.controller = controller
        this.utils = this.controller.utils;
        this.config = this.controller.config;
        this.map = {}; // {cid: instance}
    }

    process = () => {
        this.utils.registerDiagramParser("markmap", false, this.render, this.cancel, this.destroyAll, null, this.config.INTERACTIVE_MODE);
    }

    call = async type => type === "draw_fence" && this.utils.insertText(null, this.config.FENCE_TEMPLATE)

    render = async (cid, content, $pre) => {
        if (!this.controller.transformer || !this.controller.Markmap) {
            await this.controller.lazyLoad();
        }
        if (this.map.hasOwnProperty(cid)) {
            await this.update(cid, content);
        } else {
            const svg = this.createSvg($pre);
            await this.create(cid, svg, content);
        }
    }
    cancel = async cid => {
        const instance = this.map[cid];
        if (instance) {
            instance.destroy();
            delete this.map[cid];
        }
    };
    destroyAll = () => {
        for (let cid of Object.keys(this.map)) {
            this.map[cid].destroy();
        }
        this.map = {};
    };

    createSvg = $pre => {
        let svg = $pre.find(".plugin-fence-markmap-svg");
        if (svg.length === 0) {
            svg = $(`<svg class="plugin-fence-markmap-svg"></svg>`);
        }
        svg.css({
            "width": parseInt($pre.find(".md-diagram-panel").css("width").replace("px", "")) - 10 + "px",
            "height": this.config.DEFAULT_FENCE_HEIGHT,
            "background-color": this.config.DEFAULT_FENCE_BACKGROUND_COLOR,
        });
        $pre.find(".md-diagram-panel-preview").html(svg);
        return svg
    }

    create = async (cid, svg, md) => {
        const {root} = this.controller.transformer.transform(md);
        this.map[cid] = this.controller.Markmap.create(svg[0], null, root);
        setTimeout(() => this.map[cid] && this.map[cid].fit(), 200);
    }

    update = async (cid, md) => {
        const instance = this.map[cid];
        const {root} = this.controller.transformer.transform(md);
        instance.setData(root);
        await instance.fit();
    }
}

class tocMarkmap {
    constructor(controller) {
        this.controller = controller
        this.utils = this.controller.utils;
        this.config = this.controller.config;
    }

    html = () => {
        const modal = document.createElement("div");
        modal.id = 'plugin-markmap';
        modal.innerHTML = `
            <div class="plugin-markmap-wrap">
                <div class="plugin-markmap-grip grip-right"></div>
                <div class="plugin-markmap-header">
                    <div class="plugin-markmap-icon ion-close" action="close" ty-hint="关闭"></div>
                    <div class="plugin-markmap-icon ion-arrow-expand" action="expand" ty-hint="全屏"></div>
                    <div class="plugin-markmap-icon ion-arrow-move" action="move" ty-hint="移动（ctrl+drag模态框也可以移动）"></div>
                    <div class="plugin-markmap-icon ion-cube" action="fit" ty-hint="适配窗口"></div>
                    <div class="plugin-markmap-icon ion-chevron-up" action="pinUp" ty-hint="固定到顶部"></div>
                    <div class="plugin-markmap-icon ion-chevron-right" action="pinRight" ty-hint="固定到右侧"></div>
                </div>
                <svg id="plugin-markmap-svg"></svg>
                <div class="plugin-markmap-icon ion-android-arrow-down-right" action="resize" ty-hint="拖动调整大小"></div>
            </div>
            <div class="plugin-markmap-grip grip-up"></div>
        `;
        this.utils.insertDiv(modal);

        if (this.config.USE_BUTTON) {
            const button = document.createElement("div");
            button.className = "plugin-markmap-button";
            button.innerHTML = `<div class="plugin-markmap-item" ty-hint="思维导图"><i class="fa fa-code-fork"></i></div>`;
            this.utils.insertDiv(button);
        }
    }

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

        this.utils.addEventListener(this.utils.eventType.outlineUpdated, () => this.entities.modal.style.display === "block" && this.drawToc());
        this.entities.content.addEventListener("transitionend", this.fit);
        this.entities.modal.addEventListener("transitionend", this.fit);

        const dragModal = (handleElement, withMetaKey) => {
            this.utils.dragFixedModal(
                handleElement, this.entities.modal, withMetaKey,
                () => {
                    this.cleanTransition(!this.config.USE_ANIMATION_WHEN_DRAG);
                    this.waitUnpin();
                },
                null,
                () => this.rollbackTransition(!this.config.USE_ANIMATION_WHEN_DRAG)
            );
        }

        // 提供两种拖拽的方式
        dragModal(this.entities.header.querySelector(`.plugin-markmap-icon[action="move"]`), false);
        dragModal(this.entities.modal, true);

        const getModalMinHeight = () => {
            const one = this.entities.header.firstElementChild.getBoundingClientRect().height;
            const count = (this.config.ALLOW_ICON_WRAP) ? 1 : this.entities.header.childElementCount;
            return one * count
        }

        const getModalMinWidth = () => {
            const {marginLeft, paddingRight} = document.defaultView.getComputedStyle(this.entities.header);
            const headerWidth = this.entities.header.getBoundingClientRect().width;

            const _marginRight = (this.config.ALLOW_ICON_WRAP) ? 0 : parseInt(paddingRight);
            return parseInt(marginLeft) + headerWidth + _marginRight
        }

        // 自由移动时调整大小
        {
            let deltaHeight = 0;
            let deltaWidth = 0;
            this.utils.resizeFixedModal(
                this.entities.resize, this.entities.modal, true, true,
                (startX, startY, startWidth, startHeight) => {
                    this.cleanTransition(!this.config.USE_ANIMATION_WHEN_RESIZE);
                    deltaHeight = getModalMinHeight() - startHeight;
                    deltaWidth = getModalMinWidth() - startWidth;
                },
                (deltaX, deltaY) => {
                    deltaY = Math.max(deltaY, deltaHeight);
                    deltaX = Math.max(deltaX, deltaWidth);
                    return {deltaX, deltaY}
                },
                async () => {
                    this.rollbackTransition(!this.config.USE_ANIMATION_WHEN_RESIZE);
                    await this.waitUnpin();
                    await this.setFullScreenIcon(this.entities.fullScreen, false);
                }
            );
        }

        // 固定到顶部时调整大小
        {
            let contentStartTop = 0;
            let contentMinTop = 0;
            this.utils.resizeFixedModal(
                this.entities.gripUp, this.entities.modal, false, true,
                () => {
                    this.cleanTransition(!this.config.USE_ANIMATION_WHEN_RESIZE);
                    contentStartTop = this.entities.content.getBoundingClientRect().top;
                    contentMinTop = getModalMinHeight() + this.entities.header.getBoundingClientRect().top;
                },
                (deltaX, deltaY) => {
                    let newContentTop = contentStartTop + deltaY;
                    if (newContentTop < contentMinTop) {
                        newContentTop = contentMinTop;
                        deltaY = contentMinTop - contentStartTop;
                    }
                    this.entities.content.style.top = newContentTop + "px";
                    return {deltaX, deltaY}
                },
                () => {
                    this.rollbackTransition(!this.config.USE_ANIMATION_WHEN_RESIZE);
                    this.drawToc();
                }
            );
        }

        // 固定到右侧时调整大小
        {
            let contentStartRight = 0;
            let contentStartWidth = 0;
            let modalStartLeft = 0;
            let contentMaxRight = 0;
            this.utils.resizeFixedModal(
                this.entities.gripRight, this.entities.modal, true, false,
                () => {
                    this.cleanTransition(!this.config.USE_ANIMATION_WHEN_RESIZE);

                    const contentRect = this.entities.content.getBoundingClientRect();
                    contentStartRight = contentRect.right;
                    contentStartWidth = contentRect.width;

                    const modalRect = this.entities.modal.getBoundingClientRect();
                    modalStartLeft = modalRect.left;
                    contentMaxRight = modalRect.right - getModalMinWidth();
                },
                (deltaX, deltaY) => {
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
                },
                () => {
                    this.rollbackTransition(!this.config.USE_ANIMATION_WHEN_RESIZE);
                    this.drawToc();
                }
            )
        }

        this.entities.header.addEventListener("click", ev => {
            const button = ev.target.closest(".plugin-markmap-icon");
            if (button) {
                const action = button.getAttribute("action");
                if (action !== "move" && this[action]) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    this.onButtonClick(action, button);
                }
            }
        })

        if (this.config.USE_BUTTON) {
            document.querySelector(".plugin-markmap-item").addEventListener("click", () => {
                (this.entities.modal.style.display === "") ? this.drawToc() : this.onButtonClick("close");
            })
        }
    }

    call = async type => type === "draw_toc" && await this.drawToc()

    close = () => {
        this.entities.modal.style.display = "";
        this.entities.modal.style.top = "";
        this.initModalRect();
        this.markmap.destroy();
        this.markmap = null;
    };

    fit = () => this.markmap && this.markmap.fit();

    pinUp = async (draw = true) => {
        const button = document.querySelector('.plugin-markmap-icon[action="pinUp"]');
        this.pinUtils.isPinUp = !this.pinUtils.isPinUp;
        if (this.pinUtils.isPinUp) {
            if (this.pinUtils.isPinRight) {
                await this.pinRight(false);
            }

            await this.pinUtils.init();
            const {top, height, width, left} = this.contentOriginRect;
            const newHeight = height * this.config.HEIGHT_PRECENT_WHEN_PIN_UP / 100;
            this.entities.modal.style.left = left + "px";
            this.entities.modal.style.width = width + "px";
            this.entities.modal.style.top = top + "px";
            this.entities.modal.style.height = newHeight + "px";
            this.entities.modal.style.boxShadow = "initial";

            this.entities.content.style.top = top + newHeight + "px";

            this.entities.gripUp.style.display = "block";

            button.classList.replace("ion-chevron-up", "ion-ios7-undo");
            button.setAttribute("ty-hint", "还原窗口");
        } else {
            this.setModalRect(this.modalOriginRect);
            this.entities.modal.style.boxShadow = "";
            this.entities.content.style.top = this.contentOriginRect.top + "px";
            this.entities.gripUp.style.display = "";

            button.classList.replace("ion-ios7-undo", "ion-chevron-up");
            button.setAttribute("ty-hint", "固定到顶部");
        }
        if (draw) {
            await this.drawToc();
        }
    }

    pinRight = async (draw = true) => {
        const button = document.querySelector('.plugin-markmap-icon[action="pinRight"]');
        this.pinUtils.isPinRight = !this.pinUtils.isPinRight;
        if (this.pinUtils.isPinRight) {
            if (this.pinUtils.isPinUp) {
                await this.pinUp(false);
            }

            await this.pinUtils.init();
            const {top, width, height, right} = this.contentOriginRect;
            const newWidth = width * this.config.WIDTH_PRECENT_WHEN_PIN_RIGHT / 100;
            this.entities.modal.style.top = top + "px";
            this.entities.modal.style.right = right + "px";
            this.entities.modal.style.left = right - newWidth + "px";
            this.entities.modal.style.height = height + "px";
            this.entities.modal.style.width = newWidth + "px";
            this.entities.modal.style.boxShadow = "initial";

            this.entities.content.style.right = right - newWidth + "px";
            this.entities.content.style.width = width - newWidth + "px";

            document.querySelector("#write").style.width = "initial";

            this.entities.gripRight.style.display = "block";

            button.classList.replace("ion-chevron-right", "ion-ios7-undo");
            button.setAttribute("ty-hint", "还原窗口");
        } else {
            this.setModalRect(this.modalOriginRect);
            this.entities.modal.style.boxShadow = "";
            this.entities.content.style.width = "";
            this.entities.content.style.right = "";
            document.querySelector("#write").style.width = "";
            this.entities.gripRight.style.display = "";

            button.classList.replace("ion-ios7-undo", "ion-chevron-right");
            button.setAttribute("ty-hint", "固定到右侧");
        }
        if (draw) {
            await this.drawToc();
        }
    }

    waitUnpin = async () => {
        if (this.pinUtils.isPinUp) {
            await this.pinUp();
        }
        if (this.pinUtils.isPinRight) {
            await this.pinRight();
        }
    }

    cleanTransition = (run = true) => (run) ? this.entities.modal.style.transition = "0s" : undefined
    rollbackTransition = (run = true) => (run) ? this.entities.modal.style.transition = "" : undefined

    onButtonClick = async (action, button) => {
        if (action !== "pinUp" && action !== "pinRight" && action !== "fit") {
            await this.waitUnpin();
        }
        await this[action](button);
    }

    expand = async button => {
        this.modalOriginRect = this.entities.modal.getBoundingClientRect();
        this.setModalRect(this.entities.content.getBoundingClientRect());
        await this.setFullScreenIcon(button, true);
    }

    shrink = async button => {
        this.setModalRect(this.modalOriginRect);
        await this.setFullScreenIcon(button, false)
    }

    setFullScreenIcon = async (button, fullScreen) => {
        if (fullScreen) {
            this.entities.modal.style.boxShadow = "initial";
            button.className = "plugin-markmap-icon ion-arrow-shrink";
            button.setAttribute("action", "shrink");
        } else {
            this.entities.modal.style.boxShadow = "";
            button.className = "plugin-markmap-icon ion-arrow-expand";
            button.setAttribute("action", "expand");
        }
        await this.drawToc();
    }

    setModalRect = rect => {
        if (!rect) return;
        const {left, top, height, width} = rect;
        this.entities.modal.style.left = left + "px";
        this.entities.modal.style.top = top + "px";
        this.entities.modal.style.height = height + "px";
        this.entities.modal.style.width = width + "px";
    }

    initModalRect = () => {
        const {left, width, height} = this.entities.content.getBoundingClientRect();
        this.entities.modal.style.left = left + width / 6 + "px";
        this.entities.modal.style.width = width * 2 / 3 + "px";
        this.entities.modal.style.height = height / 3 + "px";
    }

    drawToc = async () => {
        const toc = File.editor.nodeMap.toc;
        const headers = [];
        if (toc) {
            for (const header of toc["headers"]) {
                if (header && header["attributes"]) {
                    headers.push(header.attributes.pattern.replace("{0}", header.attributes.text));
                }
            }
            const md = headers.join("\n");
            await this.draw(md);
        }
    }

    draw = async md => {
        this.entities.modal.style.display = "block";
        if (this.markmap) {
            await this.update(md);
        } else {
            this.initModalRect();
            await this.controller.lazyLoad();
            await this.create(md);
        }
    }

    create = async md => {
        const {root} = this.controller.transformer.transform(md);
        this.markmap = this.controller.Markmap.create(this.entities.svg, null, root);
    }

    update = async md => {
        const {root} = this.controller.transformer.transform(md);
        this.markmap.setData(root);
        await this.markmap.fit();
    }
}


module.exports = {
    plugin: markmapPlugin
};