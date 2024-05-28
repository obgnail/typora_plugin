/**
 * 控制器，转发请求，注册插件，设置配置
 */
class UploadController {
    constructor(plugin) {
        this.plugin = plugin;
        this.utils = null;
        this.uploaders = new Map();
        this.config = null;
        this.options = null;

        this.lazyLoadUtils();
        this.init();
        this.registerUploaders();
    }

    lazyLoadUtils = () => {
        if (!this.utils) {
            const Utils = require('../utils/Utils');
            this.utils = new Utils(this.plugin);
        }

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
    }

    init = () => {
        const configPath = this.plugin.utils.joinPath('./plugin/global/settings/uploadConfig.yaml');
        this.config = this.utils.loadConfig(configPath);

        if (this.config.upload.selenium.headless) {
            this.options.addArguments("--headless");
        }
    }

    registerUploaders = () => {
        const CnBlogUploader = require('../uploader/CnBlogUploader');
        const CsdnUploader = require('../uploader/CsdnUploader');
        const WordpressUploader = require('../uploader/WordpressUploader');

        this.register(new CnBlogUploader(this.utils, this.config, this.options));
        this.register(new CsdnUploader(this.utils, this.config, this.options));
        this.register(new WordpressUploader(this.utils, this.config, this.options));
    }

    register = (uploader) => {
        const name = uploader.getName();
        this.uploaders.set(name, uploader);
    }

    unregister = (name) => this.uploaders.delete(name);

    // 这里对结果不做捕捉，后续根据需求优化
    upload = async (platform, filePath) => {
        const uploader = this.uploaders.get(platform);
        const {title, content, extraData} = this.utils.readAndSplitFile(filePath);
        if (uploader) {
            await uploader.upload(title, content, extraData, this.options);
        }
    }

    uploadToAllPlatforms = async (filePath) => {
        const {title, content, extraData} = this.utils.readAndSplitFile(filePath);
        for (let [name, uploader] of this.uploaders) {
            // 上传全部的时候不上传哪些平台，属于脱裤子放屁的需求
            if ((name === "csdn" && this.config.csdn.enabled) ||
                (name === "wordpress" && this.config.wordpress.enabled) ||
                (name === "cnblog" && this.config.cnblog.enabled)) {
                await uploader.upload(title, content, extraData, this.options);
            }
        }
    }
}

module.exports = UploadController;
