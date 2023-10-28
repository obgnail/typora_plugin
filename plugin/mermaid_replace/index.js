class mermaidReplacePlugin extends global._basePlugin {
    process = () => {
        // 在 cdnjs.com 或者 unpkg.com 上找到最新版本的 `mermaid.min.js`，eg: https://unpkg.com/mermaid/dist/mermaid.min.js
        // 之后替换 mermaid.min.js 文件。（当前文件版本: 9.3.0）
        this.utils.loopDetector(
            () => window.editor && window.editor.diagrams && window.mermaidAPI,
            () => {
                this.utils.insertScript("./plugin/mermaid_replace/mermaid.min.js").then(() => {
                        window.mermaidAPI = mermaid.mermaidAPI;
                        window.editor.diagrams.refreshDiagram(window.editor);
                    }
                )
            }
        );
    }
}

module.exports = {
    plugin: mermaidReplacePlugin
};