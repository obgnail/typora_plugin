(() => {
    const config = {
        HOTKEY: ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "K",
    }

    const Package = {
        Path: reqnode("path"),
        Fs: reqnode("fs"),
    }

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;
    const getFilePath = () => File.filePath || File.bundle && File.bundle.filePath;
    const read = filepath => Package.Fs.readFileSync(filepath, 'utf-8');
    const write = (filepath, content) => Package.Fs.writeFileSync(filepath, content);
    const save = () => File.saveUseNode();
    const reload = content => {
        // const scrollTop = document.querySelector("content").scrollTop;
        File.reloadContent(content, {"fromDiskChange": false})
        // document.querySelector("content").scrollTop = scrollTop;
    };

    const getFormatter = () => {
        const dirname = global.dirname || global.__dirname;
        const filepath = Package.Path.join(dirname, "plugin", "md_padding", "md-padding");
        const {padMarkdown} = reqnode(filepath);
        return padMarkdown;
    }

    const format = content => {
        const formatter = getFormatter();
        return formatter(content);
    }

    const call = () => {
        save().then(() => {
            const filepath = getFilePath();
            const content = read(filepath);
            const formattedContent = format(content);
            write(filepath, formattedContent);
            reload(formattedContent);
        })
    }

    window.addEventListener("keydown", ev => {
        if (config.HOTKEY(ev)) {
            call();
            ev.preventDefault();
            ev.stopPropagation();
        }
    }, true)

    module.exports = {
        config,
        call,
    };

    console.log("md_padding.js had been injected");
})()