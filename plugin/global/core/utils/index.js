const HTTPS = require("https")
const OS = require("os")
const PATH = require("path")
const FS = require("fs")
const CHILD_PROCESS = require('child_process')
const FS_EXTRA = require("fs-extra")
const TOML = require("./common/toml")

class utils {
    static isBetaVersion = window._options.appVersion[0] === "0"
    static supportHasSelector = CSS.supports("selector(:has(*))")
    static separator = File.isWin ? "\\" : "/"
    static tempFolder = window._options.tempPath
    static nonExistSelector = "#__nonExist__"                 // 插件临时不可点击，返回此
    static disableForeverSelector = "#__disableForever__"     // 插件永远不可点击，返回此
    static stopLoadPluginError = new Error("stopLoadPlugin")  // 用于插件的beforeProcess方法，若希望停止加载插件，返回此
    static Package = Object.freeze({
        HTTPS: HTTPS,
        OS: OS,
        Path: PATH,
        Fs: FS,
        FsExtra: FS_EXTRA,
        ChildProcess: CHILD_PROCESS,
    })

    // 动态注册、动态注销代码块增强按钮(仅当fence_enhance插件启用时有效，通过返回值确定是否成功)
    // 需要注意的是：注册、注销只会影响新增的代码块，已经渲染到html的代码块不会改变，所以一般此函数的执行时机是在初始化的时候
    //   action: 取个名字
    //   className: button的className
    //   hint: 提示
    //   iconClassName: 通过className设置icon
    //   enable: 是否使用
    //   listener(ev, button)=>{}: 点击按钮的回调函数(ev: 时间，button: 按钮本身element)
    //   extraFunc(button)=>{}: 插入html后的额外操作
    static registerFenceEnhanceButton = (className, action, hint, iconClassName, enable, listener, extraFunc,
    ) => this.callPluginFunction("fence_enhance", "registerBuilder", className, action, hint, iconClassName, enable, listener, extraFunc)
    static unregisterFenceEnhanceButton = action => this.callPluginFunction("fence_enhance", "removeBuilder", action)

    // 动态注册barTool里的tool(仅当toolbar插件启用时有效，通过返回值确定是否成功)
    // tool: baseToolInterface的子类
    static registerBarTool = tool => this.callPluginFunction("toolbar", "registerBarTool", tool)
    static unregisterBarTool = name => this.callPluginFunction("toolbar", "unregisterBarTool", name)

    // 动态注册右下角的快捷按钮(仅当quickButton插件启用时有效，通过返回值确定是否成功)
    //   1. action(string): 取个名字
    //   2. coordinate[int, int]: 按钮的坐标(x, y)。注意：往上为x正方向，往左为y正方向。起始值为0。为何如此设计？答：新增的button不影响旧button的坐标
    //   3. hint(string): 提示信息
    //   4. iconClass(string): icon的class
    //   5. style(Object): button 额外的样式
    //   6. callback(ev, target, action) => null: 点击按钮后的回调函数
    static registerQuickButton = (action, coordinate, hint, iconClass, style, callback
    ) => this.callPluginFunction("quickButton", "register", action, coordinate, hint, iconClass, style, callback)
    // 动态注销快捷按钮
    //   一旦process后，标签就被渲染到HTML了，以后就不会再变了，再调用此函数也没有用了，因此此函数只能在插件初始化的时候调用
    //   因此，unregisterQuickButton的唯一意义是：当两个插件在初始化阶段打架时（都想注册同一坐标的按钮），用此函数去注销掉别人
    static unregisterQuickButton = action => this.callPluginFunction("quickButton", "unregister", action)
    static toggleQuickButton = hide => this.callPluginFunction("quickButton", "toggle", hide)


    ////////////////////////////// 插件相关 //////////////////////////////
    static getAllPlugins = () => global._plugins
    static getAllCustomPlugins = () => global._plugins.custom && global._plugins.custom.custom
    static getPlugin = fixedName => global._plugins[fixedName]
    static getCustomPlugin = fixedName => global._plugins.custom && global._plugins.custom.custom[fixedName]
    static getAllPluginSettings = () => global._plugin_settings
    static getAllGlobalSettings = () => global._plugin_global_settings
    static getAllCustomPluginSettings = () => (global._plugins.custom && global._plugins.custom.customSettings) || {}
    static getGlobalSetting = name => global._plugin_global_settings[name]
    static getPluginSetting = fixedName => global._plugin_settings[fixedName]
    static getCustomPluginSetting = fixedName => this.getAllCustomPluginSettings()[fixedName]
    static tryGetPlugin = fixedName => this.getPlugin(fixedName) || this.getCustomPlugin(fixedName)
    static tryGetPluginSetting = fixedName => this.getAllPluginSettings()[fixedName] || this.getAllCustomPluginSettings()[fixedName]

    static getPluginFunction = (fixedName, func) => {
        const plugin = this.tryGetPlugin(fixedName);
        return plugin && plugin[func];
    }
    static callPluginFunction = (fixedName, func, ...args) => {
        const plugin = this.tryGetPlugin(fixedName);
        const _func = plugin && plugin[func];
        _func && _func.apply(plugin, args);
        return _func
    }

    static isUnderMountFolder = path => {
        const mountFolder = PATH.resolve(File.getMountFolder());
        const _path = PATH.resolve(path);
        return _path && mountFolder && _path.startsWith(mountFolder);
    }
    static openFile = filepath => {
        if (!this.getMountFolder() || this.isUnderMountFolder(filepath)) {
            // File.editor.restoreLastCursor();
            File.editor.focusAndRestorePos();
            File.editor.library.openFile(filepath);
        } else {
            File.editor.library.openFileInNewWindow(filepath, false);
        }
    }
    static openFolder = folder => File.editor.library.openFileInNewWindow(folder, true);
    static reload = async () => {
        const content = await File.getContent();
        const arg = {fromDiskChange: false, skipChangeCount: true, skipUndo: true, skipStore: true};
        File.reloadContent(content, arg);
    }

    static showHiddenElementByPlugin = target => {
        if (!target) return;
        const plugins = ["collapse_paragraph", "collapse_table", "collapse_list", "truncate_text"];
        plugins.forEach(plu => this.callPluginFunction(plu, "rollback", target));
    }
    static getAnchorNode = () => File.editor.getJQueryElem(window.getSelection().anchorNode);
    static withAnchorNode = (selector, func) => () => {
        const anchorNode = this.getAnchorNode();
        const target = anchorNode.closest(selector);
        target && target[0] && func(target[0]);
    }
    static meta = {} // 用于在右键菜单功能中传递数据，不可手动调用此变量
    static generateDynamicCallArgs = (fixedName, anchorNode, notInContextMenu = false) => {
        if (!fixedName) return;
        const plugin = this.getPlugin(fixedName);
        if (plugin && plugin.dynamicCallArgsGenerator) {
            anchorNode = anchorNode || this.getAnchorNode();
            if (anchorNode[0]) {
                this.meta = {};
                return plugin.dynamicCallArgsGenerator(anchorNode[0], this.meta, notInContextMenu);
            }
        }
    }
    static withMeta = func => func(this.meta)

    // Repo: https://github.com/jimp-dev/jimp
    // after loadJimp(), you can use globalThis.Jimp
    static loadJimp = async () => await $.getScript((File.isNode ? "./lib.asar" : "./lib") + "/jimp/browser/lib/jimp.min.js")

    static sendEmail = (email, subject = "", body = "") => reqnode("electron").shell.openExternal(`mailto:${email}?subject=${subject}&body=${body}`)

    static downloadImage = async (src, folder, filename) => {
        folder = folder || this.tempFolder;
        filename = filename || (this.randomString() + "_" + PATH.extname(src))
        const {state} = await JSBridge.invoke("app.download", src, folder, filename);
        return {ok: state === "completed", filepath: PATH.join(folder, filename)}
    }


    ////////////////////////////// 事件 //////////////////////////////
    static metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey
    static shiftKeyPressed = ev => ev.shiftKey
    static altKeyPressed = ev => ev.altKey
    static chineseInputMethodActivated = ev => ev.key === "Process"
    static modifierKey = keyString => {
        const keys = keyString.toLowerCase().split("+").map(k => k.trim());
        const ctrl = keys.indexOf("ctrl") !== -1;
        const shift = keys.indexOf("shift") !== -1;
        const alt = keys.indexOf("alt") !== -1;
        return ev => this.metaKeyPressed(ev) === ctrl && this.shiftKeyPressed(ev) === shift && this.altKeyPressed(ev) === alt
    }


    ////////////////////////////// 纯函数 //////////////////////////////
    static compareVersion = (v1, v2) => {
        if (v1 === "" && v2 !== "") {
            return -1
        } else if (v2 === "" && v1 !== "") {
            return 1
        }
        const v1Arr = v1.split(".");
        const v2Arr = v2.split(".");
        for (let i = 0; i < v1Arr.length || i < v2Arr.length; i++) {
            const n1 = (i < v1Arr.length) ? parseInt(v1Arr[i]) : 0;
            const n2 = (i < v2Arr.length) ? parseInt(v2Arr[i]) : 0;
            if (n1 > n2) {
                return 1
            } else if (n1 < n2) {
                return -1
            }
        }
        return 0
    }

    // merge({ a: [{ b: 2 }] }, { a: [{ c: 2 }] }) -> { a: [{ c: 2 }] }
    // merge({ o: { a: 3 } }, { o: { b: 4 } }) -> { o: { a: 3, b: 4 } }
    static merge = (source, other) => {
        const isObject = value => {
            const type = typeof value
            return value !== null && (type === 'object' || type === 'function')
        }

        if (!isObject(source) || !isObject(other)) {
            return other === undefined ? source : other
        }
        return Object.keys({...source, ...other}).reduce((obj, key) => {
            const isArray = Array.isArray(source[key]) && Array.isArray(other[key])
            obj[key] = isArray ? other[key] : this.merge(source[key], other[key])
            return obj
        }, Array.isArray(source) ? [] : {})
    }

    static fromObject = (obj, attrs) => {
        const newObj = {};
        attrs.forEach(attr => obj[attr] !== undefined && (newObj[attr] = obj[attr]));
        return newObj;
    }

    static throttle = (fn, delay = 100) => {
        let timer;
        return function () {
            if (!timer) {
                fn.apply(this, arguments);
                timer = setTimeout(() => {
                    clearTimeout(timer);
                    timer = null;
                }, delay)
            }
        }
    }

    static debounce = (fn, delay) => {
        let timeout;
        return function () {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, arguments), delay);
        }
    }

    static debouncePromise = (fn, delay) => {
        let timeout;
        return function debounce() {
            return new Promise((resolve, reject) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    try {
                        resolve(fn.apply(this, arguments))
                    } catch (e) {
                        reject(e)
                    }
                }, delay);
            })
        }
    }

    static once = func => {
        let flag = true;
        return function () {
            if (flag) {
                func.apply(this, arguments);
                flag = false;
            }
        }
    }

    static chunk = (array, size = 10) => {
        let index = 0;
        let result = [];
        while (index < array.length) {
            result.push(array.slice(index, (index + size)));
            index += size;
        }
        return result;
    }

    static splitKeyword = str => {
        const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
        let result = [];
        let match;
        while ((match = regex.exec(str))) {
            result.push(match[1] || match[2] || match[0]);
        }
        return result;
    }

    static asyncReplaceAll = (content, regexp, replaceFunc) => {
        if (!regexp.global) {
            throw Error("regexp must be global");
        }

        let match;
        let lastIndex = 0;
        const reg = new RegExp(regexp);  // 为了不影响regexp的lastIndex属性，复制一个新的对象
        const promises = [];

        while ((match = reg.exec(content))) {
            const args = [...match, match.index, match.input];
            promises.push(content.slice(lastIndex, match.index), replaceFunc(...args));
            lastIndex = reg.lastIndex;
        }
        promises.push(content.slice(lastIndex));
        return Promise.all(promises).then(results => results.join(""))
    }

    static randomString = (len = 8) => Math.random().toString(36).substring(2, 2 + len).padEnd(len, "0")
    static randomInt = (min, max) => {
        const ceil = Math.ceil(min);
        const floor = Math.floor(max);
        return Math.floor(Math.random() * (floor - ceil) + ceil);
    }
    static getUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    static isPromise = obj => obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function'
    static isBase64 = str => /^[A-Za-z0-9+/=]+$/.test(str) && str.length % 4 === 0;

    static windowsPathToUnix = filepath => {
        if (!File.isWin) return filepath;
        const sep = filepath.split(PATH.win32.sep);
        const newS = [].concat([sep[0].toLowerCase()], sep.slice(1));
        return "/" + PATH.posix.join.apply(PATH.posix, newS).replace(":", "")
    }

    static escape = htmlStr => htmlStr.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    ////////////////////////////// 业务文件操作 //////////////////////////////
    // Repo: https://github.com/microsoft/vscode-ripgrep
    // Note: ripgrep built in Typora, is written in rust, so if the search folder is very large, CPU may skyrocket during queries
    // Eg:
    //   this.utils.ripgrep(
    //       ["--max-filesize", "2M", "-g", "*.md", "XXX"],
    //       data => console.log(data),
    //       data => console.error(data),
    //       code => console.log("finish code:", code),
    //   );
    static ripgrep = (args, onData, onErr, onClose) => {
        const rgPath = reqnode("vscode-ripgrep").rgPath.replace("node_modules.asar", "node_modules");
        const options = {cwd: File.getMountFolder(), stdio: ["ignore", "pipe", "pipe"]};
        const child = CHILD_PROCESS.spawn(rgPath, args, options);
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on('data', onData);
        child.stderr.on("data", onErr);
        child.on('close', onClose);
    }

    static getOriginSettingPath = settingFile => this.joinPath("./plugin/global/settings", settingFile)
    static getHomeSettingPath = settingFile => PATH.join(this.getHomeDir(), ".config", "typora_plugin", settingFile)
    static getActualSettingPath = async settingFile => {
        const homeSetting = this.getHomeSettingPath(settingFile);
        const exist = await this.existPath(homeSetting);
        return exist ? homeSetting : this.getOriginSettingPath(settingFile);
    }
    static saveConfig = async (fixedName, updateObj) => {
        let isCustom = false;
        let plugin = this.getPlugin(fixedName);
        if (!plugin) {
            plugin = this.getCustomPlugin(fixedName);
            isCustom = true;
        }
        if (!plugin) return;

        const mergeObj = isCustom ? {[fixedName]: {config: updateObj}} : {[fixedName]: updateObj};
        const file = isCustom ? "custom_plugin.user.toml" : "settings.user.toml";
        const settingPath = await this.getActualSettingPath(file);
        const tomlObj = await this.readToml(settingPath);
        const newSetting = this.merge(tomlObj, mergeObj);
        const newContent = this.stringifyToml(newSetting);
        return this.writeFile(settingPath, newContent);
    }

    static readSetting = async (defaultSetting, userSetting) => {
        const default_ = this.getOriginSettingPath(defaultSetting);
        const user_ = this.getOriginSettingPath(userSetting);
        const home_ = this.getHomeSettingPath(userSetting);
        const contentList = await this.readFiles([default_, user_, home_]);
        try {
            const configList = contentList.map(c => c ? TOML.parse(c) : {});
            return configList.reduce(this.merge)
        } catch (e) {
            const message = "配置文件格式错误，是否前往校验网站";
            const detail = `您手动修改过配置文件，由于写入的内容有问题，导致配置文件无法正确读取，报错如下：\n${e.toString()}`;
            const op = {type: "error", title: "Typora Plugin", buttons: ["确定", "取消"], message, detail};
            const {response} = await this.showMessageBox(op);
            if (response === 0) {
                this.openUrl("https://www.bejson.com/validators/toml_editor/");
            }
            return {}
        }
    }

    static openSettingFolder = async () => this.showInFinder(await this.getActualSettingPath("settings.user.toml"))

    static backupSettingFile = async (showInFinder = true) => {
        const {FsExtra, Path} = this.Package;
        const backupDir = Path.join(this.tempFolder, "typora_plugin_config");
        await FsExtra.emptyDir(backupDir);
        const settingFiles = ["settings.user.toml", "custom_plugin.user.toml", "hotkey.user.toml"];
        for (const file of settingFiles) {
            const source = await this.getActualSettingPath(file);
            const target = Path.join(backupDir, file);
            try {
                await FsExtra.copy(source, target);
            } catch (e) {
                console.error(e);
            }
        }
        showInFinder && this.showInFinder(backupDir);
    }

    static editCurrentFile = async (editFileFunc, reloadTypora = true) => {
        const bak = File.presentedItemChanged;
        File.presentedItemChanged = () => undefined;
        const filepath = this.getFilePath();
        const content = await FS.promises.readFile(filepath, "utf-8");
        const replacedContent = await editFileFunc(content);
        const ok = await this.writeFile(filepath, replacedContent);
        if (!ok) return;
        reloadTypora && File.reloadContent(replacedContent, {fromDiskChange: false});
        setTimeout(() => File.presentedItemChanged = bak, 1500);
    }

    static insertStyle = (id, css) => {
        const style = document.createElement("style");
        style.id = id;
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }
    static insertStyleFile = (id, filepath) => {
        const cssFilePath = this.joinPath(filepath);
        const link = document.createElement('link');
        link.id = id;
        link.type = 'text/css'
        link.rel = 'stylesheet'
        link.href = cssFilePath;
        document.head.appendChild(link);
    }
    static registerStyle = (fixedName, style) => {
        if (!style) return;
        switch (typeof style) {
            case "string":
                const name = fixedName.replace(/_/g, "-");
                this.insertStyle(`plugin-${name}-style`, style);
                break
            case "object":
                const {textID = null, text = null, fileID = null, file = null} = style;
                fileID && file && this.insertStyleFile(fileID, file);
                textID && text && this.insertStyle(textID, text);
                break
        }
    }

    static insertScript = filepath => $.getScript(`file:///${this.joinPath(filepath)}`)
    static removeStyle = id => this.removeElementByID(id)

    static newFilePath = async filename => {
        filename = filename || File.getFileName() || (new Date()).getTime().toString() + ".md";
        const dirPath = this.getFilePath() ? this.getCurrentDirPath() : this.getMountFolder();
        if (!dirPath) {
            alert("空白页不可使用此功能");
            return;
        }
        let filepath = PATH.resolve(dirPath, filename);
        const exist = await this.existPath(filepath);
        if (exist) {
            const ext = PATH.extname(filepath);
            filepath = ext ? filepath.replace(new RegExp(`${ext}$`), `-copy${ext}`) : filepath + "-copy.md";
        }
        return filepath
    }

    static getFileName = (filePath, removeSuffix = true) => {
        let fileName = filePath ? PATH.basename(filePath) : File.getFileName();
        if (removeSuffix) {
            const idx = fileName.lastIndexOf(".");
            if (idx !== -1) {
                fileName = fileName.substring(0, idx);
            }
        }
        return fileName
    }

    ////////////////////////////// 基础文件操作 //////////////////////////////
    static getDirname = () => global.dirname || global.__dirname
    static getHomeDir = () => OS.homedir() || File.option.userPath
    static getFilePath = () => File.filePath || (File.bundle && File.bundle.filePath) || ""
    static getMountFolder = () => File.getMountFolder() || ""
    static getCurrentDirPath = () => PATH.dirname(this.getFilePath())
    static joinPath = (...paths) => PATH.join(this.getDirname(), ...paths)
    static requireFilePath = (...paths) => require(this.joinPath(...paths))
    static readFileSync = filepath => FS.readFileSync(this.joinPath(filepath), 'utf8')

    static readFiles = async files => Promise.all(files.map(async file => {
        try {
            return await FS.promises.readFile(file, 'utf-8')
        } catch (err) {
        }
    }))

    static existPathSync = filepath => {
        try {
            FS.accessSync(filepath);
            return true
        } catch (err) {
        }
    }

    static existPath = async filepath => {
        try {
            await FS.promises.access(filepath);
            return true
        } catch (err) {
        }
    }

    static writeFile = async (filepath, content) => {
        try {
            await FS.promises.writeFile(filepath, content);
            return true
        } catch (e) {
            const detail = e.toString();
            const op = {type: "error", title: "Typora Plugin", buttons: ["确定"], message: "写入文件失败", detail};
            await this.showMessageBox(op);
        }
    }

    static readYaml = content => {
        const yaml = require("./common/yaml");
        try {
            return yaml.safeLoad(content);
        } catch (e) {
            console.error(e);
        }
    }

    static readToml = async filepath => TOML.parse(await FS.promises.readFile(filepath, "utf-8"))
    static stringifyToml = obj => TOML.stringify(obj)


    ////////////////////////////// 业务操作 //////////////////////////////
    static exitTypora = () => JSBridge.invoke("window.close");
    static restartTypora = () => {
        this.callPluginFunction("reopenClosedFiles", "save");
        this.openFolder(this.getMountFolder());
        setTimeout(this.exitTypora, 50);
    }
    static showInFinder = filepath => JSBridge.showInFinder(filepath || this.getFilePath())
    static isDiscardableUntitled = () => File && File.changeCounter && File.changeCounter.isDiscardableUntitled();

    static openUrl = url => (File.editor.tryOpenUrl_ || File.editor.tryOpenUrl)(url, 1);

    static showMessageBox = async ({type = "info", title = "typora", message, detail, buttons = ["确定", "取消"], defaultId = 0, cancelId = 1, normalizeAccessKeys = true, checkboxLabel}) => {
        const op = {type, title, message, detail, buttons, defaultId, cancelId, normalizeAccessKeys, checkboxLabel};
        return JSBridge.invoke("dialog.showMessageBox", op)
    }

    static request = (options, data) => new Promise((resolve, reject) => {
        const req = HTTPS.request(options, resp => {
            const chunks = [];
            resp.on("data", chunk => chunks.push(chunk));
            resp.on("end", () => resolve(Buffer.concat(chunks)));
        });
        req.on("error", err => reject(err));
        if (data) {
            req.write(data);
        }
        req.end();
    });

    static splitFrontMatter = content => {
        const result = {yamlObject: null, remainContent: content, yamlLineCount: 0};
        content = content.trimLeft();
        if (!/^---\r?\n/.test(content)) return result;
        const matchResult = /\n---\r?\n/.exec(content);
        if (!matchResult) return result;
        const yamlContent = content.slice(4, matchResult.index);
        const remainContent = content.slice(matchResult.index + matchResult[0].length);
        const yamlLineCount = (yamlContent.match(/\n/g) || []).length + 3;
        const yamlObject = this.readYaml(yamlContent);
        return {yamlObject, remainContent, yamlLineCount}
    }

    static getRecentFiles = async () => {
        const recent = await JSBridge.invoke("setting.getRecentFiles");
        const {files = [], folders = []} = (typeof recent === "string") ? JSON.parse(recent || "{}") : (recent || {});
        return {files, folders}
    }

    static isNetworkImage = src => /^https?|(ftp):\/\//.test(src);
    static isSpecialImage = src => src.startsWith("data:image");  // data:image;base64、data:image\svg+xml 等等

    static getFenceContent = (pre, cid) => {
        // from element
        if (pre) {
            const lines = pre.querySelectorAll(".CodeMirror-code .CodeMirror-line");
            if (lines.length) {
                const badChars = ["%E2%80%8B", "%C2%A0", "%0A"]; // 1)zeroWidthSpace:\u200b  2)noBreakSpace:\u00A0  3)noBreakSpace:\u0A
                const replaceChars = ["", "%20", ""];
                const contentList = Array.from(lines, line => {
                    let encodeText = encodeURI(line.textContent);
                    for (let i = 0; i < badChars.length; i++) {
                        if (encodeText.indexOf(badChars[i]) !== -1) {
                            encodeText = encodeText.replace(new RegExp(badChars[i], "g"), replaceChars[i]);
                        }
                    }
                    return decodeURI(encodeText);
                });
                return contentList.join("\n")
            }
        }

        // from queue
        cid = cid || (pre && pre.getAttribute("cid"));
        if (cid) {
            const fence = File.editor.fences.queue[cid];
            if (fence) {
                // return fence.getValue()
                return fence.options.value
            }
        }
    }

    static getFenceUserSize = content => {
        const regexp = /^\/\/{height:"(?<height>.*?)",width:"(?<width>.*?)"}/;
        const lines = content.split("\n").map(line => line.trim()).filter(line => line.startsWith("//"));
        for (let line of lines) {
            line = line.replace(/\s/g, "").replace(/['`]/g, `"`);
            const {groups} = line.match(regexp) || {};
            if (groups) {
                return {height: groups.height, width: groups.width};
            }
        }
        return {height: "", width: ""};
    }

    static renderAllLangFence = lang => {
        document.querySelectorAll(`#write .md-fences[lang=${lang}]`).forEach(fence => {
            const codeMirror = fence.querySelector(":scope > .CodeMirror");
            if (!codeMirror) {
                const cid = fence.getAttribute("cid");
                cid && File.editor.fences.addCodeBlock(cid);
            }
        })
    }
    static refreshAllLangFence = lang => {
        document.querySelectorAll(`#write .md-fences[lang="${lang}"]`).forEach(fence => {
            const cid = fence.getAttribute("cid");
            cid && File.editor.diagrams.updateDiagram(cid);
        })
    }

    ////////////////////////////// 业务DOM操作 //////////////////////////////
    static removeElement = ele => ele && ele.parentElement && ele.parentElement.removeChild(ele)
    static removeElementByID = id => this.removeElement(document.getElementById(id))

    static isShow = ele => !ele.classList.contains("plugin-common-hidden");
    static isHidden = ele => ele.classList.contains("plugin-common-hidden");
    static hide = ele => ele.classList.add("plugin-common-hidden");
    static show = ele => ele.classList.remove("plugin-common-hidden");
    static toggleVisible = (ele, force) => ele.classList.toggle("plugin-common-hidden", force);

    static showProcessingHint = () => this.show(document.querySelector(".plugin-wait-mask-wrapper"));
    static hideProcessingHint = () => this.hide(document.querySelector(".plugin-wait-mask-wrapper"));
    static withProcessingHint = async func => {
        const wrapper = document.querySelector(".plugin-wait-mask-wrapper");
        this.show(wrapper);
        await func();
        this.hide(wrapper);
    }

    static isInViewBox = el => {
        const totalHeight = window.innerHeight || document.documentElement.clientHeight;
        const totalWidth = window.innerWidth || document.documentElement.clientWidth;
        const {top, right, bottom, left} = el.getBoundingClientRect();
        return top >= 0 && left >= 0 && right <= totalWidth && bottom <= totalHeight;
    }

    static compareScrollPosition = (element, contentScrollTop) => {
        contentScrollTop = contentScrollTop || $("content").scrollTop();
        const elementOffsetTop = element.offsetTop;
        if (elementOffsetTop < contentScrollTop) {
            return -1;
        } else if (elementOffsetTop > contentScrollTop + window.innerHeight) {
            return 1;
        } else {
            return 0;
        }
    }

    static markdownInlineStyleToHTML = (content, dir) => {
        const imageReplacement = (_, alt, src) => {
            if (!this.isNetworkImage(src) && !this.isSpecialImage(src)) {
                src = PATH.resolve(dir || this.getCurrentDirPath(), src);
            }
            return `<img alt="${alt}" src="${src}">`
        }
        return content.replace(/(?<!\\)`(.+?)(?<!\\)`/gs, `<code>$1</code>`)
            .replace(/(?<!\\)[*_]{2}(.+?)(?<!\\)[*_]{2}/gs, `<strong>$1</strong>`)
            .replace(/(?<![*\\])\*(?![\\*])(.+?)(?<![*\\])\*(?![\\*])/gs, `<em>$1</em>`)
            .replace(/(?<!\\)~~(.+?)(?<!\\)~~/gs, "<del>$1</del>")
            .replace(/(?<![\\!])\[(.+?)\]\((.+?)\)/gs, `<a href="$2">$1</a>`)
            .replace(/(?<!\\)!\[(.+?)\]\((.+?)\)/gs, imageReplacement)
    }

    static scroll = ($target, height = -1, moveCursor = false, showHiddenElement = true) => {
        if ($target instanceof Element) {
            $target = $($target);
        }
        File.editor.focusAndRestorePos();
        if (moveCursor) {
            File.editor.selection.jumpIntoElemEnd($target);
        }
        if (showHiddenElement) {
            this.showHiddenElementByPlugin($target[0]);
        }
        if (height === -1) {
            height = (window.innerHeight || document.documentElement.clientHeight) / 2;
        }
        File.editor.selection.scrollAdjust($target, height);
        if (File.isFocusMode) {
            File.editor.updateFocusMode(false);
        }
    }

    static scrollByCid = (cid, height = -1, moveCursor = false, showHiddenElement = true) => this.scroll(File.editor.findElemById(cid), height, moveCursor, showHiddenElement);

    // content: 字符串中，\n表示软换行；\n\n表示硬换行
    static insertText = (anchorNode, content, restoreLastCursor = true) => {
        if (restoreLastCursor) {
            File.editor.contextMenu.hide();
            // File.editor.writingArea.focus();
            File.editor.restoreLastCursor();
        }
        File.editor.insertText(content);
    }

    static insertElement = elements => {
        if (!elements) return;

        if (typeof elements === "string") {
            const doc = new DOMParser().parseFromString(elements, "text/html");
            elements = doc.body.childNodes;
        }

        let target = elements;
        if (elements instanceof Array || elements instanceof NodeList) {
            target = document.createDocumentFragment();
            elements.forEach(ele => target.appendChild(ele));
        }
        const quickOpenNode = document.getElementById("typora-quick-open");
        quickOpenNode.parentNode.insertBefore(target, quickOpenNode.nextSibling);
    }

    static findActiveNode = range => {
        range = range || File.editor.selection.getRangy();
        const markElem = File.editor.getMarkElem(range.anchorNode);
        return File.editor.findNodeByElem(markElem)
    }

    static getRangy = () => {
        const range = File.editor.selection.getRangy();
        const markElem = File.editor.getMarkElem(range.anchorNode);
        const node = File.editor.findNodeByElem(markElem);
        const bookmark = range.getBookmark(markElem[0]);
        return {range, markElem, node, bookmark}
    }

    static getRangyText = () => {
        const {node, bookmark} = this.getRangy();
        const ele = File.editor.findElemById(node.cid);
        return ele.rawText().substring(bookmark.start, bookmark.end);
    }

    static resizeFixedModal = (
        handleElement, resizeElement,
        resizeWidth = true, resizeHeight = true,
        onMouseDown = null, onMouseMove = null, onMouseUp = null
    ) => {
        let startX, startY, startWidth, startHeight;
        handleElement.addEventListener("mousedown", ev => {
            const {width, height} = document.defaultView.getComputedStyle(resizeElement);
            startX = ev.clientX;
            startY = ev.clientY;
            startWidth = parseFloat(width);
            startHeight = parseFloat(height);
            onMouseDown && onMouseDown(startX, startY, startWidth, startHeight);
            document.addEventListener("mousemove", mousemove);
            document.addEventListener("mouseup", mouseup);
            ev.stopPropagation();
            ev.preventDefault();
        }, true);

        function mousemove(e) {
            requestAnimationFrame(() => {
                let deltaX = e.clientX - startX;
                let deltaY = e.clientY - startY;
                if (onMouseMove) {
                    const {deltaX: newDeltaX, deltaY: newDeltaY} = onMouseMove(deltaX, deltaY) || {};
                    deltaX = newDeltaX || deltaX;
                    deltaY = newDeltaY || deltaY;
                }
                if (resizeWidth) {
                    resizeElement.style.width = startWidth + deltaX + "px";
                }
                if (resizeHeight) {
                    resizeElement.style.height = startHeight + deltaY + "px";
                }
            })
        }

        function mouseup() {
            document.removeEventListener("mousemove", mousemove);
            document.removeEventListener("mouseup", mouseup);
            onMouseUp && onMouseUp();
        }
    }

    static dragFixedModal = (
        handleElement, moveElement, withMetaKey = true,
        _onMouseDown = null, _onMouseMove = null, _onMouseUp = null
    ) => {
        handleElement.addEventListener("mousedown", ev => {
            if (withMetaKey && !this.metaKeyPressed(ev) || ev.button !== 0) return;
            ev.stopPropagation();
            const {left, top} = moveElement.getBoundingClientRect();
            const shiftX = ev.clientX - left;
            const shiftY = ev.clientY - top;
            _onMouseDown && _onMouseDown();

            const onMouseMove = ev => {
                if (withMetaKey && !this.metaKeyPressed(ev) || ev.button !== 0) return;
                ev.stopPropagation();
                ev.preventDefault();
                requestAnimationFrame(() => {
                    _onMouseMove && _onMouseMove();
                    moveElement.style.left = ev.clientX - shiftX + 'px';
                    moveElement.style.top = ev.clientY - shiftY + 'px';
                });
            }

            const onMouseUp = ev => {
                if (withMetaKey && !this.metaKeyPressed(ev) || ev.button !== 0) return;
                _onMouseUp && _onMouseUp();
                ev.stopPropagation();
                ev.preventDefault();
                document.removeEventListener("mousemove", onMouseMove);
                moveElement.onmouseup = null;
                document.removeEventListener("mouseup", onMouseUp);
            }

            document.addEventListener("mouseup", onMouseUp);
            document.addEventListener("mousemove", onMouseMove);
        })
        handleElement.ondragstart = () => false
    }

    static scrollActiveItem = (list, activeSelector, isNext) => {
        if (list.childElementCount === 0) return;
        const origin = list.querySelector(activeSelector);
        const active = isNext
            ? (origin && origin.nextElementSibling) || list.firstElementChild
            : (origin && origin.previousElementSibling) || list.lastElementChild
        origin && origin.classList.toggle("active");
        active.classList.toggle("active");
        active.scrollIntoView({block: "nearest"});
    }

    static stopCallError = new Error("stopCall") // 用于decorate方法，若希望停止执行原生函数，返回此
    static decorate = (objGetter, attr, before, after, changeResult = false) => {
        function decorator(original, before, after) {
            return function () {
                if (before) {
                    const error = before.call(this, ...arguments);
                    if (error === utils.stopCallError) return;
                }
                let result = original.apply(this, arguments);
                if (after) {
                    const afterResult = after.call(this, result, ...arguments);
                    if (changeResult) {
                        result = afterResult;
                    }
                }
                return result;
            };
        }

        const start = new Date().getTime();
        const timer = setInterval(() => {
            if (new Date().getTime() - start > 10000) {
                console.error("decorate timeout!", objGetter, attr, before, after, changeResult);
                clearInterval(timer);
                return;
            }
            const obj = objGetter();
            if (obj && obj[attr]) {
                clearInterval(timer);
                obj[attr] = decorator(obj[attr], before, after);
            }
        }, 20);
    }
    static loopDetector = (until, after, detectInterval = 20, timeout = 10000, runWhenTimeout = true) => {
        let run = false;
        const start = new Date().getTime();
        const timer = setInterval(() => {
            if (new Date().getTime() - start > timeout) {
                // console.warn("loopDetector timeout!", until, after);
                run = runWhenTimeout;
                if (!run) {
                    clearInterval(timer);
                    return;
                }
            }
            if (until() || run) {
                clearInterval(timer);
                after && after();
            }
        }, detectInterval);
    }
}

module.exports = {
    utils
}
