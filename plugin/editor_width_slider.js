class EditorWidthSliderPlugin extends BasePlugin {
    process = async () => {
        await this._setWidth(this.config.WIDTH_RATIO)
    }

    _getWidth = () => {
        return parseInt(this.utils.entities.eWrite.offsetWidth * 100 / this.utils.entities.eContent.offsetWidth)
    }

    _setWidth = async (width, tmp = true) => {
        const { eWrite } = this.utils.entities
        if (width < 0) {
            eWrite.style.removeProperty("max-width")
        } else {
            eWrite.style.setProperty("max-width", `${width}%`, "important")
        }
        this.config.WIDTH_RATIO = width
        if (!tmp) {
            await this.utils.settings.saveSettings(this.fixedName, this.config)
        }
    }

    setWidth = async () => {
        const field = {
            width: { key: "width", type: "range", min: 30, max: 100, label: this.i18n.t("$label.WIDTH_RATIO") },
            tmpAdjust: { key: "tmpAdjust", type: "switch", label: this.i18n.t("tmpAdjust") },
            restore: { key: "restore", type: "action", label: this.i18n.t("restore") },
        }
        const op = {
            title: this.pluginName,
            schema: [
                { fields: [field.width, field.tmpAdjust] },
                { fields: [field.restore] },
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
                }
            },
            hooks: {
                onCommit: ({ key, value }) => {
                    if (key === "width") this._setWidth(value, true)
                }
            },
        }
        const { response, data } = await this.utils.formDialog.modal(op)
        if (response === 1) {
            await this._setWidth(data.width, data.tmpAdjust)
        }
    }

    call = async (action, meta) => await this.setWidth()
}

module.exports = {
    plugin: EditorWidthSliderPlugin
}
