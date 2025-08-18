window.addEventListener("load", () => {
    const { dirname, __dirname, reqnode } = global
    const dir = dirname || __dirname
    const core = reqnode("path").join(dir, "./plugin/global/core")
    const { entry } = reqnode(core)
    entry()
})

console.debug(`
   ______                                      __            _     
  /_  __/_  ______  ____  _________ _   ____  / /_  ______ _(_)___ 
   / / / / / / __ \\/ __ \\/ ___/ __ \`/  / __ \\/ / / / / __ \`/ / __ \\
  / / / /_/ / /_/ / /_/ / /  / /_/ /  / /_/ / / /_/ / /_/ / / / / /
 /_/  \\__, / .___/\\____/_/   \\__,_/  / .___/_/\\__,_/\\__, /_/_/ /_/ 
     /____/_/                       /_/            /____/          

              https://github.com/obgnail/typora_plugin             
`)
