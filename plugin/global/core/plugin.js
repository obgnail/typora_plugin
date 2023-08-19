class utils {
    static isBetaVersion = parseInt(window._options.appVersion.split(".")[0]) === 0
    static tempFolder = File.option.tempPath

    static stopLoadPluginError = new Error("stopLoadPlugin")
    static stopCallError = new Error("stopCall")
    static detectorContainer = {}
    static Package = {
        Path: reqnode("path"),
        Fs: reqnode("fs"),
        ChildProcess: reqnode('child_process'),
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

    static metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey
    static shiftKeyPressed = ev => !!ev.shiftKey
    static altKeyPressed = ev => !!ev.altKey

    static getPlugin = fixed_name => global._plugins[fixed_name]
    static getDirname = () => global.dirname || global.__dirname
    static getFilePath = () => File.filePath || File.bundle && File.bundle.filePath
    static joinPath = (...paths) => this.Package.Path.join(this.getDirname(), ...paths)

    static requireFilePath = (...paths) => {
        const filepath = this.joinPath(...paths);
        return reqnode(filepath)
    }

    static readFileSync = filepath => {
        filepath = this.joinPath(filepath);
        return this.Package.Fs.readFileSync(filepath, 'utf8');
    }

    static readToml = filepath => {
        const pluginsFile = this.readFileSync(filepath);
        const tomlParser = this.requireFilePath("./plugin/global/utils/toml");
        return tomlParser.parse(pluginsFile);
    }

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

    static decorate = (until, obj, func, before, after, changeResult = false) => {
        const start = new Date().getTime();
        const uuid = Math.random();
        this.detectorContainer[uuid] = setInterval(() => {
            if (new Date().getTime() - start > 10000) {
                console.log("decorate timeout!", until, obj, func, before, after, changeResult);
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
            obj[func] = decorator(obj[func], before, after);
            delete this.detectorContainer[uuid];
        }, 20);
    }

    static decorateOpenFile = (before, after) => {
        this.decorate(() => (File && File.editor && File.editor.library && File.editor.library.openFile),
            File.editor.library, "openFile", before, after)
    }

    static decorateAddCodeBlock = (before, after) => {
        this.decorate(() => (File && File.editor && File.editor.fences && File.editor.fences.addCodeBlock),
            File.editor.fences, "addCodeBlock", before, after)
    }

    static loopDetector = (until, after, detectInterval = 20) => {
        const uuid = Math.random();
        this.detectorContainer[uuid] = setInterval(() => {
            if (until()) {
                clearInterval(this.detectorContainer[uuid]);
                after && after();
                delete this.detectorContainer[uuid];
            }
        }, detectInterval);
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

class process {
    constructor() {
        this.utils = utils;
        this.helper = new hotkeyHelper();
    }

    insertStyle(style) {
        if (!style) return;
        const textID = style["textID"] || null;
        const text = style["text"] || null;
        const fileID = style["fileID"] || null;
        const file = style["file"] || null;
        if (textID && text) {
            this.utils.insertStyle(textID, text);
        }
        if (fileID && file) {
            this.utils.insertStyleFile(fileID, file);
        }
    }

    loadPlugin(pluginClass, pluginSetting) {
        const plugin = new pluginClass(pluginSetting);

        const error = plugin.beforeProcess();
        if (error !== this.utils.stopLoadPluginError) {
            this.insertStyle(plugin.style());
            plugin.html();
            this.helper.register(plugin.hotkey());
            plugin.process();
            plugin.afterProcess();
            console.log(`plugin had been injected: [ ${plugin.fixed_name} ] `);

            global._plugins[plugin.fixed_name] = plugin;
        }
    }

    run() {
        global._plugins = {};
        global._pluginsHadInjected = false;

        const pluginSettings = this.utils.readToml("./plugin/global/settings/settings.toml");
        const promises = [];

        for (const fixed_name in pluginSettings) {
            const pluginSetting = pluginSettings[fixed_name];
            pluginSetting.fixed_name = fixed_name;

            if (!pluginSetting.ENABLE) continue;

            const filepath = this.utils.joinPath("./plugin", fixed_name);
            const promise = new Promise(resolve => {
                try {
                    const {plugin} = reqnode(filepath);
                    this.loadPlugin(plugin, pluginSetting);
                } catch (e) {
                    console.error("plugin err:", e);
                }
                resolve();
            })
            promises.push(promise);
        }

        Promise.all(promises).then(() => {
            this.helper.listen();
            global._pluginsHadInjected = true;
        })
    }
}

module.exports = {
    process
};