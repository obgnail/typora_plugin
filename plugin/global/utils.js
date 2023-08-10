(() => {
    const insertStyle = (id, css) => {
        const style = document.createElement('style');
        style.id = id;
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);
    }

    const getPlugin = fixed_name => {
        const idx = global._plugins.findIndex(plugin => plugin.enable && plugin.fixed_name === fixed_name)
        if (idx !== -1) {
            return global._plugins[idx];
        }
    }

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;
    const getDirname = () => global.dirname || global.__dirname;
    const getFilePath = () => File.filePath || File.bundle && File.bundle.filePath;
    const joinPath = (...paths) => Package.Path.join(getDirname(), ...paths);

    const requireFile = (...paths) => {
        const filepath = joinPath(...paths);
        return reqnode(filepath)
    }

    const Package = {
        Path: reqnode("path"),
        Fs: reqnode("fs"),
        ChildProcess: reqnode('child_process'),
    };

    const detectorContainer = {}

    function getUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            let r = (Math.random() * 16) | 0,
                v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    const decorate = (until, obj, func, before, after) => {
        const uuid = getUUID();
        detectorContainer[uuid] = setInterval(() => {
            if (!until()) return;

            clearInterval(detectorContainer[uuid]);
            delete detectorContainer[uuid];

            const decorator = (original, before, after) => {
                return function (...arguments) {
                    before && before.call(this, ...arguments);
                    const result = original.apply(this, arguments);
                    after && after.call(this, result, ...arguments);
                    return result;
                };
            }

            obj[func] = decorator(obj[func], before, after);
        }, 20);
    }

    const decorateOpenFile = (before, after) => {
        decorate(() => !!File, File.editor.library, "openFile", before, after)
    }

    const decorateAddCodeBlock = (before, after) => {
        decorate(() => !!File, File.editor.fences, "addCodeBlock", before, after)
    }

    module.exports = {
        insertStyle,
        getPlugin,
        metaKeyPressed,
        dirname,
        getFilePath,
        joinPath,
        requireFile,
        Package,
        decorate,
        decorateOpenFile,
        decorateAddCodeBlock,
    };
})()