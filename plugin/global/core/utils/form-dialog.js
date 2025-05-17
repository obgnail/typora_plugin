class formDialog {
    constructor(utils, i18n) {
        this.utils = utils
        this.i18n = i18n
        this.resolver = null
        this.listener = null
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

        this.entities.cover.addEventListener("click", () => this._onVisibilityChange(0))
        this.entities.cancel.addEventListener("click", () => this._onVisibilityChange(0))
        this.entities.submit.addEventListener("click", () => this._onVisibilityChange(1))
        this.entities.form.addEventListener("CRUD", ev => {
            if (this.listener) {
                const { key, value, type } = ev.detail
                this.listener({ key, value, type, form: this.entities.form })
            }
        })
    }

    _onVisibilityChange = (state = 1) => {
        this.hide()
        this.resolver({ response: state, values: this.entities.form.values })
        this.resolver = null
        this.listener = null
    }

    show = (title, schema, data, action) => {
        this.entities.title.textContent = title
        this.entities.form.render(schema, data, action)
        this.utils.show(this.entities.dialog)
        this.utils.show(this.entities.cover)
    }

    hide = () => {
        this.utils.hide(this.entities.cover)
        this.utils.hide(this.entities.dialog)
    }

    modal = ({ title, schema, data, action, listener }) => new Promise(resolve => {
        this.resolver = resolve
        this.listener = listener
        this.show(title, schema, data, action)
    })
}

module.exports = {
    formDialog
}
