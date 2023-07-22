window.onload = () => {
    global._plugins = [
        {
            "name": "标签页管理",
            "src": "./plugin/window_tab.js",
            "enable": true,
            "clickable": false,
        },
        {
            "name": "多关键字搜索",
            "src": "./plugin/search_multi.js",
            "enable": true,
            "clickable": true,
        },
        {
            "name": "表格大小调整",
            "src": "./plugin/resize_table.js",
            "enable": true,
            "clickable": false,
        },
        {
            "name": "只读模式",
            "src": "./plugin/read_only.js",
            "enable": true,
            "clickable": true,
        },
        {
            "name": "文段截断",
            "src": "./plugin/truncate_text.js",
            "enable": true,
            "clickable": true,
        },
        {
            "name": "图片大小调整",
            "src": "./plugin/resize_image.js",
            "enable": true,
            "clickable": false,
        },
        {
            "name": "命令行环境",
            "src": "./plugin/commander.js",
            "enable": true,
            "clickable": true,
        },
        {
            "name": "代码块增强",
            "src": "./plugin/fence_enhance.js",
            "enable": true,
            "clickable": false,
        },
        {
            "name": "一键到顶",
            "src": "./plugin/go_top.js",
            "enable": true,
            "clickable": true,
        },
        {
            "name": "文件计数",
            "src": "./plugin/file_counter.js",
            "enable": true,
            "clickable": false,
        },
        {
            "name": "章节折叠",
            "src": "./plugin/collapse_paragraph.js",
            "enable": true,
            "clickable": false,
        },
        {
            "name": "盘古之白",
            "src": "./plugin/md_padding/index.js",
            "enable": true,
            "clickable": true,
        },
        {
            "name": "mermaid替换",
            "src": "./plugin/mermaid_replace/index.js",
            "enable": true,
            "clickable": false,
        },
        {
            "name": "测试",
            "src": "./plugin/test.js",
            "enable": true,
            "clickable": false,
        },
    ]

    const loadPlugin = () => {
        const _path = reqnode("path");
        const _fs = reqnode("fs");
        const dirname = global.dirname || global.__dirname;

        global._plugins.forEach(plugin => {
            const filepath = _path.join(dirname, plugin.src);
            _fs.access(filepath, err => {
                if (!err) {
                    reqnode(filepath);
                } else {
                    console.log("has no path:", filepath);
                }
            })
        })
    }

    const appendMenu = () => {
        const ul = document.querySelector(`#context-menu`);
        const line = document.createElement("li");
        line.classList.add("divider");
        line.setAttribute("data-group", "plugin");
        ul.appendChild(line);

        const li = `<li data-key="typora-plugin" data-group="enable-plugin" class="has-extra-menu">
            <a role="menuitem">
                <span data-localize="启用插件" data-lg="Menu">启用插件</span>
                <i class="fa fa-caret-right"></i>
            </a>
        </li>`
        ul.insertAdjacentHTML('beforeend', li);

        const clickablePlugins = [];
        const notClickablePlugins = [];
        global._plugins.forEach(plugin => {
            const style = (plugin.clickable) ? "" : `style="pointer-events: none;color: #c4c6cc;"`;
            const li = `<li data-key="${plugin.name}" ${style}><a role="menuitem" data-localize="${plugin.name}" data-lg="Menu">${plugin.name}</a></li>`
            if (plugin.clickable) {
                clickablePlugins.push(li);
            } else {
                notClickablePlugins.push(li)
            }
        })

        const secondUl = `
            <ul class="dropdown-menu context-menu ext-context-menu" id="plugin-menu" role="menu">
                ${clickablePlugins.join("")}
                <li class="divider"></li>
                ${notClickablePlugins.join("")}
            </ul>`
        document.querySelector("content").insertAdjacentHTML('beforeend', secondUl);

        const addStyle = (element, target) => {
            const selected = $(element).addClass("show")
                , height = selected.height() + 48
                , offset = target.offset()
                , left = offset.left
                , leftPlus = left + 200
                , top = offset.top - 30
                , finalLeft = leftPlus + 160 > window.innerWidth ? left - 184 : leftPlus
                , finalTop = top + height > window.innerHeight ? window.innerHeight - height : top;
            selected.css({top: finalTop + "px", left: finalLeft + "px"})
            return false;
        };

        $("#context-menu, #user-context-menu").on("mouseenter", "[data-key]", function () {
            const e = $(this);
            if ("typora-plugin" === e.attr("data-key")) {
                addStyle("#plugin-menu", e);
                e.addClass("active");
            } else {
                document.querySelector("#plugin-menu").classList.remove("show");
                document.querySelector("[data-key='typora-plugin']").classList.remove("active");
            }
        })
    }

    loadPlugin();
    appendMenu();
}
