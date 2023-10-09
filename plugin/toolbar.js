class toolbarPlugin extends global._basePlugin {
    beforeProcess = () => {
        this.toolController = new toolController(this);
        [
            tabTool,
            pluginTool,
            RecentFileTool,
            operationTool,
            modeTool,
            tempThemeTool
        ].forEach(tool => this.registerBarTool(new tool()));
    }

    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    styleTemplate = () => ({topPercent: `${this.config.TOOLBAR_TOP_PERCENT}%`})

    htmlTemplate = () => [{
        id: "plugin-toolbar",
        style: {display: "none"},
        children: [
            {
                id: "plugin-toolbar-input",
                children: [{
                    ele: "input", class_: "input", tabindex: "1", autocorrect: "off", spellcheck: "false",
                    autocapitalize: "off", placeholder: "ops 资源管理器打开", "data-lg": "Front",
                    title: "支持查询：\nplu：插件\ntab：标签页\nhis：最近文件\nops：常用操作\nmode：模式\ntheme：临时主题"
                }]
            },
            {class_: "plugin-toolbar-result"}
        ]
    }]

    init = () => {
        this.entities = {
            content: document.querySelector("content"),
            toolbar: document.querySelector("#plugin-toolbar"),
            input: document.querySelector("#plugin-toolbar-input input"),
            result: document.querySelector("#plugin-toolbar .plugin-toolbar-result")
        }
        this.handleInput = this.utils.debouncePromise(this.toolController.handleInput, this.config.DEBOUNCE_INTERVAL);
        this.selectItem = this.utils.selectItemFromList(this.entities.result, ".plugin-toolbar-item.active");
    }

    process = () => {
        this.init();
        this.entities.input.addEventListener("keydown", async ev => {
            switch (ev.key) {
                case "Enter":
                    const select = this.entities.result.querySelector(".plugin-toolbar-item.active");
                    if (select) {
                        this.run(select, ev);
                        this.hide();
                    }
                    break
                case "ArrowUp":
                case "ArrowDown":
                    ev.stopPropagation();
                    ev.preventDefault();
                    this.selectItem(ev);
                    break
                case "Escape":
                case "Backspace":
                    if (ev.key === "Escape" || ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.entities.input.value) {
                        ev.stopPropagation();
                        ev.preventDefault();
                        this.hide();
                    } else {
                        await this.search(ev);
                    }
                    break
                default:
                    await this.search(ev);
            }
        })

        this.entities.result.addEventListener("click", ev => {
            const target = ev.target.closest(".plugin-toolbar-item");
            target && this.run(target, ev);
        });
    }

    call = async () => {
        if (this.entities.toolbar.style.display === "block") {
            this.hide();
        } else {
            await this.show();
        }
    }

    registerBarTool = tool => this.toolController.register(tool);
    unregisterBarTool = name => this.toolController.unregister(name);

    run = (target, ev) => {
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
        const tool = target.getAttribute("tool");
        const fixedName = target.getAttribute("data");
        const meta = target.getAttribute("meta");
        this.toolController.callback(tool, fixedName, meta);
    }

    search = async ev => {
        const result = await this.handleInput(this.entities.input);
        const ok = result && result["matches"] && result["tool"];
        this.entities.result.innerHTML = ok ? this.newItems(result).join("") : "";
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
    }

    show = async () => {
        this.toolController.setAnchorNode();
        const widthRatio = this.config.TOOLBAR_WIDTH_PERCENT / 100;
        const {width, left} = this.entities.content.getBoundingClientRect();
        this.entities.toolbar.style.width = width * widthRatio + "px";
        this.entities.toolbar.style.left = left + width * (1 - widthRatio) / 2 + "px";
        this.entities.toolbar.style.display = "block";
        this.entities.input.select();
        await this.search();
    }

    hide = () => {
        this.entities.toolbar.style.display = "none";
        this.entities.input.value = "";
        this.entities.result.innerHTML = "";
    }

    newItems = result => {
        const tool = result.tool.name();
        const regExp = new RegExp(result.input, "gi");
        return result.matches.map(match => {
            let showName = match;
            let fixedName = match;
            let meta = "";
            if (typeof match === "object") {
                showName = match["showName"];
                fixedName = match["fixedName"];
                meta = match["meta"];
            }
            const content = (result.input) ? showName.replace(regExp, `<b>$&</b>`) : showName;
            const metaContent = (meta) ? `meta="${meta}"` : "";
            return `<div class="plugin-toolbar-item" data="${fixedName}" tool="${tool}" ${metaContent}>${content}</div>`
        })
    }
}

class baseToolInterface {
    name = () => {
    }
    init = () => {
    }
    // 要么返回 []string
    // 要么返回 [{ showName:"", fixedName:"", mata:"" }]
    search = async input => {
    }
    callback = (fixedName, meta) => {
    }

    baseSearch = (input, list, itemFields) => {
        if (input === "") return list;

        input = input.toLowerCase();
        return list.filter(item => {
            if (!itemFields) {
                return item.toLowerCase().indexOf(input) !== -1
            }

            for (const field of itemFields) {
                if (item[field].toLowerCase().indexOf(input) !== -1) {
                    return true
                }
            }
        })
    }
}

class tabTool extends baseToolInterface {
    name = () => "tab"

    init = () => {
        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            this.windowTabBarPlugin = this.utils.getPlugin("window_tab");
        })
    }

    search = async input => {
        if (!this.windowTabBarPlugin) return;

        const current = this.utils.getFilePath();
        const paths = this.windowTabBarPlugin.tabUtil.tabs.filter(tab => tab.path !== current).map(tab => tab.path);
        return this.baseSearch(input, paths);
    }

    callback = fixedName => this.windowTabBarPlugin.switchTabByPath(fixedName)
}

class pluginTool extends baseToolInterface {
    name = () => "plu"

    collectAll = () => {
        const pluginsList = [];
        for (const fixedName of Object.keys(global._plugins)) {
            const plugin = global._plugins[fixedName];

            if (!plugin["call"]) continue

            const chineseName = plugin.config.NAME;
            const dynamicCallArgs = this.utils.generateDynamicCallArgs(fixedName, this.controller.anchorNode);
            if ((!dynamicCallArgs || dynamicCallArgs.length === 0) && (!plugin.callArgs || plugin.callArgs === 0)) {
                pluginsList.push({showName: chineseName, fixedName: fixedName});
                continue
            }

            if (plugin.callArgs) {
                for (const arg of plugin.callArgs) {
                    const show = chineseName + " - " + arg.arg_name;
                    pluginsList.push({showName: show, fixedName: fixedName, meta: arg.arg_value});
                }
            }

            if (dynamicCallArgs) {
                for (const arg of dynamicCallArgs) {
                    if (!arg["arg_disabled"]) {
                        const show = chineseName + " - " + arg.arg_name;
                        pluginsList.push({showName: show, fixedName: fixedName, meta: arg.arg_value});
                    }
                }
            }
        }

        pluginsList.forEach(plugin => plugin.showName += (plugin["meta"]) ? ` （ ${plugin.fixedName} - ${plugin.meta} ）` : ` （ ${plugin.fixedName} ）`)
        return pluginsList
    }

    search = async input => {
        const pluginsList = this.collectAll();
        return this.baseSearch(input, pluginsList, ["showName"])
    }

    callback = (fixedName, meta) => {
        const plugin = this.utils.getPlugin(fixedName);
        if (plugin) {
            plugin.call(meta || undefined, this.controller.anchorNode);
            return
        }
        const customPlugin = this.utils.getCustomPlugin(fixedName);
        if (customPlugin) {
            global._plugins.custom.call(fixedName, this.controller.anchorNode);
        }
    }
}

class RecentFileTool extends baseToolInterface {
    name = () => "his"

    getRecentFile = async () => {
        if (!File.isNode) return;

        const file = await JSBridge.invoke("setting.getRecentFiles");
        const fileJson = JSON.parse(file || "{}");
        const files = fileJson["files"] || [];
        const folders = fileJson["folders"] || [];
        const result = [];
        for (const file of files) {
            if (file["path"]) {
                result.push({showName: file.path, fixedName: file.path, meta: "file"});
            }
        }
        for (const folder of folders) {
            if (folder["path"]) {
                result.push({showName: folder.path, fixedName: folder.path, meta: "folder"});
            }
        }
        return result
    }

    search = async input => {
        let files = await this.getRecentFile();
        if (!files || files.length === 0) return;

        const current = this.utils.getFilePath();
        files = files.filter(file => file.showName !== current); // 小细节：去掉当前的文件

        return this.baseSearch(input, files, ["fixedName"])
    }

    callback = (fixedName, meta) => {
        if (meta === "file") {
            this.utils.openFile(fixedName);
        } else if (meta === "folder") {
            this.utils.openFolder(fixedName);
        }
    }
}

class operationTool extends baseToolInterface {
    name = () => "ops"

    init = () => {
        this.ops = [
            {
                showName: "资源管理器打开",
                fixedName: "explorer",
                callback: () => JSBridge.showInFinder(this.utils.getFilePath())
            },
            {
                showName: "复制文件路径",
                fixedName: "copyPath",
                callback: () => File.editor.UserOp.setClipboard(null, null, this.utils.getFilePath())
            }
        ]

        this.ops.forEach(op => op.showName += ` - ${op.fixedName}`);
    }

    search = async input => this.baseSearch(input, this.ops, ["showName"])

    callback = (fixedName, meta) => {
        for (const op of this.ops) {
            if (fixedName === op.fixedName) {
                op.callback(meta);
                return
            }
        }
    }
}

class modeTool extends baseToolInterface {
    name = () => "mode"

    init = () => {
        this.modes = [
            {
                showName: "大纲视图",
                fixedName: "outlineView",
                callback: () => {
                    File.editor.library.toggleSidebar();
                    File.isNode && ClientCommand.refreshViewMenu();
                }
            },
            {
                showName: "源代码模式",
                fixedName: "sourceMode",
                callback: () => File.toggleSourceMode()
            },
            {
                showName: "专注模式",
                fixedName: "focusMode",
                callback: () => File.editor.toggleFocusMode()
            },
            {
                showName: "打字机模式",
                fixedName: "typewriterMode",
                callback: () => File.editor.toggleTypeWriterMode()
            },
        ]
        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            const readonly = this.utils.getPlugin("read_only");
            readonly && this.modes.push({
                showName: "只读模式",
                fixedName: "readOnlyMode",
                callback: () => readonly.call()
            });
            const blur = this.utils.getPlugin("blur");
            blur && this.modes.push({
                showName: "模糊模式",
                fixedName: "blurMode",
                callback: () => blur.call()
            })
            this.modes.push({
                showName: "调试模式",
                fixedName: "debugMode",
                callback: () => JSBridge.invoke("window.toggleDevTools")
            })
            this.modes.forEach(mode => mode.showName += ` - ${mode.fixedName}`);
        })
    }
    search = async input => this.baseSearch(input, this.modes, ["showName"])
    callback = (fixedName, meta) => {
        for (const mode of this.modes) {
            if (fixedName === mode.fixedName) {
                mode.callback(meta);
                return
            }
        }
    }
}

class tempThemeTool extends baseToolInterface {
    name = () => "theme"

    setThemeForever = theme => ClientCommand.setTheme(theme);
    setThemeTemp = theme => File.setTheme(theme);

    search = async input => {
        const {all, current} = await JSBridge.invoke("setting.getThemes");
        const list = all.map(theme => {
            return {showName: theme.replace(/\.css/gi, ""), fixedName: theme}
        });
        return this.baseSearch(input, list, ["showName"]);
    }

    callback = async fixedName => {
        const {all, current} = await JSBridge.invoke("setting.getThemes");
        for (const theme of all) {
            if (fixedName === theme) {
                this.setThemeTemp(theme);
                return
            }
        }
    }
}

class toolController {
    constructor(plugin) {
        this.plugin = plugin;
        this.utils = plugin.utils;
        this.tools = new Map();  // map[short]tool
        this.anchorNode = null;
    }

    register = tool => {
        tool.controller = this;
        tool.utils = this.utils;
        tool.init();

        const short = tool.name();
        this.tools.set(short, tool);
    }

    unregister = name => this.tools.delete(name);

    callback = (toolName, fixedName, meta) => {
        const tool = this.tools.get(toolName);
        if (!tool) return;

        tool.callback(fixedName, meta);
    }

    setAnchorNode = () => this.anchorNode = this.utils.getAnchorNode();

    handleInput = async inputElement => {
        const raw = inputElement.value;
        let {tool, input} = this.dispatch(raw);
        if (tool) {
            const matches = await tool.search(input);
            if (matches && matches.length) {
                return {tool, input, matches}
            }
        }
    }

    dispatch = raw => {
        for (const short of this.tools.keys()) {
            if (raw.startsWith(short + " ")) {
                return {tool: this.tools.get(short), input: raw.slice(short.length + 1).trim()}
            }
        }
        if (this.plugin.config.DEFAULT_TOOL) {
            return {tool: this.tools.get(this.plugin.config.DEFAULT_TOOL), input: raw.trim()}
        }
        return {tool: null, input: ""}
    }
}

module.exports = {
    plugin: toolbarPlugin
};
