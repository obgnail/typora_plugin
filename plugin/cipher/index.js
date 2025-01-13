class cipherPlugin extends BasePlugin {
    hotkey = () => [
        { hotkey: this.config.ENCRYPT_HOTKEY, callback: () => this.call("encrypt") },
        { hotkey: this.config.DECRYPT_HOTKEY, callback: () => this.call("decrypt") },
    ]

    init = () => {
        this.AES_ECB = null
        // To prevent decryption failures, users are restricted from modifying the hard-coded secret key
        this.key = "n0hLis5FjgQxa3f31sSa2wm37J81g3upTlq9it9WlfK"
        this.showMessageBox = this.config.SHOW_HINT_MODAL
        this.staticActions = [
            { act_name: "加密", act_value: "encrypt", act_hotkey: this.config.ENCRYPT_HOTKEY },
            { act_name: "解密", act_value: "decrypt", act_hotkey: this.config.DECRYPT_HOTKEY },
        ]
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

        const checkboxLabel = "不再提示（直到关闭Typora）"
        const message = isCiphered ? "文件已是加密格式，重复加密并不会更安全" : "加密后严禁修改文件"
        const op = { type: "info", title: "加密文件", buttons: ["确定", "取消"], message, checkboxLabel }
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
        await this.utils.showMessageBox({ type: "info", title: "解密文件", buttons: ["确定"], message: "文件为非加密格式" })
        return ciphered
    }

    lazyLoad = () => {
        this.AES_ECB = this.AES_ECB || require("./aes_ecb.min.js")
        return { encrypt: this.AES_ECB.AES_ECB_ENCRYPT, decrypt: this.AES_ECB.AES_ECB_DECRYPT }
    }
}

module.exports = {
    plugin: cipherPlugin,
}
