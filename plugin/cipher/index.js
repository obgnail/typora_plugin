const createCipher = getKey => {
  const MAGIC_HEADER = "TYPENC1:"
  const BASE64_RE = /^[A-Za-z0-9+/=]+$/
  let crypto = null

  const getCrypto = () => {
    crypto = crypto || require("./aes-ecb.min.js")
    return crypto
  }
  const isEncrypted = str => str.startsWith(MAGIC_HEADER) && BASE64_RE.test(str.slice(MAGIC_HEADER.length))
  const isLegacyEncrypted = str => str.length % 4 === 0 && BASE64_RE.test(str)
  return {
    isEncrypted: str => isEncrypted(str) || isLegacyEncrypted(str),
    encrypt: raw => MAGIC_HEADER + getCrypto().encrypt(raw, getKey()),
    decrypt: ciphered => {
      const c = getCrypto()
      if (isEncrypted(ciphered)) {
        return c.decrypt(ciphered.slice(MAGIC_HEADER.length), getKey())
      }
      if (isLegacyEncrypted(ciphered)) {
        return c.decrypt(ciphered, getKey())
      }
      return null
    },
  }
}

class CipherPlugin extends BasePlugin {
  cipher = createCipher(() => this.config.SECRET_KEY)
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
    if (fn) await this.utils.editCurrentFile(fn)
  }

  encrypt = async raw => {
    const isEncrypted = this.cipher.isEncrypted(raw)
    const doEncrypt = () => this.cipher.encrypt(raw)

    if (!this.showMessageBox && !isEncrypted) {
      return doEncrypt()
    }

    const { response, checkboxChecked } = await this.utils.showMessageBox({
      type: "info",
      title: this.pluginName,
      message: this.i18n.t(isEncrypted ? "msgBox.encrypt.onCiphered" : "msgBox.encrypt.onPlain"),
      checkboxLabel: this.i18n.t("disableReminder"),
    })
    if (checkboxChecked) {
      this.showMessageBox = false
    }
    if (response === 0) {
      return isEncrypted ? raw : doEncrypt()
    }
    return raw
  }

  decrypt = async decrypted => {
    const plain = this.cipher.decrypt(decrypted)
    if (plain !== null) {
      return plain
    }
    await this.utils.showMessageBox({
      type: "info",
      title: this.pluginName,
      message: this.i18n.t("msgBox.decrypt.onPlain"),
      buttons: [this.i18n.t("confirm")],
    })
    return decrypted
  }
}

module.exports = {
  plugin: CipherPlugin,
}
