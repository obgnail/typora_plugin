class testPlugin extends BasePlugin {
    exportVar = () => {
        global.require = require;
        global.module = module;
        global._findObject = (target, from = File, level = 0, maxLevel = 7) => {
            let hadFound = false;
            const core = (target, from, level = 0, maxLevel) => {
                if (hadFound || level === maxLevel || typeof from !== "object") return;
                const arr = Object.keys(from)
                for (let i of arr) {
                    if (i === target) {
                        hadFound = true
                        console.log(from);
                        return;
                    }
                    if (from[i] == null) continue
                    if (typeof from[i] == "object") {
                        core(target, from[i], level + 1, maxLevel);
                    }
                }
            }
            core(target, from, level, maxLevel);
        }
    }

    openDevTools = () => {
        const objGetter = () => File && File.editor && File.editor.library;
        const callback = () => setTimeout(() => ClientCommand.close(), 3000);
        this.utils.decorate(objGetter, "openFileInNewWindow", null,callback);
        JSBridge.invoke("window.toggleDevTools");
    }

    extra = () => {
        process.on("uncaughtException", error => {
            console.log("uncaughtException", error)
        })
    }

    process = () => {
        this.exportVar()
        this.openDevTools()
        this.extra()
    }
}

module.exports = {
    plugin: testPlugin
};
