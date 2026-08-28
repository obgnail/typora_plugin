class UploadUtils {
    constructor(plugin) {
        this.plugin = plugin;
        this.CryptoJS = null;
        this.yaml = null;
    }

    lazyLoadCryptoJS = () => {
        if (!this.CryptoJS) {
            this.CryptoJS = require('./crypto-js/core');
            require('./crypto-js/hmac');
            require('./crypto-js/sha256');
            require('./crypto-js/enc-base64');
        }
    }

    readAndSplitFile = (filePath) => {
        try {
            const data = this.plugin.utils.Package.FsExtra.readFileSync(filePath, 'utf-8')
            const lines = data.split('\n');
            const title = lines[0].trim().replace(/#/g, '').trim();
            const content = lines.slice(1).join('\n').trim();
            if (title === "" || content === '') {
                throw new Error("内容为空");
            }
            const extraData = "";  // TODO: 取出标签，分类，封面图等
            return { title, content, extraData };
        } catch (error) {
            this.plugin.utils.notification.show('文件格式读取失败', "error");
            console.error('Error reading file:', error);
            return null;
        }
    }

    getSign = (uuid, url) => {
        this.lazyLoadCryptoJS();
        const parsedUrl = new URL(url);
        const _url = parsedUrl.pathname;

        const ekey = process.env.ALIBABA_CLOUD_EKEY;
        const xCaKey = process.env.ALIBABA_CLOUD_XCA_KEY;
        if (!ekey || !xCaKey) {
            throw new Error("Missing Alibaba Cloud credentials. Set ALIBABA_CLOUD_EKEY and ALIBABA_CLOUD_XCA_KEY environment variables.");
        }
        const toEnc = `POST\napplication/json, text/plain, */*\n\napplication/json;\n\nx-ca-key:${xCaKey}\nx-ca-nonce:${uuid}\n${_url}`;
        const hmac = this.CryptoJS.HmacSHA256(toEnc, ekey);
        return this.CryptoJS.enc.Base64.stringify(hmac);
    }
}

module.exports = UploadUtils;
