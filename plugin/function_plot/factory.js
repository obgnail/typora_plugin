const { functionPlot, Chart } = require("./function-plot.min.js")

function safely(fn, onError) {
  try {
    return fn()
  } catch (err) {
    return onError(err)
  }
}

function getContainer(target) {
  return typeof target === "string" ? document.querySelector(target) : target
}

function replaceOptions(options, nextOptions) {
  for (const k of Object.keys(options)) {
    if (!(k in nextOptions)) delete options[k]
  }
  return Object.assign(options, nextOptions)
}

const driver = {
  get: (id) => (id ? Chart.cache[id] ?? null : null),
  mount: (options) => functionPlot(options),
  remount: (instance, nextOptions) => functionPlot(replaceOptions(instance.options, nextOptions)),
  unmount: (instance) => {
    if (typeof instance.destroy === "function") {
      instance.destroy()
    } else {
      getContainer(instance.options.target)?.querySelectorAll("svg").forEach(svg => svg.remove())
      instance.removeAllListeners()
    }
    delete Chart.cache[instance.options.id]
  },
}

function createFunctionPlot() {
  let id

  return {
    get() {
      return driver.get(id)
    },
    create(target, options, onError) {
      this.destroy()
      return safely(
        () => {
          const instance = driver.mount({ ...options, target })
          id = instance.options.id
          return this
        },
        onError ?? (() => null),
      )
    },
    update(newOptions, onError) {
      const instance = driver.get(id)
      if (!instance) return null
      const { target, id: keepId } = instance.options
      return safely(
        () => driver.remount(instance, { ...newOptions, target, id: keepId }),
        onError ?? (() => instance),
      )
    },
    destroy() {
      const instance = driver.get(id)
      if (instance) driver.unmount(instance)
      id = null
    },
  }
}

module.exports = createFunctionPlot
