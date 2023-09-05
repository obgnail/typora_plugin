class markmapPlugin extends BaseCustomPlugin {
    selector = () => ""

    style = () => {
        const text = `
            #custom-plugin-markmap {
                position: fixed;
                background-color: red;
            }
        `
        return {textID: "custom-plugin-markmap-style", text: text}
    }
    html = () => {
        const modal = document.createElement("div");
        modal.id = 'custom-plugin-markmap';
        // modal.style.display = "none";
        modal.innerHTML = `<svg id="custom-plugin-markmap-svg" style="width: 1000px; height: 800px"></svg>`;
        this.utils.insertDiv(modal);
    }

    init = () => {
        Promise.all([
            this.utils.insertScript("./plugin/custom/plugins/markmap/katex.js"),
            this.utils.insertScript("./plugin/custom/plugins/markmap/d3_6.js"),
            this.utils.insertScript("./plugin/custom/plugins/markmap/markmap-view.js"),
        ]).then(() => {
            // We got { root } data from transforming, and possible extraneous assets { styles, scripts }.
            const {Markmap, loadCSS, loadJS} = window.markmap;
            this.Markmap = Markmap;
        })
    }
    callback = anchorNode => {
        const markmap = this.utils.requireFilePath("./plugin/custom/plugins/markmap/markmap-lib.js")
        const {Transformer} = markmap;
        const transformer = new Transformer();

        const markdown = `# markmap
- beautiful
- useful
- easy
- interactive
`
        const { root, features } = transformer.transform(markdown);
        this.Markmap.create('#custom-plugin-markmap-svg', null, root);
    }
}


module.exports = {
    plugin: markmapPlugin
};