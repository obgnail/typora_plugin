class toolbarPlugin extends BasePlugin {
    beforeProcess = () => {
        this.toolController = new toolController(this);
        const tools = [tabTool, pluginTool, recentFileTool, operationTool, modeTool, tempThemeTool, outlineTool, functionTool, mixTool];
        tools.forEach(tool => this.registerBarTool(new tool()));
    }

    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    styleTemplate = () => ({topPercent: parseInt(this.config.TOOLBAR_TOP_PERCENT) + "%"})

    htmlTemplate = () => {
        const tools = Array.from(this.toolController.tools.values(), t => t.name() + "：" + t.translate());
        const title = "支持：\n" + tools.join("\n");
        const input = [{ele: "input", placeholder: "ops explorer", title}];
        const children = [{id: "plugin-toolbar-input", children: input}, {class_: "plugin-toolbar-result"}];
        return [{id: "plugin-toolbar", class_: "plugin-common-modal", style: {display: "none"}, children}]
    }

    process = () => {
        this.canInput = true;
        this.hideWhenEnter = true;
        this.entities = {
            content: document.querySelector("content"),
            toolbar: document.querySelector("#plugin-toolbar"),
            input: document.querySelector("#plugin-toolbar-input input"),
            result: document.querySelector("#plugin-toolbar .plugin-toolbar-result")
        }
        this.handleInput = this.utils.debouncePromise(this.toolController.handleInput, this.config.DEBOUNCE_INTERVAL);
        this.selectItem = this.utils.selectItemFromList(this.entities.result, ".plugin-toolbar-item.active");

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
                    setTimeout(() => this.canInput && this.search(ev));
            }
        })
        this.entities.result.addEventListener("click", ev => {
            const target = ev.target.closest(".plugin-toolbar-item");
            target && this.run(target, ev);
        });

        if (this.config.IGNORE_WHEN_COMPOSITION) {
            this.entities.input.addEventListener("compositionstart", () => this.canInput = false, true);
            this.entities.input.addEventListener("compositionend", async () => {
                this.canInput = true;
                await this.search();
            });
        }
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
        const ok = result && result.matches && result.tool;
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
            const showName = match.showName || match;
            const fixedName = match.fixedName || match;
            const meta = match.meta || "";
            let content = showName;
            if (input[0]) {
                input.forEach(part => content = content.replace(new RegExp(part, "gi"), "<b>$&</b>"));
            }
            const metaContent = meta ? `meta="${meta}"` : "";
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
    name = () => ""
    translate = () => ""
    init = () => null
    // 要么返回 []string
    // 要么返回 [{ showName:"", fixedName:"", meta:"" }]
    search = async input => null
    callback = (fixedName, meta) => null
    baseSearch = (input, list, searchFields) => {
        if (input === "") return list;

        input = input.toLowerCase();
        const func = searchFields
            ? item => searchFields.some(field => item[field].toLowerCase().indexOf(input) !== -1)
            : item => item.toLowerCase().indexOf(input) !== -1
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
        tool && tool.callback(fixedName, meta);
    }

    setAnchorNode = () => this.anchorNode = this.utils.getAnchorNode();

    // 交集
    intersect = arrays => {
        if (!Array.isArray(arrays) || arrays.length === 0 || arrays.some(ele => !ele)) return [];
        if (arrays.length === 1) return arrays[0]

        const func = (typeof arrays[0][0] === "string")
            ? ele => arrays.every(array => array.includes(ele))
            : ele => arrays.every(array => array.some(item => item.showName === ele.showName && item.fixedName === ele.fixedName && item.meta === ele.meta))
        return arrays[0].filter(func);
    }

    uniqueString = item => typeof item === "object" ? item.showName + "6FF28E42" + item.fixedName + "741E8837" + item.meta : item

    // 并集
    union = arrays => {
        if (!Array.isArray(arrays) || arrays.length === 0) return [];
        if (arrays.length === 1) return arrays[0]

        const set = new Set();
        const result = [];
        for (const array of arrays) {
            for (const item of array) {
                const value = this.uniqueString(item);
                if (!set.has(value)) {
                    set.add(value);
                    result.push(item);
                }
            }
        }
        return result
    }

    // 差集
    difference = (array1, array2) => {
        if (!Array.isArray(array1) || !Array.isArray(array2) || array1.length === 0 || array2.length === 0) return array1

        const set = new Set(array2.map(this.uniqueString));
        return array1.filter(item => !set.has(this.uniqueString(item)));
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
        const [posList, negList] = await Promise.all([
            Promise.all(positive.map(tool.search)),
            Promise.all(negative.map(tool.search)),
        ]);
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
        for (const [fixedName, plugin] of Object.entries(this.utils.getAllPlugins())) {
            if (!plugin.call) continue

            const chineseName = plugin.config.NAME;
            const dynamicCallArgs = this.utils.generateDynamicCallArgs(fixedName, this.controller.anchorNode, true);
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
        }
    }
}

class recentFileTool extends baseToolInterface {
    name = () => "his"
    translate = () => "打开最近文件"
    getRecentFile = async () => {
        if (!File.isNode) return;

        const result = [];
        const recent = await JSBridge.invoke("setting.getRecentFiles");
        const {files = [], folders = []} = (typeof recent === "string") ? JSON.parse(recent || "{}") : (recent || {});
        const add = (list, meta) => {
            for (const file of list) {
                if (file.path) {
                    result.push({showName: file.path, fixedName: file.path, meta: meta});
                }
            }
        }
        add(files, "file");
        add(folders, "folder");
        return result;
    }
    search = async input => {
        let files = await this.getRecentFile();
        if (!files || files.length === 0) return;

        const current = this.utils.getFilePath();
        files = files.filter(file => file.showName !== current); // 小细节：去掉当前的文件
        return this.baseSearch(input, files, ["showName"])
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
        const explorer = () => this.utils.showInFinder(this.utils.getFilePath());
        const copyPath = () => File.editor.UserOp.setClipboard(null, null, this.utils.getFilePath());
        const togglePreferencePanel = () => File.megaMenu.togglePreferencePanel();
        const togglePinWindow = () => {
            const pined = document.body.classList.contains("always-on-top");
            const func = pined ? "unpinWindow" : "pinWindow";
            ClientCommand[func]();
        }
        const openFileInNewWindow = () => File.editor.library.openFileInNewWindow(this.utils.getFilePath(), false)
        this.ops = [
            {showName: "在资源管理器中打开", fixedName: "explorer", callback: explorer},
            {showName: "复制文件路径", fixedName: "copyPath", callback: copyPath},
            {showName: "偏好设置", fixedName: "togglePreferencePanel", callback: togglePreferencePanel},
            {showName: "窗口置顶", fixedName: "togglePinWindow", callback: togglePinWindow},
            {showName: "在新窗口中打开", fixedName: "openFileInNewWindow", callback: openFileInNewWindow},
        ]
        this.ops.forEach(op => op.showName += ` - ${op.fixedName}`);
    }
    search = async input => this.baseSearch(input, this.ops, ["showName"])
    callback = (fixedName, meta) => {
        const op = this.ops.find(ele => ele.fixedName === fixedName);
        op && op.callback(meta);
    }
}

class modeTool extends baseToolInterface {
    name = () => "mode"
    translate = () => "切换模式"
    init = () => {
        const outlineView = () => {
            File.editor.library.toggleSidebar();
            File.isNode && ClientCommand.refreshViewMenu();
        }
        this.modes = [
            {showName: "大纲视图", fixedName: "outlineView", callback: outlineView},
            {showName: "源代码模式", fixedName: "sourceMode", callback: () => File.toggleSourceMode()},
            {showName: "专注模式", fixedName: "focusMode", callback: () => File.editor.toggleFocusMode()},
            {showName: "打字机模式", fixedName: "typewriterMode", callback: () => File.editor.toggleTypeWriterMode()},
        ]
        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            const readonly = this.utils.getPlugin("read_only");
            const blur = this.utils.getPlugin("blur");
            const dark = this.utils.getCustomPlugin("darkMode");
            const image = this.utils.getCustomPlugin("imageReviewer");
            if (readonly) {
                this.modes.push({showName: "只读模式", fixedName: "readOnlyMode", callback: () => readonly.call()});
            }
            if (blur) {
                this.modes.push({showName: "模糊模式", fixedName: "blurMode", callback: () => blur.call()});
            }
            if (dark) {
                this.modes.push({showName: "夜间模式", fixedName: "darkMode", callback: () => dark.callback()});
            }
            if (image) {
                this.modes.push({showName: "看图模式", fixedName: "imageReviewer", callback: () => image.callback()});
            }
            this.modes.push({
                showName: "调试模式", fixedName: "debugMode", callback: () => JSBridge.invoke("window.toggleDevTools")
            });
            this.modes.forEach(mode => mode.showName += ` - ${mode.fixedName}`);
        })
    }
    search = async input => this.baseSearch(input, this.modes, ["showName"])
    callback = (fixedName, meta) => {
        const mode = this.modes.find(ele => ele.fixedName === fixedName);
        mode && mode.callback(meta);
    }
}

class tempThemeTool extends baseToolInterface {
    name = () => "theme"
    translate = () => "临时更换主题"
    setThemeForever = theme => ClientCommand.setTheme(theme);
    setThemeTemp = theme => File.setTheme(theme);
    search = async input => {
        const {all, current} = await JSBridge.invoke("setting.getThemes");
        const list = all.map(theme => ({showName: theme.replace(/\.css/gi, ""), fixedName: theme}));
        return this.baseSearch(input, list, ["showName"]);
    }
    callback = fixedName => this.setThemeTemp(fixedName);
}

class outlineTool extends baseToolInterface {
    name = () => "out"
    translate = () => "文档大纲"
    getAll = () => {
        const headers = File.editor.nodeMap.toc && File.editor.nodeMap.toc.headers;
        if (!headers) return
        const result = [];
        headers.forEach(header => {
            const {attributes, cid} = header || {};
            if (attributes && cid) {
                result.push({showName: attributes.pattern.replace("{0}", attributes.text), fixedName: cid});
            }
        })
        return result
    }
    search = async input => this.baseSearch(input, this.getAll(), ["showName"])
    callback = fixedName => this.utils.scrollByCid(fixedName)
}

class functionTool extends baseToolInterface {
    name = () => "func"
    translate = () => "功能列表"
    search = async input => {
        const mapFunc = ([fixedName, tool]) => ({showName: `${fixedName} - ${tool.translate()}`, fixedName});
        const all = Array.from(this.controller.tools.entries(), mapFunc);
        return this.baseSearch(input, all, ["showName"]);
    }
    callback = fixedName => {
        const {plugin} = this.controller;
        plugin.entities.input.value = fixedName + " ";
        plugin.hideWhenEnter = false;
        plugin.entities.input.dispatchEvent(new Event('keydown'));
        setTimeout(() => plugin.hideWhenEnter = true, 100);
    }
}

class mixTool extends baseToolInterface {
    name = () => "all"
    translate = () => "混合查找"
    search = async input => {
        const toolName = this.name();
        const toolResult = await Promise.all(
            Array.from(this.controller.tools.entries(), async ([name, tool]) => {
                if (name === toolName) return;
                const result = await tool.search(input);
                if (result) {
                    return result.map(ele => {
                        const meta = name + "@" + (ele.meta || "");
                        return typeof ele === "string" ? {showName: ele, fixedName: ele, meta} : {...ele, meta};
                    });
                }
            })
        );
        return toolResult.flat().filter(Boolean);
    }
    callback = (fixedName, meta) => {
        const at = meta.indexOf("@");
        const tool = meta.substring(0, at);
        const realMeta = meta.substring(at + 1);
        const t = this.controller.tools.get(tool);
        t && t.callback(fixedName, realMeta);
    }
}

module.exports = {
    plugin: toolbarPlugin,
    baseToolInterface,
};
