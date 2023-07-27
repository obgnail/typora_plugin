(() => {
    const config = {
        // 侧边栏自动编号
        ENABLE_SIDE_BAR: true,
        // 正文自动编号
        ENABLE_CONTENT: true,
        // TOC自动编号
        ENABLE_TOC: true,
        // // 表格自动编号
        ENABLE_TABLE: true,
        // 图片自动编号
        ENABLE_IMAGE: true,
    }

    const content_css = `
    #write { counter-reset: h2; }
    h1 { counter-reset: h2; }
    h2 { counter-reset: h3; }
    h3 { counter-reset: h4; }
    h4 { counter-reset: h5; }
    h5 { counter-reset: h6; }
    
    #write h2:before {
      counter-increment: h2;
      content: counter(h2) ". "; 
    }
    
    #write h3:before,
    h3.md-focus.md-heading:before {
      counter-increment: h3;
      content: counter(h2) "." counter(h3) " ";
    }
    
    #write h4:before,
    h4.md-focus.md-heading:before {
      counter-increment: h4;
      content: counter(h2) "." counter(h3) "." counter(h4) " ";
    }
    
    #write h5:before,
    h5.md-focus.md-heading:before {
      counter-increment: h5;
      content: counter(h2) "." counter(h3) "." counter(h4) "." counter(h5) " "
    }
    
    #write h6:before,
    h6.md-focus.md-heading:before {
      counter-increment: h6;
      content: counter(h2) "." counter(h3) "." counter(h4) "." counter(h5) "." counter(h6) " "
    }
    
    #write>h3.md-focus:before,
    #write>h4.md-focus:before,
    #write>h5.md-focus:before,
    #write>h6.md-focus:before,
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
    }
    `

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
       }
    `

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
    }
   `

    const image_css = `
    #write { counter-reset: Figures; }
    #write p span.md-image.md-img-loaded::after {
        counter-increment: Figures;
        content: "图 " counter(Figures);
        display: block;
        text-align: center;
        margin: 4px 0;
    }`

    const table_css = `
    #write { counter-reset: Tables; }
    #write figure.table-figure::after {
        counter-increment: Tables;
        content: "表 " counter(Tables);
        font-family: monospace;
        display: block;
        text-align: center;
        margin: 4px 0;
    }
    `

    const css = [
        (config.ENABLE_CONTENT) ? content_css : "",
        (config.ENABLE_SIDE_BAR) ? side_bar_css : "",
        (config.ENABLE_TOC) ? toc_css : "",
        (config.ENABLE_IMAGE) ? image_css : "",
        (config.ENABLE_TABLE) ? table_css : "",
    ].join("\n")

    const style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    document.getElementsByTagName("head")[0].appendChild(style);

    console.log("auto_number.js had been injected");
})()