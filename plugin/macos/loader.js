/* Minimal WKWebView CommonJS adapter. TOKEN is replaced by install_macos.sh. */
(function () {
  "use strict"

  var BRIDGE = "http://127.0.0.1:45678"
  var TOKEN = "%%TYPORA_MACOS_BRIDGE_TOKEN%%"
  if (window.fetch && TOKEN.indexOf("%%") !== 0) {
    window.fetch(BRIDGE + "/v1/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Typora-Plugin-Token": TOKEN },
      body: JSON.stringify({ method: "probe.report", params: [{ stage: "loader-start" }] }),
    }).catch(function (error) { console.error("[typora-plugin-macos] loader beacon failed", error) })
  }
  var ROOT = new URL("../../", document.currentScript.src).pathname
  var cache = Object.create(null)

  function normalize(value) {
    var absolute = value.charAt(0) === "/"
    var output = []
    value.split("/").forEach(function (part) {
      if (!part || part === ".") return
      if (part === "..") output.pop()
      else output.push(part)
    })
    return (absolute ? "/" : "") + output.join("/")
  }

  var path = {
    sep: "/",
    delimiter: ":",
    normalize: normalize,
    isAbsolute: function (value) { return value.charAt(0) === "/" },
    join: function () { return normalize(Array.prototype.join.call(arguments, "/")) },
    resolve: function () {
      var result = ""
      Array.prototype.forEach.call(arguments, function (part) {
        if (part && part.charAt(0) === "/") result = part
        else if (part) result += "/" + part
      })
      return normalize(result || "/")
    },
    dirname: function (value) { var out = normalize(value).replace(/\/+[^/]*$/, ""); return out || "/" },
    basename: function (value, ext) { var out = normalize(value).split("/").pop(); return ext && out.slice(-ext.length) === ext ? out.slice(0, -ext.length) : out },
    extname: function (value) { var base = this.basename(value); var i = base.lastIndexOf("."); return i > 0 ? base.slice(i) : "" },
    relative: function (from, to) {
      var left = normalize(from).split("/").filter(Boolean)
      var right = normalize(to).split("/").filter(Boolean)
      var i = 0
      while (i < left.length && left[i] === right[i]) i++
      return left.slice(i).map(function () { return ".." }).concat(right.slice(i)).join("/") || "."
    },
    parse: function (value) { var dir = this.dirname(value); var base = this.basename(value); var ext = this.extname(value); return { root: value.charAt(0) === "/" ? "/" : "", dir: dir, base: base, ext: ext, name: ext ? base.slice(0, -ext.length) : base } },
    format: function (value) { return this.join(value.dir || value.root || "", value.base || ((value.name || "") + (value.ext || ""))) },
  }

  function rpc(method, params) {
    if (TOKEN.indexOf("%%") === 0) throw new Error("macOS bridge token was not installed")
    var xhr = new XMLHttpRequest()
    xhr.open("POST", BRIDGE + "/v1/rpc", false)
    xhr.setRequestHeader("Content-Type", "application/json")
    xhr.setRequestHeader("X-Typora-Plugin-Token", TOKEN)
    xhr.send(JSON.stringify({ method: method, params: params || [] }))
    var body = JSON.parse(xhr.responseText || "{}")
    if (xhr.status !== 200 || !body.ok) throw new Error(body.error || "bridge request failed")
    return body.result
  }

  var fs = {
    readFileSync: function (file, encoding) { return rpc("fs.readFile", [file, encoding || "utf8"]) },
    writeFileSync: function (file, data, encoding) { return rpc("fs.writeFile", [file, data, encoding || "utf8"]) },
    existsSync: function (file) { return rpc("fs.exists", [file]) },
    statSync: function (file) { var value = rpc("fs.stat", [file]); value.isFile = function () { return value.type === "file" }; value.isDirectory = function () { return value.type === "directory" }; return value },
    readdirSync: function (file) { return rpc("fs.readdir", [file]) },
    mkdirSync: function (file, options) { return rpc("fs.mkdir", [file, !!(options && options.recursive)]) },
  }
  fs.promises = {
    readFile: function (file, encoding) { return Promise.resolve().then(function () { return fs.readFileSync(file, encoding) }) },
    writeFile: function (file, data, encoding) { return Promise.resolve().then(function () { return fs.writeFileSync(file, data, encoding) }) },
    readdir: function (file) { return Promise.resolve().then(function () { return fs.readdirSync(file) }) },
    mkdir: function (file, options) { return Promise.resolve().then(function () { return fs.mkdirSync(file, options) }) },
  }
  fs.readFile = function (file, encoding, callback) { fs.promises.readFile(file, encoding).then(function (data) { callback(null, data) }, callback) }
  fs.writeFile = function (file, data, encoding, callback) { fs.promises.writeFile(file, data, encoding).then(function () { callback(null) }, callback) }
  var fsExtra = {
    readFile: fs.promises.readFile,
    writeFile: fs.promises.writeFile,
    readdir: fs.promises.readdir,
    access: function (file) { return Promise.resolve().then(function () { if (!fs.existsSync(file)) throw new Error("ENOENT") }) },
    remove: function () { return Promise.reject(new Error("remove is disabled by the macOS permission adapter")) },
  }
  var util = {
    isDeepStrictEqual: function (left, right) {
      if (left === right) return true
      try { return JSON.stringify(left) === JSON.stringify(right) } catch (_) { return false }
    },
  }

  function readBundle(file, allowMissing) {
    var relative = file.indexOf(ROOT) === 0 ? file.slice(ROOT.length) : file.replace(/^\/+/, "")
    var xhr = new XMLHttpRequest()
    xhr.open("GET", "./plugin/" + relative.replace(/^plugin\//, ""), false)
    try { xhr.send() } catch (error) {
      if (allowMissing) return null
      throw new Error("cannot load " + file + ": " + error.message)
    }
    if ((xhr.status !== 0 && xhr.status !== 200) || !xhr.responseText || /^\s*<!doctype|^\s*<html/i.test(xhr.responseText)) {
      if (allowMissing) return null
      throw new Error("cannot load " + file)
    }
    return xhr.responseText
  }

  function resolveModule(request, parent) {
    if (request === "path" || request === "fs" || request === "fs-extra" || request === "os" || request === "util" || request === "buffer" || request === "process") return request
    var file = request.charAt(0) === "/" ? request : path.resolve(path.dirname(parent), request)
    if (!/\.js$/.test(file)) file += ".js"
    return file
  }

  function reqnode(request, parent) {
    parent = parent || path.join(ROOT, "index.js")
    var id = resolveModule(request, parent)
    if (id === "path") return path
    if (id === "fs") return fs
    if (id === "fs-extra") return fsExtra
    if (id === "util") return util
    // Browser bundles commonly use these only for feature detection. WKWebView
    // supplies atob/btoa and the small process object below is enough for the
    // bundled Markmap/YAML runtime without exposing native Node capabilities.
    if (id === "buffer") return { Buffer: window.Buffer }
    if (id === "process") return window.process
    if (id === "os") return { platform: function () { return "darwin" }, homedir: function () { return rpc("os.homedir") }, tmpdir: function () { return "/private/tmp" } }
    if (cache[id]) return cache[id].exports
    var originalId = id
    var module = { exports: {} }
    cache[id] = module
    var source = readBundle(id, true)
    if (source == null) {
      if (!/\.js$/.test(id)) throw new Error("cannot load " + id)
      delete cache[originalId]
      id = id.slice(0, -3) + "/index.js"
      if (cache[id]) return cache[id].exports
      cache[id] = module
      source = readBundle(id)
    }
    var localRequire = function (child) { return reqnode(child, id) }
    Function("module", "exports", "require", "__filename", "__dirname", source + "\n//# sourceURL=" + id)(module, module.exports, localRequire, id, path.dirname(id))
    return module.exports
  }

  window.global = window
  window.global.dirname = ROOT.replace(/\/$/, "")
  window.global.__dirname = window.global.dirname
  window.global.reqnode = reqnode
  window.process = window.process || { platform: "darwin", env: {}, versions: {} }
  window.__typoraMacReportProbe = function (report) { return rpc("probe.report", [report]) }
  window.__typoraMacReportRuntime = function (report) { return rpc("runtime.report", [report]) }

  function describeError(value) {
    if (value && (value.message || value.stack)) {
      var header = [value.name, value.message].filter(Boolean).join(": ")
      return (header + (value.stack ? "\n" + value.stack : "")).slice(0, 4000)
    }
    return String(value).slice(0, 4000)
  }

  var originalConsoleError = console.error
  console.error = function () {
    var args = Array.prototype.slice.call(arguments)
    originalConsoleError.apply(console, args)
    try { window.__typoraMacReportRuntime({ kind: "console-error", message: args.map(describeError).join(" ").slice(0, 4000) }) } catch (_) {}
  }

  window.addEventListener("error", function (event) {
    try { window.__typoraMacReportRuntime({ kind: "window-error", message: describeError(event.error || event.message) }) } catch (_) {}
  })
  window.addEventListener("unhandledrejection", function (event) {
    try { window.__typoraMacReportRuntime({ kind: "unhandled-rejection", message: describeError(event.reason) }) } catch (_) {}
  })

  var probe = document.createElement("script")
  probe.src = "./plugin/macos/probe.js"
  probe.defer = true
  document.head.appendChild(probe)

  try {
    reqnode(path.join(ROOT, "plugin/index.js"))
    var reportFramework = function () {
      try {
        var container = reqnode(path.join(ROOT, "plugin/global/core/container.js"))
        var plugins = container.getAllPlugins()
        var names = Object.keys(plugins)
        if (!names.length) return false
        window.__typoraMacReportRuntime({ kind: "framework-ready", plugins: names })
        var home = rpc("os.homedir")
        var testPlan = path.join(home, ".config/typora_plugin/macos-runtime-test.json")
        if (fs.existsSync(testPlan)) {
          reqnode(path.join(ROOT, "plugin/macos/runtime_test.js"))({
            plan: JSON.parse(fs.readFileSync(testPlan, "utf8")),
            report: window.__typoraMacReportRuntime,
            container: container,
          })
        }
        return true
      } catch (error) {
        window.__typoraMacReportRuntime({ kind: "framework-report-error", message: describeError(error) })
        return true
      }
    }
    var attempts = 0
    var timer = setInterval(function () {
      attempts++
      if (reportFramework() || attempts >= 100) clearInterval(timer)
      if (attempts >= 100) window.__typoraMacReportRuntime({ kind: "framework-timeout" })
    }, 100)
  } catch (error) {
    console.error("[typora-plugin-macos]", error)
    try { window.__typoraMacReportRuntime({ kind: "framework-load-error", message: describeError(error) }) } catch (_) {}
  }
}())
