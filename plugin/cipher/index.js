class cipherPlugin extends BasePlugin {
    process = () => {
        this.AES_ECB = null;
        this.key = "n0hLis5FjgQxa3f31sSa2wm37J81g3upTlq9it9WlfK";
        this.callArgs = [{arg_name: "加密", arg_value: "encrypt"}, {arg_name: "解密", arg_value: "decrypt"}];
    }

    call = async type => await this.utils.editCurrentFile(this[type])

    encrypt = async raw => {
        this.lazyLoad();
        const isCiphered = this.utils.isBase64(raw);
        if (!this.config.SHOW_HINT_MODAL && !isCiphered) {
            return this.AES_ECB.AES_ECB_ENCRYPT(raw, this.key)
        }
        return new Promise(resolve => {
            const label = isCiphered ? "文件已是加密格式，重复加密并不会更安全" : `仅作娱乐使用，加密后 <b>严禁修改文件</b>`
            const callback = () => resolve(isCiphered ? raw : this.AES_ECB.AES_ECB_ENCRYPT(raw, this.key))
            this.utils.modal({title: "加密文件", components: [{label, type: "p"}]}, callback, () => resolve(raw));
        })
    }

    decrypt = async ciphered => {
        this.lazyLoad();
        const isCiphered = this.utils.isBase64(ciphered);
        if (isCiphered) {
            return this.AES_ECB.AES_ECB_DECRYPT(ciphered, this.key)
        }
        return new Promise(resolve => {
            const label = "文件为非加密格式";
            const callback = () => resolve(ciphered);
            this.utils.modal({title: "解密文件", components: [{label, type: "p"}]}, callback, callback);
        })
    }

    lazyLoad = () => this.AES_ECB = this.AES_ECB || this.utils.requireFilePath("./plugin/cipher/aes_ecb.js")
}

module.exports = {
    plugin: cipherPlugin,
};
