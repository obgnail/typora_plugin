/**
 * Dynamically register CSS files.
 */
class StyleTemplater {
    constructor(utils) {
        this.utils = utils
    }

    getID = name => `plugin-${name}-style`

    register = async (name, args) => {
        const files = ["user_styles", "styles"].map(dir => this.utils.joinPath("./plugin/global", dir, name + ".css"))
        const [userStyles, defaultStyles] = await this.utils.readFiles(files)
        const data = (userStyles || defaultStyles)?.trim()
        if (data == null) {
            console.error(`Not such style file: ${name}`)
            return
        }
        if (data === "") {
            console.warn(`Empty style file: ${name}`)
            return
        }
        try {
            const css = data.replace(/\${(.+?)}/g, (_, $arg) => $arg.split(".").reduce((obj, attr) => obj[attr], args))
            this.utils.insertStyle(this.getID(name), css)
        } catch (e) {
            console.error(`Replace style file ${name} args error: ${e}`)
        }
    }

    unregister = name => this.utils.removeStyle(this.getID(name))

    reset = async (name, args) => {
        this.unregister(name)
        await this.register(name, args)
    }

    getStyleContent = name => document.getElementById(this.getID(name))?.innerHTML

    process = async () => Promise.all(["plugin-common", "customize"].map(f => this.register(f)))
}

module.exports = StyleTemplater
