class mermaidReplacePlugin extends global._basePlugin {
    process = () => {
        // 在 cdnjs.com 或者 unpkg.com 上找到最新版本的 `mermaid.min.js`，eg: https://unpkg.com/mermaid/dist/mermaid.min.js
        // 之后替换 mermaid.min.js 文件。（当前文件版本: 9.3.0）
        this.utils.loopDetector(
            () => window.editor && window.editor.diagrams && window.mermaidAPI,
            () => {
                const filepath = this.utils.joinPath("./plugin/mermaid_replace/mermaid.min.js");
                $.getScript(`file:///${filepath}`).then(() => {
                    global.mermaidAPI = mermaid.mermaidAPI;
                    window.editor.diagrams.refreshDiagram(editor);
                });
            }
        );
    }
}

module.exports = {
    plugin: mermaidReplacePlugin
};