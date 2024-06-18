/**
 * 桥接插件和上传工具。用于转发请求给控制器，消息统计，提示功能
 */
class Plugin2UploadBridge {
    constructor(plugin) {
        this.plugin = plugin;
        this.config = plugin.config;
        this.sites = ["cnblog", "csdn", "wordpress"];
        this.utils = null;
        this.uploadController = null;
        this.notification = null;
    }

    lazyLoad = () => {
        if (!this.utils) {
            const Utils = require('./utils/uploadUtils');
            this.utils = new Utils(this.plugin);
        }

        if (!this.uploadController) {
            const UploadController = require('./controller/UploadController');
            this.uploadController = new UploadController(this);
            this.sites.forEach(site => this.uploadController.register(site));
        }

        if (!this.notification) {
            const Notification = require('./utils/customNotification.js').plugin;
            this.notification = new Notification();
        }
    }

    uploadProxy = async (filePath, type = "all") => {
        if (this.config.upload.reconfirm) {
            const message = "你确定要上传文章吗";
            const op = {type: "info", title: "上传提示", buttons: ["确定", "取消"], message};
            const {response} = await this.plugin.utils.showMessageBox(op);
            if (response === 1) {
                return;
            }
        }

        this.lazyLoad();
        this.notification.showNotification('开始上传，请不要关闭软件', 'info');
        const startTime = new Date();

        if (type === "all") {
            await this.uploadController.uploadToAllPlatforms(filePath);
        } else {
            await this.uploadController.upload(type, filePath);
        }

        const endTime = new Date();
        const duration = ((endTime - startTime) / 1000).toFixed(1);
        this.notification.showNotification(`上传成功，耗时${duration}秒`, 'success');
    }
}

module.exports = Plugin2UploadBridge;
