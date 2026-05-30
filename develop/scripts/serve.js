const sync = require("./sync")
const rpc = require("./rpc")

module.exports = async () => {
  const sdk = await rpc()
  sync(async () => sdk.api.system.restartTypora())
}
