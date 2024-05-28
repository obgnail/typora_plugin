class ArticleUploader extends BasePlugin {
    init = () => {
        this.callArgs = [
            {arg_name: "上传到csdn", arg_value: "upload_to_csdn"},
            {arg_name: "上传到wordpress", arg_value: "upload_to_wordpress"},
            {arg_name: "上传到博客园", arg_value: "upload_to_cn_blog"},
            {arg_name: "全部上传", arg_value: "upload_to_all_site"},
        ]
    }

    hotkey = () => [
        {hotkey: this.config.UPLOAD_CSDN_HOTKEY, callback: () => this.call("upload_to_csdn")},
        {hotkey: this.config.UPLOAD_CNBLOG_HOTKEY, callback: () => this.call("upload_to_cn_blog")},
        {hotkey: this.config.UPLOAD_WORDPRESS_HOTKEY, callback: () => this.call("upload_to_wordpress")},
        {hotkey: this.config.UPLOAD_ALL_HOTKEY, callback: () => this.call("upload_to_all_site")},
    ]

    call = type => {
        const map = {
            upload_to_csdn: "csdn",
            upload_to_wordpress: "wordpress",
            upload_to_cn_blog: "cnblog",
            upload_to_all_site: "all"
        }
        console.log(type)
        const _type = map[type];
        if (!_type) return;

        const UploadUtil = require("./Plugin2UploadBridge");
        this.baseUploader = new UploadUtil(this);
        let filePath = this.utils.getFilePath();
        this.baseUploader.uploadProxy(filePath, _type);
    }
}

module.exports = {
    plugin: ArticleUploader
};