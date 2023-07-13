(()=>{
    const getPath = file => {
        const dirname = global.dirname || global.__dirname;
        return reqnode("path").join(dirname, "plugin", "window_tab", file);
    }

    reqnode(getPath("bundle.js"));

    const link = document.createElement('link');
    link.type = 'text/css';
    link.rel = 'stylesheet';
    link.href = getPath("bundle.css");
    document.getElementsByTagName('head')[0].appendChild(link);

    console.log("window_tab.js had been injected");
})()