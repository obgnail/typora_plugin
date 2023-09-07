class utils {
    static isBetaVersion = parseInt(window._options.appVersion.split(".")[0]) === 0
    static tempFolder = File.option.tempPath

    static nonExistSelector = "#write #__has_not_this_element_id__";
    static stopLoadPluginError = new Error("stopLoadPlugin")
    static stopCallError = new Error("stopCall")
    static detectorContainer = {}
    static Package = {
        Path: reqnode("path"),
        Fs: reqnode("fs"),
        FsExtra: reqnode("fs-extra"),
        ChildProcess: reqnode('child_process'),
    }

    // { a: [{ b: 2 }] } { a: [{ c: 2 }]} -> { a: [{b:2}, {c:2}]}
    // merge({o: {a: 3}}, {o: {b:4}}) => {o: {a:3, b:4}}
    static merge(source, other) {
        const isObject = value => {
            const type = typeof value
            return value !== null && (type === 'object' || type === 'function')
        }

        if (!isObject(source) || !isObject(other)) {
            return other === undefined ? source : other
        }
        // 合并两个对象的 key，另外要区分数组的初始值为 []
        return Object.keys({
            ...source,
            ...other
        }).reduce((acc, key) => {
            // 递归合并 value
            acc[key] = this.merge(source[key], other[key])
            return acc
        }, Array.isArray(source) ? [] : {})
    }

    static insertStyle = (id, css) => {
        const style = document.createElement('style');
        style.id = id;
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);
    }

    static insertStyleFile = (id, filepath) => {
        const link = document.createElement('link');
        link.type = 'text/css'
        link.rel = 'stylesheet'
        link.href = filepath;
        document.getElementsByTagName('head')[0].appendChild(link);
    }

    static removeStyle = id => {
        const ele = document.getElementById(id);
        ele && ele.parentElement && ele.parentElement.removeChild(ele);
    }

    static insertDiv = div => {
        const quickOpenNode = document.getElementById("typora-quick-open");
        quickOpenNode.parentNode.insertBefore(div, quickOpenNode.nextSibling);
    }

    static insertScript = filepath => {
        const jsFilepath = this.joinPath(filepath);
        return $.getScript(`file:///${jsFilepath}`);
    }

    static getUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            let r = (Math.random() * 16) | 0
            let v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    static metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey
    static shiftKeyPressed = ev => !!ev.shiftKey
    static altKeyPressed = ev => !!ev.altKey

    static getPlugin = fixed_name => global._plugins[fixed_name]
    static getCustomPlugin = fixed_name => {
        const plugin = global._plugins["custom"];
        if (plugin) {
            return plugin["custom"][fixed_name]
        }
    }
    static getDirname = () => global.dirname || global.__dirname
    static getFilePath = () => File.filePath || File.bundle && File.bundle.filePath
    static joinPath = (...paths) => this.Package.Path.join(this.getDirname(), ...paths)

    static requireFilePath = (...paths) => {
        const filepath = this.joinPath(...paths);
        return reqnode(filepath)
    }

    static existPath = filepath => {
        try {
            this.Package.Fs.accessSync(filepath, this.Package.Fs.constants.F_OK);
            return true
        } catch (err) {
        }
    }

    static existInPluginPath = filepath => this.existPath(this.joinPath(filepath))

    static newFilePath = filepath => {
        if (filepath) {
            filepath = this.Package.Path.join(this.Package.Path.dirname(this.getFilePath()), filepath);
        } else {
            filepath = this.getFilePath();
        }

        if (this.existPath(filepath)) {
            const ext = this.Package.Path.extname(filepath);
            if (ext) {
                const regex = new RegExp(`${ext}$`);
                filepath = filepath.replace(regex, `-copy${ext}`);
            } else {
                filepath = filepath + "-copy.md";
            }
        }
        return filepath
    }

    static readFileSync = filepath => {
        filepath = this.joinPath(filepath);
        return this.Package.Fs.readFileSync(filepath, 'utf8');
    }

    static readToml = filepath => {
        const pluginsFile = this.readFileSync(filepath);
        const toml = this.requireFilePath("./plugin/global/utils/toml");
        return toml.parse(pluginsFile);
    }

    static stringifyToml = obj => {
        const toml = this.requireFilePath("./plugin/global/utils/toml");
        return toml.stringify(obj)
    }

    static getFileName = filePath => {
        let fileName = this.Package.Path.basename(filePath);
        const idx = fileName.lastIndexOf(".");
        if (idx !== -1) {
            fileName = fileName.substring(0, idx);
        }
        return fileName
    }

    static openFile = filepath => {
        if (this.getPlugin("window_tab")) {
            File.editor.library.openFile(filepath);
        } else {
            File.editor.library.openFileInNewWindow(filepath, false);
        }
    }

    static scroll = (target, height = 10) => {
        File.editor.focusAndRestorePos();
        File.editor.selection.scrollAdjust(target, height);
        File.isFocusMode && File.editor.updateFocusMode(false);
    }

    static openUrl = url => {
        const openUrl = File.editor.tryOpenUrl_ || File.editor.tryOpenUrl;
        openUrl(url, 1);
    }

    static isNetworkImage = src => /^https?|(ftp):\/\//.test(src);

    static toHotkeyFunc = hotkeyString => {
        const keyList = hotkeyString.toLowerCase().split("+").map(k => k.trim());
        const ctrl = keyList.indexOf("ctrl") !== -1;
        const shift = keyList.indexOf("shift") !== -1;
        const alt = keyList.indexOf("alt") !== -1;
        const key = keyList.filter(key => key !== "ctrl" && key !== "shift" && key !== "alt")[0];

        return ev => this.metaKeyPressed(ev) === ctrl
            && this.shiftKeyPressed(ev) === shift
            && this.altKeyPressed(ev) === alt
            && ev.key.toLowerCase() === key
    }

    static decorate = (until, funcStr, before, after, changeResult = false) => {
        const start = new Date().getTime();
        const uuid = Math.random();
        this.detectorContainer[uuid] = setInterval(() => {
            if (new Date().getTime() - start > 10000) {
                console.error("decorate timeout!", until, funcStr, before, after, changeResult);
                clearInterval(this.detectorContainer[uuid]);
                delete this.detectorContainer[uuid];
                return;
            }

            if (!until()) return;
            clearInterval(this.detectorContainer[uuid]);
            const decorator = (original, before, after) => {
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
            const idx = funcStr.lastIndexOf(".");
            const obj = eval(funcStr.slice(0, idx));
            const func = funcStr.slice(idx + 1);
            obj[func] = decorator(obj[func], before, after);
            delete this.detectorContainer[uuid];
        }, 20);
    }

    static decorateOpenFile = (before, after) => {
        this.decorate(() => (File && File.editor && File.editor.library && File.editor.library.openFile),
            "File.editor.library.openFile", before, after)
    }

    static decorateAddCodeBlock = (before, after) => {
        this.decorate(() => (File && File.editor && File.editor.fences && File.editor.fences.addCodeBlock),
            "File.editor.fences.addCodeBlock", before, after)
    }

    static loopDetector = (until, after, detectInterval = 20, timeout = 10000, runWhenTimeout = true) => {
        let run = false;
        const uuid = Math.random();
        const start = new Date().getTime();
        this.detectorContainer[uuid] = setInterval(() => {
            if (new Date().getTime() - start > timeout) {
                console.warn("loopDetector timeout!", until, after);
                run = runWhenTimeout;
            }

            if (until() || run) {
                clearInterval(this.detectorContainer[uuid]);
                after && after();
                delete this.detectorContainer[uuid];
            }
        }, detectInterval);
    }

    static showHiddenElementByPlugin = target => {
        if (!target) return;
        const collapsePlugin = this.getPlugin("collapse_paragraph");
        const truncatePlugin = this.getPlugin("truncate_text");
        collapsePlugin && collapsePlugin.rollback(target);
        truncatePlugin && truncatePlugin.rollback(target);
    }

    static dragFixedModal = (handleElement, moveElement, withMetaKey = true) => {
        handleElement.addEventListener("mousedown", ev => {
            if (withMetaKey && !this.metaKeyPressed(ev) || ev.button !== 0) return;
            ev.stopPropagation();
            const rect = moveElement.getBoundingClientRect();
            const shiftX = ev.clientX - rect.left;
            const shiftY = ev.clientY - rect.top;

            const onMouseMove = ev => {
                if (withMetaKey && !this.metaKeyPressed(ev) || ev.button !== 0) return;
                ev.stopPropagation();
                ev.preventDefault();
                requestAnimationFrame(() => {
                    moveElement.style.left = ev.clientX - shiftX + 'px';
                    moveElement.style.top = ev.clientY - shiftY + 'px';
                });
            }

            document.addEventListener("mouseup", ev => {
                    if (withMetaKey && !this.metaKeyPressed(ev) || ev.button !== 0) return;
                    ev.stopPropagation();
                    ev.preventDefault();
                    document.removeEventListener('mousemove', onMouseMove);
                    moveElement.onmouseup = null;
                }
            )

            document.addEventListener('mousemove', onMouseMove);
        })
        handleElement.ondragstart = () => false
    }
}

class pluginInterface {
    enable() {
        throw new Error('Method enable not implemented.')
    }

    disable() {
        throw new Error('Method disable not implemented.')
    }

    onEvent(eventType, payload) {
        throw new Error('Method onEvent not implemented.')
    }

    beforeProcess() {
        throw new Error('Method beforeProcess not implemented.')
    }

    process() {
        throw new Error('Method process not implemented.')
    }

    afterProcess() {
        throw new Error('Method afterProcess not implemented.')
    }
}

class basePlugin extends pluginInterface {
    constructor(setting) {
        super();
        this.fixed_name = setting.fixed_name;
        this.config = setting;
        this.utils = utils
    }

    enable() {
        this.config.ENABLE = true;
        this.onEvent("enable", null);
    }

    disable() {
        this.config.ENABLE = false;
        this.onEvent("disable", null);
    }

    beforeProcess() {
    }

    style() {
    }

    html() {
    }

    hotkey() {
    }

    process() {
    }

    afterProcess() {
    }
}

global._basePlugin = basePlugin;

class hotkeyHelper {
    constructor() {
        this.utils = utils;
        this.hotkeyList = [];
    }

    _register = (hotkey, call) => {
        if (typeof hotkey === "string") {
            hotkey = this.utils.toHotkeyFunc(hotkey);
            this.hotkeyList.push({hotkey, call});
        } else if (hotkey instanceof Array) {
            for (const hk of hotkey) {
                this._register(hk, call);
            }
        }
    }

    register(hotkeyList) {
        if (hotkeyList) {
            for (const hotkey of hotkeyList) {
                this._register(hotkey.hotkey, hotkey.callback);
            }
        }
    }

    listen = () => {
        window.addEventListener("keydown", ev => {
            for (const hotkey of this.hotkeyList) {
                if (hotkey.hotkey(ev)) {
                    hotkey.call();
                    ev.preventDefault();
                    ev.stopPropagation();
                    return
                }
            }
        }, true)
    }
}

class userSettingHelper {
    constructor() {
        this.utils = utils;
    }

    updateSettings(pluginSetting) {
        const toml = "./plugin/global/settings/settings.user.toml";
        if (this.utils.existInPluginPath(toml)) {
            const userSettings = this.utils.readToml(toml);
            pluginSetting = this.utils.merge(pluginSetting, userSettings);
        }
        return pluginSetting
    }
}

class process {
    constructor() {
        this.utils = utils;
        this.hotkeyHelper = new hotkeyHelper();
        this.userSettingHelper = new userSettingHelper();
    }

    insertStyle(style) {
        if (!style) return;
        const textID = style["textID"] || null;
        const text = style["text"] || null;
        const fileID = style["fileID"] || null;
        const file = style["file"] || null;
        if (fileID && file) {
            this.utils.insertStyleFile(fileID, file);
        }
        if (textID && text) {
            this.utils.insertStyle(textID, text);
        }
    }

    loadPlugin(pluginClass, pluginSetting) {
        const plugin = new pluginClass(pluginSetting);

        const error = plugin.beforeProcess();
        if (error === this.utils.stopLoadPluginError) return

        this.insertStyle(plugin.style());
        plugin.html();
        this.hotkeyHelper.register(plugin.hotkey());
        plugin.process();
        plugin.afterProcess();
        console.log(`plugin had been injected: [ ${plugin.fixed_name} ] `);
        return plugin
    }

    run() {
        global._plugins = {};
        global._pluginsHadInjected = false;

        let pluginSettings = this.utils.readToml("./plugin/global/settings/settings.default.toml");
        pluginSettings = this.userSettingHelper.updateSettings(pluginSettings);

        const promises = [];

        for (const fixed_name of Object.keys(pluginSettings)) {
            const pluginSetting = pluginSettings[fixed_name];
            pluginSetting.fixed_name = fixed_name;

            if (!pluginSetting.ENABLE) continue;

            const filepath = this.utils.joinPath("./plugin", fixed_name);
            const promise = new Promise(resolve => {
                try {
                    const {plugin} = reqnode(filepath);
                    const instance = this.loadPlugin(plugin, pluginSetting);
                    if (instance) {
                        global._plugins[fixed_name] = instance;
                    }
                } catch (e) {
                    console.error("plugin err:", e);
                }
                resolve();
            })
            promises.push(promise);
        }

        Promise.all(promises).then(() => {
            this.hotkeyHelper.listen();
            global._pluginsHadInjected = true;
        })
    }
}

module.exports = {
    process
};