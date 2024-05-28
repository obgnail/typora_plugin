class UploadUtils {
    constructor(plugin) {
        this.plugin = plugin;
        this.CryptoJS = null;
        this.yaml = null;
    }

    // 懒加载 CryptoJS 模块
    lazyLoadCryptoJS = () => {
        if (!this.CryptoJS) {
            this.CryptoJS = require('./crypto-js/core');
            require('./crypto-js/hmac');
            require('./crypto-js/sha256');
            require('./crypto-js/enc-base64');
        }
    }

    // 懒加载 yaml 模块
    lazyLoadYaml = () => {
        if (!this.yaml) {
            this.yaml = require('../../global/utils/yaml');
        }
    }

    // 生成UUID
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // 处理文件
    readAndSplitFile = (filePath) => {
        try {
            const fs = this.plugin.utils.Package.Fs;
            const data = fs.readFileSync(filePath, 'utf-8');
            const lines = data.split('\n');
            const title = lines[0].trim().replace(/#/g, '').trim();
            const content = lines.slice(1).join('\n').trim();
            if (title === "" || content === '') {
                throw new Error("内容为空");
            }
            const extraData = "";  // TODO: 取出标签，分类，封面图等
            return {title, content, extraData};
        } catch (error) {
            notification.showNotification('文件格式读取失败', "error");
            console.error('Error reading file:', error);
            return null;
        }
    }

    // 获取签名
    getSign = (uuid, url) => {
        this.lazyLoadCryptoJS();
        const parsedUrl = new URL(url);
        const _url = parsedUrl.pathname;

        const ekey = "9znpamsyl2c7cdrr9sas0le9vbc3r6ba";
        const xCaKey = "203803574";
        const toEnc = `POST\napplication/json, text/plain, */*\n\napplication/json;\n\nx-ca-key:${xCaKey}\nx-ca-nonce:${uuid}\n${_url}`;
        const hmac = this.CryptoJS.HmacSHA256(toEnc, ekey);
        return this.CryptoJS.enc.Base64.stringify(hmac);
    }

    // 加载配置文件
    loadConfig = (filePath) => {
        this.lazyLoadYaml();
        try {
            const fs = this.plugin.utils.Package.Fs;
            const fileContents = fs.readFileSync(filePath, 'utf8');
            return this.yaml.load(fileContents);
        } catch (e) {
            console.log(e);
            return null;
        }
    }
}

module.exports = UploadUtils;
