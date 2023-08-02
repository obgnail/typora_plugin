window.onload = () => {
    global._plugins_had_injected = false;
    global._plugins = [
        {
            name: "标签页管理",
            fixed_name: "window_tab",
            src: "./plugin/window_tab.js",
            enable: true,
            clickable: false,
        },
        {
            name: "全局多关键字搜索",
            fixed_name: "search_multi",
            src: "./plugin/search_multi.js",
            enable: true,
            clickable: true,
        },
        {
            name: "多关键字高亮",
            fixed_name: "multi_highlighter",
            src: "./plugin/multi_highlighter/index.js",
            enable: true,
            clickable: true,
        },
        {
            name: "表格大小调整",
            fixed_name: "resize_table",
            src: "./plugin/resize_table.js",
            enable: true,
            clickable: false,
        },
        {
            name: "只读模式",
            fixed_name: "read_only",
            src: "./plugin/read_only.js",
            enable: true,
            clickable: true,
        },
        {
            name: "文档大纲",
            fixed_name: "outline",
            src: "./plugin/outline.js",
            enable: true,
            clickable: true,
        },
        {
            name: "文段截断",
            fixed_name: "truncate_text",
            src: "./plugin/truncate_text.js",
            enable: true,
            clickable: true,
        },
        {
            name: "图片大小调整",
            fixed_name: "resize_image",
            src: "./plugin/resize_image.js",
            enable: true,
            clickable: false,
        },
        {
            name: "命令行环境",
            fixed_name: "commander",
            src: "./plugin/commander.js",
            enable: true,
            clickable: true,
        },
        {
            name: "代码块增强",
            fixed_name: "fence_enhance",
            src: "./plugin/fence_enhance.js",
            enable: true,
            clickable: false,
        },
        {
            name: "一键到顶",
            fixed_name: "go_top",
            src: "./plugin/go_top.js",
            enable: true,
            clickable: true,
        },
        {
            name: "文件计数",
            fixed_name: "file_counter",
            src: "./plugin/file_counter.js",
            enable: true,
            clickable: false,
        },
        {
            name: "章节折叠",
            fixed_name: "collapse_paragraph",
            src: "./plugin/collapse_paragraph.js",
            enable: true,
            clickable: false,
        },
        {
            name: "中英文混排优化",
            fixed_name: "md_padding",
            src: "./plugin/md_padding/index.js",
            enable: true,
            clickable: true,
        },
        {
            name: "mermaid替换",
            fixed_name: "mermaid_replace",
            src: "./plugin/mermaid_replace/index.js",
            enable: false,
            clickable: false,
        },
        {
            name: "自动编号",
            fixed_name: "auto_number",
            src: "./plugin/auto_number.js",
            enable: true,
            clickable: false,
        },
        {
            name: "右键菜单",
            fixed_name: "right_click_menu",
            src: "./plugin/right_click_menu.js",
            enable: true,
            clickable: false,
        },
        {
            name: "测试专用",
            fixed_name: "test",
            src: "./plugin/test.js",
            enable: false,
            clickable: false,
        },
    ]

    global._getPlugin = fixed_name => {
        const idx = global._plugins.findIndex(plugin => plugin.enable && plugin.fixed_name === fixed_name)
        if (idx !== -1) {
            return global._plugins[idx];
        }
    }

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
                        const {config, call, callArgs, meta} = reqnode(filepath);
                        plugin.config = config || null;
                        plugin.call = call || null;
                        plugin.call_args = callArgs || null;
                        plugin.meta = meta || null;
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
