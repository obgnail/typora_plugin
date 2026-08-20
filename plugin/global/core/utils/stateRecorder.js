class StateRecorder {
  recorders = new Map()  // map[name]recorder

  constructor(utils) {
    this.utils = utils

    this._collect = () => this.collect()
    this._restore = (p) => this.restore(p)
  }

  /**
   * @param {Object} options
   * @param options.name {string}: Give it a name.
   * @param options.selector {string}: Find the elements whose state you want to record using a selector.
   * @param options.stateGetter {function(Element): any}: Record the state of the target element. Element is the element found by the selector.
   * @param options.stateRestorer {function(Element, state): any}: Restore the state for the element. State is the return value of stateGetter.
   * @param options.finalFn {function}: The function to execute last.
   * @param options.delayFn {function(Function)}: The function to delay execute.
   */
  register = (options) => this.recorders.set(options.name, { ...options, collections: new Map() })
  unregister = recorderName => this.recorders.delete(recorderName)

  collect = name => {
    const filepath = this.utils.getFilePath()
    for (const [recorderName, recorder] of this.recorders.entries()) {
      if (!name || name === recorderName) {
        const collection = new Map()
        document.querySelectorAll(recorder.selector).forEach((el, idx) => {
          const state = recorder.stateGetter(el)
          if (state) collection.set(idx, state)
        })
        if (collection.size) {
          recorder.collections.set(filepath, collection)
        } else {
          recorder.collections.delete(filepath)
        }
      }
    }
  }

  restore = filepath => {
    for (const recorder of this.recorders.values()) {
      const collection = recorder.collections.get(filepath)
      if (collection?.size) {
        const task = () => {
          document.querySelectorAll(recorder.selector).forEach((el, idx) => {
            const state = collection.get(idx)
            if (state) recorder.stateRestorer(el, state)
          })
          recorder.finalFn?.()
        }
        recorder.delayFn ? recorder.delayFn(task) : task()
      }
    }
  }

  getState = (name) => this.recorders.get(name)?.collections || new Map()

  process = () => {
    const { eventHub } = this.utils
    eventHub.addEventListener(eventHub.eventType.beforeFileOpen, this._collect)
    eventHub.addEventListener(eventHub.eventType.fileContentLoaded, this._restore)
  }

  postprocess = () => {
    if (this.recorders.size !== 0) return
    const { eventHub } = this.utils
    eventHub.removeEventListener(eventHub.eventType.beforeFileOpen, this._collect)
    eventHub.removeEventListener(eventHub.eventType.fileContentLoaded, this._restore)
  }
}

module.exports = StateRecorder
