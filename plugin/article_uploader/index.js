class ArticleUploaderPlugin extends BasePlugin {
  staticActions = [
    { act_value: "upload_to_csdn", act_name: this.i18n.t("$label.UPLOAD_CSDN_HOTKEY") },
    { act_value: "upload_to_wordpress", act_name: this.i18n.t("$label.UPLOAD_WORDPRESS_HOTKEY") },
    { act_value: "upload_to_cn_blog", act_name: this.i18n.t("$label.UPLOAD_CNBLOG_HOTKEY") },
    { act_value: "upload_to_all_site", act_name: this.i18n.t("$label.UPLOAD_ALL_HOTKEY") },
  ]

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
      upload_to_all_site: "all",
    }
    const act = map[action]
    if (act) {
      await this.upload(act)
    }
  }

  upload = async action => {
    this.uploader = new Bridge(this)
    await this.uploader.upload(this.utils.getFilePath(), action)
  }
}

class Bridge {
  constructor(plugin) {
    this.plugin = plugin
    this.config = plugin.config
    this.sites = ["cnblog", "csdn", "wordpress"]
    this.utils = null
    this.controller = null
  }

  lazyLoad = () => {
    if (!this.utils) {
      const Utils = require("./utils/uploadUtils")
      this.utils = new Utils(this.plugin)
    }
    if (!this.controller) {
      const controller = require("./UploadController")
      this.controller = new controller(this)
      this.sites.forEach(site => this.controller.register(site))
    }
  }

  upload = async (filePath, type = "all") => {
    if (this.config.upload.reconfirm) {
      const { response } = await this.plugin.utils.showMessageBox({ type: "info", title: "上传提示", message: "你确定要上传文章吗" })
      if (response === 1) return
    }

    this.lazyLoad()
    this.plugin.utils.notification.show("开始上传，请不要关闭软件", "info")
    const startTime = new Date()

    if (type === "all") {
      await this.controller.uploadToAllPlatforms(filePath)
    } else {
      await this.controller.upload(type, filePath)
    }

    const endTime = new Date()
    const duration = ((endTime - startTime) / 1000).toFixed(1)
    this.plugin.utils.notification.show(`上传成功，耗时${duration}秒`, "success")
  }
}

module.exports = {
  plugin: ArticleUploaderPlugin,
}
