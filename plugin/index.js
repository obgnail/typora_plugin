/*  1. 整个插件系统向外暴露的变量：
        1. global._plugins_had_injected: 是否所有的插件都已加载完毕
        2. global._plugins: 全部的插件
        3. global._pluginUtils: 通用的工具
        4. global._plugin_settings: 全部的插件配置
    2. global._plugins使用声明式（声明替代代码开发）
        1. name: 展示的插件名
        2. fixed_name: 固定的插件名（可以看作是插件的UUID）
        3. enable: 是否启用
        4. clickable: 是否在右键菜单中可点击
        5. call: 插件的入口函数
        6. call_args: 固定的插件参数，如果存在，那么将在右键菜单中会显示第三级菜单，当用户点击后就会传递参数给call函数
        7. dynamic_call_args_generator: 插件动态参数，用户在不同区域、不同时间点击右键菜单时，显示不同的第三级菜单
        8. meta: 用于传递自定义变量
    3. 核心逻辑位于right_click_menu.js中，
    4. 使用例子可以看collapse_paragraph.js。此插件实现了用户在不同区域（标题处点击、非标题处点击）右键菜单会有不同的第三级菜单。
*/
window.onload = () => {
    global._plugins_had_injected = false;
    global._plugins = [
        {
            name: "标签页管理",
            fixed_name: "window_tab",
            src: "./plugin/window_tab/window_tab.js",
            clickable: true,
        },
        {
            name: "全局多关键字搜索",
            fixed_name: "search_multi",
            src: "./plugin/search_multi.js",
            clickable: true,
        },
        {
            name: "多关键字高亮",
            fixed_name: "multi_highlighter",
            src: "./plugin/multi_highlighter/index.js",
            clickable: true,
        },
        {
            name: "表格调整",
            fixed_name: "resize_table",
            src: "./plugin/resize_table.js",
            clickable: false,
        },
        {
            name: "类别大纲",
            fixed_name: "outline",
            src: "./plugin/outline.js",
            clickable: true,
        },
        {
            name: "命令行环境",
            fixed_name: "commander",
            src: "./plugin/commander.js",
            clickable: true,
        },
        {
            name: "中英文混排优化",
            fixed_name: "md_padding",
            src: "./plugin/md_padding/index.js",
            clickable: true,
        },
        {
            name: "只读模式",
            fixed_name: "read_only",
            src: "./plugin/read_only.js",
            clickable: true,
        },
        {
            name: "图片调整",
            fixed_name: "resize_image",
            src: "./plugin/resize_image.js",
            clickable: true,
        },
        {
            name: "一键到顶",
            fixed_name: "go_top",
            src: "./plugin/go_top.js",
            clickable: true,
        },
        {
            name: "思维导图",
            fixed_name: "mindmap",
            src: "./plugin/mindmap.js",
            clickable: true,
        },
        {
            name: "自动编号",
            fixed_name: "auto_number",
            src: "./plugin/auto_number.js",
            clickable: true,
        },
        {
            name: "代码块增强",
            fixed_name: "fence_enhance",
            src: "./plugin/fence_enhance.js",
            clickable: true,
        },
        {
            name: "章节折叠",
            fixed_name: "collapse_paragraph",
            src: "./plugin/collapse_paragraph.js",
            clickable: true,
        },
        {
            name: "文件计数",
            fixed_name: "file_counter",
            src: "./plugin/file_counter.js",
            clickable: false,
        },
        {
            name: "文段截断",
            fixed_name: "truncate_text",
            src: "./plugin/truncate_text.js",
            clickable: true,
        },
        {
            name: "mermaid替换",
            fixed_name: "mermaid_replace",
            src: "./plugin/mermaid_replace/index.js",
            clickable: false,
        },
        {
            name: "右键菜单",
            fixed_name: "right_click_menu",
            src: "./plugin/right_click_menu.js",
            clickable: true,
        },
        {
            name: "测试专用",
            fixed_name: "test",
            src: "./plugin/test.js",
            clickable: false,
        },
    ]

    const loadPlugins = (join, access, dirname) => {
        const promises = [];
        global._plugins.forEach(plugin => {
            if (!plugin.enable) return;
            const filepath = join(dirname, plugin.src);
            const promise = new Promise((resolve, reject) => {
                access(filepath, err => {
                    if (!err) {
                        try {
                            const {call, callArgs, dynamicCallArgsGenerator, meta} = reqnode(filepath);
                            plugin.call = call || null;
                            plugin.call_args = callArgs || null;
                            plugin.dynamic_call_args_generator = dynamicCallArgsGenerator || null;
                            plugin.meta = meta || null;
                        } catch (e) {
                            plugin.enable = false;
                            console.log("plugin err:", e);
                        }
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

    const loadUtils = (join, dirname) => {
        const filepath = join(dirname, "./plugin/global/utils.js");
        global._pluginUtils = reqnode(filepath);
    }

    const loadSettings = (join, dirname) => {
        const configPath = join(dirname, "./plugin/global/settings.js");
        const {pluginSettings} = reqnode(configPath);
        global._plugins.forEach(plugin => plugin.enable = pluginSettings[plugin.fixed_name].ENABLE)
        global._plugin_settings = pluginSettings;
    }

    const load = () => {
        const join = reqnode("path").join;
        const access = reqnode("fs").access;
        const dirname = global.dirname || global.__dirname;

        loadUtils(join, dirname);
        loadSettings(join, dirname);
        loadPlugins(join, access, dirname);
    }

    load();
}
