const sync = require("./sync")
const rpc = require("./rpc")

module.exports = async () => {
    const cli = await rpc()
    sync(() => {
        cli.startTypora()
        cli.closeTypora()
    })
}
