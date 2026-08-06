const utils = require("./utils")

class IPlugin {
  utils = utils

  constructor(fixedName, config, i18n) {
    this.fixedName = fixedName
    this.pluginName = config.NAME || i18n.t("pluginName")
    this.config = config
    this.i18n = i18n
  }

  /** Execute first, prepares data. If utils.PLUGIN_LOAD_ABORT is returned, plugin loading stops. */
  async prepare() {}

  /** Import styles */
  style() {}

  /** Insert HTML tags */
  html() {}

  /** Register hotkeys */
  hotkey() {}

  /** Initialize data */
  init() {}

  /** Main processing */
  process() {}

  /** Cleanup */
  postprocess() {}
}

class BasePlugin extends IPlugin {
  call(action, meta) {}
}

module.exports = BasePlugin
