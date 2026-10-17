const { afterEach, describe, it } = require("node:test")
const assert = require("node:assert")

const Decorator = require("../../plugin/global/core/utils/decorator")
const ExportHelper = require("../../plugin/global/core/utils/exportHelper")

afterEach(() => {
  delete global.File
})

const wait = () => Promise.resolve()

describe("ExportHelper native export", () => {
  it("restores after a synchronous native export failure", async () => {
    const calls = []
    global.File = {
      editor: {
        export: {
          exportToNative: () => {
            calls.push("export")
            throw new Error("export failed")
          },
        },
      },
    }
    const helper = new ExportHelper({ decorator: new Decorator() })
    helper.registerNative("test", () => calls.push("before"), null, () => calls.push("restore"))
    helper.processExportToNative()

    await wait()
    assert.throws(() => File.editor.export.exportToNative(), /export failed/)
    assert.deepStrictEqual(calls, ["before", "export", "restore"])
  })

  it("waits for an asynchronous native export failure before restoring", async () => {
    let reject
    const calls = []
    global.File = {
      editor: {
        export: {
          exportToNative: () => new Promise((resolve, rejectFn) => {
            reject = rejectFn
            calls.push("export")
          }),
        },
      },
    }
    const helper = new ExportHelper({ decorator: new Decorator() })
    helper.registerNative("test", () => calls.push("before"), null, () => calls.push("restore"))
    helper.processExportToNative()

    await wait()
    const result = File.editor.export.exportToNative()
    assert.deepStrictEqual(calls, ["before", "export"])
    reject(new Error("export failed"))
    await assert.rejects(result, /export failed/)
    assert.deepStrictEqual(calls, ["before", "export", "restore"])
  })
})
