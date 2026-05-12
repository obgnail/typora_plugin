class EditorWidthSliderPlugin extends BasePlugin {
  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  process = async () => {
    await this._setWidth(this.config.WIDTH_RATIO)
  }

  _getWidth = () => {
    return parseInt(this.utils.entities.eWrite.offsetWidth * 100 / this.utils.entities.eContent.offsetWidth)
  }

  _setWidth = async (width, temp = true) => {
    const s = this.utils.entities.eWrite.style
    if (width < 0) {
      s.removeProperty("max-width")
    } else {
      s.setProperty("max-width", `${width}%`, "important")
    }
    this.config.WIDTH_RATIO = width
    if (!temp) {
      await this.utils.settings.save(this.fixedName, this.config)
    }
  }

  setWidth = async () => {
    const { response, data } = await this.utils.formDialog.modal({
      title: this.pluginName,
      schema: ({ Group, Controls }) => [
        Group(
          Controls.Range("width").Label(this.i18n.t("$label.WIDTH_RATIO")).Min(30).Max(100),
          Controls.Switch("tmpAdjust").Label(this.i18n.t("tmpAdjust")),
        ),
        Controls.Action("restore").Label(this.i18n.t("restore")),
      ],
      data: {
        width: this._getWidth(),
        tmpAdjust: true,
      },
      actions: {
        restore: async () => {
          await this._setWidth(-1, false)
          this.utils.formDialog.exit()
          this.utils.notification.show(this.i18n.t("success.restore"))
        },
      },
      hooks: {
        onCommit: ({ key, value }) => {
          if (key === "width") this._setWidth(value, true)
        },
      },
    })
    if (response === 1) {
      await this._setWidth(data.width, data.tmpAdjust)
    }
  }

  call = async (action, meta) => await this.setWidth()
}

module.exports = {
  plugin: EditorWidthSliderPlugin,
}
