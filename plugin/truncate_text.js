class TruncateTextPlugin extends BasePlugin {
  className = "plugin-truncate-text"
  staticActions = this.i18n.fillActions([
    { act_name: this.i18n.t("act.hide_front", { remain: this.config.RETAIN_LENGTH }), act_value: "hide_front", act_hotkey: this.config.HIDE_FRONT_HOTKEY },
    { act_value: "show_all", act_hotkey: this.config.SHOW_ALL_HOTKEY },
    { act_value: "hide_base_view", act_hotkey: this.config.HIDE_BASE_VIEW_HOTKEY },
  ])

  hotkey = () => [
    { hotkey: this.config.HIDE_FRONT_HOTKEY, callback: () => this.call("hide_front") },
    { hotkey: this.config.SHOW_ALL_HOTKEY, callback: () => this.call("show_all") },
    { hotkey: this.config.HIDE_BASE_VIEW_HOTKEY, callback: () => this.call("hide_base_view") },
  ]

  callbackOtherPlugin = () => {
    this.utils.callPluginFunction("right_outline", "refreshPanel")
  }

  hideFront = () => {
    const children = this.utils.entities.eWrite.children
    const len = children.length
    const retainLength = this.config.RETAIN_LENGTH
    if (len <= retainLength) return
    for (let i = 0; i < len - retainLength; i++) {
      const el = children[i]
      el.classList.add(this.className)
      el.style.display = "none"
    }
  }

  showAll = () => {
    const write = this.utils.entities.eWrite
    write.getElementsByClassName(this.className).forEach(el => el.classList.remove(this.className))
    write.children.forEach(el => el.style.display = "")
  }

  hideBaseView = () => {
    const children = this.utils.entities.eWrite.children

    let start = 0, end = 0
    children.forEach((el, idx) => {
      if (this.utils.isInViewBox(el)) {
        if (!start) start = idx
        start = Math.min(start, idx)
        end = Math.max(end, idx)
      }
    })

    const halfLength = this.config.RETAIN_LENGTH / 2
    start = Math.max(start - halfLength, 0)
    end = Math.min(end + halfLength, children.length)

    children.forEach((el, idx) => {
      const hide = idx < start || idx > end
      el.classList.toggle(this.className, hide)
      el.style.display = hide ? "none" : ""
    })
  }

  rollback = () => {
    const el = this.utils.entities.querySelectorInWrite(`:scope > .${this.className}`)
    if (el) this.showAll()
  }

  call = action => {
    if (action === "hide_front") {
      this.hideFront()
    } else if (action === "show_all") {
      this.showAll()
    } else if (action === "hide_base_view") {
      this.hideBaseView()
    }
    this.callbackOtherPlugin()
  }
}

module.exports = {
  plugin: TruncateTextPlugin,
}
