(() => {
    const config = {
        ENABLE: true,
    }
    if (!config.ENABLE) {
        return
    }

    // const HOTKEY = ev => metaKeyPressed(ev) && ev.key === "n";
    // const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;
    //
    // window.addEventListener("keydown", ev => {
    //     if (HOTKEY(ev)) {
    //         console.log("asdasdasdasdasd")
    //         ev.preventDefault();
    //         ev.stopPropagation();
    //     }
    // }, true)
    //
    // document.getElementById("typora-quick-open").addEventListener("mousedown", ev => {
    //     console.log("mousedown")
    //     ev.preventDefault();
    //     ev.stopPropagation();
    // }, true)

    JSBridge.invoke("window.toggleDevTools");
    console.log("test.js had been injected");
})()