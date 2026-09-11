const copyFullPath = ({ utils, i18n }, formatter) => [{
  action: "copy_full_path",
  configKey: "HOTKEY_COPY_FULL_PATH",
  resolveContext: closest => ({ outermostAnchor: closest("#write > [cid]") }),
  execute: async ({ outermostAnchor }) => {
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
}]

const changeHeaders = ({ i18n }) => {
  const getHint = () => i18n.t("actHint.defaultDoc")
  const getTargetHeaders = () => {
    const allHeaders = File.editor.nodeMap.toc.headers
    const range = window.getSelection().getRangeAt(0)
    if (range.collapsed) return allHeaders
    const headersInRange = range.cloneContents().querySelectorAll(`[mdtype="heading"]`)
    const cidSet = new Set([...headersInRange].map(e => e.getAttribute("cid")))
    return allHeaders.filter(header => cidSet.has(header.cid))
  }
  const exec_ = (isIncrease) => {
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
  }

  return [
    { action: "increase_headers_level", configKey: "HOTKEY_INCREASE_HEADERS_LEVEL", getHint, execute: () => exec_(true) },
    { action: "decrease_headers_level", configKey: "HOTKEY_DECREASE_HEADERS_LEVEL", getHint, execute: () => exec_(false) },
  ]
}

const unwrapOutermostBlock = () => [{
  action: "unwrap_outermost_block",
  configKey: "HOTKEY_UNWRAP_OUTERMOST_BLOCK",
  resolveContext: closest => ({ innermostAnchor: closest("#write [cid]"), outermostAnchor: closest("#write > [cid]") }),
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
}]

const formatText = ({ utils, i18n }) => {
  const getHint = () => i18n.t("actHint.notRecommended")
  const invisible = /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g
  const edit = async (regex, replacement) => utils.editCurrentFile(content => content.replace(regex, replacement))
  return [
    { action: "convert_crlf_to_lf", configKey: "HOTKEY_CONVERT_CRLF_TO_LF", getHint, execute: async () => edit(/\r\n/g, "\n") },
    { action: "convert_lf_to_crlf", configKey: "HOTKEY_CONVERT_LF_TO_CRLF", getHint, execute: async () => edit(/\r?\n/g, "\r\n") },
    { action: "filter_invisible_characters", configKey: "HOTKEY_FILTER_INVISIBLE_CHARACTERS", getHint, execute: async () => edit(invisible, "") },
  ]
}

const reformatTable = () => [{
  action: "reformat_all_tables",
  configKey: "HOTKEY_REFORMAT_ALL_TABLES",
  execute: () => {
    $("[mdtype='table']").each(function () {
      File.editor.tableEdit.reformatTable($(this))
    })
  },
}]

const trailingWhiteSpace = ({ utils, i18n }) => {
  let showWarnDialog = true
  return [{
    action: "trailing_white_space",
    configKey: "HOTKEY_TRAILING_WHITE_SPACE",
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
  }]
}

const extractRange = ({ utils, i18n }) => [{
  action: "extract_range_to_new_file",
  configKey: "HOTKEY_EXTRACT_RANGE_TO_NEW_FILE",
  resolveActionState: ({ range }) => {
    const act_disabled = !range || range.collapsed
    const act_hint = act_disabled ? i18n.t("act.extract_range_to_new_file.noSelection") : ""
    return { act_disabled, act_hint }
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
}]

const insertMermaid = ({ utils, i18n }) => {
  const resolveContext = closest => ({ insertAnchor: closest(`#write > p[mdtype="paragraph"]`) })
  const resolveActionState = ({ insertAnchor }) => {
    const act_disabled = !insertAnchor || !!insertAnchor.querySelector("p > span")
    const act_hint = act_disabled ? i18n.t("act.extract_range_to_new_file.positionEmptyLine") : ""
    return { act_disabled, act_hint }
  }

  const clean = title => `("${title.replace(/"/g, "#quot;")}")`
  const comment = type => (type === "mindmap" && !window.mermaidAPI.defaultConfig.mindmap) ? `%%${i18n.t("act.insert_mermaid_mindmap.incompatible")}\n` : ""
  const insert = (type, getTokens) => ({ insertAnchor }) => {
    if (!insertAnchor) return
    const tokens = getTokens(utils.getTocTree())
    const mermaid = ["```mermaid", "\n", comment(type), ...tokens, "```"].join("")
    utils.insertText(insertAnchor, mermaid)
  }

  return [
    {
      action: "insert_mermaid_mindmap",
      configKey: "HOTKEY_INSERT_MERMAID_MINDMAP",
      resolveContext,
      resolveActionState,
      execute: insert("mindmap", tree => {
        const getTokens = (node, ret, indent) => {
          ret.push("\t".repeat(indent), clean(node.text), "\n")
          node.children.forEach(child => getTokens(child, ret, indent + 1))
          return ret
        }
        return getTokens(tree, ["mindmap", "\n"], 1)
      }),
    },
    {
      action: "insert_mermaid_graph",
      configKey: "HOTKEY_INSERT_MERMAID_GRAPH",
      resolveContext,
      resolveActionState,
      execute: insert("graph", tree => {
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
        return getTokens(tree, ["graph LR", "\n"])
      }),
    },
  ]
}

const imageBase64 = ({ utils, i18n }) => {
  const LOADED_IMAGE = "#write .md-image.md-img-loaded"
  const convertImage = async (imageEl) => {
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

  return [
    {
      action: "convert_image_to_base64",
      configKey: "HOTKEY_CONVERT_IMAGE_TO_BASE64",
      resolveContext: closest => ({ imageAnchor: closest(LOADED_IMAGE) }),
      resolveActionState: ({ imageAnchor }) => ({ act_disabled: !imageAnchor }),
      execute: async ({ imageAnchor }) => convertImage(imageAnchor),
    },
    {
      action: "convert_all_images_to_base64",
      configKey: "HOTKEY_CONVERT_ALL_IMAGES_TO_BASE64",
      execute: async () => Promise.all([...document.querySelectorAll(LOADED_IMAGE)].map(async img => convertImage(img))),
    },
  ]
}

const editFenceLang = ({ utils, i18n }) => {
  const handleFences = async (filter, handler) => {
    await utils.editCurrentFile(() => {
      const blocks = []
      File.editor.nodeMap.blocks.sortedForEach(node => {
        if (node.attributes?.type === Node.TYPE.fences && filter(node)) handler(node)
        blocks.push(node)
      })
      const joiner = File.option.preferCRLF ? "\r\n" : "\n"
      return blocks.map(node => node.toMark()).join(joiner)
    })
  }

  return [
    {
      action: "add_fence_lang",
      configKey: "HOTKEY_ADD_FENCE_LANG",
      execute: async () => {
        const { response, data: { targetLang } } = await utils.formDialog.modal({
          title: i18n.t("act.add_fence_lang.title"),
          schema: ({ Controls }) => [Controls.Text("targetLang").Label(i18n.t("act.add_fence_lang.targetLang"))],
          data: { targetLang: "javascript" },
        })
        if (response === 1 && targetLang) {
          await handleFences(node => !node.attributes.lang, node => node.attributes.lang = targetLang)
        }
      },
    },
    {
      action: "replace_fence_lang",
      configKey: "HOTKEY_REPLACE_FENCE_LANG",
      execute: async () => {
        const { response, data: { sourceLang, targetLang } } = await utils.formDialog.modal({
          title: i18n.t("act.replace_fence_lang.title"),
          schema: ({ Group, Controls }) => [Group(
            Controls.Text("sourceLang").Label(i18n.t("act.replace_fence_lang.sourceLang")),
            Controls.Text("targetLang").Label(i18n.t("act.replace_fence_lang.targetLang")),
          )],
          data: { sourceLang: "js", targetLang: "javascript" },
        })
        if (response === 1 && sourceLang && targetLang) {
          await handleFences(node => node.attributes.lang === sourceLang, node => node.attributes.lang = targetLang)
        }
      },
    },
  ]
}

module.exports = {
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
}
