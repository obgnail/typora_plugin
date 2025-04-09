class editorWidthSliderPlugin extends BasePlugin {
    process = async () => {
        this.utils.settings.autoSaveSettings(this)
        await this._setWidth();
    }

    _setWidth = async (width = this.config.WIDTH_RATIO) => {
        const { eWrite } = this.utils.entities;
        if (width < 0) {
            eWrite.style.removeProperty("max-width");
        } else {
            eWrite.style.setProperty("max-width", `${width}%`, "important");
        }
    }

    setWidth = async () => {
        const labelWidth = this.i18n.t("widthProportion")
        const labelRecover = this.i18n.t("recover")

        const { eContent, eWrite } = this.utils.entities
        const value = parseInt(eWrite.offsetWidth * 100 / eContent.offsetWidth)
        const oninput = ev => this._setWidth(ev.target.value)

        const components = [
            { label: labelWidth, type: "range", min: 30, max: 100, step: 1, value, oninput },
            { label: "", type: "checkbox", list: [{ label: labelRecover, value: "recover" }] },
        ]
        const op = { title: this.pluginName, components }
        const { response, submit: [width, [checkbox]] } = await this.utils.dialog.modalAsync(op)
        if (response === 1) {
            this.config.WIDTH_RATIO = checkbox === "recover" ? -1 : width
        }
        await this._setWidth()
    }

    call = async (action, meta) => await this.setWidth()
}

module.exports = {
    plugin: editorWidthSliderPlugin,
}
