class rightClickMenuPlugin extends global._basePlugin {
    beforeProcess = () => {
        this.utils.loopDetector(() => global._pluginsHadInjected, this.appendMenu, this.config.LOOP_DETECT_INTERVAL);
    }

    getPlugins = () => {
        const enable = []
        for (const fixed_name in global._plugins) {
            const plugin = global._plugins[fixed_name];
            enable.push(plugin);
        }
        const clickable = enable.filter(plugin => plugin.config.CLICKABLE === true);
        const nonClickable = enable.filter(plugin => plugin.config.CLICKABLE === false);
        return {clickable, nonClickable, enable}
    }

    appendFirst = () => {
        const ul = document.querySelector(`#context-menu`);
        const line = document.createElement("li");
        line.classList.add("divider");
        line.setAttribute("data-group", "plugin");
        ul.appendChild(line);

        const li = `
            <li data-key="typora-plugin" data-group="enable-plugin" class="has-extra-menu">
                <a role="menuitem">
                    <span data-localize="启用插件" data-lg="Menu">启用插件</span>
                    <i class="fa fa-caret-right"></i>
                </a>
            </li>`
        ul.insertAdjacentHTML('beforeend', li);
    }

    appendSecond = (clickablePlugins, nonClickablePlugins) => {
        const clickable = clickablePlugins.map(plugin => this.createSecondLi(plugin)).join("");
        const nonClickable = nonClickablePlugins.map(plugin => this.createSecondLi(plugin)).join("");
        const divider = `<li class="divider"></li>`
        const secondUl = this.createUl();
        secondUl.id = "plugin-menu";
        secondUl.innerHTML = clickable + divider + nonClickable;
        document.querySelector("content").appendChild(secondUl);
    }

    appendThird = enablePlugins => {
        enablePlugins.forEach(plugin => {
            if (!plugin.callArgs && !plugin.dynamicCallArgsGenerator) return;

            const thirdUl = this.createUl();
            thirdUl.classList.add("plugin-menu-third");
            thirdUl.setAttribute("fixed_name", plugin.fixed_name);
            thirdUl.innerHTML = plugin.callArgs ? plugin.callArgs.map(arg => this.createThirdLi(arg)).join("") : "";
            document.querySelector("content").appendChild(thirdUl);
        })
    }

    createSecondLi = plugin => {
        const hasNotArgs = !plugin.callArgs && !plugin.dynamicCallArgsGenerator;
        const style = (plugin.config.CLICKABLE) ? "" : `style="pointer-events: none;color: #c4c6cc;"`;
        const content = (hasNotArgs) ? plugin.config.NAME : `<span data-lg="Menu">${plugin.config.NAME}</span> <i class="fa fa-caret-right"></i>`;
        const className = (hasNotArgs) ? "" : "plugin-has-args";
        return `<li data-key="${plugin.fixed_name}" class="plugin-menu-item ${className}" ${style}>
                    <a role="menuitem" data-lg="Menu">${content}</a>
                </li>`
    }

    createThirdLi = (arg, dynamic) => {
        const disabled = (arg.arg_disabled) ? " disabled" : "";
        const className = (dynamic) ? `class="plugin-dynamic-arg${disabled}"` : "";
        return `<li data-key="${arg.arg_name}" arg_value="${arg.arg_value}" ${className}><a role="menuitem" data-lg="Menu">${arg.arg_name}</a></li>`
    }

    createUl = () => {
        const secondUl = document.createElement("ul");
        secondUl.classList.add("dropdown-menu");
        secondUl.classList.add("context-menu");
        secondUl.classList.add("ext-context-menu");
        secondUl.setAttribute("role", "menu");
        return secondUl;
    }

    show = (second, first) => {
        const next = second.addClass("show");

        const rect = next[0].getBoundingClientRect();
        const nextHeight = rect.height;
        const nextWidth = rect.width;

        const {left, top, width, height} = first[0].getBoundingClientRect();
        let nextTop = top - height;
        let nextLeft = left + width + 6;

        if (nextTop + nextHeight > window.innerHeight) {
            nextTop = window.innerHeight - nextHeight
        }
        if (nextLeft + nextWidth > window.innerWidth) {
            nextLeft = window.innerWidth - nextWidth
        }

        next.css({top: nextTop + "px", left: nextLeft + "px"})
        return false;
    }

    generateDynamicCallArgs = fixedName => {
        if (!fixedName) return;
        const plugin = this.utils.getPlugin(fixedName);
        if (plugin && plugin.dynamicCallArgsGenerator) {
            const anchorNode = File.editor.getJQueryElem(window.getSelection().anchorNode);
            if (anchorNode[0]) {
                return plugin.dynamicCallArgsGenerator(anchorNode[0]);
            }
        }
    }

    appendThirdLi = (menu, dynamicCallArgs) => {
        const args = dynamicCallArgs.map(arg => this.createThirdLi(arg, true)).join("");
        menu.append(args);
    }

    appendDummyThirdLi = menu => {
        this.appendThirdLi(menu, [{
            arg_name: "光标于此位置不可用",
            arg_value: this.config.NOT_AVAILABLE_VALUE,
            arg_disabled: true,
        }])
    }

    appendMenu = () => {
        setTimeout(() => {
            const {clickable, nonClickable, enable} = this.getPlugins();
            // 一级菜单汇总所有插件
            this.appendFirst();
            // 二级菜单展示所有插件
            this.appendSecond(clickable, nonClickable);
            // 三级菜单展示插件的参数
            this.appendThird(enable);
            this.listen();
        }, 500)
    }

    listen = () => {
        const that = this;

        // 展示二级菜单
        $("#context-menu").on("mouseenter", "[data-key]", function () {
            const target = $(this);
            if ("typora-plugin" === target.attr("data-key")) {
                that.show($("#plugin-menu"), target);
                target.addClass("active");
            } else {
                document.querySelector("#plugin-menu").classList.remove("show");
                document.querySelector("[data-key='typora-plugin']").classList.remove("active");
                document.querySelectorAll(".plugin-menu-third").forEach(ele => ele.classList.remove("show"));
            }
        })

        // 在二级菜单中调用插件
        $("#plugin-menu").on("click", "[data-key]", function () {
            const fixedName = this.getAttribute("data-key");
            const plugin = that.utils.getPlugin(fixedName);
            // 拥有三级菜单的，不允许点击二级菜单
            if (plugin.callArgs || plugin.dynamicCallArgsGenerator) {
                return false
            }
            if (plugin && plugin.call) {
                plugin.call();
            }
            if (!that.config.DO_NOT_HIDE) {
                File.editor.contextMenu.hide();
            }
            // 展示三级菜单
        }).on("mouseenter", "[data-key]", function () {
            const t = $(this);
            document.querySelectorAll(".plugin-menu-third").forEach(ele => ele.classList.remove("show"));
            document.querySelectorAll(".plugin-dynamic-arg").forEach(ele => ele.parentElement.removeChild(ele));
            const fixedName = t.attr("data-key");
            const menu = $(`.plugin-menu-third[fixed_name="${fixedName}"]`);
            const dynamicCallArgs = that.generateDynamicCallArgs(fixedName);
            if (dynamicCallArgs) {
                that.appendThirdLi(menu, dynamicCallArgs);
            }
            if (menu.children().length === 0) {
                that.appendDummyThirdLi(menu);
            }
            if (t.find(`span[data-lg="Menu"]`).length) {
                that.show(menu, t);
            } else {
                document.querySelector("#plugin-menu .plugin-has-args").classList.remove("active");
            }
        })

        // 在三级菜单中调用插件
        $(".plugin-menu-third").on("click", "[data-key]", function () {
            // 点击禁用的选项
            if (this.classList.contains("disabled")) return false;

            const fixedName = this.parentElement.getAttribute("fixed_name");
            const argValue = this.getAttribute("arg_value");
            const plugin = that.utils.getPlugin(fixedName);
            if (argValue !== that.config.NOT_AVAILABLE_VALUE && plugin && plugin.call) {
                plugin.call(argValue);
            }
            if (!that.config.DO_NOT_HIDE) {
                File.editor.contextMenu.hide();
            }
            // 高亮二级菜单
        }).on("mouseenter", function () {
            const fixedName = this.getAttribute("fixed_name");
            const parent = document.querySelector(`#plugin-menu [data-key="${fixedName}"]`);
            parent.classList.add("active");
        })
    }

    call = type => {
        if (type === "about") {
            const url = "https://github.com/obgnail/typora_plugin"
            const openUrl = File.editor.tryOpenUrl_ || File.editor.tryOpenUrl
            openUrl(url, 1);
        } else if (type === "do_not_hide") {
            this.config.DO_NOT_HIDE = !this.config.DO_NOT_HIDE;
        } else if (type === "open_setting_folder") {
            const filepath = this.utils.joinPath("./plugin/global/settings/settings.toml");
            JSBridge.showInFinder(filepath);
        }
    }

    callArgs = [
        {
            arg_name: "右键菜单点击后保持显示/隐藏",
            arg_value: "do_not_hide"
        },
        {
            arg_name: "打开插件配置文件",
            arg_value: "open_setting_folder"
        },
        {
            arg_name: "关于/帮助",
            arg_value: "about"
        },
    ]
}

module.exports = {
    plugin: rightClickMenuPlugin
};
