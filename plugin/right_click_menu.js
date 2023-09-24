class rightClickMenuPlugin extends global._basePlugin {
    init = () => {
        this.notavailableValue = "__not_available__";
        this.callArgs = [
            {arg_name: "右键菜单点击后保持显示/隐藏", arg_value: "do_not_hide"},
            {arg_name: "打开插件配置文件", arg_value: "open_setting_folder"},
            {arg_name: "关于/帮助", arg_value: "about"},
        ]
    }

    process = () => {
        this.init();
        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, this.appendMenu);
    }

    appendMenu = () => {
        setTimeout(() => {
            // 一级菜单汇总所有插件
            this.appendFirst();
            // 二级菜单展示所有插件
            this.appendSecond();
            // 三级菜单展示插件的参数
            this.appendThird();
            this.listen();
        }, 500)
    }

    appendFirst = () => {
        const ul = document.querySelector(`#context-menu`);
        const line = document.createElement("li");
        line.classList.add("divider");
        line.setAttribute("data-group", "plugin");
        ul.appendChild(line);

        const first = this.config.MENUS.map((menu, idx) => {
            return `<li data-key="typora-plugin" class="has-extra-menu" idx="${idx}">
                <a role="menuitem">
                    <span data-localize="${menu.NAME}" data-lg="Menu">${menu.NAME}</span>
                    <i class="fa fa-caret-right"></i>
                </a>
            </li>`
        })
        ul.insertAdjacentHTML('beforeend', first.join(""));
    }

    appendSecond = () => {
        this.findLostPluginIfNeed();
        this.config.MENUS.forEach((menu, idx) => {
            const plugins = menu.LIST.map(item => {
                if (item === "---") {
                    return `<li class="divider"></li>`
                }
                const plugin = this.utils.getPlugin(item);
                if (plugin) {
                    return this.createSecondLi(plugin);
                }
                return ""
            })
            const secondUl = this.createUl();
            secondUl.classList.add("plugin-menu-second");
            secondUl.setAttribute("idx", idx);
            secondUl.innerHTML = plugins.join("");
            document.querySelector("content").appendChild(secondUl);
        })
    }

    appendThird = () => {
        this.config.MENUS.forEach((menu, idx) => {
            menu.LIST.forEach(item => {
                if (item === "---") return;
                const plugin = this.utils.getPlugin(item);
                if (!plugin || !plugin.callArgs && !plugin.dynamicCallArgsGenerator) return;

                const thirdUl = this.createUl();
                thirdUl.classList.add("plugin-menu-third");
                thirdUl.setAttribute("idx", idx);
                thirdUl.setAttribute("fixed_name", plugin.fixedName);
                thirdUl.innerHTML = plugin.callArgs ? plugin.callArgs.map(arg => this.createThirdLi(arg)).join("") : "";
                document.querySelector("content").appendChild(thirdUl);
            })
        })
    }

    createSecondLi = plugin => {
        const hasNotArgs = !plugin.callArgs && !plugin.dynamicCallArgsGenerator;
        const style = (plugin.config.CLICKABLE) ? "" : `style="pointer-events: none;color: #c4c6cc;"`;
        const content = (hasNotArgs) ? plugin.config.NAME : `<span data-lg="Menu">${plugin.config.NAME}</span> <i class="fa fa-caret-right"></i>`;
        const className = (hasNotArgs) ? "" : "has-extra-menu";
        return `<li data-key="${plugin.fixedName}" class="plugin-menu-item ${className}" ${style}><a role="menuitem" data-lg="Menu">${content}</a></li>`
    }

    createThirdLi = (arg, dynamic) => {
        const hint = (arg.arg_hint) ? `ty-hint="${arg.arg_hint}"` : "";
        const disabled = (arg.arg_disabled) ? " disabled" : "";
        const className = (dynamic) ? `class="plugin-dynamic-arg${disabled}"` : "";
        return `<li data-key="${arg.arg_name}" arg_value="${arg.arg_value}" ${className} ${hint}><a role="menuitem" data-lg="Menu">${arg.arg_name}</a></li>`
    }

    createUl = () => {
        const secondUl = document.createElement("ul");
        secondUl.classList.add("dropdown-menu");
        secondUl.classList.add("context-menu");
        secondUl.classList.add("ext-context-menu");
        secondUl.setAttribute("role", "menu");
        return secondUl;
    }

    findLostPluginIfNeed = () => {
        if (!this.config.FIND_LOST_PLUGIN) return;

        const allPlugins = new Map();
        for (const fixedName of Object.keys(global._plugins)) {
            allPlugins.set(fixedName, global._plugins[fixedName]);
        }
        this.config.MENUS.forEach(menu => menu.LIST.forEach(plugin => allPlugins.delete(plugin)));
        for (const plugin of allPlugins.values()) {
            this.config.MENUS[this.config.MENUS.length - 1].LIST.push(plugin.fixedName);
        }
    }

    show = (after, before) => {
        const next = after.addClass("show");

        const rect = next[0].getBoundingClientRect();
        const nextHeight = rect.height;
        const nextWidth = rect.width;

        const {left, top, width, height} = before[0].getBoundingClientRect();
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

    appendThirdLi = (menu, dynamicCallArgs) => {
        const args = dynamicCallArgs.map(arg => this.createThirdLi(arg, true)).join("");
        menu.append(args);
    }

    appendDummyThirdLi = menu => {
        this.appendThirdLi(menu, [{
            arg_name: "光标于此位置不可用",
            arg_value: this.notavailableValue,
            arg_disabled: true,
        }])
    }

    listen = () => {
        const that = this;

        // 展示二级菜单
        $("#context-menu").on("mouseenter", "[data-key]", function () {
            const first = $(this);
            if ("typora-plugin" === first.attr("data-key")) {
                const idx = this.getAttribute("idx");
                if (document.querySelector(`.plugin-menu-second.show`)) {
                    document.querySelectorAll(`.plugin-menu-third:not([idx="${idx}"])`).forEach(ele => ele.classList.remove("show"));
                }
                const otherSecond = document.querySelectorAll(`.plugin-menu-second:not([idx="${idx}"])`);
                otherSecond.forEach(ele => ele.querySelectorAll(`.plugin-menu-item.active`).forEach(ele => ele.classList.remove("active")));
                otherSecond.forEach(ele => ele.classList.remove("show"));
                that.show($(`.plugin-menu-second[idx="${idx}"]`), first);
                first.addClass("active");
            } else {
                document.querySelectorAll(".plugin-menu-second").forEach(ele => ele.classList.remove("show"));
                document.querySelectorAll("[data-key='typora-plugin']").forEach(ele => ele.classList.remove("active"));
                document.querySelectorAll(".plugin-menu-third").forEach(ele => ele.classList.remove("show"));
            }
        })
        // 展示三级菜单
        $(".plugin-menu-second").on("mouseenter", "[data-key]", function () {
            const second = $(this);
            document.querySelectorAll(`.plugin-menu-third`).forEach(ele => ele.classList.remove("show"));
            document.querySelectorAll(".plugin-dynamic-arg").forEach(ele => ele.parentElement.removeChild(ele));
            const fixedName = second.attr("data-key");
            const third = $(`.plugin-menu-third[fixed_name="${fixedName}"]`);
            const dynamicCallArgs = that.utils.generateDynamicCallArgs(fixedName);
            if (dynamicCallArgs) {
                that.appendThirdLi(third, dynamicCallArgs);
            }
            if (third.children().length === 0) {
                that.appendDummyThirdLi(third);
            }
            if (second.find(`span[data-lg="Menu"]`).length) {
                that.show(third, second);
            } else {
                document.querySelector(".plugin-menu-second .has-extra-menu").classList.remove("active");
            }
            // 在二级菜单中调用插件
        }).on("click", "[data-key]", function () {
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
        })

        // 在三级菜单中调用插件
        $(".plugin-menu-third").on("click", "[data-key]", function () {
            // 点击禁用的选项
            if (this.classList.contains("disabled")) return false;

            const fixedName = this.parentElement.getAttribute("fixed_name");
            const argValue = this.getAttribute("arg_value");
            const plugin = that.utils.getPlugin(fixedName);
            if (argValue !== that.notavailableValue && plugin && plugin.call) {
                plugin.call(argValue);
            }
            if (!that.config.DO_NOT_HIDE) {
                File.editor.contextMenu.hide();
            }
        })
    }

    call = type => {
        if (type === "about") {
            this.utils.openUrl("https://github.com/obgnail/typora_plugin");
        } else if (type === "do_not_hide") {
            this.config.DO_NOT_HIDE = !this.config.DO_NOT_HIDE;
        } else if (type === "open_setting_folder") {
            const filepath = this.utils.joinPath("./plugin/global/settings/settings.user.toml");
            JSBridge.showInFinder(filepath);
        }
    }
}

module.exports = {
    plugin: rightClickMenuPlugin
};
