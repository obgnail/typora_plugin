(() => {
    const config = {
        HOTKEY: ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "K",
    }

    const Package = {
        Path: reqnode("path"),
        Fs: reqnode("fs"),
        File: global.File,
        ClientCommand: global.ClientCommand,
    }

    const metaKeyPressed = ev => Package.File.isMac ? ev.metaKey : ev.ctrlKey;
    const getFilePath = () => Package.File.filePath || Package.File.bundle && Package.File.bundle.filePath;
    const read = filepath => Package.Fs.readFileSync(filepath, 'utf-8');
    const write = (filepath, content) => Package.Fs.writeFileSync(filepath, content);
    const save = () => File.saveUseNode();

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

    window.addEventListener("keydown", ev => {
        if (config.HOTKEY(ev)) {
            ev.preventDefault();
            ev.stopPropagation();

            save().then(() => {
                const filepath = getFilePath();
                const content = read(filepath);
                const formattedContent = format(content);
                write(filepath, formattedContent);
            })
        }
    }, true)

    console.log("md_padding.js had been injected");
})()