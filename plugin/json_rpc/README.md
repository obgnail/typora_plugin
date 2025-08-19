## 功能

将包括 typora-plugin 所有功能在内的 Typora 的一切能力通过 `json-rpc` 的形式暴露出去，以供 **外部操纵 Typora**。



## 如何使用

启动 json_rpc 插件。当运行 Typora 后，内部就会自动运行一个 json-rpc-server。接着使用你喜欢的语言写一个 json-rpc-client，与 Typora 交互。以下为 Node.js 和 Python 的 example。



### Node.js

```javascript
// 改为你的路径
const rpc = require("./plugin/json_rpc/node-json-rpc.js")

const initRPC = async (options) => {
    const client = new rpc.Client(options)
    return new Promise((resolve, reject) => {
        client.call({ method: "ping", params: [] }, (err, response) => {
            if (err || !response || response.result !== "pong from typora-plugin") {
                reject(new Error("init rpc error", err, response))
                return
            }

            const client_ = {
                call: async (method, params) => new Promise((resolve, reject) => {
                    client.call({ method, params }, (err, resp) => {
                        if (err) reject(err)
                        else resolve(resp)
                    })
                }),
                eval: async (x) => client_.call("eval", [x]),
                invoke: async (plugin, fn, ...args) => client_.call("invokePlugin", [plugin, fn, ...args]),
            }

            resolve(client_)
        })
    })
}

const main = async () => {
    const client = await initRPC({
        port: 5080,
        host: '127.0.0.1',
        path: '/',
        strict: false
    })

	await client.eval("console.log('hello world')")
	const result = await client.invoke("search_multi", "call")
    console.log(result)
}

main()
```

### Python

```python
import requests

url = "http://localhost:5080"


def _call(method, *params):
    return requests.post(url, json={"method": method, "params": params, "jsonrpc": "2.0"}).json().get("result")


def test():
    assert _call("ping") == "pong from typora-plugin"


def invoke_plugin(fixed_name, *args):
    _call("invokePlugin", fixed_name, *args)


def eval_typora(eval_str):
    _call("eval", eval_str)


if __name__ == "__main__":
    # 测试
    test()
    # 切换只读模式
    invoke_plugin("read_only", "call")
    # 切换到第一个标签页
    invoke_plugin("window_tab", "switchTab", 0)
    # 执行alert
    eval_typora("alert('this is test')")
```



## API

目前暴露三个接口：

### ping

- 功能：验证功能是否打通，成功时返回 `pong from typora-plugin`
- 参数：无

### invokePlugin

- 功能：调用 typora-plugin 能力
- 参数：(fixedName，functionName，…args)
  - fixedName：插件的名称
  - functionName：源码中插件的方法
  - args：插件方法参数

### eval

- 功能：执行 eval()
- 参数：evalString
  - 需要执行的字符串

