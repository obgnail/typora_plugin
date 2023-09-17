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

    // { a: [{ b: 2 }] } { a: [{ c: 2 }]} -> { a: [{b:2}, {c:2}]}
    // merge({o: {a: 3}}, {o: {b:4}}) => {o: {a:3, b:4}}
    static merge = (source, other) => {
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

    static once = func => {
        let flag = true;
        return function () {
            if (flag) {
                func.apply(this, arguments);
                flag = false;
            }
        }
    }

    // 注册新的代码块语法
    //   1. lang(string): language
    //   2. destroyWhenUpdate: 更新前是否清空preview里的html
    //   3. renderFunc(async (cid, content, $pre) => null): 渲染函数，根据内容渲染所需的图像
    //        cid: 当前代码块的cid
    //        content: 代码块的内容
    //        $pre: 代码块的jquery element
    //   4. cancelFunc(async cid => null): 取消函数，触发时机：1)修改为其他的lang 2)当代码块内容被清空 3)当代码块内容不符合语法
    //   5. extraStyleGetter(() => string): 用于导出时，新增css
    static registerDiagramParser = (
        lang, destroyWhenUpdate, renderFunc, cancelFunc = null, extraStyleGetter = null
    ) => global._diagramParser.register(lang, destroyWhenUpdate, renderFunc, cancelFunc, extraStyleGetter)
    // 当代码块内容出现语法错误时调用
    static throwParseError = (errorLine, reason) => global._diagramParser.throwParseError(errorLine, reason)

    // 充分信任插件，允许所有插件发布事件
    static publishEvent = (eventType, payload) => global._eventHub.publish(eventType, payload)

    static insertStyle = (id, css) => {
        const style = document.createElement('style');
        style.id = id;
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);
    }

    static insertStyleFile = (id, filepath) => {
        const cssFilePath = this.joinPath(filepath);
        const link = document.createElement('link');
        link.id = id;
        link.type = 'text/css'
        link.rel = 'stylesheet'
        link.href = cssFilePath;
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

    static getUUID = () => {
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

    static insertFence = (anchorNode, content) => {
        File.editor.contextMenu.hide();
        // File.editor.writingArea.focus();
        File.editor.restoreLastCursor();
        File.editor.insertText(content);
    }

    static getFenceContent = (pre, cid) => {
        // from element
        if (pre) {
            const lines = pre.querySelectorAll(".CodeMirror-code .CodeMirror-line");
            if (lines.length) {
                const badChars = [
                    "%E2%80%8B", // ZERO WIDTH SPACE \u200b
                    "%C2%A0", // NO-BREAK SPACE \u00A0
                    "%0A" // NO-BREAK SPACE \u0A
                ];
                const replaceChars = ["", "%20", ""];
                const contentList = [];
                lines.forEach(line => {
                    let encodeText = encodeURI(line.textContent);
                    for (let i = 0; i < badChars.length; i++) {
                        if (encodeText.indexOf(badChars[i]) !== -1) {
                            encodeText = encodeText.replace(new RegExp(badChars[i], "g"), replaceChars[i]);
                        }
                    }
                    const decodeText = decodeURI(encodeText);
                    contentList.push(decodeText);
                })
                if (contentList) {
                    return contentList.join("\n")
                }
            }
        }

        // from queue
        cid = cid || pre && pre.getAttribute("cid");
        if (cid) {
            const fence = File.editor.fences.queue[cid];
            if (fence) {
                return fence.options.value
            }
        }
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

    static decorateExportToHTML = (before, after) => {
        this.decorate(() => (File && File.editor && File.editor.export && File.editor.export.exportToHTML),
            "File.editor.export.exportToHTML", before, after)
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

    static resizeFixedModal = (
        handleElement, resizeElement,
        resizeWidth = true, resizeHeight = true,
        onMouseDown = null, onMouseMove = null, onMouseUp = null
    ) => {
        // 鼠标按下时记录当前鼠标位置和 div 的宽高
        const radix = 10;
        let startX, startY, startWidth, startHeight;
        handleElement.addEventListener("mousedown", ev => {
            startX = ev.clientX;
            startY = ev.clientY;
            startWidth = parseInt(document.defaultView.getComputedStyle(resizeElement).width, radix);
            startHeight = parseInt(document.defaultView.getComputedStyle(resizeElement).height, radix);
            onMouseDown && onMouseDown(startX, startY, startWidth, startHeight);
            document.addEventListener("mousemove", mousemove);
            document.addEventListener("mouseup", mouseup);
            ev.stopPropagation();
            ev.preventDefault();
        }, true);

        // 鼠标移动时计算宽高差值并设置 div 的新宽高
        function mousemove(e) {
            requestAnimationFrame(() => {
                let deltaX = e.clientX - startX;
                let deltaY = e.clientY - startY;
                if (onMouseMove) {
                    const result = onMouseMove(deltaX, deltaY);
                    if (result) {
                        deltaX = result.deltaX;
                        deltaY = result.deltaY;
                    }
                }
                if (resizeWidth) {
                    resizeElement.style.width = startWidth + deltaX + "px";
                }
                if (resizeHeight) {
                    resizeElement.style.height = startHeight + deltaY + "px";
                }
            })
        }

        // 鼠标松开时取消事件监听
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
            const rect = moveElement.getBoundingClientRect();
            const shiftX = ev.clientX - rect.left;
            const shiftY = ev.clientY - rect.top;
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

            document.addEventListener("mouseup", ev => {
                    if (withMetaKey && !this.metaKeyPressed(ev) || ev.button !== 0) return;
                    _onMouseUp && _onMouseUp();
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

    onEvent(eventType, payload) {
    }

    beforeProcess() {
    }

    event() {
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

    register = hotkeyList => {
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

// 辣鸡js，连接口都不支持
class _diagramParser {
    constructor(lang, destroyWhenUpdate, renderFunc, cancelFunc, extraStyleGetter) {
        this.lang = lang;
        this.destroyWhenUpdate = destroyWhenUpdate || false;
        this.renderFunc = renderFunc || null;
        this.cancelFunc = cancelFunc || null;
        this.extraStyleGetter = extraStyleGetter || null;

        if (!this.check(this)) {
            throw "diagram error"
        }
    }

    check = instance => !!instance && !!instance["lang"] && typeof instance.lang === "string" && instance.renderFunc instanceof Function
}

class DiagramParser {
    constructor() {
        this.utils = utils;
        this.diagramParsers = {}; // {lang: _diagramParser}
    }

    style = () => (!this.utils.isBetaVersion) ? "" : `.md-fences-advanced:not(.md-focus) .CodeMirror { display: none; }`

    isDiagramType = lang => File.editor.diagrams.constructor.isDiagramType(lang)
    isCustomDiagramType = lang => this.diagramParsers.hasOwnProperty(lang)

    throwParseError = (errorLine, reason) => {
        throw {errorLine, reason}
    }

    genErrorMessage = error => {
        let msg = "";
        if (error["errorLine"]) {
            msg += `第 ${error["errorLine"]} 行发生错误。`;
        }
        if (error["reason"]) {
            msg += `错误原因：${error["reason"]}`;
        }
        if (!msg) {
            msg = error.toString();
        }
        return msg
    }

    cantDrawDiagram = async (cid, lang, $pre, content, error) => {
        if (!error) {
            $pre.removeClass("md-fences-advanced");
            $pre.children(".md-diagram-panel").remove();
        } else {
            $pre.find(".md-diagram-panel-header").text(lang);
            $pre.find(".md-diagram-panel-preview").text("语法解析异常，绘图失败");
            $pre.find(".md-diagram-panel-error").text(this.genErrorMessage(error));
        }
        await this.noticeRollback(cid);
    }

    noticeRollback = async cid => {
        for (let lang of Object.keys(this.diagramParsers)) {
            const cancel = this.diagramParsers[lang].cancelFunc;
            if (cancel) {
                try {
                    await cancel(cid);
                } catch (e) {
                    console.error("call cancel func error:", e);
                }
            }
        }
    }

    cleanErrorMsg = ($pre, lang) => {
        $pre.find(".md-diagram-panel-header").html("");
        $pre.find(".md-diagram-panel-error").html("");
        this.diagramParsers[lang].destroyWhenUpdate && $pre.find(".md-diagram-panel-preview").html("");
    }

    renderCustomDiagram = async (cid, lang, $pre) => {
        this.cleanErrorMsg($pre, lang);

        const content = this.utils.getFenceContent($pre[0], cid);
        if (!content) {
            await this.cantDrawDiagram(cid, lang, $pre); // empty content
            return;
        } else {
            $pre.addClass("md-fences-advanced");
            if ($pre.find(".md-diagram-panel").length === 0) {
                $pre.append(`<div class="md-diagram-panel md-fences-adv-panel"><div class="md-diagram-panel-header"></div>
                    <div class="md-diagram-panel-preview"></div><div class="md-diagram-panel-error"></div></div>`);
            }
        }

        const render = this.diagramParsers[lang].renderFunc;
        if (!render) return;
        try {
            await render(cid, content, $pre);
        } catch (error) {
            await this.cantDrawDiagram(cid, lang, $pre, content, error);
        }
    }

    renderDiagram = async cid => {
        if (!cid) return;

        const $pre = File.editor.findElemById(cid);
        const lang = $pre.attr("lang").trim().toLowerCase();

        // 不是Diagram类型，需要展示增强按钮
        if (!this.isDiagramType(lang)) {
            $pre.children(".fence-enhance").show();
            $pre.removeClass("md-fences-advanced");
            await this.noticeRollback(cid);
        } else {
            // 是Diagram类型，但是不是自定义类型，不展示增强按钮，直接返回即可
            $pre.children(".fence-enhance").hide();
            // 是Diagram类型，也是自定义类型，调用其回调函数
            if (this.isCustomDiagramType(lang)) {
                await this.renderCustomDiagram(cid, lang, $pre);
            } else {
                await this.noticeRollback(cid);
            }
        }
    }

    register = (lang, destroyWhenUpdate, renderFunc, cancelFunc = null, extraStyleGetter = null) => {
        lang = lang.toLowerCase();
        this.diagramParsers[lang] = new _diagramParser(lang, destroyWhenUpdate, renderFunc, cancelFunc, extraStyleGetter);
        console.log(`register diagram parser: [ ${lang} ]`);
    }

    process = () => {
        const css = this.style();
        css && this.utils.insertStyle("diagram-parser-style", css);

        // 添加时
        this.utils.decorateAddCodeBlock(null, (result, ...args) => this.renderDiagram(args[0]))
        // 修改语言时
        this.utils.decorate(
            () => (File && File.editor && File.editor.fences && File.editor.fences.tryAddLangUndo),
            "File.editor.fences.tryAddLangUndo",
            null,
            (result, ...args) => this.renderDiagram(args[0].cid)
        )
        // 更新时
        this.utils.decorate(
            () => (File && File.editor && File.editor.diagrams && File.editor.diagrams.updateDiagram),
            "File.editor.diagrams.updateDiagram",
            null,
            (result, ...args) => this.renderDiagram(args[0])
        )
        // 导出时
        this.utils.decorateExportToHTML((...args) => {
            const extraCssList = [];
            for (let lang of Object.keys(this.diagramParsers)) {
                const getter = this.diagramParsers[lang].extraStyleGetter;
                const exist = document.querySelector(`#write .md-fences[lang="${lang}"]`);
                if (getter && exist) {
                    const extraCss = getter();
                    extraCssList.push(extraCss);
                }
            }
            if (extraCssList.length) {
                args[0].extraCss = (args[0].extraCss || "") + extraCssList.join(" ");
            }
        })
        // 判断是否为Diagram
        this.utils.decorate(
            // black magic
            () => (File && File.editor && File.editor.diagrams && File.editor.diagrams.constructor && File.editor.diagrams.constructor.isDiagramType),
            "File.editor.diagrams.constructor.isDiagramType",
            null,
            (result, ...args) => {
                if (result === true) return true;

                let lang = args[0];
                const type = typeof lang;
                if (type === "object" && lang["name"]) {
                    lang = lang["name"];
                }
                if (type === "string") {
                    return this.isCustomDiagramType(lang.toLowerCase());
                }
                return result
            },
            true
        )
    }
}

global._diagramParser = new DiagramParser();

// 备注，当前插件系统拥有的event：
//   1. enable
//   2. disable
//   3. allPluginsHadInjected
//   4. allCustomPluginsHadInjected
class EventHub {
    constructor() {
        this.utils = utils
        this.eventMap = {}
    }

    register = (fixedName, eventTypes) => {
        if (!eventTypes) return;

        if (typeof eventTypes === "string") {
            if (!this.eventMap[eventTypes]) {
                this.eventMap[eventTypes] = [fixedName];
            } else {
                this.eventMap[eventTypes].push(fixedName);
            }
        } else if (eventTypes instanceof Array) {
            for (let eventType of eventTypes) {
                this.register(fixedName, eventType);
            }
        }
    }

    publish = (eventType, payload) => {
        const fixedNames = this.eventMap[eventType];
        for (let fixedName of fixedNames) {
            const plugin = this.utils.getPlugin(fixedName);
            plugin && plugin.onEvent(eventType, payload);
        }
    }
}

global._eventHub = new EventHub();

class process {
    constructor() {
        this.utils = utils;
        this.hotkeyHelper = new hotkeyHelper();
        this.userSettingHelper = new userSettingHelper();
    }

    registerEvent = (fixedName, eventTypes) => global._eventHub.register(fixedName, eventTypes);

    noticeEvent = () => {
        console.log("--- all plugins had injected ---");
        this.utils.publishEvent("allPluginsHadInjected");
    }

    insertStyle(fixedName, style) {
        if (!style) return;

        if (typeof style === "string") {
            this.utils.insertStyle(`plugin-${fixedName.replace(/_/g, "-")}-style`, style);
        } else if (typeof style === "object") {
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
    }

    loadPlugin(pluginClass, pluginSetting) {
        const plugin = new pluginClass(pluginSetting);

        const error = plugin.beforeProcess();
        if (error === this.utils.stopLoadPluginError) return

        this.registerEvent(plugin.fixed_name, plugin.event());
        this.insertStyle(plugin.fixed_name, plugin.style());
        plugin.html();
        this.hotkeyHelper.register(plugin.hotkey());
        plugin.process();
        plugin.afterProcess();
        console.log(`plugin had been injected: [ ${plugin.fixed_name} ] `);
        return plugin
    }

    run() {
        global._plugins = {};

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
            global._diagramParser.process();
            this.noticeEvent();
        })
    }
}

module.exports = {
    process
};