(() => {
    const config = {
        // 侧边栏自动编号
        ENABLE_SIDE_BAR: true,
        // 正文自动编号
        ENABLE_CONTENT: true,
        // TOC自动编号
        ENABLE_TOC: true,
        // 表格自动编号
        ENABLE_TABLE: true,
        // 图片自动编号
        ENABLE_IMAGE: true,
        // 代码块自动编号
        ENABLE_FENCE: true,

        // 下标名称
        NAME: {
            table: "Table",
            image: "Figure",
            fence: "Fence",
        },

        id: "plugin-auto-number-style"
    }

    const bast_css = `
        #write { counter-reset: write-h2 Figures Tables Fences; }
        h1 { counter-reset: write-h2 Figures Tables Fences; }
        h2 { counter-reset: write-h3 Figures Tables Fences; }
        h3 { counter-reset: write-h4; }
        h4 { counter-reset: write-h5; }
        h5 { counter-reset: write-h6; }
    `

    const content_css = `
        #write h2:before {
            counter-increment: write-h2;
            content: counter(write-h2) ". ";
        }
        
        #write h3:before,
        h3.md-focus.md-heading:before {
            counter-increment: write-h3;
            content: counter(write-h2) "." counter(write-h3) " ";
        }
        
        #write h4:before,
        h4.md-focus.md-heading:before {
            counter-increment: write-h4;
            content: counter(write-h2) "." counter(write-h3) "." counter(write-h4) " ";
        }
        
        #write h5:before,
        h5.md-focus.md-heading:before {
            counter-increment: write-h5;
            content: counter(write-h2) "." counter(write-h3) "." counter(write-h4) "." counter(write-h5) " "
        }
        
        #write h6:before,
        h6.md-focus.md-heading:before {
            counter-increment: write-h6;
            content: counter(write-h2) "." counter(write-h3) "." counter(write-h4) "." counter(write-h5) "." counter(write-h6) " "
        }
        
        #write > h3.md-focus:before,
        #write > h4.md-focus:before,
        #write > h5.md-focus:before,
        #write > h6.md-focus:before,
        h3.md-focus:before,
        h4.md-focus:before,
        h5.md-focus:before,
        h6.md-focus:before {
            color: inherit;
            border: inherit;
            border-radius: inherit;
            position: inherit;
            left: initial;
            float: none;
            top: initial;
            font-size: inherit;
            padding-left: inherit;
            padding-right: inherit;
            vertical-align: inherit;
            font-weight: inherit;
            line-height: inherit;
        }`

    const side_bar_css = `
        .outline-content { counter-reset: outline-h2; }
        .outline-h1 { counter-reset: outline-h2; }
        .outline-h2 { counter-reset: outline-h3; }
        .outline-h3 { counter-reset: outline-h4; }
        .outline-h4 { counter-reset: outline-h5; }
        .outline-h5 { counter-reset: outline-h6; }
        
        .outline-content .outline-h2 .outline-label:before {
            counter-increment: outline-h2;
            content: counter(outline-h2) ". ";
        }
        
        .outline-content .outline-h3 .outline-label:before {
            counter-increment: outline-h3;
            content: counter(outline-h2) "." counter(outline-h3) " ";
        }
        
        .outline-content .outline-h4 .outline-label:before {
            counter-increment: outline-h4;
            content: counter(outline-h2) "." counter(outline-h3) "." counter(outline-h4) " ";
        }
        
        .outline-content .outline-h5 .outline-label:before {
            counter-increment: outline-h5;
            content: counter(outline-h2) "." counter(outline-h3) "." counter(outline-h4) "." counter(outline-h5) " ";
        }
        
        .outline-content .outline-h6 .outline-label:before {
            counter-increment: outline-h6;
            content: counter(outline-h2) "." counter(outline-h3) "." counter(outline-h4) "." counter(outline-h5) "." counter(outline-h6) " ";
        }`

    const toc_css = `
        .md-toc-content { counter-reset: toc-h2; }
        .md-toc-h1 { counter-reset: toc-h2; }
        .md-toc-h2 { counter-reset: toc-h3; }
        .md-toc-h3 { counter-reset: toc-h4; }
        .md-toc-h4 { counter-reset: toc-h5; }
        .md-toc-h5 { counter-reset: toc-h6; }
        
        .md-toc-content .md-toc-h2 a:before {
            counter-increment: toc-h2;
            content: counter(toc-h2) ". ";
        }
        
        .md-toc-content .md-toc-h3 a:before {
            counter-increment: toc-h3;
            content: counter(toc-h2) "." counter(toc-h3) " ";
        }
        
        .md-toc-content .md-toc-h4 a:before {
            counter-increment: toc-h4;
            content: counter(toc-h2) "." counter(toc-h3) "." counter(toc-h4) " ";
        }
        
        .md-toc-content .md-toc-h5 a:before {
            counter-increment: toc-h5;
            content: counter(toc-h2) "." counter(toc-h3) "." counter(toc-h4) "." counter(toc-h5) " ";
        }
        
        .md-toc-content .md-toc-h6 a:before {
            counter-increment: toc-h6;
            content: counter(toc-h2) "." counter(toc-h3) "." counter(toc-h4) "." counter(toc-h5) "." counter(toc-h6) " ";
        }`

    const image_css = `
        #write p span.md-image.md-img-loaded::after {
            counter-increment: Figures;
            content: "${config.NAME.image} " counter(write-h2) "-" counter(Figures);
            font-family: monospace;
            display: block;
            text-align: center;
            margin: 4px 0;
        }`

    const table_css = `
        #write figure.table-figure::after {
            counter-increment: Tables;
            content: "${config.NAME.table} " counter(write-h2) "-" counter(Tables);
            font-family: monospace;
            display: block;
            text-align: center;
            margin: 4px 0;
        }`

    const fence_css = `
        #write .md-fences {
            margin-bottom: 2.4em;
        }
        #write .md-fences::after {
            counter-increment: Fences;
            content: "${config.NAME.fence} " counter(write-h2) "-" counter(Fences);
            position: absolute;
            width: 100%;
            text-align: center;
            font-family: monospace;
            margin: 0.6em 0;
            font-size: 1.1em;
            z-index: 9;
        }`

    const disableStyle = () => {
        const ele = document.getElementById(config.id);
        ele && ele.parentElement && ele.parentElement.removeChild(ele);
    }

    const insertStyle = toggle => {
        if (toggle) {
            config[toggle] = !config[toggle];
            disableStyle();
        }

        const css = [
            bast_css,
            (config.ENABLE_CONTENT) ? content_css : "",
            (config.ENABLE_SIDE_BAR) ? side_bar_css : "",
            (config.ENABLE_TOC) ? toc_css : "",
            (config.ENABLE_IMAGE) ? image_css : "",
            (config.ENABLE_TABLE) ? table_css : "",
            (config.ENABLE_FENCE) ? fence_css : "",
        ].join("\n")

        const style = document.createElement('style');
        style.id = config.id;
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);
    }

    insertStyle();

    //////////////////////// 以下是声明式插件系统代码 ////////////////////////
    const callArgs = [
        {
            arg_name: "禁用/启用大纲自动编号",
            arg_value: "set_outline"
        },
        {
            arg_name: "禁用/启用正文自动编号",
            arg_value: "set_content"
        },
        {
            arg_name: "禁用/启用TOC自动编号",
            arg_value: "set_toc"
        },
        {
            arg_name: "禁用/启用表格自动编号",
            arg_value: "set_table"
        },
        {
            arg_name: "禁用/启用图片自动编号",
            arg_value: "set_image"
        },
        {
            arg_name: "禁用/启用代码块自动编号",
            arg_value: "set_fence"
        },
    ];

    const dynamicCallArgsGenerator = () => {
        const ele = document.getElementById("plugin-auto-number-style");
        let arg_name, arg_value;
        if (ele) {
            arg_name = "禁用";
            arg_value = "disable";
        } else {
            arg_name = "启用";
            arg_value = "enable";
        }
        return [{arg_name, arg_value}]
    }

    const callMap = {
        disable: disableStyle,
        enable: insertStyle,
        set_outline: () => insertStyle("ENABLE_SIDE_BAR"),
        set_content: () => insertStyle("ENABLE_CONTENT"),
        set_toc: () => insertStyle("ENABLE_TOC"),
        set_table: () => insertStyle("ENABLE_TABLE"),
        set_image: () => insertStyle("ENABLE_IMAGE"),
        set_fence: () => insertStyle("ENABLE_FENCE"),
    }

    const call = type => {
        const func = callMap[type];
        func && func();
    }
    module.exports = {
        config,
        call,
        callArgs,
        dynamicCallArgsGenerator,
    };

    console.log("auto_number.js had been injected");
})()