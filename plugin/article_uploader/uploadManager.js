const FileUtils = require("./utils/file")
const CsdnUploader = require("./uploaders/csdn")
const CnBlogUploader = require("./uploaders/cnBlog")
const WordpressUploader = require("./uploaders/wordpress")

class UploadManager {
  registry = [CnBlogUploader, CsdnUploader, WordpressUploader]

  constructor(plugin) {
    this.plugin = plugin
  }

  getUploaders(targetPlatform) {
    const uploaders = []
    for (const UploaderClass of this.registry) {
      const uploader = new UploaderClass(this.plugin)
      const name = uploader.getName()

      const isTargetMatch = (targetPlatform === "all" || targetPlatform === name)
      const isEnabled = this.plugin.config.upload[name]?.enabled
      if (isTargetMatch) {
        if (targetPlatform === "all" && !isEnabled) {
          continue
        }
        uploaders.push(uploader)
      }
    }
    return uploaders
  }

  async execute(filePath, targetPlatform) {
    const articleData = FileUtils.parseArticle(this.plugin, filePath)
    const uploaders = this.getUploaders(targetPlatform)
    if (uploaders.length === 0) {
      throw new Error("No enabled platforms found for the target selection.")
    }

    const errors = []
    for (const uploader of uploaders) {
      try {
        await uploader.upload(articleData.title, articleData.content, articleData.extraData)
        console.log(`[${uploader.getName()}] Upload successful.`)
      } catch (error) {
        console.error(`[${uploader.getName()}] Error:`, error)
        errors.push(`[${uploader.getName()}] ${error.message}`)
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join(" | "))
    }
  }
}

module.exports = UploadManager
