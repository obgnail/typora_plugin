class formDialog {
    constructor(utils, i18n) {
        this.utils = utils
        this.i18n = i18n
        this.resolveFunc = null
    }

    process = async () => {
        await this.utils.styleTemplater.register("form-dialog")
        this.utils.insertElement(`
            <div class="form-dialog-cover plugin-common-hidden"></div>
            <div class="form-dialog plugin-common-hidden">
                <div class="form-dialog-header">
                    <div class="form-dialog-title"></div>
                </div>
                <div class="form-dialog-body">
                    <dialog-form class="form-dialog-content"></dialog-form>
                </div>
                <div class="form-dialog-footer">
                    <button type="button" class="form-dialog-btn form-dialog-cancel">${this.i18n.t("global", "cancel")}</button>
                    <button type="button" class="form-dialog-btn form-dialog-submit">${this.i18n.t("global", "confirm")}</button>
                </div>
            </div>
        `)

        this.entities = {
            cover: document.querySelector(".form-dialog-cover"),
            dialog: document.querySelector(".form-dialog"),
            title: document.querySelector(".form-dialog-title"),
            form: document.querySelector(".form-dialog-content"),
            submit: document.querySelector(".form-dialog .form-dialog-submit"),
            cancel: document.querySelector(".form-dialog .form-dialog-cancel"),
        }
        this.entities.form.init(this.utils, { objectFormat: "JSON" })

        this.entities.cover.addEventListener("click", () => this.onButtonClick(0))
        this.entities.cancel.addEventListener("click", () => this.onButtonClick(0))
        this.entities.submit.addEventListener("click", () => this.onButtonClick(1))
    }

    onButtonClick = (response = 1) => {
        this.hide()
        this.resolveFunc({ response, values: this.entities.form.values })
        this.resolveFunc = null
    }

    show = (title, schema, values, actions) => {
        this.entities.title.textContent = title
        this.entities.form.render(schema, values, actions)
        this.utils.show(this.entities.dialog)
        this.utils.show(this.entities.cover)
    }

    hide = () => {
        this.utils.hide(this.entities.cover)
        this.utils.hide(this.entities.dialog)
    }

    modal = (title, schema, values, actions) => new Promise(resolve => {
        this.resolveFunc = resolve
        this.show(title, schema, values, actions)
    })
}

module.exports = {
    formDialog
}
