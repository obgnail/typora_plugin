(() => {
    const config = {
        ENABLE: false,
    }

    if (!config.ENABLE) {
        return
    }

    JSBridge.invoke("window.toggleDevTools");

    console.log("test.js had been injected");
})()