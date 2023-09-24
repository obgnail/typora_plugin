class toolbarPlugin extends global._basePlugin {
    beforeProcess = () => {
        this.registerDefaultTool();
    }

    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    style = () => {
        return `
        #plugin-toolbar {
            position: fixed;
            top: ${this.config.TOOLBAR_TOP_PERCENT}%;
            z-index: 9999;
            padding: 4px;
            background-color: #f8f8f8;
            box-shadow: 0 4px 10px rgba(0, 0, 0, .5);
            border: 1px solid #ddd;
            border-top: none;
            color: var(--text-color);
        }
        
        #plugin-toolbar-input {
            font-size: 1.2em;
        }
        
        #plugin-toolbar-input input {
            width: 100%;
            height: 1.5em;
            padding-left: 10px;
        }
        
        .plugin-toolbar-result {
            margin-top: 0;
            max-height: 400px;
            overflow-x: hidden;
            overflow-y: auto;
        }
        
        .plugin-toolbar-item {
            display: block;
            height: 2.5em;
            line-height: 2.5em;
            padding-left: 20px;
            padding-right: 20px;
            overflow: hidden;
            cursor: pointer;
            border-bottom: 0.5px solid #ddd;
        }
        
        .plugin-toolbar-item:hover, .plugin-toolbar-item.active {
            background-color: var(--active-file-bg-color);
        }
        
        .plugin-toolbar-result .plugin-toolbar-item:last-child {
            border: none;
        }
        `
    }

    html = () => {
        const inner = `
        <div id="plugin-toolbar-input">
            <input type="text" class="input" tabindex="1" autocorrect="off" spellcheck="false"
                autocapitalize="off" value="" placeholder="ops 资源管理器打开" data-lg="Front"
                title="支持查询：\nplu：插件\ntab：标签页\nhis：最近文件\nops: 常用操作">
        </div>
        <div class="plugin-toolbar-result"></div>
        `
        const toolbar = document.createElement("div");
        toolbar.id = 'plugin-toolbar';
        toolbar.style.display = "none";
        toolbar.innerHTML = inner;
        this.utils.insertDiv(toolbar);
    }

    init = () => {
        this.entities = {
            content: document.querySelector("content"),
            toolbar: document.querySelector("#plugin-toolbar"),
            input: document.querySelector("#plugin-toolbar-input input"),
            result: document.querySelector("#plugin-toolbar .plugin-toolbar-result")
        }
    }

    process = () => {
        this.init();

        const handleInput = this.utils.debouncePromise(this.toolController.handleInput, this.config.DEBOUNCE_INTERVAL);
        const selectItem = this.utils.selectItemFromList(this.entities.result, ".plugin-toolbar-item.active");
        this.entities.input.addEventListener("keydown", async ev => {
            switch (ev.key) {
                case "Enter":
                    const select = this.entities.result.querySelector(".plugin-toolbar-item.active");
                    if (select) {
                        this.run(select, ev);
                        this.hide();
                    }
                    break
                case "Escape":
                    ev.stopPropagation();
                    ev.preventDefault();
                    this.hide();
                    break
                case "ArrowUp":
                case "ArrowDown":
                    ev.stopPropagation();
                    ev.preventDefault();
                    selectItem(ev);
                    break
                default:
                    const result = await handleInput(this.entities.input);
                    const ok = result && result["matches"] && result["tool"];
                    this.entities.result.innerHTML = ok ? this.newItems(result).join("") : "";
                    ev.preventDefault();
                    ev.stopPropagation();
            }
        })

        this.entities.result.addEventListener("click", ev => {
            const target = ev.target.closest(".plugin-toolbar-item");
            target && this.run(target, ev);
        });
    }

    call = () => {
        if (this.entities.toolbar.style.display === "block") {
            this.hide();
        } else {
            this.show();
        }
    }

    registerDefaultTool = () => {
        this.toolController = new toolController(this);
        this.registerBarTool(new tabTool());
        this.registerBarTool(new pluginTool());
        this.registerBarTool(new RecentFileTool());
        this.registerBarTool(new operationTool());
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

    show = () => {
        this.toolController.setAnchorNode();
        const widthRatio = this.config.TOOLBAR_WIDTH_PERCENT / 100;
        const {width, left} = this.entities.content.getBoundingClientRect();
        this.entities.toolbar.style.width = width * widthRatio + "px";
        this.entities.toolbar.style.left = left + width * (1 - widthRatio) / 2 + "px";
        this.entities.toolbar.style.display = "block";
        this.entities.input.select();
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
        this.windowTabBarPlugin = this.utils.getPlugin("window_tab");
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
            const chineseName = plugin.config.NAME;

            if (!plugin["call"]) continue

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

        const custom = global._plugins["custom"];
        if (custom && custom["custom"]) {
            for (const fixedName of Object.keys(custom["custom"])) {
                const chineseName = this.utils.getCustomPlugin(fixedName).showName;
                pluginsList.push({showName: chineseName, fixedName: fixedName});
            }
        }

        return pluginsList
    }

    search = async input => {
        const pluginsList = this.collectAll();
        return this.baseSearch(input, pluginsList, ["fixedName", "showName"])
    }

    callback = (fixedName, meta) => {
        const plugin = this.utils.getPlugin(fixedName);
        if (plugin) {
            plugin.call(meta || undefined);
            return
        }
        const customPlugin = this.utils.getCustomPlugin(fixedName);
        if (customPlugin) {
            global._plugins.custom.call(fixedName);
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
        ]
    }

    search = async input => this.baseSearch(input, this.ops, ["showName", "fixedName"])

    callback = (fixedName, meta) => {
        for (const op of this.ops) {
            if (fixedName === op.fixedName) {
                op.callback(meta);
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
        return {tool: null, input: ""}
    }
}

module.exports = {
    plugin: toolbarPlugin
};
