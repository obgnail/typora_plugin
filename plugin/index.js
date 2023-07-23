window.onload = () => {
    global._plugins = [
        {
            name: "标签页管理",
            src: "./plugin/window_tab.js",
            enable: true,
            clickable: false,
            call: null,
            call_args: null,
        },
        {
            name: "多关键字搜索",
            src: "./plugin/search_multi.js",
            enable: true,
            clickable: true,
            call: null,
            call_args: null,
        },
        {
            name: "表格大小调整",
            src: "./plugin/resize_table.js",
            enable: true,
            clickable: false,
            call: null,
            call_args: null,
        },
        {
            name: "只读模式",
            src: "./plugin/read_only.js",
            enable: true,
            clickable: true,
            call: null,
            call_args: null,
        },
        {
            name: "文段截断",
            src: "./plugin/truncate_text.js",
            enable: true,
            clickable: true,
            call: null,
            call_args: null,
        },
        {
            name: "图片大小调整",
            src: "./plugin/resize_image.js",
            enable: true,
            clickable: false,
            call: null,
            call_args: null,
        },
        {
            name: "命令行环境",
            src: "./plugin/commander.js",
            enable: true,
            clickable: true,
            call: null,
            call_args: null,
        },
        {
            name: "代码块增强",
            src: "./plugin/fence_enhance.js",
            enable: true,
            clickable: false,
            call: null,
            call_args: null,
        },
        {
            name: "一键到顶",
            src: "./plugin/go_top.js",
            enable: true,
            clickable: true,
            call: null,
            call_args: null,
        },
        {
            name: "文件计数",
            src: "./plugin/file_counter.js",
            enable: true,
            clickable: false,
            call: null,
            call_args: null,
        },
        {
            name: "章节折叠",
            src: "./plugin/collapse_paragraph.js",
            enable: true,
            clickable: false,
            call: null,
            call_args: null,
        },
        {
            name: "盘古之白",
            src: "./plugin/md_padding/index.js",
            enable: true,
            clickable: true,
            call: null,
            call_args: null,
        },
        {
            name: "mermaid替换",
            src: "./plugin/mermaid_replace/index.js",
            enable: true,
            clickable: false,
            call: null,
            call_args: null,
        },
        {
            name: "测试",
            src: "./plugin/test.js",
            enable: true,
            clickable: false,
            call: null,
            call_args: null,
        },
    ]

    async function loadPlugin() {
        const _path = reqnode("path");
        const _fs = reqnode("fs");
        const dirname = global.dirname || global.__dirname;
        const promises = [];

        global._plugins.forEach(plugin => {
            const filepath = _path.join(dirname, plugin.src);
            const promise = new Promise((resolve, reject) => {
                _fs.access(filepath, err => {
                    if (!err) {
                        const {Call, CallArgs} = reqnode(filepath);
                        plugin.call = Call;
                        plugin.call_args = CallArgs;
                        resolve(plugin);
                    } else {
                        console.log("has no path:", filepath);
                        reject(err);
                    }
                })
            })
            promises.push(promise);
        })

        await Promise.all(promises)
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
            const content = (!plugin.call_args) ? plugin.name : `<span data-lg="Menu">${plugin.name}</span> <i class="fa fa-caret-right"></i>`;
            const Class = (!plugin.call_args) ? "" : `class="plugin-has-args"`;
            const li = `<li data-key="${plugin.name}" ${Class} ${style}><a role="menuitem" data-lg="Menu">${content}</a></li>`
            if (plugin.clickable) {
                clickablePlugins.push(li);
            } else {
                notClickablePlugins.push(li);
            }
        })

        const createUl = () => {
            const secondUl = document.createElement("ul");
            secondUl.classList.add("dropdown-menu");
            secondUl.classList.add("context-menu");
            secondUl.classList.add("ext-context-menu");
            secondUl.setAttribute("role", "menu");
            return secondUl;
        }

        const show = (element, target) => {
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

        setTimeout(() => {
            const secondUl = createUl();
            secondUl.id = "plugin-menu"
            secondUl.innerHTML = `${clickablePlugins.join("")}<li class="divider"></li>${notClickablePlugins.join("")}`
            document.querySelector("content").appendChild(secondUl);

            const pluginMenu = $("#plugin-menu");
            pluginMenu.on("click", "[data-key]", function () {
                const name = this.getAttribute("data-key");
                const plugins = global._plugins.filter(plugin => plugin.name === name);
                plugins && plugins[0] && plugins[0].call && plugins[0].call();
                File.editor.contextMenu.hide();
            })
            pluginMenu.on("mouseenter", "[data-key]", function () {
                const t = $(this);
                const target = t.find(`span[data-lg="Menu"]`);
                if (target.length) {
                    const name = t.attr("data-key");
                    show(`.plugin-menu-third[plugin_name="${name}"]`, t);
                } else {
                    document.querySelectorAll(".plugin-menu-third").forEach(ele => ele.classList.remove("show"));
                    document.querySelector("#plugin-menu .plugin-has-args").classList.remove("active");
                }
            })
        }, 500)

        setTimeout(() => {
            global._plugins.forEach(plugin => {
                if (plugin.call_args) {
                    const li = plugin.call_args.map(arg => `<li data-key="${arg.arg_name}" arg_value="${arg.arg_value}">
                            <a role="menuitem" data-lg="Menu">${arg.arg_name}</a></li>`)
                    const thirdUl = createUl();
                    thirdUl.classList.add("plugin-menu-third");
                    thirdUl.setAttribute("plugin_name", plugin.name);
                    thirdUl.innerHTML = li.join("");
                    document.querySelector("content").appendChild(thirdUl);
                }
            })

            $(".plugin-menu-third").on("click", "[data-key]", function () {
                const pluginName = this.parentElement.getAttribute("plugin_name");
                const argValue = this.getAttribute("arg_value");
                const plugins = global._plugins.filter(plugin => plugin.name === pluginName);
                plugins && plugins[0] && plugins[0].call && plugins[0].call(argValue);
                File.editor.contextMenu.hide();
            })
        }, 500)

        $("#context-menu").on("mouseenter", "[data-key]", function () {
            const target = $(this);
            if ("typora-plugin" === target.attr("data-key")) {
                show("#plugin-menu", target);
                target.addClass("active");
            } else {
                document.querySelector("#plugin-menu").classList.remove("show");
                document.querySelector("[data-key='typora-plugin']").classList.remove("active");
            }
        })
    }

    loadPlugin().then(appendMenu);
}
