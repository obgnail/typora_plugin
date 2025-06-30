const load = (file, id, content) => {
    const tpl = document.createElement("template")
    tpl.id = id
    tpl.innerHTML = content
    const quickOpenNode = document.getElementById("ty-resize-temp")
    quickOpenNode.parentNode.insertBefore(tpl, quickOpenNode.nextSibling)

    require(file)
}

load(
    "./fast-form.js",
    "plugin-fast-form",
    `
        <link rel="stylesheet" href="./plugin/global/styles/plugin-fast-form.css" crossorigin="anonymous">
        <div id="form"></div>
    `,
)

load(
    "./fast-window.js",
    "plugin-fast-window",
    `
        <link rel="stylesheet" href="./plugin/global/styles/plugin-fast-window.css" crossorigin="anonymous">
        <div class="title-bar" part="title-bar">
            <span class="title-text" id="window-title"></span>
            <div class="buttons-container"></div>
        </div>
        <div class="content-area" part="content-area">
            <slot></slot>
        </div>
    `,
)
