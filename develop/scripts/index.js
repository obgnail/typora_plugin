const sync = require("./sync")
const rpc = require("./rpc")
const serve = require("./serve")

function run_script(script = "sync") {
    const scripts = { sync, rpc, serve }
    const fn = scripts[script]
    fn?.()
}

run_script(process.argv[2])
