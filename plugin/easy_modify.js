const buildCopyFullPathTool = ({ utils, i18n }, formatter) => ({
  action: "copy_full_path",
  configKey: "HOTKEY_COPY_FULL_PATH",
  isStatic: true,
  getMeta: closest => ({ outermostAnchor: closest("#write > [cid]") }),
  execute: async ({ outermostAnchor = utils.getAnchorNode("#write > [cid]")?.[0] }) => {
    if (!outermostAnchor) return

    const getHeaders = (startNode) => {
      const HEADINGS = ["H1", "H2", "H3", "H4", "H5", "H6"]
      const i18nHeader = i18n.array(HEADINGS, "act.copy_full_path.")
      const i18nNoHeader = i18n.t("act.copy_full_path.NoHeader")
      const titles = new Map()
      let minLevel = Infinity
      let curNode = startNode
      while (curNode && minLevel > 0) {
        const level = HEADINGS.indexOf(curNode.tagName)
        if (level !== -1 && level < minLevel) {
          titles.set(level, curNode.textContent || i18nNoHeader)
          minLevel = level
        }
        curNode = curNode.previousElementSibling
      }
      const maxDepth = (titles.size === 0) ? 0 : Math.max(...titles.keys()) + 1
      return Array.from({ length: maxDepth }, (_, depth) => formatter({ depth, title: titles.get(depth), i18nDepth: i18nHeader[depth] }))
    }

    const filePath = utils.getFilePath() || "Untitled"
    const pathSegments = getHeaders(outermostAnchor)
    const fullPath = utils.Package.Path.join(filePath, ...pathSegments)
    await navigator.clipboard.writeText(fullPath)
  },
})

const buildChangeHeadersTool = ({ i18n }, isIncrease) => ({
  action: isIncrease ? "increase_headers_level" : "decrease_headers_level",
  configKey: isIncrease ? "HOTKEY_INCREASE_HEADERS_LEVEL" : "HOTKEY_DECREASE_HEADERS_LEVEL",
  isStatic: true,
  getHint: () => i18n.t("actHint.defaultDoc"),
  execute: () => {
    const getTargetHeaders = () => {
      const allHeaders = File.editor.nodeMap.toc.headers
      const range = window.getSelection().getRangeAt(0)
      if (range.collapsed) return allHeaders
      const headersInRange = range.cloneContents().querySelectorAll(`[mdtype="heading"]`)
      const cidSet = new Set([...headersInRange].map(e => e.getAttribute("cid")))
      return allHeaders.filter(header => cidSet.has(header.cid))
    }
    getTargetHeaders().forEach(node => {
      const nodeType = node.get("type")
      if (isIncrease && nodeType === "paragraph") {
        File.editor.stylize.changeBlock("header6", node)
        return
      }
      if (nodeType === "heading") {
        const newLevel = +node.get("depth") + (isIncrease ? -1 : 1)
        if (newLevel === 7) {
          File.editor.stylize.changeBlock("paragraph", node)
        } else if (0 < newLevel && newLevel <= 6) {
          File.editor.stylize.changeBlock(`header${newLevel}`, node)
        }
      }
    })
  },
})

const buildUnwrapOutermostBlockTool = () => ({
  action: "unwrap_outermost_block",
  configKey: "HOTKEY_UNWRAP_OUTERMOST_BLOCK",
  isStatic: true,
  useDynamicCall: true,
  getMeta: closest => ({ innermostAnchor: closest("#write [cid]"), outermostAnchor: closest("#write > [cid]") }),
  execute: ({ outermostAnchor, innermostAnchor }) => {
    if (!outermostAnchor || !innermostAnchor) return
    if (innermostAnchor.matches(".md-fences, .md-math-block")) return

    const createUnwrapFn = (type) => () => {
      const closestCid = innermostAnchor.getAttribute("cid")
      const closestNode = File.editor.nodeMap.allNodes.get(closestCid)
      if (!closestNode) return

      const originFn = closestNode.getClosetBlock
      closestNode.getClosetBlock = () => closestNode.getTopBlock().getFirstChild()
      try {
        File.editor.stylize.toggleIndent(type)
      } finally {
        closestNode.getClosetBlock = originFn
      }
    }

    const handlers = {
      "[mdtype='heading']": () => File.editor.stylize.changeBlock(`header${outermostAnchor.tagName[1]}`, undefined, true),
      "[mdtype='blockquote']": createUnwrapFn("blockquote"),
      ".task-list-item": createUnwrapFn("tasklist"),
      "ol[mdtype='list']": createUnwrapFn("ol"),
      "ul[mdtype='list']": createUnwrapFn("ul"),
    }
    const type = Object.keys(handlers).find(selector => outermostAnchor.matches(selector))
    if (type) handlers[type]()
  },
})

const buildFormatTextTool = ({ utils, i18n }, act) => ({
  action: act.action,
  configKey: act.key,
  isStatic: true,
  getHint: () => i18n.t("actHint.notRecommended"),
  execute: async () => utils.editCurrentFile(content => content.replace(act.regex, act.replacement)),
})

const buildTrailingWhiteSpaceTool = ({ utils, i18n }) => {
  let showWarnDialog = true
  return {
    action: "trailing_white_space",
    configKey: "HOTKEY_TRAILING_WHITE_SPACE",
    isStatic: true,
    getHint: () => i18n.t("actHint.notRecommended"),
    execute: async () => {
      if (showWarnDialog) {
        const { response, checkboxChecked } = await utils.showMessageBox({
          type: "warning",
          message: i18n.t("act.trailing_white_space.hint"),
          checkboxLabel: i18n.t("disableReminder"),
        })
        if (response === 1) return false
        if (checkboxChecked) showWarnDialog = false
      }

      const replaceFlag = 2
      const tailSpace = "  "
      utils.entities.querySelectorAllInWrite("p[cid]").forEach(el => {
        const elText = el.textContent
        if (!elText.trim() || elText.endsWith(tailSpace)) return
        const span = el.querySelector(":scope > span:last-child")
        if (!span) return

        const spanText = span.textContent
        if (!spanText.trim() || spanText.endsWith(tailSpace)) return

        span.append(tailSpace)
        const cid = el.getAttribute("cid")
        File.editor.undo.addSnap(cid, replaceFlag)
        File.editor.brush.brushNode(cid)
      })
    },
  }
}

const buildExtractRangeTool = ({ utils, i18n }) => ({
  action: "extract_range_to_new_file",
  configKey: "HOTKEY_EXTRACT_RANGE_TO_NEW_FILE",
  isDynamic: true,
  useDynamicCall: true,
  getDynamicProps: meta => {
    const disabled = !meta.range || meta.range.collapsed
    return { disabled, hint: disabled ? i18n.t("act.extract_range_to_new_file.noSelection") : "" }
  },
  execute: async ({ range }) => {
    if (!range || range.collapsed) return false

    const { response, data } = await utils.formDialog.modal({
      title: i18n.t("$label.HOTKEY_EXTRACT_RANGE_TO_NEW_FILE"),
      schema: ({ Group, Controls }) => Group(
        Controls.Text("filename").Label(i18n.t("act.extract_range_to_new_file.filename")).Placeholder(i18n.t("act.extract_range_to_new_file.filenameHint")),
        Controls.Switch("autoOpen").Label(i18n.t("act.extract_range_to_new_file.autoOpenFile")),
      ),
      data: { filename: "", autoOpen: true },
    })
    if (response === 0) return false

    let { filename, autoOpen } = data
    if (filename && !filename.toLowerCase().endsWith(".md")) {
      filename += ".md"
    }
    filename = await utils.newFilePath(filename)

    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    const content = File.editor.UserOp.getSpeechText()
    const ok = await utils.writeFile(filename, content)
    if (!ok) return false

    File.editor.UserOp.backspaceHandler(File.editor, null, "Delete")
    if (autoOpen) utils.openFile(filename)
  },
})

const buildInsertMermaidTool = ({ utils, i18n }, type) => ({
  action: type === "mindmap" ? "insert_mermaid_mindmap" : "insert_mermaid_graph",
  configKey: type === "mindmap" ? "HOTKEY_INSERT_MERMAID_MINDMAP" : "HOTKEY_INSERT_MERMAID_GRAPH",
  isDynamic: true,
  useDynamicCall: true,
  getMeta: closest => ({ insertAnchor: closest(`#write > p[mdtype="paragraph"]`) }),
  getDynamicProps: meta => {
    const disabled = !meta.insertAnchor || !!meta.insertAnchor.querySelector("p > span")
    return { disabled, hint: disabled ? i18n.t("act.extract_range_to_new_file.positionEmptyLine") : "" }
  },
  execute: ({ insertAnchor }) => {
    if (!insertAnchor) return

    const errorMsg = i18n.t("act.insert_mermaid_mindmap.incompatible")
    const clean = title => `("${title.replace(/"/g, "#quot;")}")`
    const comment = t => (t === "mindmap" && !window.mermaidAPI.defaultConfig.mindmap) ? `%%${errorMsg}\n` : ""

    let tokens
    const tree = utils.getTocTree()
    if (type === "mindmap") {
      const getTokens = (node, ret, indent) => {
        ret.push("\t".repeat(indent), clean(node.text), "\n")
        node.children.forEach(child => getTokens(child, ret, indent + 1))
        return ret
      }
      tokens = getTokens(tree, ["mindmap", "\n"], 1)
    } else {
      let num = 0
      const getName = node => {
        if (node._shortName) return node._shortName
        node._shortName = "T" + ++num
        return node._shortName + clean(node.text)
      }
      const getTokens = (node, ret) => {
        node.children.forEach(child => ret.push(getName(node), "-->", getName(child), "\n"))
        node.children.forEach(child => getTokens(child, ret))
        return ret
      }
      tokens = getTokens(tree, ["graph LR", "\n"])
    }

    const mermaid = ["```mermaid", "\n", comment(type), ...tokens, "```"].join("")
    utils.insertText(insertAnchor, mermaid)
  },
})

const buildImageBase64Tool = ({ utils, i18n }, scope) => {
  const _convertSingleImage = async (imageEl) => {
    if (!imageEl) return
    let src = File.editor.imgEdit.getSrcFromDom(imageEl, true)
    if (!src) return

    if (utils.isSpecialImage(src)) return
    if (utils.isNetworkImage(src)) {
      try {
        const { ok, filepath } = await utils.downloadImage(src)
        if (!ok) {
          return utils.notification.show(i18n.t("error.timeout"))
        }
        src = filepath
      } catch (e) {
        return utils.notification.show(e.toString(), "error")
      }
    }

    const bin = await utils.Package.FsExtra.readFile(src)
    const base64 = utils.convertImageToBase64(bin)
    const { range } = utils.getRangy()
    const bookmark = range.getBookmark(imageEl)
    range.moveToBookmark(bookmark)
    range.select()
    File.editor.imgEdit.insertImageFromURL(base64)
  }

  return {
    action: scope === "single" ? "convert_image_to_base64" : "convert_all_images_to_base64",
    configKey: scope === "single" ? "HOTKEY_CONVERT_IMAGE_TO_BASE64" : "HOTKEY_CONVERT_ALL_IMAGES_TO_BASE64",
    isDynamic: true,
    useDynamicCall: true,
    getMeta: closest => scope === "single" ? { imageAnchor: closest("#write .md-image.md-img-loaded") } : {},
    getDynamicProps: meta => scope === "single" ? { disabled: !meta.imageAnchor } : {},
    execute: async ({ imageAnchor }) => {
      if (scope === "single") {
        return _convertSingleImage(imageAnchor)
      } else {
        const images = [...document.querySelectorAll("#write .md-image.md-img-loaded")]
        return Promise.all(images.map(async img => _convertSingleImage(img)))
      }
    },
  }
}

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
