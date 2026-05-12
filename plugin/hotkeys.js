class HotkeysPlugin extends BasePlugin {
  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  process = () => {
    const toHotkey = setting => {
      const { hotkey, enable, closestSelector, evil, plugin: fixedName, function: funcName } = setting
      if (!hotkey || !enable) return

      let callback = evil
        ? eval(evil)
        : (fixedName && funcName)
          ? this.utils.getPluginFunction(fixedName, funcName)
          : null
      if (typeof callback !== "function") return

      const finalCallback = (closestSelector && callback)
        ? () => {
          const target = this.utils.getAnchorNode(closestSelector)?.[0]
          if (target) callback(target)
        }
        : callback
      if (hotkey !== "-") {
        return { hotkey, callback: finalCallback }
      }
    }

    if (this.config.CUSTOM_HOTKEYS.length) {
      this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
        const hotkeys = this.config.CUSTOM_HOTKEYS.map(toHotkey).filter(Boolean)
        this.utils.hotkeyHub.register(hotkeys)
      })
    }
  }

  call = async (action, meta) => {
    const hotkeys = [...this.utils.hotkeyHub.hotkeys.keys()].sort()
    await this.utils.formDialog.modal({
      title: this.i18n.t("registeredHotkey"),
      schema: ({ Controls }) => [Controls.Textarea("hotkeys").Rows(14)],
      data: { hotkeys: JSON.stringify(hotkeys, null, "  ") },
    })
  }
}

module.exports = {
  plugin: HotkeysPlugin,
}
