const isValued = t => Object.hasOwn(t, "value")

class Toolbox {
  constructor({ stylizer, tools }) {
    this.stylizer = stylizer
    this.tools = tools
  }

  get = name => this.tools[name]
  invoke = name => this.tools[name]?.invoke(this.stylizer)
  write = (name, value) => {
    const tool = this.tools[name]
    if (tool && isValued(tool)) tool.value = value
  }
  valuedToolNames = () => new Set(Object.entries(this.tools).filter(([, t]) => isValued(t)).map(([name]) => name))
  readAll = () => new Map(Object.entries(this.tools).filter(([, t]) => isValued(t)).map(([name, t]) => [name, t.value]))
}

module.exports = Toolbox
