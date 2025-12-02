class CipherPlugin extends BasePlugin {
    hotkey = () => [
        { hotkey: this.config.ENCRYPT_HOTKEY, callback: () => this.call("encrypt") },
        { hotkey: this.config.DECRYPT_HOTKEY, callback: () => this.call("decrypt") },
    ]

    init = () => {
        this.AES_ECB = null
        this.key = this.config.SECRET_KEY
        this.showMessageBox = this.config.SHOW_HINT_MODAL
        this.staticActions = this.i18n.fillActions([
            { act_value: "encrypt", act_hotkey: this.config.ENCRYPT_HOTKEY },
            { act_value: "decrypt", act_hotkey: this.config.DECRYPT_HOTKEY },
        ])
    }

    call = async action => {
        const func = this[action]
        if (func) {
            await this.utils.editCurrentFile(func)
        }
    }

    encrypt = async raw => {
        const { encrypt } = this.lazyLoad()
        const isCiphered = this.utils.isBase64(raw)
        if (!this.showMessageBox && !isCiphered) {
            return encrypt(raw, this.key)
        }

        const title = this.i18n.t("act.encrypt")
        const message = this.i18n.t(isCiphered ? "msgBox.encrypt.onCiphered" : "msgBox.encrypt.onPlain")
        const checkboxLabel = this.i18n._t("global", "disableReminder")
        const op = { type: "info", title, message, checkboxLabel }
        const { response, checkboxChecked } = await this.utils.showMessageBox(op)
        if (checkboxChecked) {
            this.showMessageBox = false
        }
        if (response === 0) {
            return isCiphered ? raw : encrypt(raw, this.key)
        } else if (response === 1) {
            return raw
        }
    }

    decrypt = async ciphered => {
        const { decrypt } = this.lazyLoad()
        const isCiphered = this.utils.isBase64(ciphered)
        if (isCiphered) {
            return decrypt(ciphered, this.key)
        }
        const title = this.i18n.t("act.decrypt")
        const message = this.i18n.t("msgBox.decrypt.onPlain")
        const confirm = this.i18n._t("global", "confirm")
        const op = { type: "info", title, message, buttons: [confirm] }
        await this.utils.showMessageBox(op)
        return ciphered
    }

    lazyLoad = () => {
        this.AES_ECB = this.AES_ECB || require("./aes-ecb.min.js")
        return { encrypt: this.AES_ECB.encrypt, decrypt: this.AES_ECB.decrypt }
    }
}

module.exports = {
    plugin: CipherPlugin
}
