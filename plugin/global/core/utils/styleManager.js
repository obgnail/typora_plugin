class StyleManager {
  constructor(utils) {
    this.utils = utils
  }

  _readCSS = filepath => this.utils.Package.FsExtra.readFile(filepath, "utf-8").then(e => e?.trim()).catch(() => undefined)

  _getPluginStyle = async (name, args) => {
    const filepath = this.utils.joinPluginPath("./plugin", name, "index.css")
    const data = await this._readCSS(filepath)
    if (data == null) {
      console.error(`Not such style file: ${filepath}`)
      return
    }
    if (data === "") {
      console.warn(`Empty style file: ${filepath}`)
      return
    }
    try {
      return data.replace(/\${(.+?)}/g, (_, $arg) => $arg.split(".").reduce((acc, prop) => acc[prop], args))
    } catch (e) {
      console.error(`Replace style file ${name} args error: ${e}`)
    }
  }

  register = async (name, args) => {
    const css = await this._getPluginStyle(name, args)
    if (css) this.utils.insertStyle(name, css)
  }

  reset = async (name, args) => {
    const css = await this._getPluginStyle(name, args)
    this.utils.replaceStyle(name, css)
  }

  process = async () => {
    this.utils.insertStyle("customize", await this._readCSS(this.utils.joinPluginPath("./plugin/global/user_styles/customize.css")))
    this.utils.insertStyle("common", `
.plugin-common-panel { position: fixed; z-index: 9999; padding: 4px; background-color: var(--bg-color); color: var(--text-color); border-top: none; border-radius: 4px; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15); }
.plugin-common-hidden { display: none !important; }
.dropdown-menu { z-index: 9998; }
.md-notification-container { z-index: 99999 !important; background: var(--bg-color); }
#md-searchpanel.searchpanel-replace-mode { z-index: 99999 !important; }`)
  }
}

module.exports = StyleManager
