class markmapPlugin extends global._basePlugin {
    style = () => {
        let extra = "";
        if (this.config.USE_BUTTON) {
            extra = `
            .plugin-markmap-button {
                position: fixed;
                left: var(--sidebar-width);
                bottom: 50px;
                margin-left: 30px;
                font-size: 22px;
                text-align: center;
                color: var(--active-file-border-color, black);
            }
            
            .plugin-markmap-button .plugin-markmap-item {
                width: 35px;
                height: 35px;
                cursor: pointer;
                box-shadow: rgba(0, 0, 0, 0.07) 0px 0px 10px;
                border-radius: 4px;
            }
            
            .plugin-markmap-button .plugin-markmap-item:hover {
                background-color: var(--item-hover-bg-color, black);
            }
            `
        }

        const text = `
            #plugin-markmap {
                position: fixed;
                z-index: 9999;
                box-shadow: 0 4px 10px rgba(0, 0, 0, .5);
                background-color: #f8f8f8;
                display: none;
            }
            
            .plugin-markmap-wrap {
                display: flex;
                flex-direction: row-reverse;
                width: 100%;
                height: 100%;
            }
            
            ${extra}
            
            .plugin-markmap-header {
                margin: 0 0.5em;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            
            .plugin-markmap-icon {
                cursor: pointer;
                font-size: 1.3em;
                opacity: 0.5;
            }
            
            .plugin-markmap-icon:last-child {
                margin-top: auto;
                margin-bottom: 0.2em;
                font-size: 1.3em;
            }
            
            #plugin-markmap-svg {
                flex: 1;
            }
        `
        return {textID: "plugin-markmap-style", text: text}
    }

    html = () => {
        const modal = document.createElement("div");
        modal.id = 'plugin-markmap';
        modal.innerHTML = `
            <div class="plugin-markmap-wrap">
                <div class="plugin-markmap-header">
                    <div class="plugin-markmap-icon ion-close" action="hide" ty-hint="关闭"></div>
                    <div class="plugin-markmap-icon ion-arrow-expand" action="expand" ty-hint="全屏"></div>
                    <div class="plugin-markmap-icon ion-arrow-move" action="move" ty-hint="移动"></div>
                    <div class="plugin-markmap-icon ion-android-arrow-down-right" action="resize" ty-hint="拖动调整大小"></div>
                </div>
                <svg id="plugin-markmap-svg"></svg>
            </div>
        `;
        this.utils.insertDiv(modal);

        if (this.config.USE_BUTTON) {
            const button = document.createElement("div");
            button.className = "plugin-markmap-button";
            button.innerHTML = `<div class="plugin-markmap-item" ty-hint="查看思维导图"><i class="fa fa-code-fork"></i></div>`;
            this.utils.insertDiv(button);
        }
    }

    init = () => {
        this.transformer = null;
        this.Markmap = null;
        this.markmap = null;
        this.editor = null;
        this.originRect = null;

        this.entities = {
            modal: document.querySelector("#plugin-markmap"),
            header: document.querySelector("#plugin-markmap .plugin-markmap-header"),
            svg: document.querySelector("#plugin-markmap-svg"),
            resize: document.querySelector('.plugin-markmap-icon[action="resize"]'),
            fullScreen: document.querySelector('.plugin-markmap-icon[action="expand"]'),
        }

        this.callArgs = [
            {
                arg_name: "根据当前大纲生成",
                arg_value: "current_toc"
            },
        ];
    }

    process = async () => {
        this.init();

        this.utils.decorate(
            () => File && File.editor && File.editor.library && File.editor.library.outline && File.editor.library.outline.updateOutlineHtml,
            "File.editor.library.outline.updateOutlineHtml",
            null,
            () => this.entities.modal.style.display === "block" && this.drawToc()
        )

        this.utils.dragFixedModal(this.entities.header.querySelector(`.plugin-markmap-icon[action="move"]`), this.entities.modal, false);
        this.utils.resizeFixedModal(this.entities.resize, this.entities.modal, () => this.setFullScreenIcon(this.entities.fullScreen, false));

        this.entities.header.addEventListener("click", ev => {
            const target = ev.target.closest(".plugin-markmap-icon");
            if (target) {
                const action = target.getAttribute("action");
                if (action !== "move" && this[action]) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    this[action](target);
                }
            }
        })

        if (this.config.USE_BUTTON) {
            document.querySelector(".plugin-markmap-item").addEventListener("click", () => {
                (this.entities.modal.style.display === "") ? this.drawToc() : this.hide();
            })
        }
    }

    call = async type => {
        if (type === "current_toc") {
            await this.drawToc()
        }
    }

    hide = () => this.entities.modal.style.display = ""

    expand = button => {
        this.originRect = this.entities.modal.getBoundingClientRect();
        this.setRect(document.querySelector("content").getBoundingClientRect());
        this.setFullScreenIcon(button, true);
    }

    shrink = button => {
        this.setRect(this.originRect);
        this.setFullScreenIcon(button, false)
    }

    setFullScreenIcon = (button, fullScreen) => {
        if (fullScreen) {
            button.className = "plugin-markmap-icon ion-arrow-shrink";
            button.setAttribute("action", "shrink");
        } else {
            button.className = "plugin-markmap-icon ion-arrow-expand";
            button.setAttribute("action", "expand");
        }
        this.drawToc();
    }

    setRect = rect => {
        if (!rect) return;
        const {left, top, height, width} = rect;
        this.entities.modal.style.left = left + "px";
        this.entities.modal.style.top = top + "px";
        this.entities.modal.style.height = height + "px";
        this.entities.modal.style.width = width + "px";
    }

    setModalRect = () => {
        const {left, width, height} = document.querySelector("content").getBoundingClientRect();
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
        if (this["transformer"] && this["Markmap"]) {
            await this.update(md);
        } else {
            this.setModalRect();
            await this.lazyLoad();
            await this.create(md);
        }
    }

    create = async md => {
        const {root} = this.transformer.transform(md);
        this.markmap = this.Markmap.create(this.entities.svg, null, root);
    }

    update = async md => {
        const {root} = this.transformer.transform(md);
        this.markmap.setData(root);
        await this.markmap.fit();
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
        if (styles) loadCSS(styles);
        if (scripts) loadJS(scripts, {getMarkmap: () => markmap});
    }
}


module.exports = {
    plugin: markmapPlugin
};