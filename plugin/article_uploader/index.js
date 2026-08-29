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

  upload = async platform => {
    if (this.config.upload.reconfirm) {
      const { response } = await this.utils.showMessageBox({
        type: "info",
        title: "Confirm Upload",
        message: "Are you sure you want to upload this article?",
      })
      if (response === 1) return
    }

    this.utils.notification.show("Upload process started, please do not close the software...", "info")
    const startTime = new Date()

    try {
      const UploadManager = require("./uploadManager")
      const manager = new UploadManager(this)
      await manager.execute(this.utils.getFilePath(), platform)

      const endTime = new Date()
      const duration = ((endTime - startTime) / 1000).toFixed(1)
      this.utils.notification.show(`Upload completed successfully in ${duration}s`, "success")
    } catch (error) {
      this.utils.notification.show(`Upload failed: ${error.message}`, "error")
      console.error(error)
    }
  }
}

module.exports = {
  plugin: ArticleUploaderPlugin,
}
