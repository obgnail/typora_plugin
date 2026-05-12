class StateRecorder {
  recorders = new Map()  // map[name]recorder

  constructor(utils) {
    this.utils = utils
  }

  /**
   * @param {Object} options
   * @param {string} options.name: Give it a name.
   * @param {string} options.selector: Find the elements whose state you want to record using a selector.
   * @param {function(Element): any} options.stateGetter: Record the state of the target element. Element is the element found by the selector.
   *                                                 Return the state of the tag you want to record. The return value can be of any type.
   * @param {function(Element, state): any} options.stateRestorer: Restore the state for the element. State is the return value of stateGetter.
   * @param {function} options.finalFn: The function to execute last.
   * @param {function(Function)} options.delayFn: The function to delay execute.
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
    eventHub.addEventListener(eventHub.eventType.beforeFileOpen, () => this.collect())
    eventHub.addEventListener(eventHub.eventType.fileContentLoaded, this.restore)
  }

  postprocess = () => {
    if (this.recorders.size !== 0) return
    const { eventHub } = this.utils
    eventHub.removeEventListener(eventHub.eventType.beforeFileOpen, () => this.collect())
    eventHub.removeEventListener(eventHub.eventType.fileContentLoaded, this.restore)
  }
}

module.exports = StateRecorder
