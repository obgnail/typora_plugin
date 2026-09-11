const {
  copyFullPath,
  changeHeaders,
  unwrapOutermostBlock,
  formatText,
  trailingWhiteSpace,
  extractRange,
  reformatTable,
  insertMermaid,
  imageBase64,
  editFenceLang,
} = require("./providers.js")

const isDynamic = tool => Object.hasOwn(tool, "resolveContext") || Object.hasOwn(tool, "resolveActionState")

class EasyModifyPlugin extends BasePlugin {
  ctx = { utils: this.utils, i18n: this.i18n, config: this.config }
  tools = [
    copyFullPath(this.ctx, ({ title, i18nDepth }) => `${title} ${i18nDepth}`),
    unwrapOutermostBlock(this.ctx),
    changeHeaders(this.ctx),
    formatText(this.ctx),
    insertMermaid(this.ctx),
    imageBase64(this.ctx),
    editFenceLang(this.ctx),
    trailingWhiteSpace(this.ctx),
    extractRange(this.ctx),
    reformatTable(this.ctx),
  ].flat(1)
  staticActions = this.tools.filter(tool => !isDynamic(tool)).map(tool => ({
    act_value: tool.action,
    act_hotkey: this.config[tool.configKey],
    act_name: this.i18n.t(`$label.${tool.configKey}`),
    act_hint: tool.getHint?.() ?? "",
  }))

  hotkey = () => this.tools.map(tool => ({
    hotkey: this.config[tool.configKey],
    callback: isDynamic(tool) ? () => this.utils.callPluginDynamicAction(this.fixedName, tool.action) : () => this.call(tool.action),
  }))

  getDynamicActions = (anchorNode, meta) => {
    const cache = new Map()
    const closest = (selector) => {
      if (!anchorNode) return null
      if (!cache.has(selector)) {
        cache.set(selector, anchorNode.closest(selector))
      }
      return cache.get(selector)
    }
    Object.assign(meta, { range: window.getSelection().getRangeAt(0) }, ...this.tools.map(tool => tool.resolveContext?.(closest)))

    return this.tools.filter(tool => isDynamic(tool)).map(tool => ({
      act_value: tool.action,
      act_hotkey: this.config[tool.configKey],
      act_name: this.i18n.t(`$label.${tool.configKey}`),
      ...(tool.resolveActionState?.(meta) ?? {}),
    }))
  }

  call = async (action, meta = {}) => {
    const tool = this.tools.find(t => t.action === action)
    if (!tool) return
    if (await tool.execute(meta) !== false) {
      this.utils.notification.show(this.i18n.t("success"))
    }
  }
}

module.exports = {
  plugin: EasyModifyPlugin,
}
