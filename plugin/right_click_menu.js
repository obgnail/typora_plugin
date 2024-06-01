// 插件名称是通过配置文件引入的，为了避免XSS注入，不可使用innerHTML
class rightClickMenuPlugin extends BasePlugin {
    styleTemplate = () => {
        const {MENU_MIN_WIDTH, HIDE_OTHER_OPTIONS} = this.config;
        const map = {"default": "", "auto": "inherit"};
        const width = map[MENU_MIN_WIDTH] || MENU_MIN_WIDTH;
        const display = HIDE_OTHER_OPTIONS ? "none" : "";
        if (width || display) {
            return {menu_min_width: width, menu_option_display: display}
        }
    }

    init = () => {
        this.groupName = "typora-plugin";
        this.noExtraMenuGroupName = "typora-plugin-no-extra";
        this.dividerArg = "---";
        this.unavailableArg = "__not_available__";
        this.callArgs = [{arg_name: "右键菜单点击后保持显示/隐藏", arg_value: "do_not_hide"}];
    }

    process = () => this.utils.addEventListener(this.utils.eventType.everythingReady, this.appendMenu)

    appendMenu = () => {
        setTimeout(() => {
            this.appendFirst();  // 一级菜单汇总所有插件
            this.appendSecond(); // 二级菜单展示所有插件
            this.appendThird();  // 三级菜单展示插件的参数
            this.listen();
        }, 500)
    }

    appendFirst = () => {
        const items = this.config.MENUS.map(({NAME, LIST = []}, idx) => {
            const item = [{ele: "span", "data-lg": "Menu", text: NAME}];
            const children = [{ele: "a", role: "menuitem", children: item}];
            const noExtraMenu = LIST && LIST.length === 1;
            if (noExtraMenu) {
                return {ele: "li", "data-key": this.noExtraMenuGroupName, "data-value": LIST[0], idx, children};
            }
            item.push(this.caret());
            return {ele: "li", class_: "has-extra-menu", "data-key": this.groupName, idx, children};
        })
        const elements = [this.divider(), ...items];
        const menu = document.querySelector("#context-menu");
        this.utils.appendElements(menu, elements);
    }

    appendSecond = () => {
        this.findLostPluginIfNeed();

        const elements = this.config.MENUS.map(({LIST = []}, idx) => {
            const children = LIST.map(item => {
                if (item === this.dividerArg) return this.divider();

                const [fixedName, callArg] = item.split(".");
                const plugin = this.utils.getPlugin(fixedName);
                if (!plugin) return {}

                if (callArg) {
                    return this.secondComposeLiTemplate(plugin, callArg)
                } else {
                    return this.secondLiTemplate(plugin)
                }
            })
            return this.ulTemplate({class_: ["plugin-menu-second"], idx, children});
        })
        const content = document.querySelector("content");
        this.utils.appendElements(content, elements);
    }

    appendThird = () => {
        const content = document.querySelector("content");
        this.config.MENUS.forEach(({LIST = []}, idx) => {
            const elements = LIST.map(item => {
                if (item === this.dividerArg) return {};

                const plugin = this.utils.getPlugin(item);
                if (!plugin || !plugin.callArgs && !plugin.dynamicCallArgsGenerator) return {};

                const children = (plugin.callArgs || []).map(arg => this.thirdLiTemplate(arg));
                return this.ulTemplate({class_: ["plugin-menu-third"], "data-plugin": plugin.fixedName, idx, children});
            })
            this.utils.appendElements(content, elements);
        })
    }

    secondComposeLiTemplate = (plugin, callArg) => {
        const target = plugin.callArgs.find(arg => arg.arg_value === callArg);
        const name = target ? target.arg_name : plugin.config.NAME;
        const children = [{ele: "a", role: "menuitem", "data-lg": "Menu", text: name}];
        return {ele: "li", class_: "plugin-menu-item", "data-key": plugin.fixedName, "data-value": callArg, children}
    }

    secondLiTemplate = plugin => {
        const hasNotArgs = !plugin.callArgs && !plugin.dynamicCallArgsGenerator;

        const extra = {class_: ["plugin-menu-item"]};
        if (!hasNotArgs) {
            extra.class_.push("has-extra-menu");
        }
        if (!plugin.config.CLICKABLE) {
            extra.style = {color: "#c4c6cc", pointerEvents: "none"};
        }

        const childrenExtra = hasNotArgs
            ? {text: plugin.config.NAME}
            : {children: [{ele: "span", "data-lg": "Menu", text: plugin.config.NAME, children: [this.caret()]}]};

        const children = [{ele: "a", role: "menuitem", "data-lg": "Menu", ...childrenExtra}];
        return {ele: "li", "data-key": plugin.fixedName, children, ...extra}
    }

    thirdLiTemplate = (arg, dynamic) => {
        const extra = {};
        if (arg.arg_hint) {
            extra["ty-hint"] = arg.arg_hint;
        }
        if (dynamic) {
            extra.class_ = `plugin-dynamic-arg ${(arg.arg_disabled) ? "disabled" : ""}`;
        }
        const children = [{ele: "a", role: "menuitem", "data-lg": "Menu", text: arg.arg_name}];
        return {ele: "li", "data-key": arg.arg_value, ...extra, children}
    }

    ulTemplate = extra => {
        extra.class_.push("dropdown-menu", "context-menu", "ext-context-menu");
        return {ele: "ul", role: "menu", ...extra}
    }

    divider = () => ({ele: "li", class_: "divider"})
    caret = () => ({ele: "i", class_: "fa fa-caret-right"})

    findLostPluginIfNeed = () => {
        if (!this.config.FIND_LOST_PLUGIN) return;

        const allPlugins = new Map(Object.entries(this.utils.getAllPlugins()));
        this.config.MENUS.forEach(menu => menu.LIST.forEach(plugin => allPlugins.delete(plugin)));
        for (const plugin of allPlugins.values()) {
            this.config.MENUS[this.config.MENUS.length - 1].LIST.push(plugin.fixedName);
        }
    }

    show = ($after, $before) => {
        const margin = 6;
        const {left, top, width, height} = $before[0].getBoundingClientRect();
        let afterTop = top - height;
        let afterLeft = left + width + margin;

        const footer = document.querySelector("footer");
        const footerHeight = footer ? footer.getBoundingClientRect().height : 0;

        $after.addClass("show");
        const {height: afterHeight, width: afterWidth} = $after[0].getBoundingClientRect();
        afterTop = Math.min(afterTop, window.innerHeight - afterHeight - footerHeight);
        afterLeft = afterLeft + afterWidth < window.innerWidth ? afterLeft : Math.max(0, left - afterWidth - margin);

        $after.css({top: afterTop + "px", left: afterLeft + "px"});
    }

    appendThirdLi = ($menu, dynamicCallArgs) => {
        dynamicCallArgs.forEach(arg => $menu.append(this.utils.createElement(this.thirdLiTemplate(arg, true))))
    }
    appendDummyThirdLi = $menu => this.appendThirdLi($menu, [{arg_name: this.unavailableArg, arg_disabled: true}])

    hideMenuIfNeed = () => !this.config.DO_NOT_HIDE && File.editor.contextMenu.hide();

    callPlugin = plugin => plugin.call && plugin.call();
    dynamicCallPlugin = (plugin, arg) => {
        if (arg !== this.unavailableArg && plugin && plugin.call) {
            this.utils.withMeta(meta => plugin.call(arg, meta));
        }
    }

    listen = () => {
        const that = this;
        const removeShow = ele => ele.classList.remove("show");
        const removeActive = ele => ele.classList.remove("active");

        // 点击一级菜单
        $("#context-menu").on("click", `[data-key="${this.noExtraMenuGroupName}"]`, function () {
            const value = this.getAttribute("data-value");
            if (!value) return false;
            const [fixedName, callArg] = value.split(".");
            if (!fixedName || !callArg) return false;
            const plugin = that.utils.getPlugin(fixedName);
            that.dynamicCallPlugin(plugin, callArg);
            that.hideMenuIfNeed();
            // 展示二级菜单
        }).on("mouseenter", "[data-key]", function () {
            const first = $(this);
            if (that.groupName === first.attr("data-key")) {
                const idx = this.getAttribute("idx");
                if (document.querySelector(".plugin-menu-second.show")) {
                    document.querySelectorAll(`.plugin-menu-third:not([idx="${idx}"])`).forEach(removeShow);
                }
                const otherSecond = document.querySelectorAll(`.plugin-menu-second:not([idx="${idx}"])`);
                otherSecond.forEach(ele => ele.querySelectorAll(".plugin-menu-item.active").forEach(removeActive));
                otherSecond.forEach(removeShow);
                that.show($(`.plugin-menu-second[idx="${idx}"]`), first);
                first.addClass("active");
            } else {
                document.querySelectorAll(`[data-key='${that.groupName}']`).forEach(removeActive);
                document.querySelectorAll(".plugin-menu-second").forEach(removeShow);
                document.querySelectorAll(".plugin-menu-third").forEach(removeShow);
            }
        })

        // 展示三级菜单
        $(".plugin-menu-second").on("mouseenter", "[data-key]", function () {
            const second = $(this);
            document.querySelectorAll(`.plugin-menu-third`).forEach(removeShow);
            document.querySelectorAll(".plugin-dynamic-arg").forEach(ele => ele.parentElement.removeChild(ele));
            const fixedName = second.attr("data-key");
            const $third = $(`.plugin-menu-third[data-plugin="${fixedName}"]`);
            const dynamicCallArgs = that.utils.generateDynamicCallArgs(fixedName);
            if (dynamicCallArgs) {
                that.appendThirdLi($third, dynamicCallArgs);
            }
            if ($third.children().length === 0) {
                that.appendDummyThirdLi($third);
            }
            if (second.find(`span[data-lg="Menu"]`).length) {
                that.show($third, second);
            } else {
                removeActive(document.querySelector(".plugin-menu-second .has-extra-menu"));
            }
            // 在二级菜单中调用插件
        }).on("click", "[data-key]", function () {
            const fixedName = this.getAttribute("data-key");
            const callArg = this.getAttribute("data-value");
            const plugin = that.utils.getPlugin(fixedName);
            if (callArg) {
                that.dynamicCallPlugin(plugin, callArg);
            } else {
                // 拥有三级菜单的，不允许点击二级菜单
                if (!plugin || plugin.callArgs || plugin.dynamicCallArgsGenerator) return false;
                that.callPlugin(plugin);
            }
            that.hideMenuIfNeed();
        })

        // 在三级菜单中调用插件
        $(".plugin-menu-third").on("click", "[data-key]", function () {
            // 点击禁用的选项
            if (this.classList.contains("disabled")) return false;

            const fixedName = this.parentElement.getAttribute("data-plugin");
            const callArg = this.getAttribute("data-key");
            const plugin = that.utils.getPlugin(fixedName);
            that.dynamicCallPlugin(plugin, callArg);
            that.hideMenuIfNeed();
        })
    }

    call = type => {
        if (type === "do_not_hide") {
            this.config.DO_NOT_HIDE = !this.config.DO_NOT_HIDE;
        }
    }
}

module.exports = {
    plugin: rightClickMenuPlugin
};
