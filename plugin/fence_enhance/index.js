const traverseAllFences = (visitor) => {
  document.querySelectorAll("#write .md-fences[cid]").forEach(fence => {
    const cid = fence.getAttribute("cid")
    const cm = File.editor.fences.queue[cid] || File.editor.fences.addCodeBlock(cid)
    visitor({ fence, cm, cid })
  })
}

class FenceEnhancePlugin extends BasePlugin {
  buttonHelper = new ButtonHelper(this)

  style = () => ({
    bgColorOnHover: this.config.HIGHLIGHT_ON_HOVER ? `.CodeMirror-line:hover { background-color: ${this.config.HIGHLIGHT_LINE_COLOR_ON_HOVER}; }` : "",
    bgColorOnFocus: this.config.HIGHLIGHT_ON_FOCUS ? `.md-focus .CodeMirror-activeline { background-color: ${this.config.HIGHLIGHT_LINE_COLOR_ON_FOCUS}; }` : "",
  })

  process = async () => {
    this.utils.settings.autoSave(this)

    if (this.config.ENABLE_BUTTON) this.buttonHelper.process()
    if (this.config.ENABLE_HOTKEY) new HotkeyHelper(this).process()
    if (this.config.HIGHLIGHT_BY_LANGUAGE) new HighlightHelper(this).process()
    if (this.config.PRELOAD_ALL_FENCES) preloadAllFences(this)
    if (this.config.SIDE_BY_SIDE_VIEW) sideBySideView(this)
    if (this.config.ENABLE_LANGUAGE_FOLD) await foldLanguage(this)
    if (this.config.INDENTED_WRAPPED_LINE) indentWrappedLine(this)
    if (this.config.ENABLE_CODE_TITLE) codeTitle(this)
    if (this.config.VISIBLE_TABS) visibleTabs(this)
  }

  // --- Public API Proxies ---
  registerButton = (btn) => this.buttonHelper?.registerButton(btn) // { enable, action, hint, iconClassName, listener, extraFunc, initFunc }
  unregisterButton = (action) => this.buttonHelper?.unregisterButton(action)
  copyFence = (fence) => this.buttonHelper?.copyCode(fence.getAttribute("cid"), fence.querySelector(`.enhance-btn[action="copy"]`))
  indentFence = (fence) => this.buttonHelper?.indentCode(fence.getAttribute("cid"), fence.querySelector(`.enhance-btn[action="indent"]`))
  foldFence = (fence) => this.buttonHelper?.foldCode(fence.getAttribute("cid"), true, fence.querySelector(`.enhance-btn[action="fold"]`))
  expandFence = (fence) => this.buttonHelper?.expandFence(fence)

  getDynamicActions = (anchorNode, meta) => this.i18n.fillActions([
    { act_value: "toggle_state_fold", act_state: this.config.ENABLE_FOLD },
    { act_value: "toggle_state_copy", act_state: this.config.ENABLE_COPY },
    { act_value: "toggle_state_indent", act_state: this.buttonHelper?.enableIndent, act_hidden: !this.buttonHelper?.supportIndent },
    { act_value: "toggle_state_auto_hide", act_state: this.config.AUTO_HIDE },
    { act_value: "toggle_state_default_fold", act_state: this.config.DEFAULT_FOLD },
    { act_value: "add_fences_lang" },
    { act_value: "replace_fences_lang" },
    { act_value: "indent_all_fences", act_hint: this.i18n.t("$tooltip.dangerous"), act_hidden: !this.buttonHelper?.supportIndent },
  ])

  call = (action, meta) => {
    const handleAllFences = async (filterFn, handleFn) => {
      await this.utils.editCurrentFile(content => {
        const lines = content.split(/\r?\n/g)
        this.utils.parseMarkdownBlock(content)
          .filter(token => token.type === "fence")
          .filter(filterFn)
          .map(token => token.map[0])
          .forEach(idx => lines[idx] = handleFn(lines[idx].trimEnd()))
        const joiner = content.includes("\r\n") ? "\r\n" : "\n"
        return lines.join(joiner)
      })
      this.utils.notification.show(this.i18n.t("success"))
    }

    const callMap = {
      add_fences_lang: async () => {
        const { response, data: { targetLang } } = await this.utils.formDialog.modal({
          title: this.i18n.t("modal.add_fences_lang.title"),
          schema: ({ Controls }) => [Controls.Text("targetLang").Label(this.i18n.t("modal.add_fences_lang.targetLang"))],
          data: { targetLang: "javascript" },
        })
        if (response === 1 && targetLang) {
          await handleAllFences(
            token => token.info === "",
            line => line.endsWith("```") ? line + targetLang : line,
          )
        }
      },
      replace_fences_lang: async () => {
        const { response, data: { sourceLang, targetLang } } = await this.utils.formDialog.modal({
          title: this.i18n.t("modal.replace_fences_lang.title"),
          schema: ({ Group, Controls }) => [Group(
            Controls.Text("sourceLang").Label(this.i18n.t("modal.replace_fences_lang.sourceLang")),
            Controls.Text("targetLang").Label(this.i18n.t("modal.replace_fences_lang.targetLang")),
          )],
          data: { sourceLang: "js", targetLang: "javascript" },
        })
        if (response === 1 && sourceLang && targetLang) {
          const regex = new RegExp(`(?<=\`\`\`)${sourceLang}$`)
          await handleAllFences(
            token => token.info === sourceLang,
            line => line.replace(regex, targetLang),
          )
        }
      },
    }
    if (callMap[action]) {
      callMap[action]()
    } else {
      this.buttonHelper?.actionCall(action, meta)
    }
  }
}

class ButtonHelper {
  buttons = []

  constructor(plugin) {
    this.plugin = plugin
    this.utils = plugin.utils
    this.i18n = plugin.i18n
    this.supportIndent = this.config.ENABLE_INDENT && File.editor.fences?.formatContent
    this.enableIndent = this.supportIndent
  }

  get config() {
    return this.plugin.config
  }

  process = () => {
    this.registerBuiltinButtons()
    this.registerCustomButtons()
    this.handleLifecycleEvents()
    this.handleDomEvents()
  }

  registerButton = (btn) => this.buttons.push(btn)
  unregisterButton = (action) => this.buttons = this.buttons.filter(btn => btn.action !== action)

  _showIconFeedback = (btnEl, feedbackClass, originalClass) => {
    if (!btnEl) return
    const icon = btnEl.firstElementChild
    icon.className = feedbackClass
    setTimeout(() => icon.className = originalClass, this.config.HINT_DURATION)
  }

  _getFenceHeight = (cm, retainedLines) => {
    const textHeight = cm.display.cachedTextHeight || cm.defaultTextHeight()
    const height = Math.min(cm.lineCount(), retainedLines) * textHeight
    return height + "px"
  }

  copyCode = async (cid, btnEl = null) => {
    let content = this.utils.getFenceContentByCid(cid)
    if (this.config.TRIM_WHITESPACE_ON_COPY) {
      content = content.trim()
    }
    if (this.config.COPY_AS_MARKDOWN) {
      const fence = this.utils.entities.querySelectorInWrite(`.md-fences[cid="${cid}"]`)
      const lang = fence ? fence.getAttribute("lang") : ""
      content = `\`\`\`${lang}\n${content}\n\`\`\``
    }
    if (this.config.LINE_BREAKS_ON_COPY !== "preserve") {
      const [regex, replacer] = this.config.LINE_BREAKS_ON_COPY === "lf" ? [/\r\n/g, "\n"] : [/\r?\n/g, "\r\n"]
      content = content.replace(regex, replacer)
    }
    await navigator.clipboard.writeText(content)
    if (btnEl) this._showIconFeedback(btnEl, "fa fa-check", "fa fa-clipboard")
  }

  indentCode = (cid, btnEl = null) => {
    const fence = this.utils.entities.querySelectorInWrite(`.md-fences[cid="${cid}"]`)
    if (!fence) return
    const lang = fence.getAttribute("lang")
    if (this.config.EXCLUDE_LANGUAGE_ON_INDENT.includes(lang)) return
    File.editor.refocus(cid)
    File.editor.fences.formatContent()
    if (btnEl) this._showIconFeedback(btnEl, "fa fa-check", "fa fa-indent")
  }

  foldCode = (cid, isManual = true, btnEl = null) => {
    const cm = File.editor.fences.queue[cid]
    if (!cm) return
    const scroller = cm.display.scroller
    if (!scroller) return
    const fence = cm.display.wrapper.parentElement
    if (!fence) return
    const isDiagram = fence.classList.contains("md-fences-advanced")
    if (isDiagram) return  // Diagram cannot be folded

    const btn = btnEl || fence.querySelector(`.enhance-btn[action="fold"]`)
    if (!btn) return

    const folded = btn.classList.contains("folded")
    const retainedLines = isManual ? this.config.MANUAL_FOLD_LINES : this.config.AUTO_FOLD_LINES
    cm.setSize(null, folded ? "100%" : this._getFenceHeight(cm, retainedLines))
    scroller.style.overflowY = folded ? "" : this.config.FOLD_OVERFLOW
    btn.classList.toggle("folded", !folded)
    btn.firstElementChild.className = folded ? "fa fa-minus" : "fa fa-plus"
    if (this.config.AUTO_HIDE) {
      btn.closest(".fence-enhance").style.visibility = folded ? "hidden" : ""
    }
  }

  expandFence = (fence) => {
    const btn = fence.querySelector(`.enhance-btn.folded[action="fold"]`)
    if (btn) this.foldCode(fence.getAttribute("cid"), true, btn)
  }

  defaultFold = (cid, btn) => {
    const { DEFAULT_FOLD, DEFAULT_FOLD_THRESHOLD: threshold } = this.config
    if (!DEFAULT_FOLD) return
    const cm = File.editor.fences.queue[cid]
    if (!cm) return
    const shouldFold = threshold <= 0 || threshold < cm.lineCount()
    if (shouldFold) this.foldCode(cid, false, btn)
  }

  actionCall = (action, meta) => {
    const callMap = {
      toggle_state_fold: () => {
        this.config.ENABLE_FOLD = !this.config.ENABLE_FOLD
        if (!this.config.ENABLE_FOLD) {
          document.querySelectorAll(`.fence-enhance > .enhance-btn.folded[action="fold"]`).forEach(btn => {
            const cid = btn.closest(".md-fences").getAttribute("cid")
            this.foldCode(cid, false, btn)
          })
        }
        const display = this.config.ENABLE_FOLD ? "block" : "none"
        document.querySelectorAll(`.fence-enhance > .enhance-btn[action="fold"]`).forEach(el => el.style.display = display)
      },
      toggle_state_copy: () => {
        this.config.ENABLE_COPY = !this.config.ENABLE_COPY
        const display = this.config.ENABLE_COPY ? "block" : "none"
        document.querySelectorAll(`.fence-enhance > [action="copy"]`).forEach(el => el.style.display = display)
      },
      toggle_state_indent: () => {
        this.enableIndent = !this.enableIndent
        const display = this.enableIndent ? "block" : "none"
        document.querySelectorAll(`.fence-enhance > [action="indent"]`).forEach(el => el.style.display = display)
      },
      toggle_state_default_fold: () => {
        this.config.DEFAULT_FOLD = !this.config.DEFAULT_FOLD
        const selector = this.config.DEFAULT_FOLD ? `.enhance-btn:not(.folded)[action="fold"]` : `.enhance-btn.folded[action="fold"]`
        document.querySelectorAll(selector).forEach(btn => {
          const cid = btn.closest(".md-fences").getAttribute("cid")
          if (this.config.DEFAULT_FOLD) {
            this.defaultFold(cid, btn)
          } else {
            this.foldCode(cid, false, btn)
          }
        })
      },
      toggle_state_auto_hide: () => {
        this.config.AUTO_HIDE = !this.config.AUTO_HIDE
        const visibility = this.config.AUTO_HIDE ? "hidden" : ""
        document.querySelectorAll(".fence-enhance").forEach(el => {
          // Code blocks in collapsed state cannot be hidden.
          el.style.visibility = el.querySelector(`.enhance-btn.folded[action="fold"]`) ? "" : visibility
        })
      },
      indent_all_fences: async () => {
        const { response } = await this.utils.showMessageBox({
          type: "warning",
          title: this.i18n.t("btn.hint.indent"),
          message: this.i18n.t("modal.indent_all_fences.limitedFunctionality"),
        })
        if (response === 0) {
          traverseAllFences(({ cid }) => this.indentCode(cid))
        }
      },
    }
    callMap[action]?.()
  }

  registerBuiltinButtons = () => {
    const builtinButtons = [
      {
        action: "copy",
        hint: this.i18n.t("btn.hint.copy"),
        iconClassName: "fa fa-clipboard",
        enable: this.config.ENABLE_COPY,
        listener: ({ cid, btn }) => this.copyCode(cid, btn),
        extraFunc: null,
        initFunc: null,
      },
      {
        action: "indent",
        hint: this.i18n.t("btn.hint.indent"),
        iconClassName: "fa fa-indent",
        enable: this.enableIndent,
        listener: ({ cid, btn }) => this.indentCode(cid, btn),
        extraFunc: null,
        initFunc: null,
      },
      {
        action: "fold",
        hint: this.i18n.t("btn.hint.fold"),
        iconClassName: "fa fa-minus",
        enable: this.config.ENABLE_FOLD,
        listener: ({ ev, cid, btn }) => this.foldCode(cid, ev.isTrusted, btn),
        extraFunc: ({ btn, cid }) => this.defaultFold(cid, btn),
        initFunc: () => {
          const { EXPAND_ON_FOCUS, FOLD_ON_BLUR, DEFAULT_FOLD } = this.config
          if (!DEFAULT_FOLD) return
          if (!EXPAND_ON_FOCUS && !FOLD_ON_BLUR) return

          let lastFocusFenceCid = ""
          const fold = (cid) => {
            if (FOLD_ON_BLUR && cid) {
              const btn = this.utils.entities.querySelectorInWrite(`.md-fences[cid="${cid}"] .enhance-btn:not(.folded)[action="fold"]`)
              if (btn) this.defaultFold(cid, btn)
            }
            lastFocusFenceCid = ""
          }
          const expand = (fence) => {
            const cid = fence.getAttribute("cid")
            if (EXPAND_ON_FOCUS && lastFocusFenceCid !== cid) {
              const btn = fence.querySelector(`.enhance-btn.folded[action="fold"]`)
              if (btn) this.defaultFold(cid, btn)
              if (lastFocusFenceCid) fold(lastFocusFenceCid)
            }
            lastFocusFenceCid = cid
          }
          $("#write").on("cursorChange", (ev, cursorContext) => {
            if (!cursorContext) return
            const focusing = cursorContext.style.block.includes("fences")
            if (focusing) {
              expand(cursorContext.cursor.commonAncestorContainer.closest(".md-fences"))
            } else {
              fold(lastFocusFenceCid)
            }
          })
        },
      },
    ]
    builtinButtons.forEach(btn => this.registerButton(btn))
  }

  registerCustomButtons = () => {
    const evalFn = fnString => {
      const fn = this.utils.safeEval(fnString)
      if (typeof fn !== "function") {
        throw Error(`custom button param is not function: ${fnString}`)
      }
      return fn
    }
    const getParams = ({ cm, ...reset }) => ({ cont: cm.getValue(), plu: this.plugin, cm, ...reset })
    const normalize = ({ DISABLE, ICON, HINT, ON_INIT, ON_CLICK, ON_RENDER }) => {
      if (DISABLE || !ON_CLICK) return
      try {
        const callbackFn = evalFn(ON_CLICK)
        return {
          action: this.utils.randomString(),
          hint: HINT,
          iconClassName: ICON,
          enable: !DISABLE,
          listener: (args) => callbackFn(getParams(args)),
          extraFunc: ON_RENDER ? evalFn(ON_RENDER) : null,
          initFunc: ON_INIT ? evalFn(ON_INIT) : null,
        }
      } catch (e) {
        console.error("Register custom button error:", e)
      }
    }
    this.config.CUSTOM_BUTTONS.map(normalize).filter(Boolean).forEach(this.registerButton)
  }

  handleLifecycleEvents = () => {
    this.utils.exportHelper.register(this.plugin.fixedName, () => {
      this.utils.entities.querySelectorAllInWrite(`.enhance-btn.folded[action="fold"]`).forEach(btn => {
        const cid = btn.closest(".md-fences").getAttribute("cid")
        this.foldCode(cid, true, btn)
      })
    })
    const eventHub = this.utils.eventHub
    eventHub.addEventListener(eventHub.eventType.allPluginsHadInjected, () => {
      this.buttons.filter(btn => btn.enable && typeof btn.initFunc === "function").forEach(btn => btn.initFunc(this.plugin))
    })
    eventHub.addEventListener(eventHub.eventType.afterAddCodeBlock, (cid, cm) => {
      if (this.buttons.length === 0) return
      const fence = cm?.display.wrapper.parentElement ?? this.utils.entities.querySelectorInWrite(`.md-fences[cid="${cid}"]`)
      if (!fence) return
      let enhance = fence.querySelector(".fence-enhance")
      if (enhance) return

      enhance = document.createElement("div")
      enhance.setAttribute("class", "fence-enhance")
      if (this.config.AUTO_HIDE) {
        enhance.style.visibility = "hidden"
      }
      const buttons = this.buttons.map(btn => {
        const btnEl = document.createElement("div")
        btnEl.classList.add("enhance-btn")
        btnEl.setAttribute("action", btn.action)
        if (!this.config.HIDE_BUTTON_HINT && btn.hint) {
          btnEl.setAttribute("ty-hint", btn.hint)
        }
        if (!btn.enable) btnEl.style.display = "none"
        const i = document.createElement("i")
        i.className = btn.iconClassName
        btnEl.appendChild(i)
        return btnEl
      })
      enhance.append(...buttons)
      fence.append(enhance)
      this.buttons.forEach((b, idx) => b.extraFunc?.({ btn: buttons[idx], cid, fence, enhance }))
    })
  }

  handleDomEvents = () => {
    this.utils.entities.eWrite.addEventListener("click", ev => {
      const btn = ev.target.closest(".fence-enhance .enhance-btn")
      if (!btn) return
      const action = btn.getAttribute("action")
      if (!action) return
      const fence = btn.closest(".md-fences")
      if (!fence) return
      const cid = fence.getAttribute("cid")
      if (!cid) return
      const cm = File.editor.fences.queue[cid]
      if (!cm) return

      ev.preventDefault()
      ev.stopPropagation()
      document.activeElement.blur()
      this.buttons.find(b => b.action === action)?.listener({ ev, btn, fence, cid, cm })
    })
    const config = this.config
    this.utils.entities.$eWrite.on("mouseenter", ".md-fences", function () {
      if (config.AUTO_HIDE) {
        this.querySelector(".fence-enhance").style.visibility = ""
      }
    }).on("mouseleave", ".md-fences", function () {
      if (config.AUTO_HIDE && !this.querySelector(`.enhance-btn.folded[action="fold"]`)) {
        this.querySelector(".fence-enhance").style.visibility = "hidden"
      }
    })
  }
}

// Doc: https://codemirror.net/5/doc/manual.html
class HotkeyHelper {
  constructor(plugin) {
    this.utils = plugin.utils
    this.config = plugin.config
  }

  process = () => {
    const hotkeys = this.getHotkeys()
    this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, (cid, cm) => cm?.addKeyMap(hotkeys))
  }

  getHotkeys = () => {
    const hotkeys = {}
    const keyMap = {
      SWAP_PREVIOUS_LINE: () => this.swapLine(true),
      SWAP_NEXT_LINE: () => this.swapLine(false),
      COPY_PREVIOUS_LINE: () => this.copyLine(true),
      COPY_NEXT_LINE: () => this.copyLine(false),
      INSERT_LINE_NEXT: () => this.newlineAndIndent(false),
      INSERT_LINE_PREVIOUS: () => this.newlineAndIndent(true),
    }
    for (const [hotkey, callback] of Object.entries(keyMap)) {
      const hk = this.config[hotkey]
      if (hk) {
        hotkeys[hk] = callback
      }
    }
    this.config.CUSTOM_HOTKEYS.forEach(({ DISABLE, HOTKEY, CALLBACK }) => {
      if (DISABLE || !HOTKEY || !CALLBACK) return
      const fn = this.utils.safeEval(CALLBACK)
      if (typeof fn !== "function") {
        throw Error(`CALLBACK param is not function: ${CALLBACK}`)
      }
      hotkeys[HOTKEY] = () => fn(this.getFocusedFence())
    })
    return hotkeys
  }

  getFocusedFence = () => {
    const pre = this.utils.getAnchorNode(".md-fences[cid]")?.[0]
    if (!pre) return
    const activeLine = pre.querySelector(".CodeMirror-activeline")
    if (!activeLine) return
    const cid = pre.getAttribute("cid")
    const cm = File.editor.fences.queue[cid]
    if (!cm) return

    const separator = cm.lineSeparator() || "\\n"
    const cursor = cm.getCursor()
    const lineNum = cursor.line + 1
    const lastNum = cm.lastLine() + 1
    return { pre, cid, cm, cursor, lineNum, lastNum, separator }
  }

  keydown = keyObj => {
    const dict = { shiftKey: false, ctrlKey: false, altKey: false, ...keyObj }
    document.activeElement.dispatchEvent(new KeyboardEvent("keydown", dict))
  }
  // Do not use `cm.execCommand("goLineUp")`: it checks if the Shift key is pressed.
  goLineUp = () => this.keydown({ key: "ArrowUp", keyCode: 38, code: "ArrowUp", which: 38 })
  goLineDown = () => this.keydown({ key: "ArrowDown", keyCode: 40, code: "ArrowDown", which: 40 })

  swapLine = (previous = true) => {
    const { cm, separator, lineNum, lastNum } = this.getFocusedFence()
    if (!cm || (previous && lineNum === 1) || (!previous && lineNum === lastNum)) return

    const lines = previous
      ? [{ line: lineNum - 2, ch: 0 }, { line: lineNum - 1, ch: null }]
      : [{ line: lineNum - 1, ch: 0 }, { line: lineNum, ch: null }]
    const lineCount = cm.getRange(...lines)
    const lineList = lineCount.split(separator)
    if (lines.length !== 2) return

    const newContent = [lineList[1], separator, lineList[0]].join("")
    cm.replaceRange(newContent, ...lines)
    if (previous) this.goLineUp()
  }

  copyLine = (previous = true) => {
    const { cm, separator, lineNum } = this.getFocusedFence()
    if (!cm) return
    const lineContent = cm.getLine(lineNum - 1)
    const newContent = separator + lineContent
    cm.replaceRange(newContent, { line: lineNum - 1, ch: null })
  }

  newlineAndIndent = (previous = true) => {
    const { cm } = this.getFocusedFence()
    if (!cm) return
    if (previous) this.goLineUp()
    cm.execCommand("goLineEnd")
    cm.execCommand("newlineAndIndent")
  }
}

// See: https://vuepress.vuejs.org/guide/markdown.html#line-highlighting
class HighlightHelper {
  className = "plugin-fence-enhance-highlight"
  highlightSym = Symbol("highlight")
  highlightHandlesSym = Symbol("highlight_handles")

  constructor(plugin) {
    this.utils = plugin.utils
    this.pattern = new RegExp(plugin.config.HIGHLIGHT_PATTERN)
    this.numberingBase = (plugin.config.NUMBERING_BASE === "0-based") ? 0 : 1
  }

  _setHighlight = (cm) => {
    const line = cm?.options?.mode?.[this.highlightSym]?.line
    if (!line) return

    const lastLine = cm.lastLine()
    const lineNumbers = line
      .split(",")
      .filter(Boolean)
      .flatMap(part => {
        if (!part.includes("-")) return [Number(part)]
        const [start, end] = part.split("-").map(Number)
        return Array.from({ length: end - start + 1 }, (_, i) => start + i)
      })
      .map(n => n - this.numberingBase)
      .filter(n => n >= 0 && n <= lastLine)

    cm[this.highlightHandlesSym] = [...new Set(lineNumbers)].map(lineNo => {
      const handle = cm.getLineHandle(lineNo)
      cm.addLineClass(handle, "background", this.className)
      return handle
    })
  }

  _clearHighlight = cm => {
    const handles = cm[this.highlightHandlesSym]
    if (Array.isArray(handles) && handles.length > 0) {
      handles.filter(handle => handle?.parent).forEach(handle => cm.removeLineClass(handle, "background", this.className))
    }
    cm[this.highlightHandlesSym] = null
  }

  _rerender = (cm) => {
    cm?.operation(() => {
      this._clearHighlight(cm)
      this._setHighlight(cm)
    })
  }

  process = () => {
    let context
    const handleLineChange = (cm, changeObj) => {
      const isLineCountChanged = changeObj.text.length !== changeObj.removed.length
      if (isLineCountChanged) this._rerender(cm)
    }
    const extract = mode => {
      const match = mode.match(this.pattern)
      return match ? { origin: mode, ...match.groups } : { origin: mode }
    }
    const before = (mode, ...rest) => {
      if (mode == null) return [mode, ...rest]
      context = extract(mode)
      const newMode = context.lang || mode
      return [newMode, ...rest]
    }
    const after = (mode) => {
      if (mode == null) return mode
      if (typeof mode !== "object") {
        // `monkeyPatch` makes `frame.js` happy
        // `File.editor.diagrams.updateDiagram` uses `isType(cm.options.mode, "mermaid")` to determine the type
        // `isType` compares whether `mode.attributes.type === "mermaid"`
        const monkeyPatch = { attributes: { type: mode } }
        mode = { name: mode, ...monkeyPatch }
      }
      mode[this.highlightSym] = context
      context = null
      return mode
    }
    this.utils.decorator.decorate(() => window, "getCodeMirrorMode", { before, after, modifyResult: true, modifyArgs: true })
    this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, (cid, cm) => {
      this._rerender(cm)
      cm.off("change", handleLineChange)
      cm.on("change", handleLineChange)
    })
    this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterUpdateCodeBlockLang, ([node] = []) => {
      const cid = node?.cid
      if (!cid) return
      const cm = File.editor.fences.queue[cid]
      if (cm) this._rerender(cm)
    })
  }
}

const preloadAllFences = ({ utils }) => {
  const preload = () => traverseAllFences(utils.noop)
  utils.eventHub.once(utils.eventHub.eventType.fileOpened, () => setTimeout(preload, 3000))
  utils.eventHub.addEventListener(utils.eventHub.eventType.fileContentLoaded, preload)
}

// Credit: https://github.com/gruvw/typora-side-by-side
const sideBySideView = ({ utils }) => {
  utils.insertStyleFile("fence-enhance-side-by-side", "./plugin/fence_enhance/resource/side-by-side-view.css")
}

// Doc: https://codemirror.net/5/demo/visibletabs.html
const visibleTabs = ({ utils }) => {
  utils.insertStyleFile("fence-enhance-visible-tabs", "./plugin/fence_enhance/resource/visible-tabs.css")
}

// Doc: https://codemirror.net/5/demo/indentwrap.html
const indentWrappedLine = ({ utils }) => {
  let charWidth = 0
  const codeIndentSize = File.option.codeIndentSize
  const callback = (cm, line, elt) => {
    const off = CodeMirror.countColumn(line.text, null, cm.getOption("tabSize")) * charWidth
    elt.style.textIndent = "-" + off + "px"
    elt.style.paddingLeft = (codeIndentSize + off) + "px"
  }
  utils.eventHub.addEventListener(utils.eventHub.eventType.afterAddCodeBlock, (cid, cm) => {
    if (cm) {
      charWidth = charWidth || cm.defaultCharWidth()
      cm.on("renderLine", callback)
      setTimeout(() => cm?.refresh(), 100)
    }
  })
}

// Doc: https://codemirror.net/5/demo/folding.html
const foldLanguage = async ({ utils }) => {
  const requireModules = async () => {
    const foldPath = "./plugin/fence_enhance/resource/fold/"
    utils.insertStyleFile("fence-enhance-fold", foldPath + "foldgutter.css")
    const modules = (await utils.Package.FsExtra.readdir(utils.joinPluginPath(foldPath))).filter(f => f.endsWith("-fold.js"))
    const vendors = ["foldcode.js", "foldgutter.js", ...modules]
    vendors.map(f => utils.joinPluginPath(foldPath, f)).forEach(require)
    console.debug(`[ CodeMirror folding module ] [ ${modules.length} ]:`, modules)
  }

  const handle = () => {
    const gutter = "CodeMirror-foldgutter"
    utils.eventHub.addEventListener(utils.eventHub.eventType.afterAddCodeBlock, (cid, cm) => {
      if (!cm) return
      if (!cm.options.gutters.includes(gutter)) {
        cm.setOption("gutters", [...cm.options.gutters, gutter])
      }
      if (!cm.options.foldGutter) {
        cm.setOption("foldGutter", true)
      }
    })
  }

  await requireModules()
  handle()
}

// See: https://vuepress.vuejs.org/guide/markdown.html#code-title
const codeTitle = ({ utils, config }) => {
  const CLASS = "code-title-bar"
  const REGEX = /.+?\s+title="([^"]+)"/
  const LANG_REGEX = /\s+title="[^"]+"/

  const rerender = (fence) => {
    const lang = fence.getAttribute("lang")
    const title = lang?.match(REGEX)?.[1]
    if (!title) {
      fence.classList.remove(CLASS)
      return
    }
    fence.classList.add(CLASS)
    const langOnly = lang.replace(LANG_REGEX, "").trim()
    const formatted = config.CODE_TITLE_FORMAT
      .replace("{title}", title)
      .replace("{lang}", langOnly)
    fence.style.setProperty("--code-title", `"${formatted.replace(/"/g, '\\"')}"`)
  }

  utils.insertStyle("plugin-fence-enhance-code-title",
    `.md-fences.${CLASS}::before {
      content: var(--code-title);
      display: block;
      padding: 6px 14px;
      border-bottom: 1px solid var(--code-title-border, #d0d0d0);
      margin-bottom: 6px;
      color: var(--code-title-text, currentColor);
      user-select: none;
    }`)

  utils.eventHub.addEventListener(utils.eventHub.eventType.afterAddCodeBlock, (cid, cm) => {
    const fence = cm?.display.wrapper.parentElement
    if (fence) rerender(fence)
  })
  utils.eventHub.addEventListener(utils.eventHub.eventType.afterUpdateCodeBlockLang, ([node] = []) => {
    const cm = node?.cid && File.editor.fences.queue[node.cid]
    const fence = cm?.display.wrapper.parentElement
    if (fence) rerender(fence)
  })
}

module.exports = {
  plugin: FenceEnhancePlugin,
}
