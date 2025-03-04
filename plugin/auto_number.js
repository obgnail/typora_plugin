class autoNumberPlugin extends BasePlugin {
    beforeProcess = () => {
        this.css_id = "plugin-auto-number-style"

        this.base_css = `
        #write {
            --content-h2-format: counter(content-h2) ". ";
            --content-h3-format: counter(content-h2) "." counter(content-h3) " ";
            --content-h4-format: counter(content-h2) "." counter(content-h3) "." counter(content-h4) " ";
            --content-h5-format: counter(content-h2) "." counter(content-h3) "." counter(content-h4) "." counter(content-h5) " ";
            --content-h6-format: counter(content-h2) "." counter(content-h3) "." counter(content-h4) "." counter(content-h5) "." counter(content-h6) " ";
            
            --outline-h2-format: counter(outline-h2) ". ";
            --outline-h3-format: counter(outline-h2) "." counter(outline-h3) " ";
            --outline-h4-format: counter(outline-h2) "." counter(outline-h3) "." counter(outline-h4) " ";
            --outline-h5-format: counter(outline-h2) "." counter(outline-h3) "." counter(outline-h4) "." counter(outline-h5) " ";
            --outline-h6-format: counter(outline-h2) "." counter(outline-h3) "." counter(outline-h4) "." counter(outline-h5) "." counter(outline-h6) " ";
            
            --toc-h2-format: counter(toc-h2) ". ";
            --toc-h3-format: counter(toc-h2) "." counter(toc-h3) " ";
            --toc-h4-format: counter(toc-h2) "." counter(toc-h3) "." counter(toc-h4) " ";
            --toc-h5-format: counter(toc-h2) "." counter(toc-h3) "." counter(toc-h4) "." counter(toc-h5) " ";
            --toc-h6-format: counter(toc-h2) "." counter(toc-h3) "." counter(toc-h4) "." counter(toc-h5) "." counter(toc-h6) " ";
            
            --image-format: "${this.config.NAMES.table} " counter(image) " " attr(data-alt);
            --table-format: "${this.config.NAMES.image} " counter(table);
            --fence-format: "${this.config.NAMES.fence} " counter(fence);
        }

        #write { counter-reset: content-h2 image table fence; }
        #write > h1 { counter-reset: content-h2; }
        #write > h2 { counter-reset: content-h3; }
        #write > h3 { counter-reset: content-h4; }
        #write > h4 { counter-reset: content-h5; }
        #write > h5 { counter-reset: content-h6; }
        
        @media print {
            pb { display: block; page-break-after: always; }
            h1 { page-break-before: always; }
            h1:first-of-type { page-break-before: avoid; }
            p:has(img:first-child) { page-break-inside: avoid; }
        }`

        this.content_css = `
        #write > h2:before,
        #write > h2.md-focus.md-heading:before {
            counter-increment: content-h2;
            content: var(--content-h2-format);
        }
        
        #write > h3:before,
        #write > h3.md-focus.md-heading:before {
            counter-increment: content-h3;
            content: var(--content-h3-format);
        }
        
        #write > h4:before,
        #write > h4.md-focus.md-heading:before {
            counter-increment: content-h4;
            content: var(--content-h4-format);
        }
        
        #write > h5:before,
        #write > h5.md-focus.md-heading:before {
            counter-increment: content-h5;
            content: var(--content-h5-format);
        }
        
        #write > h6:before,
        #write > h6.md-focus.md-heading:before {
            counter-increment: content-h6;
            content: var(--content-h6-format);
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
            visibility: inherit;
        }`

        this.outline_css = `
        .outline-content { counter-reset: outline-h2; }
        .outline-h1 { counter-reset: outline-h2; }
        .outline-h2 { counter-reset: outline-h3; }
        .outline-h3 { counter-reset: outline-h4; }
        .outline-h4 { counter-reset: outline-h5; }
        .outline-h5 { counter-reset: outline-h6; }
        
        .outline-content .outline-h2 .outline-label:before {
            counter-increment: outline-h2;
            content: var(--outline-h2-format);
        }
        
        .outline-content .outline-h3 .outline-label:before {
            counter-increment: outline-h3;
            content: var(--outline-h3-format);
        }
        
        .outline-content .outline-h4 .outline-label:before {
            counter-increment: outline-h4;
            content: var(--outline-h4-format);
        }
        
        .outline-content .outline-h5 .outline-label:before {
            counter-increment: outline-h5;
            content: var(--outline-h5-format);
        }
        
        .outline-content .outline-h6 .outline-label:before {
            counter-increment: outline-h6;
            content: var(--outline-h6-format);
        }`

        this.toc_css = `
        .md-toc-content { counter-reset: toc-h2; }
        .md-toc-h1 { counter-reset: toc-h2; }
        .md-toc-h2 { counter-reset: toc-h3; }
        .md-toc-h3 { counter-reset: toc-h4; }
        .md-toc-h4 { counter-reset: toc-h5; }
        .md-toc-h5 { counter-reset: toc-h6; }
        
        .md-toc-content .md-toc-h2 a:before {
            counter-increment: toc-h2;
            content: var(--toc-h2-format);
        }
        
        .md-toc-content .md-toc-h3 a:before {
            counter-increment: toc-h3;
            content: var(--toc-h3-format);
        }
        
        .md-toc-content .md-toc-h4 a:before {
            counter-increment: toc-h4;
            content: var(--toc-h4-format);
        }
        
        .md-toc-content .md-toc-h5 a:before {
            counter-increment: toc-h5;
            content: var(--toc-h5-format);
        }
        
        .md-toc-content .md-toc-h6 a:before {
            counter-increment: toc-h6;
            content: var(--toc-h6-format);
        }`

        const image_content = `
            counter-increment: image;
            content: var(--image-format);
            font-family: ${this.config.FONT_FAMILY};
            display: block;
            text-align: ${this.config.ALIGN};
            margin: 4px 0;
        `
        this.image_css = `#write .md-image::after {${image_content}}`
        this.image_export_css = `#write p:has(img:first-child)::after {${image_content}}`

        this.table_css = `
        #write .table-figure::after {
            counter-increment: table;
            content: var(--table-format);
            font-family: ${this.config.FONT_FAMILY};
            display: block;
            text-align: ${this.config.ALIGN};
            margin: 4px 0;
        }`

        this.fence_css = `
        #write .md-fences {
            margin-bottom: 2.4em;
        }
        #write .md-fences::after {
            counter-increment: fence;
            content: var(--fence-format);
            position: absolute;
            width: 100%;
            text-align: ${this.config.ALIGN};
            font-family: ${this.config.FONT_FAMILY};
            margin: 0.6em 0;
            font-size: 1.1em;
            z-index: 9;
        }
        #write .md-fences.md-fences-advanced.md-focus::after {
            content: ""
        }
        `
    }

    style = () => ({ textID: this.css_id, text: this.getResultStyle() })

    process = () => {
        this.utils.runtime.autoSaveConfig(this);
        if (this.config.ENABLE_WHEN_EXPORT) {
            new exportHelper(this).process();
        }
        if (this.config.ENABLE_IMAGE && this.config.SHOW_IMAGE_NAME) {
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileEdited, () => {
                const images = this.utils.entities.querySelectorAllInWrite(".md-image:not([data-alt]) > img");
                for (const image of images) {
                    image.parentElement.dataset.alt = image.getAttribute("alt");
                }
            })
        }
    }

    removeStyle = () => this.utils.removeStyle(this.css_id);

    getStyleString = (inExport = false) => {
        const image_css = (inExport && this.utils.supportHasSelector) ? this.image_export_css : this.image_css;
        const { ENABLE_CONTENT, ENABLE_OUTLINE, ENABLE_TOC, ENABLE_IMAGE, ENABLE_TABLE, ENABLE_FENCE } = this.config;
        return [
            this.base_css,
            ENABLE_CONTENT ? this.content_css : "",
            ENABLE_OUTLINE ? this.outline_css : "",
            ENABLE_TOC ? this.toc_css : "",
            ENABLE_IMAGE ? image_css : "",
            ENABLE_TABLE ? this.table_css : "",
            ENABLE_FENCE ? this.fence_css : "",
        ].join("\n")
    }

    getResultStyle = toggle => {
        if (toggle) {
            this.config[toggle] = !this.config[toggle];
            this.removeStyle();
        }
        return this.getStyleString()
    }

    toggleSetting = toggle => {
        const css = this.getResultStyle(toggle);
        this.utils.insertStyle(this.css_id, css);
    }

    getDynamicActions = () => this.i18n.fillActions([
        { act_value: "set_outline", act_state: this.config.ENABLE_OUTLINE },
        { act_value: "set_content", act_state: this.config.ENABLE_CONTENT },
        { act_value: "set_toc", act_state: this.config.ENABLE_TOC },
        { act_value: "set_table", act_state: this.config.ENABLE_TABLE },
        { act_value: "set_image", act_state: this.config.ENABLE_IMAGE },
        { act_value: "set_fence", act_state: this.config.ENABLE_FENCE },
    ])

    call = action => {
        const callMap = {
            set_outline: () => this.toggleSetting("ENABLE_OUTLINE"),
            set_content: () => this.toggleSetting("ENABLE_CONTENT"),
            set_toc: () => this.toggleSetting("ENABLE_TOC"),
            set_table: () => this.toggleSetting("ENABLE_TABLE"),
            set_image: () => this.toggleSetting("ENABLE_IMAGE"),
            set_fence: () => this.toggleSetting("ENABLE_FENCE"),
        }
        const func = callMap[action];
        func && func();
    }
}

// Adds CSS on export and resolves the issue of missing numbering in the PDF export table of contents.
class exportHelper {
    constructor(plugin) {
        this.inExport = false;
        this.plugin = plugin;
    }

    beforeExport = () => {
        this.inExport = true;
        return `body {font-variant-ligatures: no-common-ligatures;} ` + this.plugin.getStyleString(true);
    }

    afterGetHeaderMatrix = headers => {
        if (!this.inExport) return;
        this.inExport = false;

        const numbering = { H2: 0, H3: 0, H4: 0, H5: 0, H6: 0 };
        headers.forEach(header => {
            const tagName = "H" + header[0];
            if (!numbering.hasOwnProperty(tagName)) return;

            let val = "";
            switch (tagName) {
                case "H1":
                    numbering.H2 = 0;
                    break
                case "H2":
                    numbering.H3 = 0;
                    numbering.H2++;
                    val = `${numbering.H2}. `;
                    break
                case "H3":
                    numbering.H4 = 0;
                    numbering.H3++;
                    val = `${numbering.H2}.${numbering.H3} `;
                    break
                case "H4":
                    numbering.H5 = 0;
                    numbering.H4++;
                    val = `${numbering.H2}.${numbering.H3}.${numbering.H4} `;
                    break
                case "H5":
                    numbering.H6 = 0;
                    numbering.H5++;
                    val = `${numbering.H2}.${numbering.H3}.${numbering.H4}.${numbering.H5} `;
                    break
                case "H6":
                    numbering.H6++;
                    val = `${numbering.H2}.${numbering.H3}.${numbering.H4}.${numbering.H5}.${numbering.H6} `;
                    break
            }
            header[1] = val + header[1];
        })
    }

    process = () => {
        this.plugin.utils.exportHelper.register("auto_number", this.beforeExport);
        this.plugin.utils.decorate(
            () => File && File.editor && File.editor.library && File.editor.library.outline,
            "getHeaderMatrix", null, this.afterGetHeaderMatrix
        );
    }
}

module.exports = {
    plugin: autoNumberPlugin
}
