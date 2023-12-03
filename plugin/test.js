class testPlugin extends BasePlugin {
    init = () => {
        console.log("-------- test.js")

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

    process = () => {
        this.init();

        this.utils.decorate(() => File && File.editor && File.editor.library, "openFileInNewWindow", null,
            () => (!global._DO_NOT_CLOSE) && setTimeout(() => ClientCommand.close(), 3000)
        )

        JSBridge.invoke("window.toggleDevTools");
    }

    // _findObject = (varName, from = File) => {
    //     let target = null;
    //
    //     const _find = (from, level = 0, maxLevel = 10) => {
    //         if (this.hadFound || level === maxLevel || typeof from !== "object") return;
    //
    //         for (let i of Object.keys(from)) {
    //             if (from[i] != null) {
    //                 if (typeof from[i] == "object") {
    //                     from[i].__parent__ = from;
    //                     _find(from[i], level + 1)
    //                 } else {
    //                     if (i === varName) {
    //                         this.hadFound = true
    //                         target = from;
    //                     }
    //                 }
    //             }
    //         }
    //     }
    //     _find(varName, from)
    //
    //     if (!target) {
    //         console.log("had not find")
    //         return
    //     }
    //
    //     const result = []
    //     let ele = target;
    //     while (ele) {
    //         result.push(ele);
    //         ele = ele.__parent__;
    //     }
    //
    //     result.reverse()
    //     console.log(result)
    // }

}

module.exports = {
    plugin: testPlugin
};
