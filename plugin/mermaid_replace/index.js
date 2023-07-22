(() => {
    // 在 cdnjs.com 或者 unpkg.com 上找到最新版本的 `mermaid.min.js`，eg: https://unpkg.com/mermaid/dist/mermaid.min.js
    // 之后替换 mermaid.min.js 文件。（当前文件版本: 9.3.0）
    const dirname = global.dirname || global.__dirname;
    const filepath = reqnode("path").join(dirname, "plugin", "mermaid_replace", "mermaid.min.js");
    const interval = setInterval(() => {
        if (window.editor && window.editor.diagrams && window.mermaidAPI) {
            $.getScript(`file:///${filepath}`).then(() => {
                mermaidAPI = mermaid.mermaidAPI;
                window.editor.diagrams.refreshDiagram(editor);
                clearInterval(interval);
            });
        }
    }, 100);

    console.log("mermaid_replace.js had been injected");
})()