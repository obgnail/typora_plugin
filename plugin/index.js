window.onload = () => {
    global._plugins_had_injected = false;
    global._plugins = [
        {
            name: "标签页管理",
            src: "./plugin/window_tab.js",
            enable: true,
            clickable: false,
        },
        {
            name: "全局多关键字搜索",
            src: "./plugin/search_multi.js",
            enable: true,
            clickable: true,
        },
        {
            name: "多关键字高亮",
            src: "./plugin/multi_highlighter/index.js",
            enable: true,
            clickable: true,
        },
        {
            name: "表格大小调整",
            src: "./plugin/resize_table.js",
            enable: true,
            clickable: false,
        },
        {
            name: "只读模式",
            src: "./plugin/read_only.js",
            enable: true,
            clickable: true,
        },
        {
            name: "文段截断",
            src: "./plugin/truncate_text.js",
            enable: true,
            clickable: true,
        },
        {
            name: "图片大小调整",
            src: "./plugin/resize_image.js",
            enable: true,
            clickable: false,
        },
        {
            name: "命令行环境",
            src: "./plugin/commander.js",
            enable: true,
            clickable: true,
        },
        {
            name: "代码块增强",
            src: "./plugin/fence_enhance.js",
            enable: true,
            clickable: false,
        },
        {
            name: "一键到顶",
            src: "./plugin/go_top.js",
            enable: true,
            clickable: true,
        },
        {
            name: "文件计数",
            src: "./plugin/file_counter.js",
            enable: true,
            clickable: false,
        },
        {
            name: "章节折叠",
            src: "./plugin/collapse_paragraph.js",
            enable: true,
            clickable: false,
        },
        {
            name: "中英文混排优化",
            src: "./plugin/md_padding/index.js",
            enable: true,
            clickable: true,
        },
        {
            name: "mermaid替换",
            src: "./plugin/mermaid_replace/index.js",
            enable: true,
            clickable: false,
        },
        {
            name: "自动编号",
            src: "./plugin/auto_number.js",
            enable: true,
            clickable: false,
        },
        {
            name: "右键菜单",
            src: "./plugin/right_click_menu.js",
            enable: true,
            clickable: false,
        },
        {
            name: "测试专用",
            src: "./plugin/test.js",
            enable: false,
            clickable: false,
        },
    ]

    const loadPlugin = () => {
        const _path = reqnode("path");
        const _fs = reqnode("fs");
        const dirname = global.dirname || global.__dirname;
        const promises = [];

        global._plugins.forEach(plugin => {
            if (!plugin.enable) return;
            const filepath = _path.join(dirname, plugin.src);
            const promise = new Promise((resolve, reject) => {
                _fs.access(filepath, err => {
                    if (!err) {
                        const {config, Call, CallArgs} = reqnode(filepath);
                        plugin.config = config || null;
                        plugin.call = Call || null;
                        plugin.call_args = CallArgs || null;
                        resolve(plugin);
                    } else {
                        plugin.enable = false;
                        console.log("has no path:", filepath);
                        reject(err);
                    }
                })
            })
            promises.push(promise);
        })

        Promise.all(promises)
            .then(() => global._plugins_had_injected = true)
            .catch(() => global._plugins_had_injected = true)
    }

    loadPlugin();
}
