class HotkeyHub {
  isPaused = false
  hotkeys = new Map()

  normalize = hotkeyString => {
    const modifier = ["ctrl", "shift", "alt"]
    const keyList = hotkeyString.toLowerCase().split("+").map(k => k.trim())
    const modifierKeys = modifier.filter(k => keyList.includes(k))
    const mainKey = keyList.find(k => !modifier.includes(k)) || (hotkeyString.includes("++") ? "+" : " ")
    return [...modifierKeys, mainKey].join("+")
  }

  registerSingle = (hotkey, callback) => {
    if (typeof hotkey === "string" && hotkey.length) {
      this.hotkeys.set(this.normalize(hotkey), callback)
    } else if (Array.isArray(hotkey)) {
      for (const hk of hotkey) {
        this.registerSingle(hk, callback)
      }
    }
  }

  register = hotkeys => {
    if (!hotkeys) return

    for (const item of hotkeys) {
      if (Array.isArray(item)) {
        this.register(item)
      } else {
        this.registerSingle(item.hotkey, item.callback)
      }
    }
  }

  unregister = hotkey => this.hotkeys.delete(this.normalize(hotkey))

  pause = () => this.isPaused = true
  resume = () => this.isPaused = false

  capitalize = (hotkeyString) => hotkeyString.toLowerCase().split("+").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("+")

  process = () => {
    window.addEventListener("keydown", ev => {
      if (ev.key === undefined || this.isPaused) return
      let combo = ""
      if (ev.ctrlKey || ev.metaKey) combo += "ctrl+"
      if (ev.shiftKey) combo += "shift+"
      if (ev.altKey) combo += "alt+"
      combo += ev.key.toLowerCase()
      const callback = this.hotkeys.get(combo)
      if (callback) {
        ev.preventDefault()
        ev.stopPropagation()
        callback()
      }
    }, true)
  }
}

module.exports = HotkeyHub
