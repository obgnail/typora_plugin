class stateRecorder {
    constructor(utils) {
        this.utils = utils;
        this.recorders = new Map(); // map[name]recorder
    }

    //   1. name(string): 取个名字
    //   2. selector(string): 通过选择器找到要你想记录状态的元素们
    //   3. stateGetter(Element) => {...}: 记录目标元素的状态。Element就是selector找到的元素，返回你想记录的标签的状态，返回值可以是任何类型
    //   4. stateRestorer(Element, state) => {}: 为元素恢复状态。state就是stateGetter的返回值
    //   5. finalFunc() => {}: 最后执行的函数
    register = (name, selector, stateGetter, stateRestorer, finalFunc) => {
        const obj = { selector, stateGetter, stateRestorer, finalFunc, collections: new Map() };
        this.recorders.set(name, obj);
    }
    unregister = recorderName => this.recorders.delete(recorderName);

    // 手动触发
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

    // 手动获取
    getState = (name, filepath) => {
        const recorder = this.recorders.get(name);
        if (!recorder) return new Map();
        const collections = recorder.collections;
        if (!collections) return new Map();
        if (!filepath || !collections.size) return collections;
        const map = collections.get(filepath);
        if (map) return map
    }

    // 手动删除
    deleteState = (name, filepath, idx) => {
        const map = this.getState(name, filepath);
        map && map.delete(idx);
    }

    // 手动设置
    setState = (name, collections) => {
        const recorder = this.recorders.get(name);
        if (recorder) {
            recorder.collections = collections;
        }
    }

    process = () => {
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.beforeFileOpen, this.collect);
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileContentLoaded, this.restore);
    }

    afterProcess = () => {
        if (this.recorders.size) return;
        this.utils.eventHub.removeEventListener(this.utils.eventHub.eventType.beforeFileOpen, this.collect);
        this.utils.eventHub.removeEventListener(this.utils.eventHub.eventType.fileContentLoaded, this.restore);
    }
}

module.exports = {
    stateRecorder
}