/**
 * 控制器，转发请求，注册插件，设置配置
 */
class UploadController {
    constructor(bridge) {
        this.bridge = bridge;
        this.config = bridge.config;
        this.utils = bridge.utils;
        this.uploaders = new Map();
        this.options = null;
        this.pathMap = {
            cnblog: "../uploader/CnBlogUploader",
            csdn: "../uploader/CsdnUploader",
            wordpress: "../uploader/WordpressUploader",
        }
        this.seleniumSites = ["cnblog", "wordpress"]

        this.init();
    }

    init = () => {
        const needSelenium = this.seleniumSites.some(site => {
            const cfg = this.config.upload[site]
            return cfg && cfg.enabled
        })
        if (needSelenium) {
            if (!this.options) {
                const chrome = require('selenium-webdriver/chrome');
                this.options = new chrome.Options();
                this.options.addArguments(
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars',
                    '--disable-extensions',
                    '--disable-gpu',
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-javascript'
                );
            }
            if (this.config.upload.selenium.headless) {
                this.options.addArguments("--headless");
            }
        }
    }

    register = (site) => {
        const path = this.pathMap[site];
        if (path) {
            const uploader = require(path);
            const instance = new uploader(this);
            const name = instance.getName();
            this.uploaders.set(name, instance);
        }
    }

    unregister = (name) => this.uploaders.delete(name);

    // 这里对结果不做捕捉，后续根据需求优化
    upload = async (platform, filePath) => {
        const uploader = this.uploaders.get(platform);
        const { title, content, extraData } = this.utils.readAndSplitFile(filePath);
        if (uploader) {
            await uploader.upload(title, content, extraData, this.options);
        }
    }

    uploadToAllPlatforms = async (filePath) => {
        const { title, content, extraData } = this.utils.readAndSplitFile(filePath);
        for (let [name, uploader] of this.uploaders) {
            const c = this.config.upload[name];
            if (c && c.enabled) {
                await uploader.upload(title, content, extraData, this.options);
            }
        }
    }
}

module.exports = UploadController;
