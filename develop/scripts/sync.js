const path = require("path")
const fs = require("fs-extra")
const chokidar = require("chokidar")

const debounce = (fn, delay = 500) => {
    let timer
    return function (...args) {
        clearTimeout(timer)
        timer = setTimeout(() => fn(...args), delay)
    }
}

const getDirs = () => {
    let rootDir = path.resolve(process.env.TYPORA_PATH, "../resources")
    try {
        const appDir = path.join(rootDir, "app")
        fs.accessSync(appDir)
        rootDir = appDir
        console.log("Assuming old version Typora")
    } catch (err) {
        console.log("Assuming new version Typora")
    }
    try {
        fs.accessSync(path.join(rootDir, "window.html"))
    } catch (e) {
        throw new Error("Error env param: TYPORA_PATH")
    }
    return {
        sourceDir: path.resolve(__dirname, "../../plugin"),
        destDir: path.join(rootDir, "plugin"),
    }
}

const sync = (callback) => {
    const { sourceDir, destDir } = getDirs()
    const callback_ = callback ? debounce(callback) : () => undefined

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
}

module.exports = sync
