window.addEventListener("load", () => {
    const { dirname, __dirname, reqnode } = global;
    const dir = dirname || __dirname;
    const core = reqnode("path").join(dir, "./plugin/global/core");
    const { entry } = reqnode(core);
    entry();
});
