class File {
  static parseArticle(plugin, filePath) {
    try {
      const data = plugin.utils.Package.FsExtra.readFileSync(filePath, "utf-8")
      const lines = data.split("\n")
      const title = lines[0].trim().replace(/#/g, "").trim()
      const content = lines.slice(1).join("\n").trim()
      if (!title || !content) {
        throw new Error("File content or title is empty.")
      }

      const extraData = {}  // TODO
      return { title, content, extraData }
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`)
    }
  }
}

module.exports = File
