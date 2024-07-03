class testPlugin extends BasePlugin {
    process = () => {
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

        this.utils.decorate(
            () => File && File.editor && File.editor.library,
            "openFileInNewWindow",
            null,
            () => !global._DO_NOT_CLOSE && setTimeout(() => ClientCommand.close(), 3000)
        )

        JSBridge.invoke("window.toggleDevTools");
    }
}

module.exports = {
    plugin: testPlugin
};
