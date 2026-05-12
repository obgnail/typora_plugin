class CipherPlugin extends BasePlugin {
  AES_ECB = null
  key = this.config.SECRET_KEY
  showMessageBox = this.config.SHOW_HINT_DIALOG
  staticActions = [
    { act_value: "encrypt", act_hotkey: this.config.ENCRYPT_HOTKEY, act_name: this.i18n.t("$label.ENCRYPT_HOTKEY") },
    { act_value: "decrypt", act_hotkey: this.config.DECRYPT_HOTKEY, act_name: this.i18n.t("$label.DECRYPT_HOTKEY") },
  ]

  hotkey = () => [
    { hotkey: this.config.ENCRYPT_HOTKEY, callback: () => this.call("encrypt") },
    { hotkey: this.config.DECRYPT_HOTKEY, callback: () => this.call("decrypt") },
  ]

  call = async action => {
    const fn = this[action]
    if (fn) {
      await this.utils.editCurrentFile(fn)
    }
  }

  encrypt = async raw => {
    const { encrypt } = this.lazyLoad()
    const isCiphered = this.utils.isBase64(raw)
    if (!this.showMessageBox && !isCiphered) {
      return encrypt(raw, this.key)
    }

    const { response, checkboxChecked } = await this.utils.showMessageBox({
      type: "info",
      title: this.i18n.t("act.encrypt"),
      message: this.i18n.t(isCiphered ? "msgBox.encrypt.onCiphered" : "msgBox.encrypt.onPlain"),
      checkboxLabel: this.i18n.t("disableReminder"),
    })
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
    await this.utils.showMessageBox({
      type: "info",
      title: this.i18n.t("act.decrypt"),
      message: this.i18n.t("msgBox.decrypt.onPlain"),
      buttons: [this.i18n.t("confirm")],
    })
    return ciphered
  }

  lazyLoad = () => {
    this.AES_ECB = this.AES_ECB || require("./aes-ecb.min.js")
    return { encrypt: this.AES_ECB.encrypt, decrypt: this.AES_ECB.decrypt }
  }
}

module.exports = {
  plugin: CipherPlugin,
}
