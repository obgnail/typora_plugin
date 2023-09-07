class markmapPlugin extends global._basePlugin {
    style = () => {
        const text = `
            #plugin-markmap {
                position: fixed;
                right: 0;
                z-index: 9999;
                box-shadow: 0 4px 10px rgba(0, 0, 0, .5);
                background-color: #f8f8f8;
                display: none;
            }
            
            .plugin-markmap-header {
                display: inline-flex;
                justify-content: space-evenly;
                align-items: center;
                position: absolute;
                top: 0.3em;
                right: 0.5em;
                font-size: 1.5em;
                opacity: 0.5;
            }
            
            .plugin-markmap-icon {
                margin-left: 0.5em;
                cursor: pointer;
            }
            
            #plugin-markmap-svg {
                width: 100%;
                height: 100%;
            }
        `
        return {textID: "plugin-markmap-style", text: text}
    }

    html = () => {
        const modal = document.createElement("div");
        modal.id = 'plugin-markmap';
        modal.innerHTML = `
            <div class="plugin-markmap-header">
                <div class="plugin-markmap-icon ion-arrow-expand" action="expand"></div>
                <div class="plugin-markmap-icon ion-arrow-move" action="move"></div>
                <div class="plugin-markmap-icon ion-close" action="hide"></div>
            </div>
            <svg id="plugin-markmap-svg"></svg>`;

        const {width, height} = document.querySelector("content").getBoundingClientRect();
        modal.style.width = width / 2 + "px";
        modal.style.height = height / 2 + "px";

        this.utils.insertDiv(modal);
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
        }

        this.callArgs = [
            {
                arg_name: "生成当前目录的markmap",
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
        button.className = "plugin-markmap-icon ion-arrow-shrink";
        button.setAttribute("action", "shrink");
        this.drawToc();
    }

    shrink = button => {
        this.setRect(this.originRect);
        button.className = "plugin-markmap-icon ion-arrow-expand";
        button.setAttribute("action", "expand");
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