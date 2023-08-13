(() => {
    const config = global._pluginUtils.getPluginSetting("md_padding");

    const read = filepath => global._pluginUtils.Package.Fs.readFileSync(filepath, 'utf-8');
    const write = (filepath, content) => global._pluginUtils.Package.Fs.writeFileSync(filepath, content);
    const save = () => File.saveUseNode();
    const reload = content => {
        // const scrollTop = document.querySelector("content").scrollTop;
        File.reloadContent(content, {"fromDiskChange": false})
        // document.querySelector("content").scrollTop = scrollTop;
    };

    const getFormatter = () => {
        const {padMarkdown} = global._pluginUtils.requireFile("./plugin/md_padding/md-padding");
        return padMarkdown;
    }

    const format = content => {
        const formatter = getFormatter();
        return formatter(content);
    }

    const call = () => {
        save().then(() => {
            const filepath = global._pluginUtils.getFilePath();
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
        call,
    };

    console.log("md_padding.js had been injected");
})()