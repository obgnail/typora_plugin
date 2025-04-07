/**
 * Dynamically register and unregister element state recorders (only effective when the window_tab plugin is enabled).
 * Functionality: Record the state of elements before the user switches tabs, and restore the state of the elements when the user switches back.
 * For example: plugin `collapse_paragraph`: It is necessary to record which chapters are folded before the user switches tabs,
 *              and then automatically fold the chapters back after the user switches back to maintain consistency.
 */
class stateRecorder {
    constructor(utils) {
        this.utils = utils;
        this.recorders = new Map(); // map[name]recorder
    }

    /**
     * @param {string} name: Give it a name.
     * @param {string} selector: Find the elements whose state you want to record using a selector.
     * @param {function(Element): Object} stateGetter: Record the state of the target element. Element is the element found by the selector.
     *                                                 Return the state of the tag you want to record. The return value can be of any type.
     * @param {function(Element, state): Object} stateRestorer: Restore the state for the element. State is the return value of stateGetter.
     * @param {function(): Object} finalFunc: The function to execute last.
     */
    register = (name, selector, stateGetter, stateRestorer, finalFunc) => {
        const obj = { selector, stateGetter, stateRestorer, finalFunc, collections: new Map() };
        this.recorders.set(name, obj);
    }
    unregister = recorderName => this.recorders.delete(recorderName);

    // Manually triggered
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
