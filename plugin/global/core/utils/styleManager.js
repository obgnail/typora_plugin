class StyleManager {
  constructor(utils) {
    this.utils = utils
  }

  _getStyleText = async (name, args) => {
    const files = ["user_styles", "styles"].map(dir => this.utils.joinPluginPath("./plugin/global", dir, name + ".css"))
    const [userStyles, defaultStyles] = await this.utils.readFiles(files)
    const data = (userStyles || defaultStyles)?.trim()
    if (data == null) {
      console.error(`Not such style file: ${name}`)
      return
    }
    if (data === "") {
      console.warn(`Empty style file: ${name}`)
      return
    }
    try {
      return data.replace(/\${(.+?)}/g, (_, $arg) => $arg.split(".").reduce((acc, prop) => acc[prop], args))
    } catch (e) {
      console.error(`Replace style file ${name} args error: ${e}`)
    }
  }

  register = async (name, args) => {
    const css = await this._getStyleText(name, args)
    if (css) this.utils.insertStyle(name, css)
  }

  reset = async (name, args) => {
    const css = await this._getStyleText(name, args)
    this.utils.replaceStyle(name, css)
  }

  process = async () => Promise.all(["common", "customize"].map(f => this.register(f)))
}

module.exports = StyleManager
