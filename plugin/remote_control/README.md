## Features

Exposes Typora's full capabilities—including all Typora Plugin features—via `JSON RPC`, enabling you to **remotely control Typora**.

## Usage

Enable the `remote_control` plugin. Once Typora is launched, a `JSON RPC Server` will automatically run in the background. You can then write a `JSON RPC Client` to interact with Typora.

```javascript
const RpcSDK = require("your_path_to_typora_dir/plugin/remote_control/client.js")

const address = "http://localhost:5080/"
const auto_token = "secret-token"
const sdk = new RpcSDK(address, { token: auto_token })

async function main() {
  try {
    console.log(await sdk.discover())  // Get all available APIs
    console.log(await sdk.authenticate(auto_token))

    // System APIs
    console.log(await sdk.api.system.ping())
    console.log(await sdk.api.system.getVersion())
    console.log(await sdk.api.system.getStatus())
    // console.log(await client.api.system.eval("console.log(1)"))  // Only works if ENABLE_EVAL is enabled

    // Document APIs
    const content = await sdk.api.document.getContent()
    console.log("Document content:", content)

    // Plugin APIs
    const plugins = await sdk.api.plugin.list()
    console.log("Available plugins:", plugins)

    // Call a plugin method
    await sdk.api.plugin.call({
      plugin: "read_only",
      method: "call",
      args: []
    })

  } catch (error) {
    console.error("RPC Error:", error)
  }
}

main()
```
