/**
 * Dynamically register and unregister element state recorders (only effective when the window_tab plugin is enabled).
 * Functionality: Record the state of elements before the user switches tabs, and restore the state of the elements when the user switches back.
 * For example: plugin `collapse_paragraph`: It is necessary to record which chapters are folded before the user switches tabs,
 *              and then automatically fold the chapters back after the user switches back to maintain consistency.
 */
class StateRecorder {
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
                    if (state) collection.set(idx, state)
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
                    if (state) recorder.stateRestorer(ele, state);
                })
                recorder.finalFunc?.()
            }
        }
    }

    getState = (name) => this.recorders.get(name)?.collections || new Map()

    process = () => {
        const { eventHub } = this.utils
        eventHub.addEventListener(eventHub.eventType.beforeFileOpen, this.collect)
        eventHub.addEventListener(eventHub.eventType.fileContentLoaded, this.restore)
    }

    afterProcess = () => {
        if (this.recorders.size !== 0) return
        const { eventHub } = this.utils
        eventHub.removeEventListener(eventHub.eventType.beforeFileOpen, this.collect)
        eventHub.removeEventListener(eventHub.eventType.fileContentLoaded, this.restore)
    }
}

module.exports = StateRecorder
