class markmapPlugin extends global._basePlugin  {
    style = () => {
        const text = `
            #plugin-markmap {
                position: fixed;
                z-index: 99999;
                box-shadow: 0 4px 10px rgba(0, 0, 0, .5);
                border: 1px solid #ddd;
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
                font-size: 1.2em;
                opacity: 0.5;
            }
            
            .plugin-markmap-icon {
                margin-left: 0.5em;
                cursor: pointer;
            }
            
            #plugin-markmap-svg {
                width: 800px;
                height: 500px;
            }
        `
        return {textID: "plugin-markmap-style", text: text}
    }

    html = () => {
        const modal = document.createElement("div");
        modal.id = 'plugin-markmap';
        modal.innerHTML = `
            <div class="plugin-markmap-header">
                <div class="plugin-markmap-icon ion-arrow-move" type="move"></div>
                <div class="plugin-markmap-icon ion-close" type="close"></div>
            </div>
            <svg id="plugin-markmap-svg"></svg>
        `;
        this.utils.insertDiv(modal);
    }

    process = async () => {
        this.transformer = null;
        this.Markmap = null;
        this.markmap = null;
        this.editor = null;

        this.entities = {
            modal: document.querySelector("#plugin-markmap"),
            header: document.querySelector("#plugin-markmap .plugin-markmap-header"),
            svg: document.querySelector("#plugin-markmap-svg"),
        }

        this.utils.decorate(
            () => File && File.editor && File.editor.library && File.editor.library.outline && File.editor.library.outline.updateOutlineHtml,
            "File.editor.library.outline.updateOutlineHtml",
            null,
            () => this.entities.modal.style.display === "block" && this.drawToc()
        )

        this.utils.dragFixedModal(this.entities.header.querySelector(`[type="move"]`), this.entities.modal, false);
        this.entities.header.querySelector(`[type="close"]`).addEventListener("click", ev => {
            ev.stopPropagation();
            ev.preventDefault();
            this.hide();
        })
    }

    call = async type => {
        await this.drawToc()
    }

    hide = () => this.entities.modal.style.display = ""

    drawToc = async () => {
        const toc = File.editor.nodeMap.toc;
        if (toc) {
            const headers = toc["headers"].map(header => header.attributes.pattern.replace("{0}", header.attributes.text));
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
        this.transformer = new markmapLib.Transformer();
        await this.utils.insertScript("./plugin/markmap/resource/d3_6.js");
        await this.utils.insertScript("./plugin/markmap/resource/markmap-view.js");
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