class FormDialog {
    constructor(utils, i18n) {
        this.utils = utils
        this.i18n = i18n
        this.resolver = null
    }

    process = async () => {
        await this.utils.styleTemplater.register("plugin-form-dialog")
        this.utils.insertElement(`
            <div class="form-dialog-cover plugin-common-hidden"></div>
            <div class="form-dialog plugin-common-hidden">
                <div class="form-dialog-header">
                    <div class="form-dialog-title"></div>
                </div>
                <div class="form-dialog-body">
                    <fast-form class="form-dialog-core"></fast-form>
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
            form: document.querySelector(".form-dialog-core"),
            submit: document.querySelector(".form-dialog-submit"),
            cancel: document.querySelector(".form-dialog-cancel"),
        }

        this.entities.cover.addEventListener("click", () => this._onVisibilityChange(0))
        this.entities.cancel.addEventListener("click", () => this._onVisibilityChange(0))
        this.entities.submit.addEventListener("click", () => this._onVisibilityChange(1))
        this.entities.dialog.addEventListener("keydown", ev => {
            if (ev.key === "Escape") {
                this._onVisibilityChange(0)
            }
        })
    }

    _onVisibilityChange = (state = 1) => {
        this.utils.hide(this.entities.cover)
        this.utils.hide(this.entities.dialog)

        this.resolver({ response: state, data: this.entities.form.options.data })
        this.resolver = null
        this.entities.form.clear()
    }

    modal = ({ title, ...options }) => {
        if (options.schema instanceof Function) {
            options.schema = this.entities.form.DSL.buildSchema(options.schema)
        }

        const { promise, resolve } = Promise.withResolvers()
        this.resolver = resolve

        this.entities.title.textContent = title
        this.entities.form.render(options)
        this.utils.show(this.entities.dialog)
        this.utils.show(this.entities.cover)
        this.entities.submit.focus()

        return promise
    }

    updateModal = async fn => {
        const options = this.entities.form.options
        await fn(options)
        if (options.title) {
            this.entities.title.textContent = options.title
        }
        this.entities.form.render(options)
    }

    exit = () => this.entities.cancel.click()
}

module.exports = FormDialog
