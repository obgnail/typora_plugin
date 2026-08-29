class BaseUploader {
  constructor(plugin) {
    this.plugin = plugin
    this.config = plugin.config
  }

  getName() {
    throw new Error("Method getName should be implemented")
  }

  async upload(title, content, extraData) {
    throw new Error("Method upload should be implemented")
  }
}

module.exports = BaseUploader
