const OS = require("os")
const PATH = require("path")
const FS = require("fs")
const CHILD_PROCESS = require("child_process")
const FS_EXTRA = require("fs-extra")
const { i18n } = require("../i18n")

class utils {
    static i18n = i18n

    static nodeVersion = process && process.versions && process.versions.node
    static electronVersion = process && process.versions && process.versions.electron
    static chromeVersion = process && process.versions && process.versions.chrome
    static typoraVersion = window._options.appVersion
    static isBetaVersion = this.typoraVersion[0] === "0"

    static supportHasSelector = CSS.supports("selector(:has(*))")
    static separator = File.isWin ? "\\" : "/"
    static tempFolder = window._options.tempPath || OS.tmpdir()
    static nonExistSelector = "#__non_exist__"                // Plugin temporarily unavailable, return this.
    static disableForeverSelector = "#__disabled__"           // Plugin permanently unavailable, return this.
    static stopLoadPluginError = new Error("stopLoadPlugin")  // For plugin's beforeProcess method; return this to stop loading the plugin.
    static Package = Object.freeze({
        OS: OS,
        Path: PATH,
        Fs: FS,
        FsExtra: FS_EXTRA,
        ChildProcess: CHILD_PROCESS,
    })

    ////////////////////////////// plugin //////////////////////////////
    static getAllPlugins = () => global.__plugins__
    static getAllCustomPlugins = () => global.__plugins__.custom && global.__plugins__.custom.plugins
    static getPlugin = fixedName => global.__plugins__[fixedName]
    static getCustomPlugin = fixedName => global.__plugins__.custom && global.__plugins__.custom.plugins[fixedName]
    static getAllPluginSettings = () => global.__plugin_settings__
    static getAllCustomPluginSettings = () => (global.__plugins__.custom && global.__plugins__.custom.pluginsSettings) || {}
    static getGlobalSetting = name => global.__plugin_settings__.global[name]
    static getPluginSetting = fixedName => global.__plugin_settings__[fixedName]
    static getCustomPluginSetting = fixedName => this.getAllCustomPluginSettings()[fixedName]
    static tryGetPlugin = fixedName => this.getPlugin(fixedName) || this.getCustomPlugin(fixedName)
    static tryGetPluginSetting = fixedName => this.getAllPluginSettings()[fixedName] || this.getAllCustomPluginSettings()[fixedName]

    static getPluginFunction = (fixedName, func) => {
        const plugin = this.tryGetPlugin(fixedName);
        return plugin && plugin[func];
    }
    static callPluginFunction = (fixedName, func, ...args) => {
        const plugin = this.tryGetPlugin(fixedName)
        const _func = plugin && plugin[func]
        if (_func) {
            _func.apply(plugin, args)
        }
        return _func
    }

    static isUnderMountFolder = path => {
        const mountFolder = PATH.resolve(File.getMountFolder());
        const _path = PATH.resolve(path);
        return _path && mountFolder && _path.startsWith(mountFolder);
    }
    static openFile = filepath => {
        if (!this.getMountFolder() || this.isUnderMountFolder(filepath)) {
            File.editor.restoreLastCursor();
            File.editor.focusAndRestorePos();
            File.editor.library.openFile(filepath);
        } else {
            File.editor.library.openFileInNewWindow(filepath, false);
        }
    }
    static openFolder = folder => File.editor.library.openFileInNewWindow(folder, true);
    static reload = async () => {
        const content = await File.getContent();
        const arg = { fromDiskChange: false, skipChangeCount: true, skipUndo: true, skipStore: true };
        File.reloadContent(content, arg);
    }

    static showHiddenElementByPlugin = target => {
        if (!target) return;
        const plugins = ["collapse_paragraph", "collapse_table", "collapse_list", "truncate_text"];
        plugins.forEach(plu => this.callPluginFunction(plu, "rollback", target));
    }

    static getAnchorNode = () => File.editor.getJQueryElem(window.getSelection().anchorNode);
    static withAnchorNode = (selector, func) => () => {
        const anchorNode = this.getAnchorNode()
        const target = anchorNode.closest(selector)
        if (target && target[0]) {
            func(target[0])
        }
    }
    static _meta = {} // Used to pass data in the context menu; do not manually call this variable.
    static updatePluginDynamicActions = (fixedName, anchorNode, notInContextMenu = false) => {
        const plugin = this.getPlugin(fixedName)
        if (plugin && plugin.getDynamicActions instanceof Function) {
            anchorNode = anchorNode || this.getAnchorNode()
            const anchor = anchorNode[0]
            if (anchor) {
                this._meta = {}
                return plugin.getDynamicActions(anchor, this._meta, notInContextMenu)
            }
        }
    }
    static callPluginDynamicAction = (fixedName, action) => {
        const plugin = this.getPlugin(fixedName)
        if (plugin && plugin.call instanceof Function) {
            plugin.call(action, this._meta)
        }
    }
    static updateAndCallPluginDynamicAction = (fixedName, action, anchorNode, notInContextMenu) => {
        this.updatePluginDynamicActions(fixedName, anchorNode, notInContextMenu)
        this.callPluginDynamicAction(fixedName, action)
    }

    // Repo: https://github.com/jimp-dev/jimp
    // after loadJimp(), you can use globalThis.Jimp
    // static loadJimp = async () => await $.getScript((File.isNode ? "./lib.asar" : "./lib") + "/jimp/browser/lib/jimp.min.js")

    // static sendEmail = (email, subject = "", body = "") => reqnode("electron").shell.openExternal(`mailto:${email}?subject=${subject}&body=${body}`)

    static downloadImage = async (src, folder, filename) => {
        folder = folder || this.tempFolder;
        filename = filename || (this.randomString() + "_" + PATH.extname(src))
        const { state } = await JSBridge.invoke("app.download", src, folder, filename);
        return { ok: state === "completed", filepath: PATH.join(folder, filename) }
    }


    ////////////////////////////// event //////////////////////////////
    static metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey
    static shiftKeyPressed = ev => ev.shiftKey
    static altKeyPressed = ev => ev.altKey
    static isIMEActivated = ev => ev.key === "Process"
    static modifierKey = keyString => {
        const keys = keyString.toLowerCase().split("+").map(k => k.trim());
        const ctrl = keys.indexOf("ctrl") !== -1;
        const shift = keys.indexOf("shift") !== -1;
        const alt = keys.indexOf("alt") !== -1;
        return ev => this.metaKeyPressed(ev) === ctrl && this.shiftKeyPressed(ev) === shift && this.altKeyPressed(ev) === alt
    }


    ////////////////////////////// pure function //////////////////////////////
    static noop = args => args

    /** @description param fn cannot be an async function that returns promiseLike object */
    static throttle = (fn, delay) => {
        let timer;
        const isAsync = this.isAsyncFunction(fn);
        return function (...args) {
            if (timer) return;
            const result = isAsync
                ? Promise.resolve(fn(...args)).catch(e => Promise.reject(e))
                : fn(...args)
            timer = setTimeout(() => {
                clearTimeout(timer);
                timer = null;
            }, delay)
            return result
        }
    }

    /** @description param fn cannot be an async function that returns promiseLike object */
    static debounce = (fn, delay) => {
        let timer;
        const isAsync = this.isAsyncFunction(fn);
        return function (...args) {
            clearTimeout(timer);
            if (isAsync) {
                return new Promise(resolve => timer = setTimeout(() => resolve(fn(...args)), delay)).catch(e => Promise.reject(e))
            } else {
                timer = setTimeout(() => fn(...args), delay);
            }
        };
    }

    /** @description param fn cannot be an async function that returns promiseLike object */
    static once = fn => {
        let called = false;
        const isAsync = this.isAsyncFunction(fn);
        return function (...args) {
            if (called) return;
            called = true;
            return isAsync
                ? Promise.resolve(fn(...args)).catch(e => Promise.reject(e))
                : fn(...args);
        }
    }

    /** @description param fn cannot be an async function that returns promiseLike object */
    static memorize = fn => {
        const cache = {}
        const isAsync = this.isAsyncFunction(fn)
        return function (...args) {
            const key = JSON.stringify(args)
            if (cache[key]) {
                return cache[key]
            }
            const result = isAsync
                ? Promise.resolve(fn(...args)).catch(e => Promise.reject(e))
                : fn(...args)
            cache[key] = result
            return result
        }
    }

    /** @description param fn cannot be an async function that returns promiseLike object */
    static memoizeLimited = (fn, cap = 100) => {
        const cache = new Map()
        const isAsync = this.isAsyncFunction(fn)
        return function (...args) {
            const key = JSON.stringify(args)
            const cacheEntry = cache.get(key)
            if (cacheEntry) {
                cache.delete(key)
                cache.set(key, cacheEntry)
                return cacheEntry
            }
            const result = isAsync
                ? Promise.resolve(fn(...args)).catch(e => Promise.reject(e))
                : fn(...args)
            cache.set(key, result)
            if (cap > 0 && cache.size > cap) {
                cache.delete(cache.keys().next().value)
            }
            return result
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

    static zip = (...arrays) => {
        const zipped = []
        const minLength = Math.min(...arrays.map(arr => arr.length))
        for (let i = 0; i < minLength; i++) {
            zipped.push(arrays.map(arr => arr[i]))
        }
        return zipped
    }

    /** @description try not to use it */
    static sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

    /**
     * @example merge({ a: [{ b: 2 }] }, { a: [{ c: 2 }] }) -> { a: [{ c: 2 }] }
     * @example merge({ o: { a: 3 } }, { o: { b: 4 } }) -> { o: { a: 3, b: 4 } }
     */
    static merge = (source, other) => {
        if (!this.isObject(source) || !this.isObject(other)) {
            return other === undefined ? source : other
        }
        return Object.keys({ ...source, ...other }).reduce((obj, key) => {
            const isArray = Array.isArray(source[key]) && Array.isArray(other[key])
            obj[key] = isArray ? other[key] : this.merge(source[key], other[key])
            return obj
        }, Array.isArray(source) ? [] : {})
    }

    /**
     * only merge keys that exist in source
     * @example update({ o: { a: [1, 2] } }, { o: { a: [3, 4] }, d: { b: 4 } }) -> { o: { a: [ 3, 4 ] } } }
     * @example update({ o: { a: 3, c: 1 } }, { o: { a: 2 }, d: { b: 4 } }) -> { o: { a: 2, c: 1 } } }
     */
    static update = (source, other) => {
        if (!this.isObject(source) || !this.isObject(other)) {
            return other === undefined ? source : other
        }
        return Object.keys(source).reduce((obj, key) => {
            const isArray = Array.isArray(source[key]) && Array.isArray(other[key]);
            if (other[key]) {
                obj[key] = isArray ? other[key] : this.update(source[key], other[key]);
            } else {
                obj[key] = source[key];
            }
            return obj;
        }, Array.isArray(source) ? [] : {});
    }

    static pick = (obj, attrs) => {
        if (!obj || typeof obj !== "object") {
            return {}
        }
        const entries = attrs
            .map(attr => [attr, obj[attr]])
            .filter(([_, value]) => value !== undefined)
        return Object.fromEntries(entries)
    }

    static pickBy = (obj, predicate) => {
        if (!obj || typeof obj !== "object" || typeof predicate !== "function") {
            return {}
        }
        const entries = Object.entries(obj).filter(([key, value]) => predicate(value, key, obj))
        return Object.fromEntries(entries)
    }

    static asyncReplaceAll = (content, regexp, replaceFunc) => {
        if (!regexp.global) {
            throw Error("regexp must be global");
        }

        let match;
        let lastIndex = 0;
        const reg = new RegExp(regexp);  // To avoid modifying the RegExp.lastIndex property, copy a new object
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

    static dateTimeFormat = (date = new Date(), format = "yyyy-MM-dd HH:mm:ss", locale = undefined) => {
        const fns = {
            yyyy: () => date.getFullYear().toString(),
            yyy: () => (date.getFullYear() % 1000).toString().padStart(3, "0"),
            yy: () => (date.getFullYear() % 100).toString().padStart(2, "0"),
            MMMM: () => new Intl.DateTimeFormat(locale, { month: "long" }).format(date),
            MMM: () => new Intl.DateTimeFormat(locale, { month: "short" }).format(date),
            MM: () => (date.getMonth() + 1).toString().padStart(2, "0"),
            M: () => (date.getMonth() + 1).toString(),
            dddd: () => new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date),
            ddd: () => new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date),
            dd: () => date.getDate().toString().padStart(2, "0"),
            d: () => date.getDate().toString(),
            HH: () => date.getHours().toString().padStart(2, "0"),
            H: () => date.getHours().toString(),
            hh: () => ((date.getHours() % 12 || 12)).toString().padStart(2, "0"),
            h: () => (date.getHours() % 12 || 12).toString(),
            mm: () => date.getMinutes().toString().padStart(2, "0"),
            m: () => date.getMinutes().toString(),
            ss: () => date.getSeconds().toString().padStart(2, "0"),
            s: () => date.getSeconds().toString(),
            SSS: () => date.getMilliseconds().toString().padStart(3, "0"),
            S: () => date.getMilliseconds().toString(),
            a: () => {
                const time = new Intl.DateTimeFormat(locale, { hour: "numeric", hour12: true })
                    .formatToParts(date)
                    .find(part => part.type === "dayPeriod")
                return time ? time.value : ""
            }
        }
        const regex = /(yyyy|yyy|yy|MMMM|MMM|MM|M|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|SSS|S|a)/g
        return format.replace(regex, (match) => fns[match] ? fns[match]() : match)
    }

    /** @description NOT a foolproof solution. */
    static isBase64 = str => str.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(str);
    /** @description NOT a foolproof solution. In fact, the Promises/A+ specification is not a part of Node.js, so there is no foolproof solution at all */
    static isPromise = obj => this.isObject(obj) && typeof obj.then === "function"
    /** @description NOT a foolproof solution. Can only be used to determine the "true" asynchronous functions */
    static isAsyncFunction = fn => fn.constructor.name === "AsyncFunction"
    /** @description NOT a foolproof solution. */
    static isObject = value => {
        const type = typeof value
        return value !== null && (type === "object" || type === "function")
    }

    static windowsPathToUnix = filepath => {
        if (!File.isWin) {
            return filepath
        }
        const sep = filepath.split(PATH.win32.sep);
        const newS = [].concat([sep[0].toLowerCase()], sep.slice(1));
        return "/" + PATH.posix.join.apply(PATH.posix, newS).replace(":", "")
    }

    static escape = htmlStr => htmlStr.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    static compareVersion = (ver1, ver2) => {
        if (ver1 === "" && ver2 !== "") {
            return -1
        } else if (ver2 === "" && ver1 !== "") {
            return 1
        }
        const arr1 = ver1.split(".");
        const arr2 = ver2.split(".");
        const maxLength = Math.max(arr1.length, arr2.length);
        for (let i = 0; i < maxLength; i++) {
            const num1 = parseInt(arr1[i] || 0);
            const num2 = parseInt(arr2[i] || 0);
            if (num1 !== num2) {
                return num1 - num2;
            }
        }
        return 0
    }

    ////////////////////////////// business file operation //////////////////////////////
    static _plugin_version = ""
    static getPluginVersion = async () => {
        if (!this._plugin_version) {
            const file = this.joinPath("./plugin/bin/version.json")
            try {
                const { tag_name } = await this.Package.FsExtra.readJson(file)
                this._plugin_version = tag_name
            } catch (err) {
                this._plugin_version = "Unknown"
            }
        }
        return this._plugin_version
    }

    /**
     * @param {boolean} shouldSave - Whether to save the content.
     * @param {string} contentType - The content type (e.g., 'markdown', 'html').
     * @param {boolean} skipSetContent - Whether to skip setting the content.
     * @param {any} saveContext - Contextual information for saving (optional).
     * @returns {string} - The content of the editor.
     */
    static getCurrentFileContent = (shouldSave, contentType, skipSetContent, saveContext) => File.sync(shouldSave, contentType, skipSetContent, saveContext)

    static editCurrentFile = async (replacement, reloadContent = true) => {
        await this.fixScrollTop(async () => {
            const bak = File.presentedItemChanged
            File.presentedItemChanged = this.noop

            const filepath = this.getFilePath()
            const content = this.getCurrentFileContent()
            const replaced = replacement instanceof Function
                ? await replacement(content)
                : replacement
            if (filepath) {
                const ok = await this.writeFile(filepath, replaced)
                if (!ok) return
            }
            if (reloadContent) {
                File.reloadContent(replaced, { delayRefresh: true, skipChangeCount: true, skipStore: true })
            }

            setTimeout(() => File.presentedItemChanged = bak, 1500)
        })
    }

    static fixScrollTop = async func => {
        const inSourceMode = File.editor.sourceView.inSourceMode;
        const scrollTop = inSourceMode
            ? File.editor.sourceView.cm.getScrollInfo().top
            : document.querySelector("content").scrollTop;
        await func();
        if (inSourceMode) {
            File.editor.sourceView.cm.scrollTo(0, scrollTop);
        } else {
            document.querySelector("content").scrollTop = scrollTop;
        }
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
                const { textID, text, fileID, file } = style;
                if (fileID && file) {
                    this.insertStyleFile(fileID, file)
                }
                if (textID && text) {
                    this.insertStyle(textID, text)
                }
                break
        }
    }

    static insertScript = filepath => $.getScript(`file:///${this.joinPath(filepath)}`)
    static removeStyle = id => this.removeElementByID(id)

    static newFilePath = async filename => {
        filename = filename || File.getFileName() || (new Date()).getTime().toString() + ".md";
        const dirPath = this.getFilePath() ? this.getCurrentDirPath() : this.getMountFolder();
        if (!dirPath) {
            alert(i18n.t("global", "error.onBlankPage"))
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
        if (fileName === undefined) return
        if (removeSuffix) {
            const idx = fileName.lastIndexOf(".");
            if (idx !== -1) {
                fileName = fileName.substring(0, idx);
            }
        }
        return fileName
    }

    ////////////////////////////// Basic file operations //////////////////////////////
    static getDirname = () => global.dirname || global.__dirname
    static getHomeDir = () => OS.homedir() || File.option.userPath
    static getFilePath = () => File.filePath || (File.bundle && File.bundle.filePath) || ""
    static getMountFolder = () => File.getMountFolder() || ""
    static getCurrentDirPath = () => PATH.dirname(this.getFilePath())
    static joinPath = (...paths) => PATH.join(this.getDirname(), ...paths)
    static requireFilePath = (...paths) => require(this.joinPath(...paths))

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
            const detail = e.toString()
            const confirm = i18n.t("global", "confirm")
            const message = i18n.t("global", "error.writingFileFailed")
            const op = { type: "error", title: "Typora Plugin", buttons: [confirm], message, detail }
            await this.showMessageBox(op)
        }
    }

    static readYaml = content => {
        const yaml = require("../lib/js-yaml")
        return yaml.safeLoad(content)
    }
    static stringifyYaml = (obj, args) => {
        const yaml = require("../lib/js-yaml")
        return yaml.safeDump(obj, { lineWidth: -1, forceQuotes: true, styles: { "!!null": "lowercase" }, ...args })
    }
    static readToml = content => require("../lib/soml-toml").parse(content)
    static stringifyToml = obj => require("../lib/soml-toml").stringify(obj)
    static readTomlFile = async filepath => this.readToml(await FS.promises.readFile(filepath, "utf-8"))

    static unzip = async (buffer, workDir) => {
        const output = [];
        const jsZip = require("../lib/jszip")
        const zipData = await jsZip.loadAsync(buffer);
        for (const [name, file] of Object.entries(zipData.files)) {
            const dest = PATH.join(workDir, name);
            if (file.dir) {
                await FS_EXTRA.ensureDir(dest);
            } else {
                const content = await file.async("nodebuffer");
                await FS.promises.writeFile(dest, content);
            }
            output.push(dest);
        }
        return output
    }

    ////////////////////////////// Business Operations //////////////////////////////
    static exitTypora = () => JSBridge.invoke("window.close");
    static restartTypora = (reopenClosedFiles = true) => {
        if (reopenClosedFiles) {
            this.callPluginFunction("reopenClosedFiles", "save")
        }
        this.openFolder(this.getMountFolder())
        setTimeout(this.exitTypora, 50)
    }
    static showInFinder = filepath => JSBridge.showInFinder(filepath || this.getFilePath())
    static isDiscardableUntitled = () => File && File.changeCounter && File.changeCounter.isDiscardableUntitled();

    static openUrl = url => (File.editor.tryOpenUrl_ || File.editor.tryOpenUrl)(url, 1);

    static showMessageBox = async (
        {
            type = "info",
            title = "typora",
            message, detail,
            buttons = [i18n.t("global", "confirm"), i18n.t("global", "cancel")],
            defaultId = 0,
            cancelId = 1,
            normalizeAccessKeys = true,
            checkboxLabel,
        }
    ) => {
        const op = { type, title, message, detail, buttons, defaultId, cancelId, normalizeAccessKeys, checkboxLabel };
        return JSBridge.invoke("dialog.showMessageBox", op)
    }

    static _markdownIt = null
    static getMarkdownIt = () => {
        if (!this._markdownIt) {
            const { markdownit } = require("../lib/markdown-it")
            this._markdownIt = markdownit({ html: true, linkify: true, typographer: true })
        }
        return this._markdownIt
    }
    static parseMarkdownBlock = (content, options = {}) => this.getMarkdownIt().parse(content, options)
    static parseMarkdownInline = (content, options = {}) => this.getMarkdownIt().parseInline(content, options)

    static fetch = async (url, { proxy = "", timeout = 3 * 60 * 1000, ...args }) => {
        let signal, agent
        if (timeout) {
            if (AbortSignal && AbortSignal.timeout) {
                signal = AbortSignal.timeout(timeout)
            } else if (AbortController) {
                const controller = new AbortController()
                setTimeout(() => controller.abort(), timeout)
                signal = controller.signal // polyfill
            }
        }
        if (proxy) {
            const proxyAgent = require("../lib/https-proxy-agent")
            agent = new proxyAgent.HttpsProxyAgent(proxy)
        }
        const nodeFetch = require("../lib/node-fetch")
        return nodeFetch.fetch(url, { agent, signal, ...args })
    }

    static splitFrontMatter = content => {
        const result = { yamlObject: null, remainContent: content, yamlLineCount: 0 };
        content = content.trimLeft();
        if (!/^---\r?\n/.test(content)) {
            return result
        }
        const matchResult = /\n---\r?\n/.exec(content);
        if (!matchResult) {
            return result
        }
        const yamlContent = content.slice(4, matchResult.index);
        const remainContent = content.slice(matchResult.index + matchResult[0].length);
        const yamlLineCount = (yamlContent.match(/\n/g) || []).length + 3;
        let yamlObject = {}
        try {
            yamlObject = this.readYaml(yamlContent)
        } catch (e) {
            console.error(e)
        }
        return { yamlObject, remainContent, yamlLineCount }
    }

    static getRecentFiles = async () => {
        const recent = await JSBridge.invoke("setting.getRecentFiles")
        const ret = typeof recent === "string" ? JSON.parse(recent || "{}") : (recent || {})
        const { files = [], folders = [] } = ret
        return { files, folders }
    }

    static isNetworkURI = url => /^https?|(ftp):\/\//.test(url)
    static isSpecialImage = src => /^(blob|chrome-blob|moz-blob|data):[^\/]/.test(src)
    static isNetworkImage = this.isNetworkURI

    static getFenceContentByCid = cid => {
        if (!cid) return
        const fence = File.editor.fences.queue[cid]
        if (fence) {
            return fence.getValue()
        }
    }
    static getFenceContentByPre = pre => this.getFenceContentByCid(pre && pre.getAttribute("cid"))

    /** Backup before `File.editor.stylize.toggleFences()` as it uses `File.option` to set block code language. Restore after. */
    static insertFence = (lang = "") => {
        const lang1_ = File.option["default-code-lang"]  // Used for old versions
        const lang2_ = File.option.defaultCodeLang       // Used for new versions
        const menu_ = File.option.DefaultCodeLangOptionMenu
        const op_ = File.option.defaultCodeLangOption

        File.option["default-code-lang"] = lang
        File.option.defaultCodeLang = lang
        File.option.DefaultCodeLangOptionMenu = 1
        File.option.defaultCodeLangOption = 1
        try {
            File.editor.stylize.toggleFences()
        } finally {
            File.option["default-code-lang"] = lang1_
            File.option.defaultCodeLang = lang2_
            File.option.DefaultCodeLangOptionMenu = menu_
            File.option.defaultCodeLangOption = op_
        }
    }

    static getTocTree = useBuiltin => {
        const root = { depth: 0, cid: "n0", text: this.getFileName(), children: [] }
        const stack = [root]
        const toc = useBuiltin
            ? File.editor.library.outline.getHeaderMatrix(true)
                .map(([depth, text, cid]) => ({ depth, text, cid, children: [] }))
            : (File.editor.nodeMap.toc.headers || [])
                .filter(node => Boolean(node && node.attributes))
                .map(({ attributes: { depth, text }, cid }) => {
                    text = text.replace(/\[\^([^\]]+)\]/g, "")
                    text = this.escape(text)
                    return { depth, cid, text, children: [] }
                })
        toc.forEach(node => {
            while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
                stack.pop()
            }
            const parent = stack[stack.length - 1]
            parent.children.push(node)
            stack.push(node)
        })
        return root
    }

    ////////////////////////////// DOM Operations //////////////////////////////
    static removeElement = ele => ele && ele.parentElement && ele.parentElement.removeChild(ele)
    static removeElementByID = id => this.removeElement(document.getElementById(id))

    static isShow = ele => !ele.classList.contains("plugin-common-hidden");
    static isHidden = ele => ele.classList.contains("plugin-common-hidden");
    static hide = ele => ele.classList.add("plugin-common-hidden");
    static show = ele => ele.classList.remove("plugin-common-hidden");
    static toggleVisible = (ele, force) => ele.classList.toggle("plugin-common-hidden", force);

    static isImgEmbed = img => img.complete && img.naturalWidth !== 0 && img.naturalHeight !== 0

    static isInViewBox = el => {
        const totalHeight = window.innerHeight || document.documentElement.clientHeight;
        const totalWidth = window.innerWidth || document.documentElement.clientWidth;
        const { top, right, bottom, left } = el.getBoundingClientRect();
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

    static buildTable = rows => {
        const first = rows.shift()
        const th = first.map(row => `<th>${row}</th>`).join("")
        const trs = rows.map(row => row.map(e => `<td>${e}</td>`).join(""))
        const all = [th, ...trs].map(e => `<tr>${e}</tr>`)
        const thead = all.shift()
        const tbody = all.join("")
        return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`
    }

    static moveCursor = $target => File.editor.selection.jumpIntoElemEnd($target);

    static scroll = ($target, height = -1, moveCursor = false, showHiddenElement = true) => {
        if ($target instanceof Element) {
            $target = $($target);
        }
        File.editor.focusAndRestorePos();
        if (moveCursor) {
            this.moveCursor($target);
        }
        if (showHiddenElement) {
            this.showHiddenElementByPlugin($target[0]);
        }
        if (height === -1) {
            height = (window.innerHeight || document.documentElement.clientHeight) / 2;
        }
        if (File.isTypeWriterMode) {
            File.editor.selection.typeWriterScroll($target)
        } else {
            File.editor.selection.scrollAdjust($target, height)
        }
        if (File.isFocusMode) {
            File.editor.updateFocusMode(false)
        }
    }

    static scrollByCid = (cid, height = -1, moveCursor = false, showHiddenElement = true) => {
        const $target = File.editor.findElemById(cid)
        this.scroll($target, height, moveCursor, showHiddenElement)
    }

    static scrollSourceView = lineToGo => {
        const cm = File.editor.sourceView.cm;
        cm.scrollIntoView({ line: lineToGo - 1, ch: 0 });
        cm.setCursor({ line: lineToGo - 1, ch: 0 });
    }

    // content: string type. \n represents a soft line break; \n\n represents a hard line break.
    static insertText = (anchorNode, content, restoreLastCursor = true) => {
        if (restoreLastCursor) {
            File.editor.contextMenu.hide();
            // File.editor.writingArea.focus();
            File.editor.restoreLastCursor();
        }
        File.editor.insertText(content);
    }

    static createDocumentFragment = elements => {
        if (!elements) return;

        if (typeof elements === "string") {
            const dom = new DOMParser().parseFromString(elements, "text/html")
            elements = [...dom.body.childNodes]
        }
        let fragment = elements;
        if (elements instanceof Array || elements instanceof NodeList) {
            fragment = document.createDocumentFragment();
            fragment.append(...elements);
        }
        return fragment;
    }

    static insertElement = elements => {
        const fragment = this.createDocumentFragment(elements);
        if (fragment) {
            const quickOpenNode = document.getElementById("typora-quick-open");
            quickOpenNode.parentNode.insertBefore(fragment, quickOpenNode.nextSibling);
        }
    }

    static findActiveNode = range => {
        range = range || File.editor.selection.getRangy()
        if (range) {
            const markElem = File.editor.getMarkElem(range.anchorNode)
            return File.editor.findNodeByElem(markElem)
        }
    }

    static getRangy = () => {
        const range = File.editor.selection.getRangy();
        const markElem = File.editor.getMarkElem(range.anchorNode);
        const node = File.editor.findNodeByElem(markElem);
        const bookmark = range.getBookmark(markElem[0]);
        return { range, markElem, node, bookmark }
    }

    static getRangyText = () => {
        const { node, bookmark } = this.getRangy();
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
            const { width, height } = document.defaultView.getComputedStyle(resizeElement);
            startX = ev.clientX;
            startY = ev.clientY;
            startWidth = parseFloat(width);
            startHeight = parseFloat(height);
            if (onMouseDown) {
                onMouseDown(startX, startY, startWidth, startHeight)
            }
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
                    const { deltaX: newDeltaX, deltaY: newDeltaY } = onMouseMove(deltaX, deltaY) || {};
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
            if (onMouseUp) {
                onMouseUp()
            }
        }
    }

    static dragFixedModal = (
        handleElement, moveElement, withMetaKey = true,
        _onMouseDown = null, _onMouseMove = null, _onMouseUp = null
    ) => {
        handleElement.addEventListener("mousedown", ev => {
            if (withMetaKey && !this.metaKeyPressed(ev) || ev.button !== 0) return;
            ev.stopPropagation();
            const { left, top } = moveElement.getBoundingClientRect();
            const shiftX = ev.clientX - left;
            const shiftY = ev.clientY - top;
            if (_onMouseDown) {
                _onMouseDown()
            }

            const onMouseMove = ev => {
                if (withMetaKey && !this.metaKeyPressed(ev) || ev.button !== 0) return;
                ev.stopPropagation();
                ev.preventDefault();
                requestAnimationFrame(() => {
                    if (_onMouseMove) {
                        _onMouseMove()
                    }
                    moveElement.style.left = ev.clientX - shiftX + 'px';
                    moveElement.style.top = ev.clientY - shiftY + 'px';
                });
            }

            const onMouseUp = ev => {
                if (withMetaKey && !this.metaKeyPressed(ev) || ev.button !== 0) return;
                if (_onMouseUp) {
                    _onMouseUp()
                }
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
        if (origin) {
            origin.classList.toggle("active")
        }
        active.classList.toggle("active");
        active.scrollIntoView({ block: "nearest" });
    }

    static stopCallError = new Error("stopCall") // For the decorate method; return this to stop executing the native function.
    static decorate = (objGetter, attr, before, after, changeResult = false) => {
        function decorator(original, before, after) {
            const fn = function () {
                if (before) {
                    const error = before.call(this, ...arguments)
                    if (error === utils.stopCallError) return
                }
                let result = original.apply(this, arguments)
                if (after) {
                    const afterResult = after.call(this, result, ...arguments)
                    if (changeResult) {
                        result = afterResult
                    }
                }
                return result
            }
            return Object.defineProperty(fn, "name", { value: original.name })
        }

        const start = new Date().getTime()
        const timer = setInterval(() => {
            if (new Date().getTime() - start > 10000) {
                console.error("decorate timeout!", objGetter, attr, before, after, changeResult)
                clearInterval(timer)
                return
            }
            const obj = objGetter()
            if (obj && obj[attr]) {
                clearInterval(timer)
                obj[attr] = decorator(obj[attr], before, after)
            }
        }, 20)
    }

    static loopDetector = (until, after, detectInterval = 20, timeout = 10000, runWhenTimeout = true) => {
        let run = false
        const start = new Date().getTime()
        const timer = setInterval(() => {
            if (new Date().getTime() - start > timeout) {
                run = runWhenTimeout
                if (!run) {
                    clearInterval(timer)
                    return
                }
            }
            if (until() || run) {
                clearInterval(timer)
                if (after) {
                    after()
                }
            }
        }, detectInterval)
    }
}

const newMixin = (utils) => {
    const MIXIN = {
        ...require("./settings"),
        ...require("./migrate"),
        ...require("./hotkeyHub"),
        ...require("./eventHub"),
        ...require("./stateRecorder"),
        ...require("./exportHelper"),
        ...require("./styleTemplater"),
        ...require("./contextMenu"),
        ...require("./notification"),
        ...require("./progressBar"),
        ...require("./dialog"),
        ...require("./diagramParser"),
        ...require("./thirdPartyDiagramParser"),
        ...require("./entities"),
    }
    const mixin = Object.fromEntries(
        Object.entries(MIXIN).map(([name, cls]) => [[name], new cls(utils, i18n)])
    )

    // we should use composition to layer various functions, but utils is outdated and has become legacy code. My apologies
    Object.assign(utils, mixin, {
        /** @deprecated new API: utils.hotkeyHub.register */
        registerHotkey: mixin.hotkeyHub.register,
        /** @deprecated new API: utils.dialog.modal */
        modal: mixin.dialog.modal
    })

    return mixin
}

const getHook = utils => {
    const mixin = newMixin(utils)

    const {
        styleTemplater, hotkeyHub, eventHub, stateRecorder, exportHelper, contextMenu,
        notification, progressBar, dialog, diagramParser, thirdPartyDiagramParser,
    } = mixin

    const registerMixin = (...ele) => Promise.all(ele.map(h => h.process && h.process()))
    const optimizeMixin = () => Promise.all(Object.values(mixin).map(h => h.afterProcess && h.afterProcess()))

    const registerPreMixin = async () => {
        await registerMixin(styleTemplater)
        await registerMixin(contextMenu, notification, progressBar, dialog, stateRecorder, hotkeyHub, exportHelper)
    }

    const registerPostMixin = async () => {
        await registerMixin(eventHub)
        await registerMixin(diagramParser, thirdPartyDiagramParser)
        eventHub.publishEvent(eventHub.eventType.allPluginsHadInjected)
    }

    return async pluginLoader => {
        await registerPreMixin()
        await pluginLoader()
        await registerPostMixin()
        await optimizeMixin()
        // Due to the use of async, some events may have been missed (such as afterAddCodeBlock), reload it
        if (File.getMountFolder() != null) {
            setTimeout(utils.reload, 50)
        }
    }
}

module.exports = {
    utils,
    hook: getHook(utils),
}
