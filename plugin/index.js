window.addEventListener("load", () => {
    const { dirname, __dirname, reqnode } = global
    const dir = dirname || __dirname
    const core = reqnode("path").join(dir, "./plugin/global/core")
    const { entry } = reqnode(core)
    entry()
})

console.debug(`
  ______                        ___  __          _    
 /_  __/_ _____  ___  _______ _/ _ \\/ /_ _____ _(_)__ 
  / / / // / _ \\/ _ \\/ __/ _ \`/ ___/ / // / _ \`/ / _ \\
 /_/  \\_, / .__/\\___/_/  \\_,_/_/  /_/\\_,_/\\_, /_/_//_/
     /___/_/                             /___/        

       https://github.com/obgnail/typora_plugin
`)
