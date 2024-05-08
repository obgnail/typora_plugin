class utils {
    static isBetaVersion = window._options.appVersion[0] === "0"
    static supportHasSelector = CSS.supports("selector(:has(*))")
    static separator = File.isWin ? "\\" : "/"
    static tempFolder = window._options.tempPath
    static nonExistSelector = "#__nonExist__"                 // 插件临时不可点击，返回此
    static disableForeverSelector = "#__disableForever__"     // 插件永远不可点击，返回此
    static stopLoadPluginError = new Error("stopLoadPlugin")  // 用于插件的beforeProcess方法，若希望停止加载插件，返回此
    static stopCallError = new Error("stopCall")              // 用于decorate方法，若希望停止执行原生函数，返回此
    static meta = {}                                          // 用于在右键菜单功能中传递数据，不可手动调用此变量
    static Package = Object.freeze({
        HTTPS: reqnode("https"),
        OS: reqnode("os"),
        Path: reqnode("path"),
        Fs: reqnode("fs"),
        FsExtra: reqnode("fs-extra"),
        ChildProcess: reqnode('child_process'),
    })


    ////////////////////////////// 高级工具 //////////////////////////////
    // 动态注册、动态注销hotkey
    // 注意: 不会检测hotkeyString的合法性，需要调用者自己保证快捷键没被占用，没有typo
    //   hotkeyList: [
    //     { hotkey: "ctrl+shift+c", callback: () => console.log("ctrl+shift+c pressed") },
    //     { hotkey: "ctrl+shift+e", callback: () => console.log("ctrl+shift+e pressed") },
    //   ]
    //   hotkeyString(string): eg: "ctrl+shift+c"
    static registerHotkey = hotkeyList => helper.hotkeyHub.register(hotkeyList);
    static registerSingleHotkey = (hotkeyString, callback) => helper.hotkeyHub.registerSingle(hotkeyString, callback);
    static unregisterHotkey = hotkeyString => helper.hotkeyHub.unregister(hotkeyString);

    // 动态注册、动态注销、动态发布生命周期事件
    static eventType = Object.freeze({
        allCustomPluginsHadInjected: "allCustomPluginsHadInjected", // 自定义插件加载完毕
        allPluginsHadInjected: "allPluginsHadInjected",             // 所有插件加载完毕
        everythingReady: "everythingReady",                         // 一切准备就绪
        firstFileInit: "firstFileInit",                             // 打开Typora后文件被加载
        beforeFileOpen: "beforeFileOpen",                           // 打开文件之前
        fileOpened: "fileOpened",                                   // 打开文件之后
        otherFileOpened: "otherFileOpened",                         // 和fileOpened的区别：重新打开当前标签不会触发otherFileOpened，但是fileOpened会
        fileContentLoaded: "fileContentLoaded",                     // 文件内容加载完毕之后(依赖于window_tab)
        fileEdited: "fileEdited",                                   // 文件编辑后
        beforeUnload: "beforeUnload",                               // 退出Typora之前
        beforeToggleSourceMode: "beforeToggleSourceMode",           // 进入源码模式之前
        afterToggleSidebar: "afterToggleSidebar",                   // 切换侧边栏状态之后
        beforeAddCodeBlock: "beforeAddCodeBlock",                   // 添加代码块之前
        afterAddCodeBlock: "afterAddCodeBlock",                     //  添加代码块之后
        outlineUpdated: "outlineUpdated",                           // 大纲更新之时
        toggleSettingPage: "toggleSettingPage",                     // 切换到/回配置页面
    })
    static addEventListener = (eventType, listener) => helper.eventHub.addEventListener(eventType, listener);
    static removeEventListener = (eventType, listener) => helper.eventHub.removeEventListener(eventType, listener);
    // 理论上不应该暴露publishEvent的，但我希望给予最大自由度，充分信任插件，允许所有插件发布事件。所以需要调用者自觉维护，一旦错误发布事件，会影响整个插件系统
    static publishEvent = (eventType, payload) => helper.eventHub.publishEvent(eventType, payload);

    // 动态注册、动态注销元素状态记录器（仅当window_tab插件启用时有效）
    // 功能：在用户切换标签页前记录元素的状态，等用户切换回来时恢复元素的状态
    // 比如：【章节折叠】功能：需要在用户切换标签页前记录有哪些章节被折叠了，等用户切换回来后需要把章节自动折叠回去，保持前后一致。
    //   1. name(string): 取个名字
    //   2. selector(string): 通过选择器找到要你想记录状态的元素们
    //   3. stateGetter(Element) => {...}: 记录目标元素的状态。Element就是selector找到的元素，返回你想记录的标签的状态，返回值可以是任何类型
    //   4. stateRestorer(Element, state) => {}: 为元素恢复状态。state就是stateGetter的返回值
    //   5. finalFunc() => {}: 最后执行的函数
    static registerStateRecorder = (name, selector, stateGetter, stateRestorer, finalFunc) => helper.stateRecorder.register(name, selector, stateGetter, stateRestorer, finalFunc);
    static unregisterStateRecorder = name => helper.stateRecorder.unregister(name);
    // 手动触发
    static collectState = name => helper.stateRecorder.collect(name);
    // 手动获取
    static getState = (name, filepath) => helper.stateRecorder.getState(name, filepath);
    // 手动删除
    static deleteState = (name, filepath, idx) => helper.stateRecorder.deleteState(name, filepath, idx);
    // 手动设置
    static setState = (name, collections) => helper.stateRecorder.setState(name, collections);

    // 动态注册、动态注销新的代码块图表语法
    //   1. lang(string): language
    //   2. destroyWhenUpdate(boolean): 更新前是否清空preview里的html
    //   3. async renderFunc(cid, content, $pre) => null: 渲染函数，根据内容渲染所需的图像
    //        1. cid: 当前代码块的cid
    //        2. content: 代码块的内容
    //        3. $pre: 代码块的jquery element
    //   4. cancelFunc(cid) => null: 取消函数，触发时机：1)修改为其他的lang 2)当代码块内容被清空 3)当代码块内容不符合语法
    //   5. destroyAllFunc() => null: 当切换文档时，需要将全部的图表destroy掉（注意：不可为AsyncFunction，防止destroyAll的同时，发生fileOpened事件触发renderFunc）
    //   6. extraStyleGetter() => string: 用于导出时，新增css
    //   7. interactiveMode(boolean): 交互模式下，只有ctrl+click才能展开代码块
    static registerDiagramParser = (lang, destroyWhenUpdate, renderFunc, cancelFunc = null, destroyAllFunc = null, extraStyleGetter = null, interactiveMode = true
    ) => helper.diagramParser.register(lang, destroyWhenUpdate, renderFunc, cancelFunc, destroyAllFunc, extraStyleGetter, interactiveMode)
    static unregisterDiagramParser = lang => helper.diagramParser.unregister(lang);
    // 当代码块内容出现语法错误时调用，此时页面将显示错误信息
    static throwParseError = (errorLine, reason) => helper.diagramParser.throwParseError(errorLine, reason)

    // 动态注册、动态注销第三方代码块图表语法(派生自DiagramParser)
    // f**k，js不支持interface，只能将接口函数作为参数传入，整整11个参数，一坨狗屎
    //   1. lang(string): language
    //   2. destroyWhenUpdate(boolean): 更新前是否清空preview里的html
    //   3. interactiveMode(boolean): 交互模式下，只有ctrl+click才能展开代码块
    //   4. checkSelector(string): 检测当前fence下是否含有目标标签
    //   5. wrapElement(string): 如果不含目标标签，需要创建
    //   6. extraCss({defaultHeight, backgroundColor}): 控制fence的高度和背景颜色
    //   7. async lazyLoadFunc() => null: 加载第三方资源
    //   8. createFunc($Element, string) => Object: 传入目标标签和fence的内容，生成图形实例
    //   9. destroyFunc(Object) => null: 传入图形实例，destroy图形实例
    //  10. beforeExport(element, instance) => null: 导出前的准备操作（比如在导出前调整图形大小、颜色等等）
    //  11. extraStyleGetter() => string: 用于导出时，新增css
    static registerThirdPartyDiagramParser = (lang, destroyWhenUpdate, interactiveMode, checkSelector, wrapElement, extraCss, lazyLoadFunc, createFunc, destroyFunc, beforeExport, extraStyleGetter,
    ) => helper.thirdPartyDiagramParser.register(lang, destroyWhenUpdate, interactiveMode, checkSelector, wrapElement, extraCss, lazyLoadFunc, createFunc, destroyFunc, beforeExport, extraStyleGetter);
    static unregisterThirdPartyDiagramParser = lang => helper.thirdPartyDiagramParser.unregister(lang);

    // 动态注册导出时的额外操作
    //   1. name: 取个名字
    //   2. beforeExport() => cssString || nullLike  如果返回string，将加入到extraCSS
    //   3. async afterExport() => html || nullLike  如果返回string，将替换HTML
    static registerExportHelper = (name, beforeExport, afterExport) => helper.exportHelper.register(name, beforeExport, afterExport)
    static unregisterExportHelper = name => helper.exportHelper.unregister(name)

    // 动态注册css模板文件
    static registerStyleTemplate = async (name, renderArg) => await helper.styleTemplater.register(name, renderArg)
    static unregisterStyleTemplate = name => helper.styleTemplater.unregister(name)
    static getStyleContent = name => helper.styleTemplater.getStyleContent(name)

    // 插入html
    static insertHtmlTemplate = elements => helper.htmlTemplater.insert(elements)
    static createElement = element => helper.htmlTemplater.create(element)
    static createElements = elements => helper.htmlTemplater.createList(elements)
    static appendElements = (parent, template) => helper.htmlTemplater.appendElements(parent, template)
    static getElementCreator = () => helper.htmlTemplater.creator()

    // 解析markdown语法
    static parseMarkdown = markdown => helper.markdownParser.parse(markdown)
    static getNodeKindByNode = node => helper.markdownParser.getNodeKindByNode(node)
    static getNodeKindByNum = num => helper.markdownParser.getNodeKindByNum(num)

    // 动态注册右键菜单
    // 1. name: 取个名字
    // 2. selector: 在哪个位置右键将弹出菜单
    // 3. generator({ev, target}) => {key1: showName1}: 生成右键菜单选项组成的object，参数target是上面的selector对应的元素
    // 4. callback({ev, key}) => null: 点击的回调，参数key是点击的选项
    static registerMenu = (name, selector, generator, callback) => helper.contextMenu.registerMenu(name, selector, generator, callback)
    static unregisterMenu = name => helper.contextMenu.unregisterMenu(name)

    // 动态弹出自定义模态框（即刻弹出，因此无需注册）
    //   1. modal: {title: "", components: [{label: "...", type: "input", value: "...", placeholder: "..."}]}
    //   2. callback(components) => {}: 当用户点击【确认】后的回调函数
    //   3. onCancelCallback(components) => {}: 当用户点击【取消】后的回调函数
    // 具体使用请参考__modal_example.js，不再赘述
    static modal = (modal, callback, cancelCallback) => helper.dialog.modal(modal, callback, cancelCallback);

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
    // 动态注销快捷按钮
    //   一旦process后，标签就被渲染到HTML了，以后就不会再变了，再调用此函数也没有用了，因此此函数只能在插件初始化的时候调用
    //   因此，unregisterQuickButton的唯一意义是：当两个插件在初始化阶段打架时（都想注册同一坐标的按钮），用此函数去注销掉别人
    static registerQuickButton = (action, coordinate, hint, iconClass, style, callback
    ) => this.callPluginFunction("quickButton", "register", action, coordinate, hint, iconClass, style, callback)
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

    static loadPluginLifeCycle = async (instance, isCustom) => {
        const error = await instance.beforeProcess();
        if (error === this.stopLoadPluginError) return false;
        this.registerStyle(instance.fixedName, instance.style());
        const renderArgs = instance.styleTemplate();
        if (renderArgs) {
            await this.registerStyleTemplate(instance.fixedName, {...renderArgs, this: instance});
        }
        this.insertElement(instance.html());
        const elements = instance.htmlTemplate();
        elements && this.insertHtmlTemplate(elements);
        !isCustom && this.registerHotkey(instance.hotkey());
        instance.init();
        instance.process();
        instance.afterProcess();
        return true;
    }

    static isUnderMountFolder = path => {
        const mountFolder = File.getMountFolder();
        return path && mountFolder && path.startsWith(mountFolder);
    }
    static openFile = filepath => {
        if (this.isUnderMountFolder(filepath)) {
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
        this.callPluginFunction("collapse_paragraph", "rollback", target);
        this.callPluginFunction("collapse_list", "rollback", target);
        this.callPluginFunction("truncate_text", "rollback", target);
    }
    static getAnchorNode = () => File.editor.getJQueryElem(window.getSelection().anchorNode);
    static withAnchorNode = (selector, func) => () => {
        const anchorNode = this.getAnchorNode();
        const target = anchorNode.closest(selector);
        target && target[0] && func(target[0]);
    }
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
        filename = filename || (this.randomString() + "_" + this.Package.Path.extname(src))
        const {state} = await JSBridge.invoke("app.download", src, folder, filename);
        return {ok: state === "completed", filepath: this.Package.Path.join(folder, filename)}
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

    static fromObject = (object, attrs) => {
        const newObject = {};
        attrs.forEach(attr => object[attr] !== undefined && (newObject[attr] = object[attr]));
        return newObject;
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

    static splitArray = (array, separatorFunc) => {
        return array.reduce((acc, current) => {
            if (separatorFunc(current)) {
                acc.push([]);
            } else {
                if (acc.length === 0) {
                    acc.push([]);
                }
                acc[acc.length - 1].push(current);
            }
            return acc;
        }, []);
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

    static randomString = () => Math.random().toString(36).slice(2)
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
        const sep = filepath.split(this.Package.Path.win32.sep);
        const newS = [].concat([sep[0].toLowerCase()], sep.slice(1));
        return "/" + this.Package.Path.posix.join.apply(this.Package.Path.posix, newS).replace(":", "")
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
        const child = this.Package.ChildProcess.spawn(rgPath, args, options);
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on('data', onData);
        child.stderr.on("data", onErr);
        child.on('close', onClose);
    }

    static getOriginSettingPath = settingFile => this.joinPath("./plugin/global/settings", settingFile)
    static getHomeSettingPath = settingFile => this.Package.Path.join(this.getHomeDir(), ".config", "typora_plugin", settingFile)
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
        await this.Package.Fs.promises.writeFile(settingPath, newContent);
    }

    static readSetting = async (defaultSetting, userSetting) => {
        const toml = this.requireFilePath("./plugin/global/utils/toml");
        const default_ = this.getOriginSettingPath(defaultSetting);
        const user_ = this.getOriginSettingPath(userSetting);
        const home_ = this.getHomeSettingPath(userSetting);
        const contentList = await this.readFiles([default_, user_, home_]);
        try {
            const configList = contentList.map(c => c ? toml.parse(c) : {});
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
        const content = await this.Package.Fs.promises.readFile(filepath, "utf-8");
        const replacedContent = await editFileFunc(content);
        await this.Package.Fs.promises.writeFile(filepath, replacedContent);
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
        let filepath = !filename ? this.getFilePath() : this.Package.Path.join(this.getCurrentDirPath(), filename);
        const exist = await this.existPath(filepath);
        if (exist) {
            const ext = this.Package.Path.extname(filepath);
            filepath = ext
                ? filepath.replace(new RegExp(`${ext}$`), `-copy${ext}`)
                : filepath + "-copy.md"
        }
        return filepath
    }

    static getFileName = (filePath, removeSuffix = true) => {
        let fileName = filePath ? this.Package.Path.basename(filePath) : File.getFileName();
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
    static getHomeDir = () => this.Package.OS.homedir() || File.option.userPath
    static getFilePath = () => File.filePath || (File.bundle && File.bundle.filePath) || ""
    static getCurrentDirPath = () => this.Package.Path.dirname(this.getFilePath())
    static joinPath = (...paths) => this.Package.Path.join(this.getDirname(), ...paths)
    static requireFilePath = (...paths) => reqnode(this.joinPath(...paths))
    static readFileSync = filepath => this.Package.Fs.readFileSync(this.joinPath(filepath), 'utf8')

    static readFiles = async files => Promise.all(files.map(async file => {
        try {
            return await this.Package.Fs.promises.readFile(file, 'utf-8')
        } catch (err) {
        }
    }))

    static existPathSync = filepath => {
        try {
            this.Package.Fs.accessSync(filepath);
            return true
        } catch (err) {
        }
    }

    static existPath = async filepath => {
        try {
            await this.Package.Fs.promises.access(filepath);
            return true
        } catch (err) {
        }
    }

    static readYaml = content => {
        const yaml = this.requireFilePath("./plugin/global/utils/yaml");
        try {
            return yaml.safeLoad(content);
        } catch (e) {
            console.error(e);
        }
    }

    static readToml = async filepath => {
        const file = await this.Package.Fs.promises.readFile(filepath, "utf-8");
        const toml = this.requireFilePath("./plugin/global/utils/toml");
        return toml.parse(file);
    }

    static stringifyToml = obj => {
        const toml = this.requireFilePath("./plugin/global/utils/toml");
        return toml.stringify(obj)
    }


    ////////////////////////////// 业务操作 //////////////////////////////
    static exitTypora = () => JSBridge.invoke("window.close");
    static restartTypora = () => {
        this.callPluginFunction("reopenClosedFiles", "save");
        this.openFolder(File.getMountFolder());
        setTimeout(this.exitTypora, 50);
    }
    static showInFinder = filepath => JSBridge.showInFinder(filepath || this.getFilePath())
    static isDiscardableUntitled = () => File && File.changeCounter && File.changeCounter.isDiscardableUntitled();

    static openUrl = url => {
        const openUrl = File.editor.tryOpenUrl_ || File.editor.tryOpenUrl;
        openUrl(url, 1);
    }

    static showMessageBox = async ({type = "info", title = "typora", message, detail, buttons = ["确定", "取消"], defaultId = 0, cancelId = 1, normalizeAccessKeys = true, checkboxLabel}) => {
        const op = {type, title, message, detail, buttons, defaultId, cancelId, normalizeAccessKeys, checkboxLabel};
        return JSBridge.invoke("dialog.showMessageBox", op)
    }

    static request = (options, data) => {
        return new Promise((resolve, reject) => {
            const req = this.Package.HTTPS.request(options, resp => {
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
    }

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
    // data:image;base64、data:image\svg+xml 等等
    static isSpecialImage = src => src.startsWith("data:image");

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
        dir = dir || this.getCurrentDirPath();
        // code
        return content.replace(/(?<!\\)`(.+?)(?<!\\)`/gs, `<code>$1</code>`)
            // strong
            .replace(/(?<!\\)[*_]{2}(.+?)(?<!\\)[*_]{2}/gs, `<strong>$1</strong>`)
            // em
            .replace(/(?<![*\\])\*(?![\\*])(.+?)(?<![*\\])\*(?![\\*])/gs, `<em>$1</em>`)
            // del
            .replace(/(?<!\\)~~(.+?)(?<!\\)~~/gs, "<del>$1</del>")
            // link
            .replace(/(?<![\\!])\[(.+?)\]\((.+?)\)/gs, `<a href="$2">$1</a>`)
            // img
            .replace(/(?<!\\)!\[(.+?)\]\((.+?)\)/gs, (_, alt, src) => {
                if (!this.isNetworkImage(src) && !this.isSpecialImage(src)) {
                    src = this.Package.Path.resolve(dir, src);
                }
                return `<img alt="${alt}" src="${src}">`
            })
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

class diagramParser {
    constructor() {
        this.utils = utils;
        this.parsers = new Map(); // {lang: parser}
    }

    register = (
        lang, destroyWhenUpdate = false,
        renderFunc, cancelFunc = null, destroyAllFunc = null,
        extraStyleGetter = null, interactiveMode = true,
    ) => {
        lang = lang.toLowerCase();
        const obj = {lang, destroyWhenUpdate, renderFunc, cancelFunc, destroyAllFunc, extraStyleGetter, interactiveMode}
        this.parsers.set(lang, obj);
        console.debug(`register diagram parser: [ ${lang} ]`);
    }

    unregister = lang => this.parsers.delete(lang)

    registerStyleTemplate = async () => {
        if (this.utils.isBetaVersion) {
            await this.utils.registerStyleTemplate("diagram-parser");
        }
    }

    process = async () => {
        if (this.parsers.size === 0) return;
        await this.registerStyleTemplate();
        this.onAddCodeBlock();       // 添加代码块时
        this.onTryAddLangUndo();     // 修改语言时
        this.onUpdateDiagram();      // 更新时
        this.onExportToHTML();       // 导出时
        this.onFocus();              // 聚焦时
        this.onChangeFile();         // 切换文件时
        this.onCheckIsDiagramType(); // 判断是否为Diagram时
    }

    isDiagramType = lang => File.editor.diagrams.constructor.isDiagramType(lang)

    throwParseError = (errorLine, reason) => {
        throw {errorLine, reason}
    }

    getErrorMessage = error => {
        let msg = error.errorLine ? `第 ${error.errorLine} 行发生错误。` : '';
        msg += error.reason ? `错误原因：${error.reason}` : '';
        return msg || error.toString();
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
        for (const [lang, parser] of this.parsers.entries()) {
            if (!parser.cancelFunc) continue;
            try {
                parser.cancelFunc(cid, lang);
            } catch (e) {
                console.error("call cancel func error:", e);
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
        }

        $pre.addClass("md-fences-advanced");
        if ($pre.find(".md-diagram-panel").length === 0) {
            $pre.append(`<div class="md-diagram-panel md-fences-adv-panel"><div class="md-diagram-panel-header"></div>
                    <div class="md-diagram-panel-preview"></div><div class="md-diagram-panel-error"></div></div>`);
        }

        const render = this.parsers.get(lang).renderFunc;
        if (!render) return;
        try {
            await render(cid, content, $pre, lang);
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
            $pre.removeClass("md-fences-advanced md-fences-interactive");
            await this.noticeRollback(cid);
        } else {
            // 是Diagram类型，但不是自定义类型，不展示增强按钮，直接返回即可
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

    onAddCodeBlock = () => this.utils.addEventListener(this.utils.eventType.afterAddCodeBlock, this.renderDiagram)

    onTryAddLangUndo = () => {
        const objGetter = () => File && File.editor && File.editor.fences;
        const after = (result, ...args) => args && args[0] && this.renderDiagram(args[0].cid);
        this.utils.decorate(objGetter, "tryAddLangUndo", null, after);
    }

    onUpdateDiagram = () => {
        const objGetter = () => File && File.editor && File.editor.diagrams;
        const after = (result, ...args) => this.renderDiagram(args[0]);
        this.utils.decorate(objGetter, "updateDiagram", null, after);
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

        this.utils.decorate(() => File && File.editor && File.editor.fences, "focus", stopCall);
        this.utils.decorate(() => File && File.editor, "refocus", stopCall);

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
            if (!enhance) return;
            const editButton = enhance.querySelector(".edit-custom-diagram");
            if (editButton) {
                editButton.style.display = "none";
            }
            enhance.style.display = "none";
        }

        const handleCtrlClick = () => {
            const ctrlClick = this.utils.getGlobalSetting("CTRL_CLICK_TO_EXIST_INTERACTIVE_MODE");
            if (!ctrlClick) return;
            document.querySelector("#write").addEventListener("mouseup", ev => {
                if (this.utils.metaKeyPressed(ev) && ev.target.closest(".md-fences-interactive .md-diagram-panel-preview")) {
                    showAllTButton(ev.target.closest(".md-fences-interactive"));
                    enableFocus();
                }
            }, true)
        }

        const handleEditButton = () => {
            const editBtn = this.utils.getGlobalSetting("CLICK_EDIT_BUTTON_TO_EXIT_INTERACTIVE_MODE");
            const hasInteractive = Array.from(this.parsers.values()).some(parser => parser.interactiveMode);
            if (!editBtn || !hasInteractive) return;

            const listener = (ev, button) => {
                button.closest(".fence-enhance").querySelectorAll(".enhance-btn").forEach(ele => ele.style.display = "");
                enableFocus();
            }
            const ok = this.utils.registerFenceEnhanceButton("edit-custom-diagram", "editDiagram", "编辑", "fa fa-edit", false, listener);
            if (!ok) return;

            $("#write").on("mouseenter", ".md-fences-interactive:not(.md-focus)", function () {
                showEditButtonOnly(this);
            }).on("mouseleave", ".md-fences-interactive.md-focus", function () {
                showEditButtonOnly(this);
            }).on("mouseleave", ".md-fences-interactive:not(.md-focus)", function () {
                hideAllButton(this);
            }).on("mouseenter", ".md-fences-interactive.md-focus", function () {
                showAllTButton(this);
            })
        }

        handleCtrlClick();
        handleEditButton();
    }

    onChangeFile = () => {
        this.utils.addEventListener(this.utils.eventType.otherFileOpened, () => {
            for (const {destroyAllFunc} of this.parsers.values()) {
                destroyAllFunc && destroyAllFunc();
            }
        });
    }

    onCheckIsDiagramType = () => {
        const objGetter = () => File && File.editor && File.editor.diagrams && File.editor.diagrams.constructor
        const after = (result, ...args) => {
            if (result === true) return true;

            let lang = args[0];
            if (!lang) return false;
            const type = typeof lang;
            if (type === "object" && lang.name) {
                lang = lang.name;
            }
            if (type === "string") {
                return this.parsers.get(lang.toLowerCase());
            }
            return result
        }
        this.utils.decorate(objGetter, "isDiagramType", null, after, true);
    }
}

class thirdPartyDiagramParser {
    constructor() {
        this.utils = utils;
        this.parsers = new Map();
    }

    // extraCss: {defaultHeight, backgroundColor}
    register = (
        lang, destroyWhenUpdate, interactiveMode, checkSelector, wrapElement, extraCss,
        lazyLoadFunc, createFunc, destroyFunc, beforeExport, extraStyleGetter,
    ) => {
        const p = {checkSelector, wrapElement, extraCss, lazyLoadFunc, createFunc, destroyFunc, beforeExport, map: {}};
        this.parsers.set(lang.toLowerCase(), p);
        this.utils.registerDiagramParser(lang, destroyWhenUpdate, this.render, this.cancel, this.destroyAll, extraStyleGetter, interactiveMode)
    }

    unregister = lang => {
        this.parsers.delete(lang);
        this.utils.unregisterDiagramParser(lang);
    }

    render = async (cid, content, $pre, lang) => {
        const parser = this.parsers.get(lang);
        if (!parser) return

        await parser.lazyLoadFunc();
        const $wrap = this.getWrap(parser, $pre);
        try {
            this.setStyle(parser, $pre, $wrap, content);
            if (parser.map.hasOwnProperty(cid)) {
                this.cancel(cid, lang);
            }
            const instance = parser.createFunc($wrap, content);
            if (instance) {
                parser.map[cid] = instance;
            }
        } catch (e) {
            this.utils.throwParseError(null, e.toString());
        }
    }

    getWrap = (parser, $pre) => {
        let $wrap = $pre.find(parser.checkSelector);
        if ($wrap.length === 0) {
            $wrap = $(parser.wrapElement);
        }
        $pre.find(".md-diagram-panel-preview").html($wrap);
        return $wrap
    }

    setStyle = (parser, $pre, $wrap, content) => {
        const {height, width} = this.utils.getFenceUserSize(content);
        $wrap.css({
            "width": width || parseFloat($pre.find(".md-diagram-panel").css("width")) - 10 + "px",
            "height": height || parser.extraCss["defaultHeight"] || "",
            "background-color": parser.extraCss["backgroundColor"] || "",
        });
    }

    cancel = (cid, lang) => {
        const parser = this.parsers.get(lang);
        if (!parser) return
        const instance = parser.map[cid];
        if (instance) {
            parser.destroyFunc && parser.destroyFunc(instance);
            delete parser.map[cid];
        }
    }

    destroyAll = () => {
        for (const parser of this.parsers.values()) {
            for (const instance of Object.values(parser.map)) {
                parser.destroyFunc && parser.destroyFunc(instance);
            }
            parser.map = {};
        }
    }

    beforeExport = () => {
        for (const [lang, parser] of this.parsers.entries()) {
            if (!parser.beforeExport) continue;
            this.utils.renderAllLangFence(lang);
            for (const [cid, instance] of Object.entries(parser.map)) {
                const preview = document.querySelector(`#write .md-fences[cid=${cid}] .md-diagram-panel-preview`);
                preview && parser.beforeExport(preview, instance);
            }
        }
    }

    afterExport = () => {
        setTimeout(() => {
            for (const lang of this.parsers.keys()) {
                this.utils.refreshAllLangFence(lang);
            }
        }, 300)
    }

    process = () => this.utils.registerExportHelper("third-party-diagram-parser", this.beforeExport, this.afterExport);
}

class eventHub {
    constructor() {
        this.utils = utils
        this.filepath = ""
        this.observer = null
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
        this.utils.decorate(() => File && File.editor && File.editor.library, "openFile",
            () => {
                this.filepath = this.utils.getFilePath();
                this.publishEvent(this.utils.eventType.beforeFileOpen);
            },
            (result, ...args) => {
                const filePath = args[0];
                filePath && this.publishEvent(this.utils.eventType.fileOpened, filePath);
                this.filepath !== filePath && this.publishEvent(this.utils.eventType.otherFileOpened, filePath);
            }
        )

        this.utils.loopDetector(() => File && this.utils.getFilePath(), () => {
            const filePath = this.utils.getFilePath();
            filePath && this.utils.publishEvent(this.utils.eventType.firstFileInit, filePath);
        });

        this.utils.decorate(() => File && File.editor && File.editor.fences, "addCodeBlock",
            (...args) => {
                const cid = args[0];
                cid && this.publishEvent(this.utils.eventType.beforeAddCodeBlock, cid)
            },
            (result, ...args) => {
                const cid = args[0];
                cid && this.publishEvent(this.utils.eventType.afterAddCodeBlock, cid)
            },
        )

        this.utils.decorate(() => File, "toggleSourceMode", () => this.publishEvent(this.utils.eventType.beforeToggleSourceMode))

        this.utils.decorate(
            () => File && File.editor && File.editor.library && File.editor.library.outline, "updateOutlineHtml",
            null, () => this.publishEvent(this.utils.eventType.outlineUpdated)
        )

        this.utils.decorate(() => File && File.editor && File.editor.library, "toggleSidebar", null, () => {
            const sidebar = document.querySelector("#typora-sidebar");
            if (sidebar) {
                const open = sidebar.classList.contains("open");
                this.publishEvent(this.utils.eventType.afterToggleSidebar, open);
            }
        })

        this.utils.decorate(() => window, "onbeforeunload", () => this.utils.publishEvent(this.utils.eventType.beforeUnload))

        new MutationObserver(mutationList => {
            for (const mutation of mutationList) {
                if (mutation.type === 'attributes' && mutation.attributeName === "class") {
                    const value = document.body.getAttribute(mutation.attributeName);
                    const openPage = value.indexOf("megamenu-opened") !== -1 || value.indexOf("show-preference-panel") !== -1;
                    this.utils.publishEvent(this.utils.eventType.toggleSettingPage, openPage);
                }
            }
        }).observe(document.body, {attributes: true});

        const debouncePublish = this.utils.debounce(() => this.utils.publishEvent(this.utils.eventType.fileEdited), 400);
        this.observer = new MutationObserver(mutationList => {
            if (mutationList.some(m => m.type === "characterData")
                || mutationList.length && mutationList.some(m => m.addedNodes.length) && mutationList.some(m => m.removedNodes.length)) {
                debouncePublish();
            }
        });
        this.observer.observe(document.querySelector("#write"), {characterData: true, childList: true, subtree: true})
    }

    afterProcess = () => {
        delete this.eventMap[this.utils.eventType.allCustomPluginsHadInjected];
        delete this.eventMap[this.utils.eventType.allPluginsHadInjected];
        delete this.eventMap[this.utils.eventType.everythingReady];
        setTimeout(() => delete this.eventMap[this.utils.eventType.firstFileInit], 1000);

        const funcList = this.eventMap[this.utils.eventType.fileEdited];
        if (!funcList || funcList.length === 0) {
            delete this.eventMap[this.utils.eventType.fileEdited];
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

class stateRecorder {
    constructor() {
        this.utils = utils;
        this.recorders = new Map(); // map[name]recorder
    }

    // collections: map[filepath]map[idx]state
    register = (name, selector, stateGetter, stateRestorer, finalFunc) => {
        const obj = {selector, stateGetter, stateRestorer, finalFunc, collections: new Map()};
        this.recorders.set(name, obj);
    }
    unregister = recorderName => this.recorders.delete(recorderName);

    collect = name => {
        const filepath = this.utils.getFilePath();
        for (const [recorderName, recorder] of this.recorders.entries()) {
            if (!name || name === recorderName) {
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
    }

    restore = filepath => {
        for (const recorder of this.recorders.values()) {
            const collection = recorder.collections.get(filepath)
            if (collection && collection.size) {
                document.querySelectorAll(recorder.selector).forEach((ele, idx) => {
                    const state = collection.get(idx);
                    state && recorder.stateRestorer(ele, state);
                })
                recorder.finalFunc && recorder.finalFunc();
            }
        }
    }

    getState = (name, filepath) => {
        const recorder = this.recorders.get(name);
        if (!recorder) return new Map();
        const collections = recorder.collections;
        if (!collections) return new Map();
        if (!filepath || !collections.size) return collections;
        const map = collections.get(filepath);
        if (map) return map
    }

    deleteState = (name, filepath, idx) => {
        const map = this.getState(name, filepath);
        map && map.delete(idx);
    }

    setState = (name, collections) => {
        const recorder = this.recorders.get(name);
        if (recorder) {
            recorder.collections = collections;
        }
    }

    process = () => {
        this.utils.addEventListener(this.utils.eventType.beforeFileOpen, this.collect);
        this.utils.addEventListener(this.utils.eventType.fileContentLoaded, this.restore);
    }

    afterProcess = () => {
        if (this.recorders.size) return;
        this.utils.removeEventListener(this.utils.eventType.beforeFileOpen, this.collect);
        this.utils.removeEventListener(this.utils.eventType.fileContentLoaded, this.restore);
    }
}

class dialog {
    constructor() {
        this.utils = utils;
        this.entities = null;
        this.clean();
    }

    html = () => `
        <div id="plugin-custom-modal" class="modal-dialog plugin-common-hidden">
            <div class="modal-content">
                <div class="modal-header"><div class="modal-title" data-lg="Front">自定义插件弹窗</div></div>
                <div class="modal-body"></div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default plugin-modal-cancel" data-dismiss="modal" data-lg="Front">取消</button>
                    <button type="button" class="btn btn-primary plugin-modal-submit" data-lg="Front">确定</button>
                </div>
            </div>
        </div>
    `

    clean = () => {
        this.pluginModal = null;
        this.callback = null;
        this.cancelCallback = null;
    }

    process = async () => {
        await this.utils.registerStyleTemplate("modal-generator");
        this.utils.insertElement(this.html());

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

    onButtonClick = async callback => {
        this.pluginModal.components.forEach(component => {
            if (component.label === undefined || !component.type || !component.id) return;
            const widget = this.entities.body.querySelector(`.form-group[component-id="${component.id}"]`);
            component.submit = widget ? this.getWidgetValue(component.type, widget) : undefined;
        })
        this.utils.hide(this.entities.modal);
        if (callback) {
            await callback(this.pluginModal.components);
        }
        this.clean();
        this.entities.body.innerHTML = "";
    }

    addEvent = () => {
        if (!this.pluginModal || !this.pluginModal.components) return;
        this.pluginModal.components.forEach(component => {
            Object.entries(component).forEach(([key, func]) => {
                if (!key.startsWith("on")) return;
                const widget = this.entities.body.querySelector(`.form-group[component-id="${component.id}"]`);
                widget[key] = func;
            })
        })
    }

    getWidgetValue = (type, widget) => {
        type = type.toLowerCase();
        switch (type) {
            case "input":
            case "textarea":
            case "select":
                return widget.querySelector(type).value
            case "radio":
                return widget.querySelector("input:checked").value
            case "file":
                return widget.querySelector("input").files
            case "checkbox":
                return Array.from(widget.querySelectorAll("input:checked"), box => box.value)
            case "range":
                return widget.querySelector('input[type="range"]').value
            default:
                return ""
        }
    }

    newWidget = component => {
        if (!component || component.label === undefined || !component.type) return;

        let label = "label";
        let inner = "";
        const type = component.type.toLowerCase();
        const disabled = c => c.disabled ? "disabled" : "";
        switch (type) {
            case "input":
            case "password":
            case "file":
                const t = type === "input" ? "text" : type;
                inner = `<input type="${t}" class="form-control" value="${component.value || ""}" placeholder="${component.placeholder || ""}" ${disabled(component)}>`;
                break
            case "range":
                const {min = 0, max = 100, step = 1, value = 1} = component;
                inner = `<div class="plugin-custom-modal-range">
                            <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" oninput="this.nextElementSibling.innerText = this.value;">
                            <div class="modal-range-value">${value}</div>
                         </div>`
                break
            case "checkbox":
            case "radio":
                const checked = c => c.checked ? "checked" : "";
                const name = this.utils.randomString();
                const prefix = name + "-";
                const elements = component.list.map(el => {
                    const id = prefix + el.value;
                    return `<div class="${type}"><input type="${type}" id="${id}" name="${name}" value="${el.value}" ${disabled(el)} ${checked(el)}><label for="${id}">${el.label}</label></div>`
                });
                const content = elements.join("");
                inner = (component.legend === undefined) ? content : `<fieldset><legend>${component.legend}</legend>${content}</fieldset>`;
                break
            case "select":
                const selected = option => (option === component.selected) ? "selected" : "";
                const map = component.map || Object.fromEntries(component.list.map(item => [item, item]));
                const options = Object.entries(map).map(([value, option]) => `<option value="${value}" ${selected(value)}>${option}</option>`);
                inner = `<select class="form-control" ${disabled(component)}>${options.join("")}</select>`;
                break
            case "textarea":
                const rows = component.rows || 3;
                const cnt = component.content || "";
                const readonly = component.readonly || "";
                inner = `<textarea class="form-control" rows="${rows}" ${readonly} placeholder="${component.placeholder || ""}" ${disabled(component)}>${cnt}</textarea>`;
                break
            case "p":
                label = "p";
                break
        }
        return `<div class="col-lg-12 form-group" component-id="${component.id}"><${label}>${component.label}</${label}>${inner}</div>`;
    }

    // modal: {title: "", components: [{label: "", type: "", value: ""}]}
    modal = (modal, callback, cancelCallback) => {
        if (modal) {
            this.pluginModal = modal;
            this.callback = callback;
            this.cancelCallback = cancelCallback;

            this.entities.title.innerText = modal.title;
            modal.components.forEach(component => component.id = this.utils.randomString());
            const widgetList = modal.components.map(this.newWidget);
            this.entities.body.innerHTML = `<form role="form">${widgetList.join("")}</form>`;
            this.addEvent();
            this.utils.show(this.entities.modal);
            modal.onload && modal.onload(this.entities.modal);
        }
    }
}

class hotkeyHub {
    constructor() {
        this.utils = utils;
        this.map = new Map();
    }

    normalize = hotkeyString => {
        const modifier = ["ctrl", "shift", "alt"];
        const keyList = hotkeyString.toLowerCase().split("+").map(k => k.trim());
        const modifierKeys = modifier.filter(k => keyList.includes(k));
        const mainKey = keyList.find(k => !modifier.includes(k)) || (hotkeyString.includes("++") ? "+" : " ");
        return [...modifierKeys, mainKey].join("+");
    }

    _register = (hotkey, call) => {
        if (typeof hotkey === "string" && hotkey.length) {
            this.map.set(this.normalize(hotkey), call);
        } else if (hotkey instanceof Array) {   // 一个callback可能对应多个hotkey
            for (const hk of hotkey) {
                this._register(hk, call);
            }
        }
    }

    register = hotkeyList => {
        if (!hotkeyList) return;
        for (const item of hotkeyList) {
            if (item instanceof Array) {
                this.register(item);
            } else {
                this._register(item.hotkey, item.callback);
            }
        }
    }
    unregister = hotkeyString => this.map.delete(this.normalize(hotkeyString))
    registerSingle = (hotkeyString, callback) => this._register(hotkeyString, callback)

    process = () => {
        window.addEventListener("keydown", ev => {
            if (ev.key === undefined) return;
            const arr = [];
            this.utils.metaKeyPressed(ev) && arr.push("ctrl");
            this.utils.shiftKeyPressed(ev) && arr.push("shift");
            this.utils.altKeyPressed(ev) && arr.push("alt");
            arr.push(ev.key.toLowerCase());
            const key = arr.join("+");
            const callback = this.map.get(key);
            if (callback) {
                callback();
                ev.preventDefault();
                ev.stopPropagation();
            }
        }, true)
    }
}

class styleTemplater {
    constructor() {
        this.utils = utils
    }

    getID = name => `plugin-${name}-style`

    register = async (name, args) => {
        const files = ["user_styles", "styles"].map(dir => this.utils.joinPath("./plugin/global", dir, `${name}.css`));
        const [userStyles, defaultStyles] = await this.utils.readFiles(files);
        const data = userStyles || defaultStyles;
        if (!data) {
            console.error(`there is not such style file: ${name}`);
            return
        }
        try {
            const css = data.replace(/\${(.+?)}/g, (_, $arg) => $arg.split(".").reduce((obj, attr) => obj[attr], args));
            this.utils.insertStyle(this.getID(name), css);
        } catch (err) {
            console.error(`replace args error. file: ${name}. err: ${err}`);
        }
    }

    unregister = name => this.utils.removeStyle(this.getID(name));

    getStyleContent = name => {
        const style = document.getElementById(this.getID(name));
        return style ? style.innerHTML : undefined;
    }

    process = async () => await this.register("plugin-common");
}

// 3x faster then innerHTML, less memory usage, more secure, but poor readable
// don't use it unless element is simple enough or there are secure issues
class htmlTemplater {
    constructor() {
        this.utils = utils
        this.defaultElement = "div"
    }

    create = element => {
        if (!element) return;
        if (element instanceof Element) return element

        const el = document.createElement(element.ele || this.defaultElement);
        for (const [prop, value] of Object.entries(element)) {
            switch (prop) {
                case "ele":
                    break
                case "class":
                case "className":
                case "class_":
                    const li = Array.isArray(value) ? value : value.trim().split(" ");
                    el.classList.add(...li);
                    break
                case "text":
                    el.innerText = value;
                    break
                case "style":
                    Object.assign(el.style, value);
                    break
                case "children":
                    for (const child of value) {
                        el.appendChild(this.create(child));
                    }
                    break
                default:
                    el.setAttribute(prop, value);
            }
        }
        return el
    }

    createList = elements => elements.map(this.create)
    insert = elements => this.utils.insertElement(this.createList(elements))
    appendElements = (parent, templates) => {
        const target = document.createDocumentFragment();
        this.createList(templates).forEach(ele => target.appendChild(ele));
        parent.appendChild(target);
    }

    process = () => {
        this.utils.insertElement(`
            <span class="plugin-wait-mask-wrapper plugin-common-hidden">
                <span class="plugin-wait-mask">
                    <span class="plugin-wait-label">Processing</span>
                    <span class="truncate-line"></span><span class="truncate-line"></span><span class="truncate-line"></span>
                </span>
            </span>
        `);
    }
}

class contextMenu {
    constructor() {
        this.utils = utils;
        this.menus = new Map();
        this.callback = null;
    }

    process = async () => {
        await this.utils.registerStyleTemplate("plugin-common-menu");
        this.utils.insertHtmlTemplate([{class_: "plugin-common-menu"}]);

        this.menu = document.querySelector(".plugin-common-menu");
        this.menu.addEventListener("click", ev => {
            if (!this.callback) return;
            const target = ev.target.closest(".menu-item");
            if (!target) return;
            ev.preventDefault();
            ev.stopPropagation();
            this.callback({ev, key: target.getAttribute("key")});
            this.callback = null;
            this.menu.classList.remove("show");
        })
        // 仅限content内部
        document.querySelector("content").addEventListener("mousedown", ev => {
            !ev.target.closest(".menu-item") && this.menu.classList.remove("show");
            if (ev.button !== 2) return;
            for (const menu of this.menus.values()) {
                const target = ev.target.closest(menu.selector);
                if (!target) continue;
                ev.preventDefault();
                ev.stopPropagation();
                const menus = menu.generator({ev, target});
                this.render(menus);
                this.show(ev);
                this.callback = menu.callback;
            }
        }, true)
    }

    registerMenu = (name, selector, generator, callback) => this.menus.set(name, {selector, generator, callback})
    unregisterMenu = name => this.menus.delete(name)

    render = menus => {
        const entries = Object.entries(menus);
        let child = this.menu.firstElementChild;
        for (let idx = 0; idx < entries.length; idx++) {
            const [key, text] = entries[idx];
            if (child) {
                child.setAttribute("key", key);
                child.innerText = text;
            } else {
                const menuList = entries.slice(idx).map(([key, text]) => ({class_: "menu-item", key, text}));
                this.utils.appendElements(this.menu, menuList);
                break;
            }
            child = child.nextElementSibling;
        }
        while (child) {
            const next = child.nextElementSibling;
            this.menu.removeChild(child);
            child = next;
        }
    }

    show = ev => {
        const $menu = $(this.menu);
        $menu.addClass("show");
        const {innerWidth, innerHeight} = window;
        const {clientX, clientY} = ev;
        let width = $menu.width() + 20;
        width = Math.min(clientX, innerWidth - width);
        width = Math.max(0, width);
        let height = $menu.height() + 48;
        height = clientY > innerHeight - height ? innerHeight - height : clientY - $("#top-titlebar").height() + 8;
        height = Math.max(0, height);
        $menu.css({top: height + "px", left: width + "px"});
    }
}

class exportHelper {
    constructor() {
        this.utils = utils;
        this.helpers = new Map();
    }

    register = (name, beforeExport, afterExport) => this.helpers.set(name, {beforeExport, afterExport});
    unregister = name => this.helpers.delete(name);

    beforeExport = (...args) => {
        for (const h of this.helpers.values()) {
            if (h.beforeExport) {
                const css = h.beforeExport() || "";
                args[0].extraCss = (args[0].extraCss || "") + css;
            }
        }
    }

    check = args => {
        const {type} = args[0] || {};
        return type === "html" || type === "html-plain"
    }

    afterExport = async (exportResult, ...args) => {
        if (!this.check(args)) return exportResult

        let html = await exportResult;
        const writeIdx = html.indexOf(`id='write'`);
        if (writeIdx === -1) return html;

        for (const h of this.helpers.values()) {
            if (h.afterExport) {
                const newHtml = await h.afterExport(html, writeIdx);
                if (newHtml) {
                    html = newHtml;
                }
            }
        }
        return html;
    }

    afterExportSync = (exportResult, ...args) => {
        if (!this.check(args)) return exportResult

        let html = exportResult;
        const writeIdx = html.indexOf(`id='write'`);
        if (writeIdx === -1) return html;

        for (const h of this.helpers.values()) {
            if (h.afterExport) {
                const newHtml = h.afterExport(html, writeIdx);
                if (newHtml && !this.utils.isPromise(newHtml)) {
                    html = newHtml;
                }
            }
        }
        return html
    }

    process = () => {
        // 旧版本的Typora的export函数不是AsyncFunction，尽最大努力兼容旧版本
        const until = () => File && File.editor && File.editor.export && File.editor.export.exportToHTML
        const callback = () => {
            const after = (File.editor.export.exportToHTML.constructor.name === 'AsyncFunction') ? this.afterExport : this.afterExportSync
            this.utils.decorate(() => File && File.editor && File.editor.export, "exportToHTML", this.beforeExport, after, true)
        }
        this.utils.loopDetector(until, callback);
    }
}

class markdownParser {
    constructor() {
        this.utils = utils;
        const nodeKind = {
            Blank: 1, Punctuation: 1 << 1, AlphabetNumeric: 1 << 2, UnicodeString: 1 << 3, BlockCode: 1 << 4,
            Document: 1 << 5, HTMLTag: 1 << 6, ReferenceLink: 1 << 7, ReferenceDefinition: 1 << 8, InlineLink: 1 << 9,
            OrderedListItem: 1 << 10, Quoted: 1 << 11, SquareQuoted: 1 << 12, Strikethrough: 1 << 13, Strong: 1 << 14,
            Emphasis: 1 << 15, InlineCode: 1 << 16, UnorderedListItem: 1 << 17, InlineImage: 1 << 18,
            ReferenceImage: 1 << 19, Raw: 1 << 20, Math: 1 << 21, BlockquoteItem: 1 << 22,
            CalloutItem: 1 << 23, Highlight: 1 << 24, CJK: 1 << 25,
        }
        this.nodeKind = new Map(Object.entries(nodeKind).map(([key, value]) => [value, key]));
    }

    parse = markdown => {
        this.parser = this.parser || this.utils.requireFilePath("./plugin/md_padding/md-padding/parser/parse");
        return this.parser.parse(markdown, {ignoreWords: []});
    }
    getNodeKindByNode = node => this.nodeKind.get(node.kind)
    getNodeKindByNum = num => this.nodeKind.get(num)
}

const helper = Object.freeze({
    // 生命周期事件
    eventHub: new eventHub(),
    // 公共菜单
    contextMenu: new contextMenu(),
    // 自定义代码块语法
    diagramParser: new diagramParser(),
    // 第三方图形代码块语法
    thirdPartyDiagramParser: new thirdPartyDiagramParser(),
    // 状态记录器
    stateRecorder: new stateRecorder(),
    // 对话框
    dialog: new dialog(),
    // 快捷键
    hotkeyHub: new hotkeyHub(),
    // 样式模板
    styleTemplater: new styleTemplater(),
    // html模板
    htmlTemplater: new htmlTemplater(),
    // 导出时的额外操作
    exportHelper: new exportHelper(),
    // markdown语法解析器
    markdownParser: new markdownParser(),
})

class IPlugin {
    constructor(fixedName, setting) {
        this.fixedName = fixedName;
        this.config = setting;
        this.utils = utils;
    }

    // 最先执行的函数，唯一一个asyncFunction，在这里初始化插件需要的数据。若返回stopLoadPluginError，则停止加载插件
    beforeProcess = async () => undefined
    // 以字符串形式导入样式
    style = () => undefined
    // 以文件形式导入样式
    styleTemplate = () => undefined
    // 原生插入html标签
    html = () => undefined
    // 使用htmlTemplater插入html标签，详见htmlTemplater
    htmlTemplate = () => undefined
    // 注册快捷键
    hotkey = () => undefined
    // 初始化数据
    init = () => undefined
    // 主要的处理流程
    process = () => undefined
    // 收尾，一般用于回收内存，用的比较少
    afterProcess = () => undefined
}

class basePlugin extends IPlugin {
    call = (type, meta) => undefined
}

class baseCustomPlugin extends IPlugin {
    constructor(fixedName, setting, controller) {
        super(fixedName, setting.config);
        this.controller = controller;
        this.info = setting;
        this.showName = setting.name;
        this.modal = utils.modal;
    }

    hint = isDisable => undefined
    selector = () => undefined
    callback = anchorNode => undefined
}

class process {
    static optimize = async () => {
        if (!global._plugin_global_settings.PERFORMANCE_MODE) return;
        await Promise.all(Object.values(helper).map(async h => h.afterProcess && h.afterProcess()));
    }

    static loadPlugin = async fixedName => {
        const setting = global._plugin_settings[fixedName];
        if (!setting || !setting.ENABLE || global._plugin_global_settings.DISABLE_PLUGINS.indexOf(fixedName) !== -1) {
            console.debug(`disable plugin: [ ${fixedName} ] `);
            return
        }
        try {
            const {plugin} = utils.requireFilePath("./plugin", fixedName);
            if (!plugin) return;

            const instance = new plugin(fixedName, setting);
            if (!(instance instanceof BasePlugin)) {
                console.error("instance is not instanceof BasePlugin:", fixedName);
                return
            }
            const ok = await utils.loadPluginLifeCycle(instance);
            if (!ok) return;
            global._plugins[instance.fixedName] = instance;
            console.debug(`plugin had been injected: [ ${instance.fixedName} ] `);
        } catch (e) {
            console.error("load plugin err:", e);
        }
    }

    static loadPlugins = () => Promise.all(Object.keys(global._plugin_settings).map(this.loadPlugin));

    static loadHelpers = (...helpers) => Promise.all(helpers.map(async e => e.process()));

    static existEnablePlugin = () => Object.entries(global._plugin_settings).some(([name, plugin]) => plugin.ENABLE && !global._plugin_global_settings.DISABLE_PLUGINS.includes(name))

    // 整个插件系统一共暴露了7个全局变量，实际有用的只有2个：BasePlugin, BaseCustomPlugin
    // 其余5个皆由静态类utils暴露，永远不会被外部文件引用；而utils同时又是上面两个父类的实例属性，所以utils自己也不需要暴露
    // 既然永远不会被外部文件引用，为什么还要将它们设置为什么全局变量？答：方便调试
    static prepare = settings => {
        global.BasePlugin = basePlugin;             // 插件的父类
        global.BaseCustomPlugin = baseCustomPlugin; // 自定义插件的父类

        global._plugins = {};                              // 启用的插件
        global._plugin_utils = utils;                      // 通用工具
        global._plugin_helper = helper;                    // 高级工具
        global._plugin_settings = settings;                // 插件配置
        global._plugin_global_settings = settings.global;  // 通用配置

        delete settings.global;
    }

    static run = async () => {
        const settings = await utils.readSetting("settings.default.toml", "settings.user.toml");
        if (!settings || !settings.global || !settings.global.ENABLE) return;

        // 初始化全局变量
        this.prepare(settings);

        if (!this.existEnablePlugin()) return;

        const {
            contextMenu, dialog, styleTemplater, stateRecorder, eventHub,
            htmlTemplater, diagramParser, hotkeyHub, exportHelper, thirdPartyDiagramParser,
        } = helper;

        // 以下高级工具必须先加载
        // 1.插件可能会在加载阶段用到dialog、contextMenu和styleTemplater
        // 2.必须先让stateRecorder恢复状态，才能执行后续流程
        await this.loadHelpers(contextMenu, dialog, styleTemplater, stateRecorder);

        // 加载插件
        await this.loadPlugins();

        // 其他高级工具可能会用到eventHub，所以必须先于高级工具加载；必须先等待插件注册事件后才能触发事件，所以必须后于插件加载
        await this.loadHelpers(eventHub);

        // 发布【所有插件加载完毕】事件。有些插件会监听此事件，在其回调函数中注册高级工具，所以必须先于高级工具执行
        utils.publishEvent(utils.eventType.allPluginsHadInjected);

        // 加载剩余的高级工具
        await this.loadHelpers(htmlTemplater, diagramParser, hotkeyHub, exportHelper, thirdPartyDiagramParser);

        // 一切准备就绪
        utils.publishEvent(utils.eventType.everythingReady);

        // 尽力优化
        await this.optimize();

        // 由于使用了async，有些页面事件可能已经错过了（比如afterAddCodeBlock），重新加载一遍页面
        setTimeout(utils.reload, 50);
    }
}

module.exports = {
    entry: process.run
};