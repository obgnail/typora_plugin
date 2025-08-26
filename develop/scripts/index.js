const fs = require("fs")
const sync = require("./sync")
const rpc = require("./rpc")
const serve = require("./serve")

function check_env() {
    fs.accessSync(process.env.TYPORA_PATH)
}

function run_script(script = "sync") {
    const scripts = { sync, rpc, serve }
    const fn = scripts[script]
    fn?.()
}

check_env()
run_script(process.argv[2])
