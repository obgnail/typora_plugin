const SDK = require("../../plugin/remote_control/client.js")

module.exports = async () => {
  const port = process.env.JSON_RPC_PORT
  const token = process.env.JSON_RPC_AUTH_TOKEN
  return new SDK(`http://localhost:${port}`, { token: token })
}
