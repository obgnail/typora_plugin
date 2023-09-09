class testPlugin extends global._basePlugin {
    init = () => {
        console.log("-------- test.js")
        const target = "decodeFromEscapedPath"
        this.hadFound = false;

        global._findObject = (target, obj = File, level = 0, maxLevel = 10) => {
            if (this.hadFound || level === this.maxLevel || typeof obj !== "object") return;

            for (let i of Object.keys(obj)) {
                if (obj[i] != null) {
                    if (typeof obj[i] == "object") {
                        global._findObject(target, obj[i], level + 1)
                    } else {
                        if (i === target) {
                            this.hadFound = true
                            console.log(obj);
                        }
                    }
                }
            }
        }
    }

    process() {
        this.init();

        this.utils.decorate(
            () => (File && File.editor && File.editor.library && File.editor.library.openFileInNewWindow),
            "File.editor.library.openFileInNewWindow",
            null,
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
