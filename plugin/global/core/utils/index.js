const PATH = require("path")
const FS = require("fs")
const FS_EXTRA = require("fs-extra")
const i18n = require("../i18n")

const MIXINS = {
    settings: require("./settings"),
    migrate: require("./migrate"),
    hotkeyHub: require("./hotkeyHub"),
    eventHub: require("./eventHub"),
    stateRecorder: require("./stateRecorder"),
    exportHelper: require("./exportHelper"),
    styleTemplater: require("./styleTemplater"),
    contextMenu: require("./contextMenu"),
    notification: require("./notification"),
    progressBar: require("./progressBar"),
    formDialog: require("./formDialog"),
    diagramParser: require("./diagramParser"),
    thirdPartyDiagramParser: require("./thirdPartyDiagramParser"),
    mermaid: require("./mermaid"),
    entities: require("./entities"),
}

class utils {
    static nodeVersion = process?.versions?.node
    static electronVersion = process?.versions?.electron
    static chromeVersion = process?.versions?.chrome
    static typoraVersion = window._options.appVersion
    static isBetaVersion = this.typoraVersion[0] === "0"

    static separator = File.isWin ? "\\" : "/"
    static fileProtocolUrlBase = this.isBetaVersion ? "typora://typemark" : "typora://app/typemark"
    static supportHasSelector = CSS.supports("selector(:has(*))")
    static tempFolder = window._options.tempPath || require("os").tmpdir()
    static Package = Object.freeze({ Path: PATH, Fs: FS, FsExtra: FS_EXTRA })

    static nonExistSelector = "__non_exist__"  // Plugin temporarily unavailable, return this.
    static disableForeverSelector = "__disabled__"  // Plugin permanently unavailable, return this.
    static stopLoadPluginError = Symbol("stop_loading")  // For plugin's beforeProcess method; return this to stop loading the plugin.

    static mixins = Object.fromEntries(
        Object.entries(MIXINS).map(([name, cls]) => [[name], new cls(this, i18n)])
    )

    // Do NOT manually call these variables
    static _sentinel = Symbol()  // As a sentinel value
    static _meta = {}            // Used to pass data in the context menu

    ////////////////////////////// plugin //////////////////////////////
    static container = null
    static registerContainer = container => {
        Object.entries(this.mixins).forEach(([name, instance]) => container.registerService(name, instance))
        this.container = container
    }
    static getAllBasePlugins = () => this.container.getAllBasePlugins()
    static getAllCustomPlugins = () => this.container.getAllCustomPlugins()
    static getBasePlugin = fixedName => this.container.getBasePlugin(fixedName)
    static getCustomPlugin = fixedName => this.container.getCustomPlugin(fixedName)
    static getAllBasePluginSettings = () => this.container.getAllBasePluginSettings()
    static getAllCustomPluginSettings = () => this.container.getAllCustomPluginSettings()
    static getGlobalSetting = fixedName => this.container.getGlobalSetting(fixedName)
    static getBasePluginSetting = fixedName => this.container.getBasePluginSetting(fixedName)
    static getCustomPluginSetting = fixedName => this.container.getCustomPluginSetting(fixedName)
    static tryGetPlugin = fixedName => this.container.tryGetPlugin(fixedName)
    static tryGetPluginSetting = fixedName => this.container.tryGetPluginSetting(fixedName)

    static getPluginFunction = (fixedName, funcName) => this.tryGetPlugin(fixedName)?.[funcName]
    static callPluginFunction = (fixedName, funcName, ...args) => {
        const plugin = this.tryGetPlugin(fixedName)
        return plugin?.[funcName]?.apply(plugin, args)
    }

    static hasOverrideBasePluginFn = (plugin, fn) => plugin[fn] !== global.BasePlugin.prototype[fn]
    static hasOverrideCustomPluginFn = (plugin, fn) => plugin[fn] !== global.BaseCustomPlugin.prototype[fn]

    static isUnderMountFolder = path => {
        const mountFolder = PATH.resolve(this.getMountFolder());
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
    static openFolder = folder => File.editor.library.openFileInNewWindow(folder, true)
    static reload = async () => {
        const content = await File.getContent()
        const arg = { fromDiskChange: false, skipChangeCount: true, skipUndo: true, skipStore: true }
        File.reloadContent(content, arg)
    }

    static showHiddenElementByPlugin = target => {
        if (!target) return;
        const plugins = ["collapse_paragraph", "collapse_table", "collapse_list", "truncate_text"];
        plugins.forEach(plu => this.callPluginFunction(plu, "rollback", target));
    }

    static getAnchorNode = (closest) => {
        const anchorNode = File.editor.getJQueryElem(window.getSelection().anchorNode)
        return closest ? anchorNode.closest(closest) : anchorNode
    }

    static updatePluginDynamicActions = (fixedName, anchorNode, notInContextMenu = false) => {
        const plugin = this.getBasePlugin(fixedName)
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
        const plugin = this.getBasePlugin(fixedName)
        if (plugin?.hasOwnProperty("call") && plugin.call instanceof Function) {
            plugin.call(action, this._meta)
        }
    }
    static updateAndCallPluginDynamicAction = (fixedName, action, anchorNode, notInContextMenu) => {
        this.updatePluginDynamicActions(fixedName, anchorNode, notInContextMenu)
        this.callPluginDynamicAction(fixedName, action)
    }

    // Repo: https://github.com/jimp-dev/jimp
    // after loadJimp(), you can use `globalThis.Jimp`
    static loadJimp = async () => await $.getScript((File.isNode ? "./lib.asar" : "./lib") + "/jimp/browser/lib/jimp.min.js")

    static sendEmail = (email, subject = "", body = "") => reqnode("electron").shell.openExternal(`mailto:${email}?subject=${subject}&body=${body}`)
    static openPath = (path) => reqnode("electron").shell.openPath(path)

    static downloadImage = async (src, folder, filename) => {
        folder = folder || this.tempFolder;
        filename = filename || (this.randomString() + "_" + PATH.extname(src))
        const { state } = await JSBridge.invoke("app.download", src, folder, filename);
        return { ok: state === "completed", filepath: PATH.join(folder, filename) }
    }

    // MIME type detection should use magic number checks or a dedicated library.
    // Manually checking magic numbers is impractical and a library adds too much overhead.
    // This uses a simplified approach. Modern browsers can often infer the subtype reliably.
    static convertImageToBase64 = (bin) => {
        const prefix = bin.slice(0, 5).toString()
        const mime = ["<svg", "<?xml"].some(e => prefix.startsWith(e)) ? "image/svg+xml" : "image"
        const base64 = bin.toString("base64")
        return `data:${mime};base64,${base64}`
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
    static noop = () => undefined
    static identity = args => args

    static safeEval = x => new Function(`return (${x})`)()
    static unsafeEval = x => eval(`(${x})`)

    /** @description param fn cannot be an ordinary function that returns promise-like objects */
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

    /** @description param fn cannot be an ordinary function that returns promise-like objects */
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

    /** @description param fn cannot be an ordinary function that returns promise-like objects */
    static once = fn => {
        let cache = this._sentinel
        const isAsync = this.isAsyncFunction(fn)
        return function (...args) {
            if (cache === utils._sentinel) {
                cache = isAsync
                    ? Promise.resolve(fn(...args)).catch(e => Promise.reject(e))
                    : fn(...args)
            }
            return cache
        }
    }

    /** @description param fn cannot be an ordinary function that returns promise-like objects */
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

    /** @description param fn cannot be an ordinary function that returns promise-like objects */
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

    static oneShot = () => {
        let shot
        const arm = fn => shot = fn
        const fire = (...args) => {
            const fn = shot
            shot = null
            return fn?.(...args)
        }
        return [arm, fire]
    }

    /**
     * @description Creates a function that confirms an action only after it has been
     * triggered `threshold` times consecutively within `timeWindow` milliseconds.
     * It supports an optional `getIdentifier` function to ensure only identical actions count.
     */
    static createConsecutiveAction = (
        {
            threshold = 2,
            timeWindow = 1000,
            totalTimeLimit = 0,
            debounceDelay = 0,
            resetOnConfirmed = true,
            getIdentifier = (...args) => undefined,
            shouldReset = () => false,
            shouldConfirm = () => false,
            onTimeout = this.noop,
            onReset = this.noop,
            onInsufficient = (current, total) => this.notification.show(i18n.t("global", "confirmNeeded", { count: total - current }), "info"),
            onConfirmed,
        }
    ) => {
        if (typeof onConfirmed !== "function") {
            throw new Error("onConfirmed must be a Function")
        }
        threshold = Math.max(threshold, 2)
        totalTimeLimit = Math.max(totalTimeLimit, 0)
        debounceDelay = Math.max(debounceDelay, 0)

        const NO_IDENTIFIER = Symbol("no_identifier")
        let currentCount = 0
        let lastTimestamp = 0
        let firstTimestamp = 0
        let lastIdentifier = NO_IDENTIFIER
        let resetTimer = null
        let debounceTimer = null

        const resetState = () => {
            onReset(currentCount, threshold)

            currentCount = 0
            lastTimestamp = 0
            firstTimestamp = 0
            lastIdentifier = NO_IDENTIFIER
            if (resetTimer) {
                clearTimeout(resetTimer)
                resetTimer = null
            }
            if (debounceTimer) {
                clearTimeout(debounceTimer)
                debounceTimer = null
            }
        }
        const executeConfirmation = (...args) => {
            onConfirmed(...args)
            if (resetOnConfirmed) {
                resetState()
            }
        }

        return function (...args) {
            if (debounceDelay > 0 && debounceTimer) {
                return
            }
            if (shouldConfirm(...args)) {
                executeConfirmation(...args)
                return
            }

            const now = Date.now()
            const currentIdentifier = getIdentifier(...args)
            if (shouldReset(...args)) {
                resetState()
            }

            const needReset = (
                currentCount === 0
                || now - lastTimestamp > timeWindow
                || (totalTimeLimit > 0 && currentCount > 0 && now - firstTimestamp > totalTimeLimit)
                || (lastIdentifier !== NO_IDENTIFIER && currentIdentifier !== lastIdentifier)
            )
            if (needReset) {
                resetState()
                currentCount = 1
                firstTimestamp = now
            } else {
                currentCount++
            }
            lastTimestamp = now
            lastIdentifier = currentIdentifier
            if (resetTimer) {
                clearTimeout(resetTimer)
                resetTimer = null
            }
            if (debounceDelay > 0) {
                if (debounceTimer) {
                    clearTimeout(debounceTimer)
                }
                debounceTimer = setTimeout(() => debounceTimer = null, debounceDelay)
            }

            if (currentCount < threshold) {
                resetTimer = setTimeout(() => {
                    if (currentCount > 0 && currentCount < threshold) {
                        onTimeout(currentCount, threshold)
                    }
                    resetState()
                }, timeWindow)
                onInsufficient(currentCount, threshold)
            } else {
                executeConfirmation(...args)
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

    static zip = (...arrays) => {
        const zipped = []
        const minLength = Math.min(...arrays.map(arr => arr.length))
        for (let i = 0; i < minLength; i++) {
            zipped.push(arrays.map(arr => arr[i]))
        }
        return zipped
    }

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
            obj[key] = Array.isArray(other[key]) ? other[key] : this.merge(source[key], other[key])
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
            if (other[key]) {
                obj[key] = Array.isArray(other[key]) ? other[key] : this.update(source[key], other[key])
            } else {
                obj[key] = source[key]
            }
            return obj
        }, Array.isArray(source) ? [] : {})
    }

    /**
     * Recursively creates a minimal version of an object by removing properties that are null, empty, or deeply equal to their counterparts in a default values object.
     * @example minimize({ o: { a: 3, b: 4 } }, { o: { a: 3 } }) -> { o: { b: 4 } }
     */
    static minimize = (sourceObject, defaultValues, options = {}, result = {}) => {
        const { allowNull = false, allowUndefined = false, allowEmptyArray = false, allowEmptyObject = false } = options

        for (const key of Object.keys(sourceObject)) {
            const sourceValue = sourceObject[key]
            const defaultValue = defaultValues ? defaultValues[key] : undefined

            if (sourceValue === null && !allowNull) continue
            if (sourceValue === undefined && !allowUndefined) continue
            if (this.deepEqual(sourceValue, defaultValue)) continue

            if (Array.isArray(sourceValue)) {
                if (allowEmptyArray || sourceValue.length > 0) {
                    result[key] = sourceValue
                }
            } else if (typeof sourceValue === "object" && sourceValue !== null) {
                const subDefault = (typeof defaultValue === "object" && defaultValue !== null) ? defaultValue : {}
                const minimizedSubObject = this.minimize(sourceValue, subDefault, options, {})
                if (allowEmptyObject || Object.keys(minimizedSubObject).length > 0) {
                    result[key] = minimizedSubObject
                }
            } else {
                result[key] = sourceValue
            }
        }
        return result
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

    static deepEqual = (object, other) => _.isEqual(object, other)

    static cloneDeep = (obj, memo = new WeakMap()) => {
        if (obj == null || typeof obj !== "object") {
            return obj
        } else if (memo.has(obj)) {
            return memo.get(obj)
        } else if (obj instanceof Date) {
            return new Date(obj.getTime())
        } else if (obj instanceof RegExp) {
            return new RegExp(obj.source, obj.flags)
        } else if (obj instanceof Map) {
            const clonedMap = new Map()
            memo.set(obj, clonedMap)
            obj.forEach((value, key) => {
                clonedMap.set(this.cloneDeep(key, memo), this.cloneDeep(value, memo))
            })
            return clonedMap
        } else if (obj instanceof Set) {
            const clonedSet = new Set()
            memo.set(obj, clonedSet)
            obj.forEach(value => {
                clonedSet.add(this.cloneDeep(value, memo))
            })
            return clonedSet
        }
        const clone = Array.isArray(obj) ? [] : Object.create(Object.getPrototypeOf(obj))
        memo.set(obj, clone)
        for (const key of [...Object.keys(obj), ...Object.getOwnPropertySymbols(obj)]) {
            clone[key] = this.cloneDeep(obj[key], memo)
        }
        return clone
    }

    static naiveCloneDeep = (source) => {
        if (source == null || typeof source !== "object") {
            return source
        }
        return Array.isArray(source)
            ? source.map(this.naiveCloneDeep)
            : Object.fromEntries(Object.entries(source).map(([key, val]) => [key, this.naiveCloneDeep(val)]))
    }

    static asyncReplaceAll = (content, regexp, replaceFunc) => {
        if (!regexp.global) {
            throw Error("Called with a non-global RegExp argument")
        }

        let match;
        let lastIndex = 0;
        const reg = new RegExp(regexp);  // To avoid modifying the RegExp.lastIndex property, copy a new object
        const promises = [];
        while (match = reg.exec(content)) {
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
            a: () => new Intl.DateTimeFormat(locale, { hour: "numeric", hour12: true }).formatToParts(date).find(part => part.type === "dayPeriod")?.value || ""
        }
        const regex = /(yyyy|yyy|yy|MMMM|MMM|MM|M|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|SSS|S|a)/g
        return format.replace(regex, (match) => fns[match] ? fns[match]() : match)
    }

    /** @description NOT a foolproof solution. */
    static isBase64 = str => str.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(str)
    /** @description NOT a foolproof solution. In fact, the Promises/A+ specification is not a part of Node.js, so there is no foolproof solution at all */
    static isPromise = obj => this.isObject(obj) && typeof obj.then === "function"
    /** @description NOT a foolproof solution. Can only be used to determine the "true" asynchronous functions */
    static isAsyncFunction = fn => fn.constructor.name === "AsyncFunction"
    /** @description NOT a foolproof solution. */
    static isObject = value => {
        const type = typeof value
        return value != null && (type === "object" || type === "function")
    }

    static escape = html => {
        const replacements = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "/": "&#x2F;", "`": "&#x60;", "=": "&#x3D;" }
        return html.replace(/[&<>"'`=\/]/g, c => replacements[c])
    }

    static compareVersion = (ver1, ver2) => {
        const arr1 = ver1.split(".")
        const arr2 = ver2.split(".")
        const maxLength = Math.max(arr1.length, arr2.length)
        for (let i = 0; i < maxLength; i++) {
            const num1 = parseInt(arr1[i] || 0, 10)
            const num2 = parseInt(arr2[i] || 0, 10)
            if (num1 !== num2) {
                return Math.sign(num1 - num2)
            }
        }
        return 0
    }

    static nestedPropertyHelpers = {
        has: (obj, key) => {
            if (key == null) {
                return false
            }
            return key.split(".").every(k => {
                if (obj && typeof obj === "object" && obj.hasOwnProperty(k)) {
                    obj = obj[k]
                    return true
                }
                return false
            })
        },
        dive: (obj, key) => {
            if (key == null) return {}
            const keys = key.split(".")
            const targetKey = keys.pop()
            let keyContainer = obj
            for (const k of keys) {
                if (keyContainer && typeof keyContainer === "object" && keyContainer.hasOwnProperty(k)) {
                    keyContainer = keyContainer[k]
                } else {
                    throw new Error(`Object has no such nested property: ${key}`)
                }
            }
            if (keyContainer && typeof keyContainer === "object") {
                return { keyContainer, targetKey }
            }
            return {}
        },
        handle: (obj, key, handler) => {
            const { keyContainer, targetKey } = this.nestedPropertyHelpers.dive(obj, key)
            if (keyContainer && targetKey) {
                return handler(keyContainer, targetKey)
            }
        },
        get: (obj, key) => this.nestedPropertyHelpers.handle(obj, key, (obj, lastKey) => obj[lastKey]),
        set: (obj, key, val) => this.nestedPropertyHelpers.handle(obj, key, (obj, lastKey) => obj[lastKey] = val),
        push: (obj, key, item) => this.nestedPropertyHelpers.handle(obj, key, (obj, lastKey) => obj[lastKey].push(item)),
        removeIndex: (obj, key, idx) => this.nestedPropertyHelpers.handle(obj, key, (obj, lastKey) => obj[lastKey].splice(idx, 1)),
    }

    ////////////////////////////// business file operation //////////////////////////////
    static getLocalRootUrl = () => File.editor.docMenu.getLocalRootUrl() || this.getCurrentDirPath()
    static getFileProtocolUrl = (url) => new URL(url, this.fileProtocolUrlBase)

    /**
     * @param {boolean} shouldSave - Whether to save the content.
     * @param {string} contentType - The content type (e.g., 'markdown', 'html').
     * @param {boolean} skipSetContent - Whether to skip setting the content.
     * @param {any} saveContext - Contextual information for saving (optional).
     * @returns {string} - The content of the editor.
     */
    static getCurrentFileContent = (shouldSave = false, contentType, skipSetContent, saveContext) => {
        return File.sync(shouldSave, contentType, skipSetContent, saveContext)
    }

    static editCurrentFile = async (replacement, persistence = File.option.enableAutoSave) => {
        await this.fixScrollTop(async () => {
            const bak = File.presentedItemChanged
            File.presentedItemChanged = this.noop
            try {
                const filepath = this.getFilePath()
                const content = this.getCurrentFileContent()
                const replaced = replacement instanceof Function
                    ? await replacement(content)
                    : replacement
                if (replaced === content) return
                if (persistence && filepath) {
                    const ok = await this.writeFile(filepath, replaced)
                    if (!ok) return
                }
                const op = persistence ? { delayRefresh: true, skipChangeCount: true, skipStore: true } : undefined
                File.reloadContent(replaced, op)
            } catch (e) {
                console.error(e)
            } finally {
                File.presentedItemChanged = bak
            }
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
        if (!css) return
        const style = document.createElement("style");
        style.id = id;
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }
    static insertStyleFile = (id, href) => {
        const link = document.createElement("link")
        link.id = id
        link.type = "text/css"
        link.rel = "stylesheet"
        link.href = this.joinPath(href)
        document.head.appendChild(link)
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
        filename = filename || File.getFileName() || Date.now() + ".md"
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

    static getStorage = (key) => ({
        set: value => localStorage.setItem(key, JSON.stringify(value)),
        get: () => JSON.parse(localStorage.getItem(key)),
        exist: () => localStorage.getItem(key) != null,
        remove: () => localStorage.removeItem(key),
    })

    ////////////////////////////// Basic file operations //////////////////////////////
    static getDirname = () => global.dirname || global.__dirname
    static getHomeDir = () => require("os").homedir() || File.option.userPath
    static getFilePath = () => File.filePath || File.bundle?.filePath || ""
    static getMountFolder = () => File.getMountFolder() || ""
    static getCurrentDirPath = () => PATH.dirname(this.getFilePath())
    static joinPath = (...paths) => PATH.join(this.getDirname(), ...paths)
    static resolvePath = (...paths) => PATH.resolve(this.getDirname(), ...paths)
    static require = (...paths) => require(this.joinPath(...paths))
    static getUserSpaceFile = (file = "") => this.joinPath("./plugin/global/user_space", file)

    static readFiles = async files => Promise.all(files.map(file => FS.promises.readFile(file, "utf-8").catch(() => undefined)))
    static existPath = async path => FS.promises.access(path).then(() => true).catch(() => false)
    static writeFile = async (filepath, content) => {
        try {
            await FS.promises.writeFile(filepath, content)
            return true
        } catch (e) {
            const detail = e.toString()
            const confirm = i18n.t("global", "confirm")
            const message = i18n.t("global", "error.writeFileFailed")
            const op = { type: "error", title: "Typora Plugin", buttons: [confirm], message, detail }
            await this.showMessageBox(op)
        }
    }

    static readYaml = content => require("../lib/js-yaml").safeLoad(content)
    static stringifyYaml = (obj, args) => require("../lib/js-yaml").safeDump(obj, { lineWidth: -1, forceQuotes: true, styles: { "!!null": "lowercase" }, ...args })
    static readToml = content => require("../lib/smol-toml").parse(content)
    static stringifyToml = obj => require("../lib/smol-toml").stringify(obj)
    static readTomlFile = async filepath => this.readToml(await FS.promises.readFile(filepath, "utf-8"))

    static unzip = async (buffer, workDir) => {
        const jsZip = require("../lib/jszip")
        const files = []
        const zipData = await jsZip.loadAsync(buffer)
        const promises = Object.values(zipData.files).map(async file => {
            const dest = PATH.join(workDir, file.name)
            if (!dest.startsWith(PATH.resolve(workDir))) return  // Zip Slip Attack
            files.push(dest)
            if (file.dir) {
                await FS_EXTRA.ensureDir(dest)
            } else {
                await FS_EXTRA.ensureDir(PATH.dirname(dest))
                const content = await file.async("nodebuffer")
                await FS.promises.writeFile(dest, content)
            }
        })
        await Promise.all(promises)
        return files
    }

    // TODO: Uses dual counters to prevent from terminating prematurely while tasks are paused for asynchronous IO. Too complicated.
    static walkDir = async (
        {
            dir,
            onFile,
            onDir = null,
            fileFilter = (name, path, stats) => true,
            dirFilter = (name, path, stats) => true,
            fileParamsGetter = (path, file, dir, stats) => ({ path, file, dir, stats }),
            onStat = null,
            onNonFatalError = (path, err) => console.error(`Error processing path ${path}:`, err),
            onFinished = null,
            semaphore = 20,
            maxDepth = -1,
            maxStats = -1,
            strategy = "bfs", // bfs | dfs
            followSymlinks = false,
            stopOnNonFatalError = false,
            signal = null,
        }
    ) => {
        if (signal?.aborted) {
            const reason = signal.reason ?? new DOMException("Signal Aborted", "AbortError")
            return Promise.reject(reason)
        }

        semaphore = Math.max(semaphore, 1)

        const { promises: { readdir, stat, lstat } } = FS
        const { join, dirname, basename } = PATH
        const statFn = followSymlinks ? stat : lstat
        const dequeueFn = strategy === "dfs" ? "pop" : "shift"
        const needCheckStats = maxStats > 0
        const noNeedCheckDepth = maxDepth < 0

        let fatalError
        let aborted = false
        let statsCount = 0
        let runningTasks = 0  // The number of currently executing tasks, limited by the `semaphore`
        let pendingPaths = 0  // The number of discovered paths that are not yet processed
        const taskQueue = []
        const { promise: drainPromise, resolve: resolveDrain, reject: rejectDrain } = Promise.withResolvers()

        if (signal) {
            const onAbort = () => rejectAndStop(signal.reason ?? new DOMException("Signal Aborted", "AbortError"))
            signal.addEventListener("abort", onAbort, { once: true })
            drainPromise.finally(() => signal.removeEventListener("abort", onAbort))
        }
        if (onFinished) {
            drainPromise.finally(() => onFinished(fatalError))
        }
        const rejectAndStop = (err) => {
            aborted = true
            taskQueue.length = 0
            fatalError = err
            rejectDrain(err)
        }
        const checkDrain = () => {
            if (runningTasks === 0 && pendingPaths === 0 && !aborted) {
                resolveDrain()
            }
        }
        const runNextTask = () => {
            if (aborted) return
            while (taskQueue.length > 0 && runningTasks < semaphore) {
                const task = taskQueue[dequeueFn]()
                runningTasks++
                task().finally(() => {
                    runningTasks--
                    runNextTask()
                    checkDrain()
                })
            }
        }
        const scheduleTask = (fn) => {
            if (!aborted) {
                taskQueue.push(fn)
                runNextTask()
            }
        }
        const processPath = async (currentPath, parentDir, fileName, depth) => {
            try {
                const stats = await statFn(currentPath)
                if (aborted) return

                if (needCheckStats) {
                    statsCount++
                    if (statsCount > maxStats) {
                        rejectAndStop(new DOMException("Stats Count Exceeded", "QuotaExceededError"))
                        return
                    }
                }
                onStat?.(stats)
                if (stats.isDirectory()) {
                    if (dirFilter(fileName, currentPath, stats) && (noNeedCheckDepth || depth < maxDepth)) {
                        const shouldProcessChildren = !(onDir && await onDir(fileName, currentPath, stats) === false)
                        if (shouldProcessChildren) {
                            const files = await readdir(currentPath)
                            pendingPaths += files.length
                            for (const file of files) {
                                const newPath = join(currentPath, file)
                                scheduleTask(() => processPath(newPath, currentPath, file, depth + 1))
                            }
                        }
                    }
                } else if (stats.isFile() || (!followSymlinks && stats.isSymbolicLink())) {
                    if (fileFilter(fileName, currentPath, stats)) {
                        const params = await fileParamsGetter(currentPath, fileName, parentDir, stats)
                        if (!aborted) await onFile(params)
                    }
                }
            } catch (err) {
                onNonFatalError(currentPath, err)
                if (depth === 0 || stopOnNonFatalError) rejectAndStop(err)
            } finally {
                // currentPath is fully processed (regardless of success, failure, or filtering)
                pendingPaths--
            }
        }

        pendingPaths = 1
        scheduleTask(() => processPath(dir, dirname(dir), basename(dir), 0))
        return drainPromise
    }

    ////////////////////////////// Business Operations //////////////////////////////
    static exitTypora = () => JSBridge.invoke("window.close")
    static restartTypora = () => {
        this.openFolder(this.getMountFolder())
        setTimeout(this.exitTypora, 50)
    }

    static showInFinder = file => JSBridge.showInFinder(file)

    static isDiscardableUntitled = () => File.changeCounter?.isDiscardableUntitled()

    static openUrl = url => (File.editor.tryOpenUrl_ ?? File.editor.tryOpenUrl)(url, 1)

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
        const op = { type, title, message, detail, buttons, defaultId, cancelId, normalizeAccessKeys, checkboxLabel }
        return JSBridge.invoke("dialog.showMessageBox", op)
    }

    static getMarkdownIt = this.once(() => require("../lib/markdown-it").markdownit({ html: true, linkify: true, typographer: true }))
    static parseMarkdownBlock = (content, options = {}) => this.getMarkdownIt().parse(content, options)
    static parseMarkdownInline = (content, options = {}) => this.getMarkdownIt().parseInline(content, options)

    static fetch = async (url, { proxy = "", timeout = 3 * 60 * 1000, ...args } = {}) => {
        let signal, agent
        if (timeout) {
            signal = AbortSignal.timeout(timeout)
        }
        if (proxy) {
            const { HttpsProxyAgent } = require("../lib/https-proxy-agent")
            agent = new HttpsProxyAgent(proxy)
        }
        const nodeFetch = require("../lib/node-fetch")
        return nodeFetch.fetch(url, { agent, signal, ...args })
    }

    static splitFrontMatter = content => {
        const result = { yamlObject: null, remainContent: content, yamlLineCount: 0 }
        content = content.trimLeft()
        if (!/^---\r?\n/.test(content)) {
            return result
        }
        const endDelimiterMatch = /\n---\r?\n/.exec(content)
        if (!endDelimiterMatch) {
            return result
        }
        const yamlContent = content.slice(4, endDelimiterMatch.index)
        result.remainContent = content.slice(endDelimiterMatch.index + endDelimiterMatch[0].length)
        result.yamlLineCount = (yamlContent.match(/\n/g) || []).length + 3
        try {
            result.yamlObject = this.readYaml(yamlContent)
        } catch (e) {
            console.error(e)
        }
        return result
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
        return fence?.getValue()
    }

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
        const root = { depth: 0, cid: "n0", text: this.getFileName(), parent: null, children: [] }
        const stack = [root]
        const toc = useBuiltin
            ? File.editor.library.outline.getHeaderMatrix(true)
                .map(([depth, text, cid]) => ({ depth, text, cid, children: [] }))
            : (File.editor.nodeMap.toc.headers ?? [])
                .filter(node => Boolean(node?.attributes))
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
            node.parent = parent
            parent.children.push(node)
            stack.push(node)
        })
        return root
    }

    ////////////////////////////// DOM Operations //////////////////////////////
    static removeElement = ele => ele?.parentElement?.removeChild(ele)
    static removeElementByID = id => this.removeElement(document.getElementById(id))

    static isShow = ele => !ele.classList.contains("plugin-common-hidden");
    static isHidden = ele => ele.classList.contains("plugin-common-hidden");
    static hide = ele => ele.classList.add("plugin-common-hidden");
    static show = ele => ele.classList.remove("plugin-common-hidden");
    static toggleInvisible = (ele, hide) => ele.classList.toggle("plugin-common-hidden", hide)

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

    static markdownInlineStyleToHTML = (content, dir = this.getLocalRootUrl()) => {
        return content
            .replace(/(?<!\\)`(.+?)(?<!\\)`/gs, `<code>$1</code>`)
            .replace(/(?<!\\)[*_]{2}(.+?)(?<!\\)[*_]{2}/gs, `<strong>$1</strong>`)
            .replace(/(?<![*\\])\*(?![\\*])(.+?)(?<![*\\])\*(?![\\*])/gs, `<em>$1</em>`)
            .replace(/(?<!\\)~~(.+?)(?<!\\)~~/gs, "<del>$1</del>")
            .replace(/(?<![\\!])\[(.+?)\]\((.+?)\)/gs, `<a href="$2">$1</a>`)
            .replace(/(?<!\\)!\[(.+?)\]\((.+?)\)/gs, (_, alt, src) => {
                if (!this.isNetworkImage(src) && !this.isSpecialImage(src)) {
                    src = PATH.resolve(dir, src)
                }
                return `<img alt="${alt}" src="${src}">`
            })
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

    static moveCursor = $target => File.editor.selection.jumpIntoElemEnd($target)

    static scroll = ($target, height = -1, moveCursor = false, showHiddenElement = true) => {
        if (!$target) return
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
        if (Array.isArray(elements) || elements instanceof NodeList) {
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
        range = range ?? File.editor.selection.getRangy()
        if (range) {
            const selection = window.getSelection()
            const markElem = File.editor.getMarkElem(selection.anchorNode)
            return File.editor.findNodeByElem(markElem)
        }
    }

    static getRangy = () => {
        const range = File.editor.selection.getRangy()
        if (range) {
            const selection = window.getSelection()
            const markElem = File.editor.getMarkElem(selection.anchorNode)
            const node = File.editor.findNodeByElem(markElem)
            const bookmark = range.getBookmark(markElem[0])
            return { range, markElem, node, bookmark }
        }
    }

    static getRangyText = () => {
        const { node, bookmark } = this.getRangy();
        const ele = File.editor.findElemById(node.cid);
        return ele.rawText().substring(bookmark.start, bookmark.end);
    }

    static resizeElement = (
        {
            targetEle,
            resizeEle,
            resizeWidth = true,
            resizeHeight = true,
            onMouseDown = null,
            onMouseMove = null,
            onMouseUp = null,
        }
    ) => {
        let startX, startY, startWidth, startHeight
        targetEle.addEventListener("mousedown", ev => {
            const { width, height } = document.defaultView.getComputedStyle(resizeEle)
            startX = ev.clientX
            startY = ev.clientY
            startWidth = parseFloat(width)
            startHeight = parseFloat(height)
            onMouseDown?.(startX, startY, startWidth, startHeight)
            document.addEventListener("mousemove", mousemove)
            document.addEventListener("mouseup", mouseup)
            ev.stopPropagation()
            ev.preventDefault()
        }, true)

        function mousemove(e) {
            requestAnimationFrame(() => {
                let deltaX = e.clientX - startX
                let deltaY = e.clientY - startY
                if (onMouseMove) {
                    const { deltaX: newDeltaX, deltaY: newDeltaY } = onMouseMove(deltaX, deltaY) ?? {}
                    deltaX = newDeltaX || deltaX
                    deltaY = newDeltaY || deltaY
                }
                if (resizeWidth) {
                    resizeEle.style.width = startWidth + deltaX + "px"
                }
                if (resizeHeight) {
                    resizeEle.style.height = startHeight + deltaY + "px"
                }
            })
        }

        function mouseup() {
            document.removeEventListener("mousemove", mousemove)
            document.removeEventListener("mouseup", mouseup)
            onMouseUp?.()
        }
    }

    static dragElement = (
        {
            targetEle,
            moveEle,
            onCheck = null,
            onMouseDown = null,
            onMouseMove = null,
            onMouseUp = null,
        }
    ) => {
        targetEle.addEventListener("mousedown", ev => {
            if (onCheck && !onCheck(ev)) return

            ev.stopPropagation()
            const { left, top } = moveEle.getBoundingClientRect()
            const shiftX = ev.clientX - left
            const shiftY = ev.clientY - top
            onMouseDown?.()

            const _onMouseMove = ev => {
                ev.stopPropagation()
                ev.preventDefault()
                requestAnimationFrame(() => {
                    onMouseMove?.()
                    moveEle.style.left = ev.clientX - shiftX + "px"
                    moveEle.style.top = ev.clientY - shiftY + "px"
                })
            }

            const _onMouseUp = ev => {
                onMouseUp?.()
                ev.stopPropagation()
                ev.preventDefault()
                document.removeEventListener("mousemove", _onMouseMove)
                moveEle.onmouseup = null
                document.removeEventListener("mouseup", _onMouseUp)
            }

            document.addEventListener("mouseup", _onMouseUp)
            document.addEventListener("mousemove", _onMouseMove)
        })
        targetEle.ondragstart = () => false
    }

    static scrollActiveItem = (list, activeSelector, isNext) => {
        if (list.childElementCount === 0) return
        const origin = list.querySelector(activeSelector)
        const active = isNext
            ? origin?.nextElementSibling ?? list.firstElementChild
            : origin?.previousElementSibling ?? list.lastElementChild
        origin?.classList.toggle("active")
        active.classList.toggle("active")
        active.scrollIntoView({ block: "nearest" })
    }

    static stopCallError = Symbol("stop_calling") // For the decorate method; return this to stop executing the native function.
    static decorate = (objGetter, attr, beforeFn, afterFn, modifyResult = false, modifyArgs = false) => {
        const createDecorator = (originalFn, before, after) => {
            const decoratedFn = function (...args) {
                let executionArgs = args
                if (before) {
                    const beforeFnResult = before.call(this, ...args)
                    if (beforeFnResult === utils.stopCallError) return
                    if (modifyArgs) executionArgs = beforeFnResult
                }
                const result = originalFn.apply(this, executionArgs)
                if (after) {
                    const afterFnResult = after.call(this, result, ...executionArgs)
                    if (modifyResult) return afterFnResult
                }
                return result
            }
            return Object.defineProperties(decoratedFn, {
                name: { value: originalFn.name, configurable: true },
                length: { value: originalFn.length, configurable: true },
            })
        }

        const endTime = 10000 + Date.now()
        const timer = setInterval(() => {
            if (Date.now() > endTime) {
                console.error("decorate timeout!", objGetter, attr, beforeFn, afterFn, modifyResult)
                clearInterval(timer)
                return
            }
            const obj = objGetter()
            if (obj?.[attr]) {
                clearInterval(timer)
                obj[attr] = createDecorator(obj[attr], beforeFn, afterFn)
            }
        }, 50)
    }

    static pollUntil = (until, after, interval = 50, timeout = 10000, runWhenTimeout = true) => {
        let run = false
        const endTime = timeout + Date.now()
        const timer = setInterval(() => {
            if (Date.now() > endTime) {
                run = runWhenTimeout
                if (!run) {
                    clearInterval(timer)
                    return
                }
            }
            if (until() || run) {
                clearInterval(timer)
                after?.()
            }
        }, interval)
    }
}

module.exports = Object.assign(utils, utils.mixins)
