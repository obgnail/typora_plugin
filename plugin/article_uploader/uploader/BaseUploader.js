class BaseUploader {
  constructor(controller) {
    this.utils = controller.utils
    this.config = controller.config
  }

  getName() {
    throw new Error("method getName should be implemented")
  }

  async upload(title, content, extraData, options) {
    throw new Error("method upload should be implemented")
  }
}

module.exports = BaseUploader
