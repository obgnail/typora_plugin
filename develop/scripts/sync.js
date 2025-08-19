const chokidar = require("chokidar")
const fs = require("fs-extra")
const path = require("path")
const utils = require("./utils")

const sync = (callback) => {
    const sourceDir = process.env.SOURCE_DIR
    const destDir = process.env.DEST_DIR
    const callback_ = callback ? utils.debounce(callback) : () => undefined

    console.log(`Starting sync from ${sourceDir} to ${destDir}`)

    fs.ensureDirSync(sourceDir)
    fs.ensureDirSync(destDir)

    const watcher = chokidar.watch(sourceDir, {
        persistent: true,
        ignoreInitial: false,
        ignored: /(^|[\/\\])\../,
    })

    function getDestPath(srcPath) {
        const relativePath = path.relative(sourceDir, srcPath)
        return path.join(destDir, relativePath)
    }

    watcher
        .on("add", async (filePath) => {
            const destPath = getDestPath(filePath)
            console.log(`File added: ${filePath} -> ${destPath}`)
            try {
                await fs.copy(filePath, destPath)
                callback_()
            } catch (err) {
                console.error(`Error copying file ${filePath}:`, err)
            }
        })
        .on("addDir", async (dirPath) => {
            const destPath = getDestPath(dirPath)
            console.log(`Directory added: ${dirPath} -> ${destPath}`)
            try {
                await fs.ensureDir(destPath)
                callback_()
            } catch (err) {
                console.error(`Error creating directory ${dirPath}:`, err)
            }
        })
        .on("change", async (filePath) => {
            const destPath = getDestPath(filePath)
            console.log(`File changed: ${filePath} -> ${destPath}`)
            try {
                await fs.copy(filePath, destPath)
                callback_()
            } catch (err) {
                console.error(`Error copying changed file ${filePath}:`, err)
            }
        })
        .on("unlink", async (filePath) => {
            const destPath = getDestPath(filePath)
            console.log(`File removed: ${filePath} -> ${destPath}`)
            try {
                await fs.remove(destPath)
                callback_()
            } catch (err) {
                console.error(`Error removing file ${destPath}:`, err)
            }
        })
        .on("unlinkDir", async (dirPath) => {
            const destPath = getDestPath(dirPath)
            console.log(`Directory removed: ${dirPath} -> ${destPath}`)
            try {
                await fs.remove(destPath)
                callback_()
            } catch (err) {
                console.error(`Error removing directory ${destPath}:`, err)
            }
        })
        .on("error", (error) => console.error(`Watcher error: ${error}`))
        .on("ready", () => console.log("Initial scan complete. Ready for changes."))

    console.log("Sync script is running...")
}

module.exports = sync
