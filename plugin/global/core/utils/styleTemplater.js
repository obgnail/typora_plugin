class styleTemplater {
    constructor(utils) {
        this.utils = utils;
    }

    getID = name => `plugin-${name}-style`

    register = async (name, args) => {
        const files = ["user_styles", "styles"].map(dir => this.utils.joinPath("./plugin/global", dir, `${name}.css`));
        const [userStyles, defaultStyles] = await this.utils.readFiles(files);
        const data = userStyles || defaultStyles;
        if (!data) {
            console.error(`there is not such style file: ${name}`);
            return
        }
        try {
            const css = data.replace(/\${(.+?)}/g, (_, $arg) => $arg.split(".").reduce((obj, attr) => obj[attr], args));
            this.utils.insertStyle(this.getID(name), css);
        } catch (err) {
            console.error(`replace args error. file: ${name}. err: ${err}`);
        }
    }

    unregister = name => this.utils.removeStyle(this.getID(name));

    getStyleContent = name => {
        const style = document.getElementById(this.getID(name));
        return style ? style.innerHTML : undefined;
    }

    process = async () => await this.register("plugin-common");
}

module.exports = {
    styleTemplater
}