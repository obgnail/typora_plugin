class cipherPlugin extends BasePlugin {
    process = () => {
        this.AES_ECB = null;
        this.key = "n0hLis5FjgQxa3f31sSa2wm37J81g3upTlq9it9WlfK";
        this.callArgs = [{arg_name: "加密", arg_value: "encrypt"}, {arg_name: "解密", arg_value: "decrypt"}];
    }

    call = async type => await this.utils.editCurrentFile(this[type])

    encrypt = async raw => {
        this.lazyLoad();
        if (!this.config.SHOW_HINT_MODAL) {
            return this.AES_ECB.AES_ECB_ENCRYPT(raw, this.key)
        }
        return new Promise(resolve => {
            this.utils.modal(
                {title: "提示", components: [{label: `仅作娱乐使用，加密后 <b>严禁修改文件</b>`, type: "p"}]},
                () => resolve(this.AES_ECB.AES_ECB_ENCRYPT(raw, this.key)),
                () => resolve(raw)
            );
        })
    }

    decrypt = async ciphered => {
        this.lazyLoad();
        if (this.utils.isBase64(ciphered)) {
            return this.AES_ECB.AES_ECB_DECRYPT(ciphered, this.key)
        }
        return new Promise(resolve => {
            const label = "文件非加密格式";
            const callback = () => resolve(ciphered);
            this.utils.modal({title: "提示", components: [{label, type: "p"}]}, callback, callback);
        })
    }

    lazyLoad = () => this.AES_ECB = this.AES_ECB || this.utils.requireFilePath("./plugin/cipher/aes_ecb.js")
}

module.exports = {
    plugin: cipherPlugin,
};
