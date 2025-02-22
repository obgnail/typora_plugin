class ArticleUploaderPlugin extends BasePlugin {
    init = () => {
        this.staticActions = this.i18n.fillActions([
            { act_value: "upload_to_csdn" },
            { act_value: "upload_to_wordpress" },
            { act_value: "upload_to_cn_blog" },
            { act_value: "upload_to_all_site" },
        ])
    }

    hotkey = () => [
        { hotkey: this.config.UPLOAD_CSDN_HOTKEY, callback: () => this.call("upload_to_csdn") },
        { hotkey: this.config.UPLOAD_CNBLOG_HOTKEY, callback: () => this.call("upload_to_cn_blog") },
        { hotkey: this.config.UPLOAD_WORDPRESS_HOTKEY, callback: () => this.call("upload_to_wordpress") },
        { hotkey: this.config.UPLOAD_ALL_HOTKEY, callback: () => this.call("upload_to_all_site") },
    ]

    call = async action => {
        const map = {
            upload_to_csdn: "csdn",
            upload_to_wordpress: "wordpress",
            upload_to_cn_blog: "cnblog",
            upload_to_all_site: "all"
        }
        const act = map[action]
        if (act) {
            await this.upload(act)
        }
    }

    upload = async action => {
        const uploader = require("./Plugin2UploadBridge");
        this.uploader = new uploader(this);
        const filePath = this.utils.getFilePath();
        await this.uploader.uploadProxy(filePath, action);
    }
}

module.exports = {
    plugin: ArticleUploaderPlugin
}
