class UploadController {
    constructor(bridge) {
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
        const needSelenium = this.seleniumSites.some(site => this.config.upload[site]?.enabled)
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
            this.uploaders.set(instance.getName(), instance);
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
            if (this.config.upload[name]?.enabled) {
                await uploader.upload(title, content, extraData, this.options);
            }
        }
    }
}

module.exports = UploadController;
