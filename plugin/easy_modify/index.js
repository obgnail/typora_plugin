const {
  buildCopyFullPathTool,
  buildChangeHeadersTool,
  buildUnwrapOutermostBlockTool,
  buildFormatTextTool,
  buildTrailingWhiteSpaceTool,
  buildExtractRangeTool,
  buildReformatTableTool,
  buildInsertMermaidTool,
  buildImageBase64Tool,
} = require("./providers.js")

class EasyModifyPlugin extends BasePlugin {
  ctx = { utils: this.utils, i18n: this.i18n, config: this.config }
  tools = [
    buildCopyFullPathTool(this.ctx, ({ title, i18nDepth }) => `${title} ${i18nDepth}`),
    buildChangeHeadersTool(this.ctx, true),
    buildChangeHeadersTool(this.ctx, false),
    buildUnwrapOutermostBlockTool(this.ctx),
    buildFormatTextTool(this.ctx, { action: "convert_crlf_to_lf", key: "HOTKEY_CONVERT_CRLF_TO_LF", regex: /\r\n/g, replacement: "\n" }),
    buildFormatTextTool(this.ctx, { action: "convert_lf_to_crlf", key: "HOTKEY_CONVERT_LF_TO_CRLF", regex: /\r?\n/g, replacement: "\r\n" }),
    buildFormatTextTool(this.ctx, {
      action: "filter_invisible_characters",
      key: "HOTKEY_FILTER_INVISIBLE_CHARACTERS",
      regex: /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g,
      replacement: "",
    }),
    buildTrailingWhiteSpaceTool(this.ctx),
    buildInsertMermaidTool(this.ctx, "mindmap"),
    buildInsertMermaidTool(this.ctx, "graph"),
    buildImageBase64Tool(this.ctx, "single"),
    buildImageBase64Tool(this.ctx, "all"),
    buildExtractRangeTool(this.ctx),
    buildReformatTableTool(this.ctx),
  ]
  staticActions = this.tools.filter(t => t.isStatic).map(tool => ({
    act_value: tool.action,
    act_hotkey: this.config[tool.configKey],
    act_name: this.i18n.t(`$label.${tool.configKey}`),
    act_hint: tool.getHint?.() ?? "",
  }))

  hotkey = () => this.tools.map(tool => ({
    hotkey: this.config[tool.configKey],
    callback: () => this[tool.useDynamicCall ? "dynamicCall" : "call"](tool.action),
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
    Object.assign(meta, { range: window.getSelection().getRangeAt(0) }, ...this.tools.map(tool => tool.getMeta?.(closest)))

    return this.tools.filter(tool => tool.isDynamic).map(tool => {
      const props = tool.getDynamicProps?.(meta) ?? {}
      return {
        act_value: tool.action,
        act_hotkey: this.config[tool.configKey],
        act_name: this.i18n.t(`$label.${tool.configKey}`),
        act_hint: props.hint || "",
        act_disabled: props.disabled,
      }
    })
  }

  dynamicCall = action => this.utils.updateAndCallPluginDynamicAction(this.fixedName, action)

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
