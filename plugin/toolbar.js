class toolbarPlugin extends global._basePlugin {
    beforeProcess = () => {
        this.toolController = new toolController(this);
        [
            tabTool,
            pluginTool,
            recentFileTool,
            operationTool,
            modeTool,
            tempThemeTool,
            functionTool,
            mixTool,
        ].forEach(tool => this.registerBarTool(new tool()));
    }

    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    styleTemplate = () => ({topPercent: `${this.config.TOOLBAR_TOP_PERCENT}%`})

    htmlTemplate = () => {
        const title = "支持查询：\nplu：插件\ntab：标签页\nhis：最近文件\nops：常用操作\nmode：模式\ntheme：临时主题";
        const children = [
            {id: "plugin-toolbar-input", children: [{ele: "input", placeholder: "ops 资源管理器打开", title}]},
            {class_: "plugin-toolbar-result"}
        ]
        return [{id: "plugin-toolbar", class_: "plugin-common-modal", style: {display: "none"}, children}]
    }

    init = () => {
        this.hideWhenEnter = true;
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
                    let select = this.entities.result.querySelector(".plugin-toolbar-item.active");
                    if (!select && this.entities.result.childElementCount === 1) {
                        select = this.entities.result.firstChild;
                    }
                    if (select) {
                        this.run(select, ev);
                        this.hideWhenEnter && this.hide();
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
        const result = await this.handleInput();
        const ok = result && result["matches"] && result["tool"];
        this.entities.result.innerHTML = ok ? this.newItems(result).join("") : "";
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
    }

    newItems = result => {
        const {tool, matches, input} = result;

        const toolName = tool.name();
        return matches.map(match => {
            let showName = match;
            let fixedName = match;
            let meta = "";
            if (typeof match === "object") {
                showName = match["showName"];
                fixedName = match["fixedName"];
                meta = match["meta"];
            }

            let content = showName;
            if (input[0]) {
                input.forEach(part => content = content.replace(new RegExp(part, "gi"), "<b>$&</b>"));
            }
            const metaContent = (meta) ? `meta="${meta}"` : "";
            return `<div class="plugin-toolbar-item" data="${fixedName}" tool="${toolName}" ${metaContent}>${content}</div>`
        })
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
}

class baseToolInterface {
    name = () => {
    }
    translate = () => {
    }
    init = () => {
    }
    // 要么返回 []string
    // 要么返回 [{ showName:"", fixedName:"", meta:"" }]
    search = async input => {
    }
    callback = (fixedName, meta) => {
    }

    baseSearch = (input, list, itemFields) => {
        if (input === "") return list;

        input = input.toLowerCase();

        const func = (!itemFields)
            ? item => item.toLowerCase().indexOf(input) !== -1
            : item => {
                for (const field of itemFields) {
                    if (item[field].toLowerCase().indexOf(input) !== -1) {
                        return true
                    }
                }
            }
        return list.filter(func)
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

    // 交集
    intersect = arrays => {
        if (!Array.isArray(arrays) || arrays.length === 0 || arrays.some(ele => !ele)) return [];

        if (arrays.length === 1) return arrays[0]

        if (typeof arrays[0][0] === "string") {
            return arrays[0].filter(ele => arrays.every(array => array.includes(ele)));
        } else {
            return arrays[0].filter(ele => arrays.every(array => array.some(item => (
                item.showName === ele.showName
                && item.fixedName === ele.fixedName
                && item.meta === ele.meta
            ))))
        }
    }

    // 并集
    union = arrays => {
        if (!Array.isArray(arrays) || arrays.length === 0) return [];

        const set = new Set();
        const first = arrays[0][0];
        const isObj = first && typeof first === "object";
        for (const arr of arrays) {
            for (const ele of arr) {
                set.add(isObj ? JSON.stringify(ele) : ele);
            }
        }
        return Array.from(set).map(str => (isObj ? JSON.parse(str) : str));
    }

    // 差集
    difference = (array1, array2) => {
        if (!Array.isArray(array2) || array2.length === 0) return array1

        const set = new Set(array2.map(val => JSON.stringify(val)));
        return array1.filter(val => !set.has(JSON.stringify(val)));
    }

    kind = input => {
        const all = input.split(" ").filter(Boolean);
        const positive = [];
        const negative = [];
        all.forEach(ele => {
            if (ele.startsWith("-")) {
                const value = ele.slice(1);
                value && negative.push(value);
            } else {
                positive.push(ele);
            }
        })
        positive.length === 0 && positive.push("");
        all.length === 0 && all.push("");
        return {all, positive, negative}
    }

    searchWithNeg = async (tool, positive, negative) => {
        const posList = await Promise.all(positive.map(tool.search));
        const negList = await Promise.all(negative.map(tool.search));

        const posResult = this.intersect(posList);
        const negResult = this.union(negList);
        const matches = this.difference(posResult, negResult);
        return {inputList: positive, matches}
    }

    searchWithoutNeg = async (tool, all) => {
        const resultList = await Promise.all(all.map(tool.search));
        const matches = this.intersect(resultList);
        return {inputList: all, matches}
    }

    search = async (tool, input) => {
        const {all, positive, negative} = this.kind(input);
        if (this.plugin.config.USE_NEGATIVE_SEARCH) {
            return this.searchWithNeg(tool, positive, negative);
        } else {
            return this.searchWithoutNeg(tool, all);
        }
    }

    dispatch = raw => {
        raw = raw.trimLeft();
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

    handleInput = async () => {
        const raw = this.plugin.entities.input.value;
        let {tool, input} = this.dispatch(raw);
        if (!tool) return

        const {inputList, matches} = await this.search(tool, input);
        if (matches && matches.length) {
            return {tool, input: inputList, matches}
        }
    }
}

class tabTool extends baseToolInterface {
    name = () => "tab"
    translate = () => "切换标签页"

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
    translate = () => "使用插件"

    collectAll = () => {
        const pluginsList = [];
        for (const [fixedName, plugin] of Object.entries(global._plugins)) {
            if (!plugin.call) continue

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
                    if (!arg.arg_disabled) {
                        const show = chineseName + " - " + arg.arg_name;
                        pluginsList.push({showName: show, fixedName: fixedName, meta: arg.arg_value});
                    }
                }
            }
        }

        pluginsList.forEach(plugin => plugin.showName += (plugin.meta) ? ` （ ${plugin.fixedName} - ${plugin.meta} ）` : ` （ ${plugin.fixedName} ）`)
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

class recentFileTool extends baseToolInterface {
    name = () => "his"
    translate = () => "打开最近文件"

    getRecentFile = async () => {
        if (!File.isNode) return;

        const file = await JSBridge.invoke("setting.getRecentFiles");
        const fileJson = (typeof file === "string") ? JSON.parse(file || "{}") : (file || {});
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
    translate = () => "执行操作"

    init = () => {
        this.ops = [
            {
                showName: "资源管理器打开", fixedName: "explorer",
                callback: () => JSBridge.showInFinder(this.utils.getFilePath())
            },
            {
                showName: "复制文件路径", fixedName: "copyPath",
                callback: () => File.editor.UserOp.setClipboard(null, null, this.utils.getFilePath())
            },
            {
                showName: "偏好设置", fixedName: "togglePreferencePanel",
                callback: () => File.megaMenu.togglePreferencePanel()
            },
            {
                showName: "窗口置顶", fixedName: "togglePinWindow", callback: () => {
                    const pined = document.body.classList.contains("always-on-top");
                    const func = pined ? "unpinWindow" : "pinWindow";
                    ClientCommand[func]();
                }
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
    translate = () => "切换模式"
    init = () => {
        this.modes = [
            {
                showName: "大纲视图", fixedName: "outlineView", callback: () => {
                    File.editor.library.toggleSidebar();
                    File.isNode && ClientCommand.refreshViewMenu();
                }
            },
            {showName: "源代码模式", fixedName: "sourceMode", callback: () => File.toggleSourceMode()},
            {showName: "专注模式", fixedName: "focusMode", callback: () => File.editor.toggleFocusMode()},
            {showName: "打字机模式", fixedName: "typewriterMode", callback: () => File.editor.toggleTypeWriterMode()},
        ]
        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            const readonly = this.utils.getPlugin("read_only");
            const blur = this.utils.getPlugin("blur");
            const dark = this.utils.getCustomPlugin("darkMode");
            if (readonly) {
                this.modes.push({showName: "只读模式", fixedName: "readOnlyMode", callback: () => readonly.call()});
            }
            if (blur) {
                this.modes.push({showName: "模糊模式", fixedName: "blurMode", callback: () => blur.call()});
            }
            if (dark) {
                this.modes.push({showName: "夜间模式", fixedName: "darkMode", callback: () => dark.callback()})
            }
            this.modes.push({
                showName: "调试模式", fixedName: "debugMode", callback: () => JSBridge.invoke("window.toggleDevTools")
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
    translate = () => "临时更换主题"

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

class functionTool extends baseToolInterface {
    name = () => "func"
    translate = () => "功能列表"

    search = async input => {
        const name = this.name();
        const all = Array.from(this.controller.tools.entries())
            .filter(tool => tool[0] !== name)
            .map(tool => {
                const fixedName = tool[0];
                const translate = tool[1].translate();
                return {showName: `${fixedName} - ${translate}`, fixedName}
            })
        return this.baseSearch(input, all, ["showName"]);
    }

    callback = async fixedName => {
        this.controller.plugin.entities.input.value = fixedName + " ";
        this.controller.plugin.hideWhenEnter = false;
        this.controller.plugin.entities.input.dispatchEvent(new Event('keydown'));
        setTimeout(() => this.controller.plugin.hideWhenEnter = true, 100);
    }
}

class mixTool extends baseToolInterface {
    name = () => "all"
    translate = () => "混合查找"

    search = async input => {
        const name = this.name();
        const all = await Promise.all(
            Array.from(this.controller.tools.entries())
                .filter(tool => tool[0] !== name)
                .map(async tool => {
                    const toolName = tool[0];
                    const toolResult = await tool[1].search(input);
                    if (!toolResult || !toolResult.length) return
                    if (typeof toolResult[0] === "string") {
                        return toolResult.map(ele => ({showName: ele, fixedName: ele, meta: `${toolName}@`}))
                    } else {
                        return toolResult.map(ele => ({
                            showName: ele.showName, fixedName: ele.fixedName, meta: `${toolName}@${ele.meta || ""}`
                        }))
                    }
                })
        )
        const list = all.filter(ele => !!ele);
        return [].concat(...list)
    }

    callback = (fixedName, meta) => {
        const at = meta.indexOf("@");
        const tool = meta.substring(0, at);
        const realMeta = meta.substring(at + 1);
        const t = this.controller.tools.get(tool);
        if (t) {
            t.callback(fixedName, realMeta);
        }
    }
}

module.exports = {
    plugin: toolbarPlugin
};
