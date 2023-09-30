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


    ////////////////////////////// 高级工具 //////////////////////////////
    // 当前支持的高级工具（全部支持动态注册、动态注销）
    //   1. hotkey
    //   2. event
    //   3. state recorder
    //   4. diagram parser
    //   5. fence enhance button
    //   6. bar tool
    //   7. export helper
    //   8. modal

    // 动态注册、动态注销hotkey
    // 注意: 不会检测hotkeyString的合法性，需要调用者自己保证快捷键没被占用，没有typo
    //   hotkeyList: [
    //     { hotkey: "ctrl+shift+c", callback: () => console.log("ctrl+shift+c pressed") },
    //     { hotkey: "ctrl+shift+e", callback: () => console.log("ctrl+shift+e pressed") },
    //   ]
    //   hotkeyString(string): eg: "ctrl+shift+c"
    static registerHotkey = hotkeyList => global._hotkeyHub.register(hotkeyList);
    static registerSingleHotkey = (hotkeyString, callback) => global._hotkeyHub.registerSingle(hotkeyString, callback);
    static unregisterHotkey = hotkeyString => global._hotkeyHub.unregister(hotkeyString);


    // 动态注册、动态注销、动态发布生命周期事件
    // 理论上不应该暴露publishEvent()的，但是我还是希望给予最大自由度，充分信任插件，允许所有插件调用发布事件。所以调用者需要自觉维护，一旦错误发布事件，会影响整个插件系统
    // 触发顺序：
    //   allCustomPluginsHadInjected: 自定义插件加载完毕
    //   allPluginsHadInjected: 所有插件加载完毕
    //   firstFileInit: 打开Typora后文件被加载
    //   beforeFileOpen: 打开文件之前
    //   fileOpened: 打开文件之后
    //   fileContentLoaded: 文件内容加载完毕之后(依赖于window_tab)

    //   beforeToggleSourceMode: 进入源码模式之前
    //   beforeAddCodeBlock: 添加代码块之前
    //   afterAddCodeBlock: 添加代码块之后
    //   outlineUpdated: 大纲更新之时
    //   toggleSettingPage: 切换到/回配置页面
    static eventType = {
        allCustomPluginsHadInjected: "allCustomPluginsHadInjected",
        allPluginsHadInjected: "allPluginsHadInjected",
        firstFileInit: "firstFileInit",
        beforeFileOpen: "beforeFileOpen",
        fileOpened: "fileOpened",
        fileContentLoaded: "fileContentLoaded",
        beforeToggleSourceMode: "beforeToggleSourceMode",
        beforeAddCodeBlock: "beforeAddCodeBlock",
        afterAddCodeBlock: "afterAddCodeBlock",
        outlineUpdated: "outlineUpdated",
        toggleSettingPage: "toggleSettingPage",
    }
    static addEventListener = (eventType, listener) => global._eventHub.addEventListener(eventType, listener);
    static removeEventListener = (eventType, listener) => global._eventHub.removeEventListener(eventType, listener);
    static publishEvent = (eventType, payload) => global._eventHub.publishEvent(eventType, payload);


    // 动态注册、动态注销元素状态记录器（仅当window_tab插件启用时有效）
    // 功能是：在用户切换标签页前记录元素的状态，等用户切换回来时恢复元素的状态
    // 比如说：【章节折叠】功能：需要在用户切换标签页前记录有哪些章节被折叠了，等用户切换回来后需要把章节自动折叠回去，保持前后一致。
    //   1. recorderName(string): 取个名字
    //   2. selector(string): 通过选择器找到要你想记录状态的元素们
    //   3. stateGetter(Element) => {...}: 记录目标元素的状态。Element就是selector找到的元素，返回你想记录的标签的状态，返回值可以是任何类型
    //   4. stateRestorer(Element, state) => {}: 为元素恢复状态。state就是stateGetter的返回值
    static registerStateRecorder = (recorderName, selector, stateGetter, stateRestorer) => global._stateRecorder.register(recorderName, selector, stateGetter, stateRestorer);
    static unregisterStateRecorder = recorderName => global._stateRecorder.unregister(recorderName);


    // 动态注册、动态注销新的代码块图表语法
    //   1. lang(string): language
    //   2. destroyWhenUpdate(boolean): 更新前是否清空preview里的html
    //   3. async renderFunc(cid, content, $pre) => null: 渲染函数，根据内容渲染所需的图像
    //        1. cid: 当前代码块的cid
    //        2. content: 代码块的内容
    //        3. $pre: 代码块的jquery element
    //   4. async cancelFunc(cid) => null: 取消函数，触发时机：1)修改为其他的lang 2)当代码块内容被清空 3)当代码块内容不符合语法
    //   5. extraStyleGetter() => string: 用于导出时，新增css
    //   6. interactiveMode: 交互模式下，只有ctrl+click才能展开代码块
    static registerDiagramParser = (lang, destroyWhenUpdate, renderFunc, cancelFunc = null, extraStyleGetter = null, interactiveMode = true
    ) => global._diagramParser.register(lang, destroyWhenUpdate, renderFunc, cancelFunc, extraStyleGetter, interactiveMode)
    static unregisterDiagramParser = lang => global._diagramParser.unregister(lang);
    // 当代码块内容出现语法错误时调用，此时页面将显示错误信息
    static throwParseError = (errorLine, reason) => global._diagramParser.throwParseError(errorLine, reason)


    // 动态注册、动态注销代码块增强按钮(仅当fence_enhance插件启用时有效，通过返回bool值确定是否成功)
    // 需要注意的是：注册、注销只会影响新增的代码块，已经渲染到html的代码块不会改变，所以一般此函数的执行时机是在初始化的时候
    //   action: 取个名字
    //   className: button的className
    //   hint: 提示
    //   iconClassName: 通过className设置icon
    //   enable: 是否使用
    //   listener(ev, button)=>{}: 点击按钮的回调函数(ev: 时间，button: 按钮本身element)
    //   extraFunc(button)=>{}: 插入html后的额外操作
    static registerFenceEnhanceButton = (className, action, hint, iconClassName, enable, listener, extraFunc) => {
        const enhancePlugin = this.getPlugin("fence_enhance");
        if (enhancePlugin) {
            enhancePlugin.registerBuilder(className, action, hint, iconClassName, enable, listener, extraFunc);
        }
        return (!!enhancePlugin)
    }
    static unregisterFenceEnhanceButton = action => {
        const enhancePlugin = this.getPlugin("fence_enhance");
        if (enhancePlugin) {
            enhancePlugin.removeBuilder(action);
        }
        return (!!enhancePlugin)
    }

    // 动态注册barTool里的tool(仅当toolbar插件启用时有效，通过返回bool值确定是否成功)
    // tool: baseToolInterface的子类
    static registerBarTool = tool => {
        const toolbarPlugin = this.getPlugin("toolbar");
        if (toolbarPlugin) {
            toolbarPlugin.registerBarTool(tool);
        }
        return (!!toolbarPlugin)
    }
    static unregisterBarTool = name => {
        const toolbarPlugin = this.getPlugin("toolbar");
        if (toolbarPlugin) {
            toolbarPlugin.unregisterBarTool(name);
        }
        return (!!toolbarPlugin)
    }

    // 动态注册导出时的额外操作
    //   1. name: 取个名字
    //   2. beforeExport() => cssString || null , 如果返回string，将加入到extraCSS
    //   3. async afterExport() => html || null,  如果返回string，将替换HTML
    static registerExportHelper = (name, beforeExport, afterExport) => global._exportHelper.register(name, beforeExport, afterExport)
    static unregisterExportHelper = name => global._exportHelper.unregister(name)

    // 动态弹出自定义模态框（及刻弹出，因此无需注册）
    //   1. modal: { title: "", components: [{label: "...", type: "input", value: "...", placeholder: "..."}]}
    //   2. callback(components) => {}: 当用户点击【确认】后的回调函数
    //   3. onCancelCallback(components) => {}: 当用户点击【取消】后的回调函数
    // 具体使用请参考__modal_example.js，不再赘述
    static modal = (modal, callback, cancelCallback) => global._modalGenerator.modal(modal, callback, cancelCallback);


    ////////////////////////////// 插件相关 //////////////////////////////
    static getGlobalSetting = name => global._global_settings[name]
    static getPlugin = fixedName => global._plugins[fixedName]
    static getCustomPlugin = fixedName => {
        const plugin = global._plugins["custom"];
        if (plugin) {
            return plugin["custom"][fixedName]
        }
    }
    // 路径是否在挂载文件夹下
    static isUnderMountFolder = path => {
        const mountFolder = File.getMountFolder();
        return path && mountFolder && path.startsWith(mountFolder);
    }
    static openFile = filepath => {
        if (this.getPlugin("window_tab") && this.isUnderMountFolder(filepath)) {
            File.editor.library.openFile(filepath);
        } else {
            File.editor.library.openFileInNewWindow(filepath, false);
        }
    }
    static openFolder = folder => File.editor.library.openFileInNewWindow(folder, true);
    static showHiddenElementByPlugin = target => {
        if (!target) return;
        const collapsePlugin = this.getPlugin("collapse_paragraph");
        const truncatePlugin = this.getPlugin("truncate_text");
        collapsePlugin && collapsePlugin.rollback(target);
        truncatePlugin && truncatePlugin.rollback(target);
    }
    static getAnchorNode = () => File.editor.getJQueryElem(window.getSelection().anchorNode);
    static withAnchorNode = (selector, func) => {
        return () => {
            const anchorNode = this.getAnchorNode();
            const target = anchorNode.closest(selector);
            if (target && target[0]) {
                func(target[0]);
            }
        }
    }
    static generateDynamicCallArgs = (fixedName, anchorNode) => {
        if (!fixedName) return;
        const plugin = this.getPlugin(fixedName);
        if (plugin && plugin.dynamicCallArgsGenerator) {
            anchorNode = anchorNode || this.getAnchorNode();
            if (anchorNode[0]) {
                return plugin.dynamicCallArgsGenerator(anchorNode[0]);
            }
        }
    }


    ////////////////////////////// 事件 //////////////////////////////
    static metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey
    static shiftKeyPressed = ev => !!ev.shiftKey
    static altKeyPressed = ev => !!ev.altKey


    ////////////////////////////// 基础纯函数 //////////////////////////////
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

    static getUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            let r = (Math.random() * 16) | 0
            let v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }


    ////////////////////////////// 业务文件操作 //////////////////////////////
    static readSetting = (defaultSetting, userSetting) => {
        let result = null;
        if (defaultSetting && this.existInPluginPath(defaultSetting)) {
            result = this.readToml(defaultSetting);
        }
        if (userSetting && this.existInPluginPath(userSetting)) {
            const _user = this.readToml(userSetting);
            result = this.merge(result, _user);
        }
        return result
    }

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

    static insertScript = filepath => {
        const jsFilepath = this.joinPath(filepath);
        return $.getScript(`file:///${jsFilepath}`);
    }

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

    static getFileName = filePath => {
        let fileName = this.Package.Path.basename(filePath);
        const idx = fileName.lastIndexOf(".");
        if (idx !== -1) {
            fileName = fileName.substring(0, idx);
        }
        return fileName
    }

    ////////////////////////////// 基础文件操作 //////////////////////////////
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


    ////////////////////////////// 业务操作 //////////////////////////////
    static openUrl = url => {
        const openUrl = File.editor.tryOpenUrl_ || File.editor.tryOpenUrl;
        openUrl(url, 1);
    }

    static isNetworkImage = src => /^https?|(ftp):\/\//.test(src);
    // data:image;base64、data:image\svg+xml 等等
    static isSpecialImage = src => src.startsWith("data:image");

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

    static getFenceUserSize = content => {
        let height = "";
        let width = "";
        const lines = content.split("\n").map(line => line.trim()).filter(line => line.startsWith("//"));
        for (let line of lines) {
            line = line.replace(/\s/g, "").replace(`'`, `"`).replace("`", '"');
            const result = line.match(/^\/\/{height:"(?<height>.*?)",width:"(?<width>.*?)"}/);
            if (result && result.groups) {
                height = height || result.groups["height"];
                width = width || result.groups["width"];
            }
            if (height && width) break
        }
        return {height, width}
    }

    ////////////////////////////// 业务DOM操作 //////////////////////////////
    static scroll = (target, height = 10) => {
        File.editor.focusAndRestorePos();
        File.editor.selection.scrollAdjust(target, height);
        File.isFocusMode && File.editor.updateFocusMode(false);
    }

    static insertFence = (anchorNode, content) => {
        File.editor.contextMenu.hide();
        // File.editor.writingArea.focus();
        File.editor.restoreLastCursor();
        File.editor.insertText(content);
    }

    static insertDiv = div => {
        const quickOpenNode = document.getElementById("typora-quick-open");
        quickOpenNode.parentNode.insertBefore(div, quickOpenNode.nextSibling);
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

    static selectItemFromList = (resultList, activeItemSelector) => {
        let floor;
        return (ev) => {
            if (!resultList.childElementCount) return;

            const activeItem = resultList.querySelector(activeItemSelector);
            let nextItem;
            if (ev.key === "ArrowDown") {
                if (floor !== 7) floor++;

                if (activeItem && activeItem.nextElementSibling) {
                    nextItem = activeItem.nextElementSibling;
                } else {
                    nextItem = resultList.firstElementChild;
                    floor = 1
                }
            } else {
                if (floor !== 1) floor--;

                if (activeItem && activeItem.previousElementSibling) {
                    nextItem = activeItem.previousElementSibling;
                } else {
                    nextItem = resultList.lastElementChild;
                    floor = 7
                }
            }

            activeItem && activeItem.classList.toggle("active");
            nextItem.classList.toggle("active");

            let top;
            if (floor === 1) {
                top = nextItem.offsetTop - nextItem.offsetHeight;
            } else if (floor === 7) {
                top = nextItem.offsetTop - 6 * nextItem.offsetHeight;
            } else if (Math.abs(resultList.scrollTop - activeItem.offsetTop) > 7 * nextItem.offsetHeight) {
                top = nextItem.offsetTop - 3 * nextItem.offsetHeight;
            }
            top && resultList.scrollTo({top: top, behavior: "smooth"});
        }
    }

    ////////////////////////////// 黑魔法 //////////////////////////////
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
}

class diagramParser {
    constructor() {
        this.utils = utils;
        this.parsers = new Map(); // {lang: parser}
    }

    style = () => (!this.utils.isBetaVersion) ? "" : `.md-fences-advanced:not(.md-focus) .CodeMirror { display: none; }`

    register = (
        lang, destroyWhenUpdate = false,
        renderFunc, cancelFunc = null, extraStyleGetter = null,
        interactiveMode = true,
    ) => {
        lang = lang.toLowerCase();
        const parser = {lang, destroyWhenUpdate, renderFunc, cancelFunc, extraStyleGetter, interactiveMode};
        this.parsers.set(lang, parser);
        console.log(`register diagram parser: [ ${lang} ]`);
    }

    unregister = lang => this.parsers.delete(lang)

    process = () => {
        if (this.parsers.size === 0) return;

        const css = this.style();
        css && this.utils.insertStyle("diagram-parser-style", css);

        // 添加时
        this.onAddCodeBlock();
        // 修改语言时
        this.onTryAddLangUndo();
        // 更新时
        this.onUpdateDiagram();
        // 导出时
        this.onExportToHTML();
        // 聚焦时
        this.onFocus();
        // 判断是否为Diagram时
        this.onCheckIsDiagramType();
    }

    isDiagramType = lang => File.editor.diagrams.constructor.isDiagramType(lang)

    throwParseError = (errorLine, reason) => {
        throw {errorLine, reason}
    }

    getErrorMessage = error => {
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

    whenCantDraw = async (cid, lang, $pre, content, error) => {
        if (!error) {
            $pre.removeClass("md-fences-advanced");
            $pre.children(".md-diagram-panel").remove();
        } else {
            $pre.find(".md-diagram-panel-header").text(lang);
            $pre.find(".md-diagram-panel-preview").text("语法解析异常，绘图失败");
            $pre.find(".md-diagram-panel-error").text(this.getErrorMessage(error));
        }
        await this.noticeRollback(cid);
    }

    noticeRollback = async cid => {
        for (const parser of this.parsers.values()) {
            if (parser.cancelFunc) {
                try {
                    await parser.cancelFunc(cid);
                } catch (e) {
                    console.error("call cancel func error:", e);
                }
            }
        }
    }

    cleanErrorMsg = ($pre, lang) => {
        $pre.find(".md-diagram-panel-header").html("");
        $pre.find(".md-diagram-panel-error").html("");
        this.parsers.get(lang).destroyWhenUpdate && $pre.find(".md-diagram-panel-preview").html("");
    }

    renderCustomDiagram = async (cid, lang, $pre) => {
        this.cleanErrorMsg($pre, lang);

        const content = this.utils.getFenceContent($pre[0], cid);
        if (!content) {
            await this.whenCantDraw(cid, lang, $pre); // empty content
            return;
        } else {
            $pre.addClass("md-fences-advanced");
            if ($pre.find(".md-diagram-panel").length === 0) {
                $pre.append(`<div class="md-diagram-panel md-fences-adv-panel"><div class="md-diagram-panel-header"></div>
                    <div class="md-diagram-panel-preview"></div><div class="md-diagram-panel-error"></div></div>`);
            }
        }

        const render = this.parsers.get(lang).renderFunc;
        if (!render) return;
        try {
            await render(cid, content, $pre);
        } catch (error) {
            await this.whenCantDraw(cid, lang, $pre, content, error);
        }
    }

    renderDiagram = async cid => {
        const $pre = File.editor.findElemById(cid);
        const lang = $pre.attr("lang").trim().toLowerCase();

        // 不是Diagram类型，需要展示增强按钮
        if (!this.isDiagramType(lang)) {
            $pre.children(".fence-enhance").show();
            $pre.removeClass("md-fences-advanced");
            $pre.removeClass("md-fences-interactive");
            await this.noticeRollback(cid);
        } else {
            // 是Diagram类型，但是不是自定义类型，不展示增强按钮，直接返回即可
            $pre.children(".fence-enhance").hide();
            // 是Diagram类型，也是自定义类型，调用其回调函数
            const parser = this.parsers.get(lang);
            if (parser) {
                parser.interactiveMode && $pre.addClass("md-fences-interactive");
                await this.renderCustomDiagram(cid, lang, $pre);
            } else {
                $pre.removeClass("md-fences-interactive");
                await this.noticeRollback(cid);
            }
        }
    }

    onAddCodeBlock = () => {
        this.utils.addEventListener(this.utils.eventType.afterAddCodeBlock, this.renderDiagram)
    }

    onTryAddLangUndo = () => {
        this.utils.decorate(
            () => (File && File.editor && File.editor.fences && File.editor.fences.tryAddLangUndo),
            "File.editor.fences.tryAddLangUndo",
            null,
            (result, ...args) => this.renderDiagram(args[0].cid)
        )
    }

    onUpdateDiagram = () => {
        this.utils.decorate(
            () => (File && File.editor && File.editor.diagrams && File.editor.diagrams.updateDiagram),
            "File.editor.diagrams.updateDiagram",
            null,
            (result, ...args) => this.renderDiagram(args[0])
        )
    }

    onExportToHTML = () => {
        this.utils.registerExportHelper("diagramParser", () => {
            const extraCssList = [];
            this.parsers.forEach((parser, lang) => {
                const getter = parser.extraStyleGetter;
                const exist = document.querySelector(`#write .md-fences[lang="${lang}"]`);
                if (getter && exist) {
                    const extraCss = getter();
                    extraCssList.push(extraCss);
                }
            });
            if (extraCssList.length) {
                const base = ` .md-diagram-panel, svg {page-break-inside: avoid;} `;
                return base + extraCssList.join(" ");
            }
        })
    }

    onFocus = () => {
        let dontFocus = true;

        const enableFocus = () => {
            dontFocus = false;
            setTimeout(() => dontFocus = true, 200);
        }

        const stopCall = (...args) => {
            if (!dontFocus || !args || !args[0]) return;

            const cid = ("string" == typeof args[0]) ? args[0] : args[0]["id"];
            if (cid) {
                const lang = (File.editor.findElemById(cid).attr("lang") || "").trim().toLowerCase();
                if (!cid || !lang) return;
                const parser = this.parsers.get(lang);
                if (parser && parser.interactiveMode) return this.utils.stopCallError
            }
        }

        this.utils.decorate(
            () => (File && File.editor && File.editor.fences && File.editor.fences.focus),
            "File.editor.fences.focus",
            stopCall,
        )
        this.utils.decorate(
            () => (File && File.editor && File.editor.refocus),
            "File.editor.refocus",
            stopCall,
        )

        const showAllTButton = fence => {
            const enhance = fence.querySelector(".fence-enhance");
            if (!enhance) return;
            enhance.querySelectorAll(".enhance-btn").forEach(ele => ele.style.display = "");
            return enhance
        }

        const showEditButtonOnly = fence => {
            const enhance = fence.querySelector(".fence-enhance");
            if (!enhance) return;
            enhance.style.display = "";
            enhance.querySelectorAll(".enhance-btn").forEach(ele => ele.style.display = "none");
            enhance.querySelector(".edit-custom-diagram").style.display = "";
        }

        const hideAllButton = fence => {
            const enhance = showAllTButton(fence);
            const editButton = enhance.querySelector(".edit-custom-diagram");
            if (editButton) {
                editButton.style.display = "none";
            }
            enhance.style.display = "none";
        }

        if (this.utils.getGlobalSetting("CTRL_CLICK_TO_EXIST_INTERACTIVE_MODE")) {
            document.querySelector("#write").addEventListener("mouseup", ev => {
                if (ev.target.closest(".md-fences-interactive .md-diagram-panel-preview") && this.utils.metaKeyPressed(ev)) {
                    showAllTButton(ev.target.closest(".md-fences-interactive"));
                    enableFocus();
                }
            }, true)
        }

        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            if (!this.utils.getGlobalSetting("CLICK_EDIT_BUTTON_TO_EXIT_INTERACTIVE_MODE")) return;

            let hasInteractiveDiagram = false;
            for (const parser of this.parsers.values()) {
                if (parser.interactiveMode) {
                    hasInteractiveDiagram = true;
                    break
                }
            }
            if (!hasInteractiveDiagram) return;

            const ok = this.utils.registerFenceEnhanceButton(
                "edit-custom-diagram", "editDiagram", "编辑", "fa fa-edit", false,
                (ev, button) => {
                    button.closest(".fence-enhance").querySelectorAll(".enhance-btn").forEach(ele => ele.style.display = "");
                    enableFocus();
                }
            )
            if (!ok) return;

            $("#write").on("mouseenter", ".md-fences-interactive:not(.md-focus)", function () {
                showEditButtonOnly(this);
            }).on("mouseleave", ".md-fences-interactive:not(.md-focus)", function () {
                hideAllButton(this);
            }).on("mouseenter", ".md-fences-interactive.md-focus", function () {
                showAllTButton(this);
            }).on("mouseleave", ".md-fences-interactive.md-focus", function () {
                showEditButtonOnly(this);
            })
        })
    }

    onCheckIsDiagramType = () => {
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
                    return this.parsers.get(lang.toLowerCase());
                }
                return result
            },
            true
        )
    }
}

class eventHub {
    constructor() {
        this.utils = utils
        this.eventMap = {}  // { eventType: [listenerFunc] }
    }

    addEventListener = (eventType, listener) => {
        if (!this.eventMap[eventType]) {
            this.eventMap[eventType] = [];
        }
        this.eventMap[eventType].push(listener);
    }
    removeEventListener = (eventType, listener) => {
        if (this.eventMap[eventType]) {
            this.eventMap[eventType] = this.eventMap[eventType].filter(lis => lis !== listener);
        }
    }
    publishEvent = (eventType, payload) => {
        if (this.eventMap[eventType]) {
            for (const listener of this.eventMap[eventType]) {
                listener.call(this, payload);
            }
        }
    }

    process = () => {
        this.utils.decorate(
            () => (File && File.editor && File.editor.library && File.editor.library.openFile),
            "File.editor.library.openFile",
            () => this.publishEvent(this.utils.eventType.beforeFileOpen),
            (result, ...args) => {
                const filePath = args[0];
                filePath && this.publishEvent(this.utils.eventType.fileOpened, filePath);
            }
        )

        this.utils.loopDetector(() => (File && this.utils.getFilePath()), () => {
            const filePath = this.utils.getFilePath();
            filePath && this.utils.publishEvent(this.utils.eventType.firstFileInit, filePath);
        });

        this.utils.decorate(
            () => (File && File.editor && File.editor.fences && File.editor.fences.addCodeBlock),
            "File.editor.fences.addCodeBlock",
            (...args) => {
                const cid = args[0];
                cid && this.publishEvent(this.utils.eventType.beforeAddCodeBlock, cid)
            },
            (result, ...args) => {
                const cid = args[0];
                cid && this.publishEvent(this.utils.eventType.afterAddCodeBlock, cid)
            },
        )

        this.utils.decorate(
            () => (File && File.toggleSourceMode),
            "File.toggleSourceMode",
            () => this.publishEvent(this.utils.eventType.beforeToggleSourceMode)
        )

        this.utils.decorate(
            () => File && File.editor && File.editor.library && File.editor.library.outline && File.editor.library.outline.updateOutlineHtml,
            "File.editor.library.outline.updateOutlineHtml",
            null,
            () => this.publishEvent(this.utils.eventType.outlineUpdated)
        )

        new MutationObserver(mutationList => {
            for (const mutation of mutationList) {
                if (mutation.type === 'attributes' && mutation.attributeName === "class") {
                    const value = document.body.getAttribute(mutation.attributeName);
                    const openPage = value.indexOf("megamenu-opened") !== -1 || value.indexOf("show-preference-panel") !== -1;
                    this.utils.publishEvent(this.utils.eventType.toggleSettingPage, openPage);
                }
            }
        }).observe(document.body, {attributes: true});
    }
}

class stateRecorder {
    constructor() {
        this.utils = utils;
        this.recorders = new Map(); // map[name]recorder
    }

    // collections: map[filepath]map[idx]state
    register = (recorderName, selector, stateGetter, stateRestorer) => {
        this.recorders.set(recorderName, {selector, stateGetter, stateRestorer, collections: new Map()})
    }
    unregister = recorderName => this.recorders.delete(recorderName);

    collect = () => {
        const filepath = this.utils.getFilePath();
        for (const recorder of this.recorders.values()) {
            const collection = new Map();
            document.querySelectorAll(recorder.selector).forEach((ele, idx) => {
                const state = recorder.stateGetter(ele);
                state && collection.set(idx, state);
            })
            if (collection.size) {
                recorder.collections.set(filepath, collection)
            } else {
                recorder.collections.delete(filepath);
            }
        }
    }

    restore = filepath => {
        for (const recorder of this.recorders.values()) {
            const collection = recorder.collections.get(filepath)
            if (collection && collection.size) {
                document.querySelectorAll(recorder.selector).forEach((ele, idx) => {
                    const state = collection.get(idx);
                    state && recorder.stateRestorer(ele, state);
                })
            }
        }
    }

    process = () => {
        this.utils.addEventListener(this.utils.eventType.beforeFileOpen, this.collect);
        this.utils.addEventListener(this.utils.eventType.fileContentLoaded, this.restore);
    }
}

class modalGenerator {
    constructor() {
        this.utils = utils;
        this.pluginModal = null;
        this.callback = null;
        this.entities = null;
    }

    style = () => {
        return `
            #plugin-custom-modal {
                position: fixed;
                z-index: 99999;
                margin: 50px auto;
                left: 0;
                right: 0;
                display: none;
            }
            
            #plugin-custom-modal label {
                display: block;
                margin-bottom: 5px;
            }
            
            #plugin-custom-modal input[type="checkbox"], input[type="radio"] {
                box-shadow: none;
                margin-top: -3px;
            }
        `
    }

    html = () => {
        const modal_content = `
            <div class="modal-content">
              <div class="modal-header">
                <div class="modal-title" data-lg="Front">自定义插件弹窗</div>
              </div>
              <div class="modal-body"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-default plugin-modal-cancel" data-dismiss="modal" data-lg="Front">取消</button>
                <button type="button" class="btn btn-primary plugin-modal-submit" data-lg="Front">确定</button>
              </div>
            </div>
        `
        const modal = document.createElement("div");
        modal.id = "plugin-custom-modal";
        modal.classList.add("modal-dialog");
        modal.innerHTML = modal_content;
        this.utils.insertDiv(modal);
    }

    process = () => {
        this.utils.insertStyle("plugin-custom-modal-style", this.style());
        this.html();

        this.entities = {
            modal: document.getElementById("plugin-custom-modal"),
            content: document.querySelector("#plugin-custom-modal .modal-content"),
            body: document.querySelector("#plugin-custom-modal .modal-body"),
            title: document.querySelector("#plugin-custom-modal .modal-title"),
            submit: document.querySelector("#plugin-custom-modal button.plugin-modal-submit"),
            cancel: document.querySelector("#plugin-custom-modal button.plugin-modal-cancel"),
        }

        this.entities.cancel.addEventListener("click", () => this.onButtonClick(this.cancelCallback))
        this.entities.submit.addEventListener("click", () => this.onButtonClick(this.callback))
        this.entities.modal.addEventListener("keydown", ev => {
            if (ev.key === "Enter") {
                this.entities.submit.click();
                ev.stopPropagation();
                ev.preventDefault();
            } else if (ev.key === "Escape") {
                this.entities.cancel.click();
                ev.stopPropagation();
                ev.preventDefault();
            }
        }, true)
    }

    onButtonClick = callback => {
        this.pluginModal.components.forEach(component => {
            if (!component.label || !component.type || !component.id) return;
            const div = this.entities.body.querySelector(`.form-group[component-id="${component.id}"]`);
            if (div) {
                component.submit = this.getWidgetValue(component.type, div);
            }
        })
        callback && callback(this.pluginModal.components);
        this.entities.modal.style.display = "none";
    }

    getWidgetValue = (type, widget) => {
        switch (type.toLowerCase()) {
            case "input":
                return widget.querySelector("input").value
            case "textarea":
                return widget.querySelector("textarea").value
            case "checkbox":
                return [...widget.querySelectorAll("input:checked")].map(box => box.value)
            case "radio":
                return widget.querySelector("input:checked").value
            case "select":
                return widget.querySelector("select").value
            case "file":
                return widget.querySelector("input").files
        }
    }

    newWidget = component => {
        if (!component || !component.label || !component.type) return;

        let inner = "";
        const type = component.type.toLowerCase();
        switch (type) {
            case "input":
            case "password":
            case "file":
                inner = `<input type="${type === "input" ? "text" : type}" class="form-control" 
                            placeholder="${component.placeholder}" value="${component.value}">`;
                break
            case "textarea":
                const rows = component.rows || 3;
                inner = `<textarea class="form-control" rows="${rows}" placeholder="${component.placeholder}"></textarea>`;
                break
            case "checkbox":
                const checkBoxList = component.list.map(box => `
                    <div class="checkbox">
                        <label><input type="checkbox" value="${box.value}" ${box.checked ? "checked" : ""}>${box.label}</label>
                    </div>`
                );
                inner = checkBoxList.join("");
                break
            case "radio":
                const radioList = component.list.map(radio => `
                    <div class="radio">
                        <label><input type="radio" name="radio-${component.id}" value="${radio.value}" ${radio.checked ? "checked" : ""}>${radio.label}</label>
                    </div>`
                );
                inner = radioList.join("");
                break
            case "select":
                const optionsList = component.list.map(option => `<option ${option === component.selected ? "selected" : ""}>${option}</option>`);
                inner = `<select class="form-control">${optionsList}</select>`
                break
            case "p":
                break
        }
        return `<div class="col-lg-12 form-group" component-id="${component.id}"><label>${component.label}</label>${inner}</div>`;
    }

    // modal: {title: "", components: [{label: "", type: "", value: ""}]}
    modal = (modal, callback, cancelCallback) => {
        if (modal && callback instanceof Function) {
            this.pluginModal = modal;
            this.callback = callback;
            this.cancelCallback = cancelCallback;

            this.entities.title.innerText = modal.title;
            modal.components.forEach(component => component.id = Math.random());
            const widgetList = modal.components.map(component => this.newWidget(component));
            this.entities.body.innerHTML = `<form role="form">` + widgetList.join("") + "</form>";
            this.entities.modal.style.display = "block";
        }
    }
}

class hotkeyHub {
    constructor() {
        this.utils = utils;
        this.hotkeyMap = new Map();
    }

    toHotkeyFunc = hotkeyString => {
        const keyList = hotkeyString.toLowerCase().split("+").map(k => k.trim());
        const ctrl = keyList.indexOf("ctrl") !== -1;
        const shift = keyList.indexOf("shift") !== -1;
        const alt = keyList.indexOf("alt") !== -1;
        const key = keyList.filter(key => key !== "ctrl" && key !== "shift" && key !== "alt")[0];

        return ev => this.utils.metaKeyPressed(ev) === ctrl
            && this.utils.shiftKeyPressed(ev) === shift
            && this.utils.altKeyPressed(ev) === alt
            && ev.key.toLowerCase() === key
    }

    _register = (hk, call) => {
        if (typeof hk === "string") {
            const hotkey = this.toHotkeyFunc(hk);
            this.hotkeyMap.set(hk, {hotkey, call});
        } else if (hk instanceof Array) {
            for (const _hk of hk) {
                this._register(_hk, call);
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
    unregister = hotkeyString => this.hotkeyMap.delete(hotkeyString)
    registerSingle = (hotkeyString, callback) => this._register(hotkeyString, callback)

    process = () => {
        window.addEventListener("keydown", ev => {
            for (const hotkey of this.hotkeyMap.values()) {
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

class exportHelper {
    constructor() {
        this.utils = utils;
        this.helper = new Map();
    }

    register = (name, beforeExport, afterExport) => this.helper.set(name, {beforeExport, afterExport});
    unregister = name => this.helper.delete(name);

    beforeExport = (...args) => {
        for (const helper of this.helper.values()) {
            if (helper.beforeExport) {
                const css = helper.beforeExport() || "";
                args[0].extraCss = (args[0].extraCss || "") + css;
            }
        }
    }

    afterExport = async (exportResult, ...args) => {
        const exportConfig = args[0];
        if (!exportConfig || exportConfig["type"] !== "html" && exportConfig["type"] !== "html-plain") return exportResult;

        let html = await exportResult;
        const writeIdx = html.indexOf(`id='write'`);
        if (writeIdx === -1) return new Promise(resolve => resolve(html));

        for (const helper of this.helper.values()) {
            if (helper.afterExport) {
                const newHtml = await helper.afterExport(html, writeIdx);
                if (newHtml) {
                    html = newHtml;
                }
            }
        }
        return new Promise(resolve => resolve(html));
    }

    isPromise = obj => {
        return !!obj
            && (typeof obj === 'object' || typeof obj === 'function')
            && typeof obj.then === 'function';
    };

    afterExportSync = (exportResult, ...args) => {
        const exportConfig = args[0];
        if (!exportConfig || exportConfig["type"] !== "html" && exportConfig["type"] !== "html-plain") return exportResult;

        let html = exportResult;
        const writeIdx = html.indexOf(`id='write'`);
        if (writeIdx === -1) return html;

        for (const helper of this.helper.values()) {
            if (helper.afterExport) {
                const newHtml = helper.afterExport(html, writeIdx);
                if (newHtml && !this.isPromise(newHtml)) {
                    html = newHtml;
                }
            }
        }
        return html
    }

    process = () => {
        // 旧版本的Typora的export函数不是AsyncFunction
        // 尽最大努力兼容旧版本
        this.utils.loopDetector(
            () => (File && File.editor && File.editor.export && File.editor.export.exportToHTML),
            () => {
                const after = (File.editor.export.exportToHTML.constructor.name === 'AsyncFunction')
                    ? this.afterExport
                    : this.afterExportSync
                this.utils.decorate(() => true, "File.editor.export.exportToHTML", this.beforeExport, after, true)
            }
        )
    }
}


class basePlugin {
    constructor(fixedName, setting) {
        this.fixedName = fixedName;
        this.config = setting;
        this.utils = utils
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

class process {
    constructor() {
        this.utils = utils;
    }

    insertStyle = (fixedName, style) => {
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

    loadPlugin = (fixedName, pluginClass, pluginSetting) => {
        const plugin = new pluginClass(fixedName, pluginSetting);

        const error = plugin.beforeProcess();
        if (error === this.utils.stopLoadPluginError) return

        this.insertStyle(fixedName, plugin.style());
        plugin.html();
        this.utils.registerHotkey(plugin.hotkey());
        plugin.process();
        plugin.afterProcess();
        console.log(`plugin had been injected: [ ${fixedName} ] `);
        return plugin
    }

    run = () => {
        global._global_settings = {};
        global._plugins = {};

        const pluginSettings = this.utils.readSetting(
            "./plugin/global/settings/settings.default.toml",
            "./plugin/global/settings/settings.user.toml",
        );

        if (pluginSettings && pluginSettings["global"] && !pluginSettings["global"]["ENABLE"]) return;

        const promises = [];
        for (const fixedName of Object.keys(pluginSettings)) {
            const setting = pluginSettings[fixedName];

            if (fixedName === "global") {
                global._global_settings = setting;
                continue;
            } else if (!setting.ENABLE) {
                continue;
            }

            promises.push(new Promise(resolve => {
                try {
                    const filepath = this.utils.joinPath("./plugin", fixedName);
                    const {plugin} = reqnode(filepath);
                    const instance = this.loadPlugin(fixedName, plugin, setting);
                    if (instance) {
                        global._plugins[fixedName] = instance;
                    }
                } catch (e) {
                    console.error("plugin err:", e);
                }
                resolve();
            }));
        }

        Promise.all(promises).then(() => {
            global._eventHub.process();
            global._diagramParser.process();
            global._stateRecorder.process();
            global._modalGenerator.process();
            global._hotkeyHub.process();
            global._exportHelper.process();
            this.utils.publishEvent(this.utils.eventType.allPluginsHadInjected);
        })
    }
}

// 通用工具
global._pluginUtils = utils;
// 插件的父类
global._basePlugin = basePlugin;
// 注册、发布生命周期事件
global._eventHub = new eventHub();
// 自定义代码块语法
global._diagramParser = new diagramParser();
// 状态记录器
global._stateRecorder = new stateRecorder();
// 弹出模态框
global._modalGenerator = new modalGenerator();
// 注册、监听快捷键
global._hotkeyHub = new hotkeyHub();
// 注册导出时的额外操作
global._exportHelper = new exportHelper();

module.exports = {
    process
};