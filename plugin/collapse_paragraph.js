class DOMNavigator {
  HEADERS = ["H1", "H2", "H3", "H4", "H5", "H6"]

  constructor(plugin) {
    this.plugin = plugin
  }

  getHeaderLevel = (node) => node ? this.HEADERS.indexOf(node.tagName) : -1

  getTargetHeader = (target, strictMode, forceLoose = false) => {
    if (strictMode && !forceLoose) {
      return target.closest(this.plugin.selector)
    }
    let el = target.closest("#write > [cid]")
    while (el && el.getAttribute("mdtype") !== "heading") {
      el = el.previousElementSibling
    }
    return el
  }

  traverseSiblings = (node, fn) => {
    for (let el = node.previousElementSibling; el; el = el.previousElementSibling) {
      if (fn(el)) break
    }
    for (let el = node.nextElementSibling; el; el = el.nextElementSibling) {
      if (fn(el)) break
    }
  }

  findSiblings = (node) => {
    const targetLevel = this.getHeaderLevel(node)
    const result = [node]

    this.traverseSiblings(node, (el) => {
      const level = this.getHeaderLevel(el)
      if (level !== -1 && level < targetLevel) return true
      if (level === targetLevel) result.push(el)
    })
    return result
  }

  findSubSiblings = (node) => {
    const targetLevel = this.getHeaderLevel(node)
    const result = [node]

    this.traverseSiblings(node, (el) => {
      const level = this.getHeaderLevel(el)
      if (level !== -1 && level <= targetLevel) return true
      if (level > targetLevel) result.push(el)
    })
    return result
  }

  findAllSiblings = (node) => this.plugin.utils.entities.querySelectorAllInWrite(`:scope > ${node.tagName}`)

  toggleCollapse = (node, shouldExpand) => {
    node.classList.toggle(this.plugin.className, !shouldExpand)

    const applyVisibility = (startNode, targetDisplay) => {
      const startLevel = this.getHeaderLevel(startNode)
      let current = startNode.nextElementSibling

      while (current) {
        const currentLevel = this.getHeaderLevel(current)
        const isHeader = currentLevel !== -1

        if (isHeader && currentLevel <= startLevel) break

        const isNestedCollapsed = isHeader
          && current.classList.contains(this.plugin.className)
          && targetDisplay === ""

        if (isNestedCollapsed) {
          current.style.display = ""
          current = applyVisibility(current, "none")
          continue
        }

        current.style.display = targetDisplay
        current = current.nextElementSibling
      }
      return current
    }

    applyVisibility(node, shouldExpand ? "" : "none")
  }

  expandParent = (node) => {
    let currentLevel = this.getHeaderLevel(node)
    while (node) {
      const isHeading = node.getAttribute?.("mdtype") === "heading"
      if (isHeading && node.classList.contains(this.plugin.className)) {
        const level = this.getHeaderLevel(node)
        if (level < currentLevel) {
          this.toggleCollapse(node, true)
          currentLevel = level
        }
      }
      node = node.previousElementSibling
    }
  }
}

class ActionDispatcher {
  constructor(plugin, navigator) {
    this.plugin = plugin
    this.navigator = navigator
  }

  execute = (action, target) => {
    const actionMap = {
      collapse_all: this.collapseAll,
      expand_all: this.expandAll,
      collapse_others: () => this.collapseOthers(target),
      toggle_current: () => this.applyToTargets(target, el => [el]),
      toggle_siblings: () => this.applyToTargets(target, this.navigator.findSiblings),
      toggle_all_siblings: () => this.applyToTargets(target, this.navigator.findAllSiblings),
      toggle_recursive: () => this.applyToTargets(target, this.navigator.findSubSiblings),
    }
    actionMap[action]?.()
  }

  collapseAll = () => {
    [...this.navigator.HEADERS].reverse().forEach(tag => {
      this.plugin.utils.entities.querySelectorAllInWrite(`:scope > ${tag}`).forEach(el => this.navigator.toggleCollapse(el, false))
    })
  }

  expandAll = () => {
    this.navigator.HEADERS.forEach(tag => {
      this.plugin.utils.entities.querySelectorAllInWrite(`:scope > ${tag}`).forEach(el => this.navigator.toggleCollapse(el, true))
    })
  }

  collapseOthers = (target) => {
    if (!target) return
    let currentLevel = this.navigator.getHeaderLevel(target)
    if (currentLevel === -1) return

    this.navigator.traverseSiblings(target, (el) => {
      const level = this.navigator.getHeaderLevel(el)
      if (level === -1) return false

      if (level < currentLevel) {
        this.navigator.toggleCollapse(el, true)
        currentLevel = level
      } else {
        this.navigator.toggleCollapse(el, false)
      }
    })
  }

  applyToTargets = (target, findFn) => {
    if (!target) return
    const shouldExpand = target.classList.contains(this.plugin.className)
    findFn(target).forEach(el => this.navigator.toggleCollapse(el, shouldExpand))
  }

  rollback = (startNode) => {
    if (!this.plugin.utils.entities.querySelectorInWrite(`:scope > .${this.plugin.className}`)) return

    const headersToExpand = []
    let el = startNode.closest("#write > [cid]")

    while (el) {
      const level = this.navigator.getHeaderLevel(el)
      if (level !== -1) {
        const isFirstNode = headersToExpand.length === 0
        const lastHeader = headersToExpand.at(-1)
        const isValidHigherLevel = lastHeader && lastHeader.level > level && el.classList.contains(this.plugin.className)
        if (isFirstNode || isValidHigherLevel) {
          headersToExpand.push({ el, level })
          if (level === 0) break
        }
      }
      el = el.previousElementSibling
    }

    headersToExpand.reverse().forEach(header => this.navigator.toggleCollapse(header.el, true))
  }
}

class CollapseParagraphPlugin extends BasePlugin {
  className = "plugin-collapsed-paragraph"
  selector = `#write > [mdtype="heading"]`
  navigator = new DOMNavigator(this)
  dispatcher = new ActionDispatcher(this, this.navigator)
  staticActions = this.i18n.fillActions([{ act_value: "collapse_all" }, { act_value: "expand_all" }])

  style = () => true

  process = () => {
    File.option.expandSimpleBlock = false  // This config option interferes with the plugin, disable it.
    this.utils.settings.autoSave(this)
    this.recordCollapseState(false)

    this.collapseFns = this.initCollapseFns()
    this.utils.entities.eWrite.addEventListener("click", this.onEditorClick)
    document.querySelector(".sidebar-menu").addEventListener("click", this.onSidebarClick)
  }

  initCollapseFns = () => {
    const fns = {
      COLLAPSE_SINGLE: el => [el],
      COLLAPSE_SIBLINGS: this.navigator.findSiblings,
      COLLAPSE_ALL_SIBLINGS: this.navigator.findAllSiblings,
      COLLAPSE_RECURSIVE: this.navigator.findSubSiblings,
    }
    return Object.keys(fns)
      .filter(key => this.config.MODIFIER_KEY[key])
      .map(key => ({
        filter: this.utils.modifierKey(this.config.MODIFIER_KEY[key]),
        callback: fns[key],
      }))
  }

  onEditorClick = (ev) => {
    const header = this.navigator.getTargetHeader(ev.target, this.config.STRICT_MODE)
    if (!header || ev.target.closest(".md-link")) return

    const collapseFn = this.collapseFns.find(fn => fn.filter(ev))
    if (!collapseFn) return

    document.activeElement.blur()
    const shouldExpand = header.classList.contains(this.className)
    collapseFn.callback(header).forEach(el => this.navigator.toggleCollapse(el, shouldExpand))
    this.callbackOtherPlugin()
  }

  onSidebarClick = (ev) => {
    const ref = ev.target.closest(".outline-item")?.querySelector(".outline-label")?.dataset.ref
    if (!ref) return

    const el = this.utils.entities.eWrite.querySelector(`[cid="${ref}"]`)
    if (el && el.style.display === "none") {
      this.navigator.expandParent(el)
    }
  }

  recordCollapseState = (needChange = true) => {
    if (needChange) {
      this.config.RECORD_COLLAPSE = !this.config.RECORD_COLLAPSE
    }
    if (this.config.RECORD_COLLAPSE) {
      this.utils.stateRecorder.register({
        name: this.fixedName,
        selector: this.selector,
        stateGetter: el => el.classList.contains(this.className),
        stateRestorer: el => this.navigator.toggleCollapse(el, false),
      })
    } else {
      this.utils.stateRecorder.unregister(this.fixedName)
    }
  }

  callbackOtherPlugin = () => this.utils.callPluginFunction("right_outline", "refreshPanel")

  trigger = (node, shouldExpand) => this.navigator.toggleCollapse(node, shouldExpand)
  rollback = (startNode) => this.dispatcher.rollback(startNode)

  getDynamicActions = (anchorNode, meta) => {
    const getHotkey = (key) => {
      const modifier = this.config.MODIFIER_KEY[key]
      return modifier ? `${modifier}+Click` : undefined
    }
    const target = this.navigator.getTargetHeader(anchorNode, this.config.STRICT_MODE, !this.config.STRICT_MODE_IN_CONTEXT_MENU)
    meta.target = target
    const act_disabled = !target
    return this.i18n.fillActions([
      { act_value: "collapse_others", act_disabled },
      { act_value: "toggle_current", act_disabled, act_hotkey: getHotkey("COLLAPSE_SINGLE") },
      { act_value: "toggle_recursive", act_disabled, act_hotkey: getHotkey("COLLAPSE_RECURSIVE") },
      { act_value: "toggle_siblings", act_disabled, act_hotkey: getHotkey("COLLAPSE_SIBLINGS") },
      { act_value: "toggle_all_siblings", act_disabled, act_hotkey: getHotkey("COLLAPSE_ALL_SIBLINGS") },
      { act_value: "record_collapse_state", act_state: !!this.config.RECORD_COLLAPSE },
    ])
  }

  call = (action, meta) => {
    if (action === "record_collapse_state") {
      this.recordCollapseState()
    } else {
      this.dispatcher.execute(action, meta?.target)
    }
    this.callbackOtherPlugin()
  }
}

module.exports = {
  plugin: CollapseParagraphPlugin,
}
