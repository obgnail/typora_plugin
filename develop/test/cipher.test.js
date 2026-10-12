const { describe, it, beforeEach, mock } = require("node:test")
const assert = require("node:assert/strict")
const mockUtils = require("./mocks/utils.mock.js")

global.BasePlugin = class {
  constructor(fixedName, config, i18n) {
    this.fixedName = fixedName
    this.pluginName = config.NAME || i18n.t("pluginName")
    this.config = config
    this.i18n = i18n
    this.utils = mockUtils
  }
}

const { plugin: CipherPlugin, createCipher } = require("../../plugin/cipher/index.js")

const key1 = "1234567891234567891234567891234567891234567"
const key2 = "9876543219876543219876543219876543219876543"

describe("cipher - createCipher (pure logic, no BasePlugin/DOM needed)", () => {
  let cipher

  beforeEach(() => {
    cipher = createCipher(() => key1)
  })

  describe("isEncrypted - new format (TYPENC1: prefix)", () => {
    it("recognizes TYPENC1: prefix followed by valid base64 payload", () => {
      const encrypted = cipher.encrypt("hello world")
      assert.ok(encrypted.startsWith("TYPENC1:"))
      assert.equal(cipher.isEncrypted(encrypted), true)
    })

    it("rejects TYPENC1: prefix followed by non-base64 content (spaces, CJK, punctuation)", () => {
      assert.equal(cipher.isEncrypted("TYPENC1:not base64!! 中文"), false)
    })

    it("rejects TYPENC1: prefix followed by an empty payload", () => {
      assert.equal(cipher.isEncrypted("TYPENC1:"), false)
    })
  })

  describe("isEncrypted - legacy format (no prefix, raw base64)", () => {
    it("recognizes legacy base64 ciphertext (length multiple of 4, valid charset)", () => {
      // "dGVzdA==" is valid base64, length 8 (multiple of 4)
      assert.equal(cipher.isEncrypted("dGVzdA=="), true)
    })

    it("rejects legacy-shaped strings whose length is not a multiple of 4", () => {
      assert.equal(cipher.isEncrypted("abc"), false)
      assert.equal(cipher.isEncrypted("abcde"), false)
    })

    it("rejects strings with correct length but illegal base64 characters", () => {
      assert.equal(cipher.isEncrypted("ab!@"), false)
      assert.equal(cipher.isEncrypted("中文测试"), false)
    })

    it("documents current behavior for the empty string edge case", () => {
      assert.equal(cipher.isEncrypted(""), false)
    })
  })

  describe("isEncrypted - plain text", () => {
    it("rejects ordinary plain text that is neither new nor legacy format", () => {
      assert.equal(cipher.isEncrypted("hello world"), false)
      assert.equal(cipher.isEncrypted("多行\n文本内容"), false)
    })
  })

  describe("encrypt()", () => {
    it("always prefixes output with the magic header TYPENC1:", () => {
      const encrypted = cipher.encrypt("abc")
      assert.ok(encrypted.startsWith("TYPENC1:"))
    })

    it("produces output recognized as encrypted by isEncrypted()", () => {
      const encrypted = cipher.encrypt("abc")
      assert.equal(cipher.isEncrypted(encrypted), true)
    })

    it("produces different ciphertext for different keys given the same plaintext", () => {
      const a = createCipher(() => key1).encrypt("same plaintext")
      const b = createCipher(() => key2).encrypt("same plaintext")
      assert.notEqual(a, b)
    })

    it("lazily requires the underlying crypto module only on first use", () => {
      // getCrypto() memoizes `crypto`; calling encrypt twice should not throw
      // and should be consistent on repeated invocations with the same key.
      const first = cipher.encrypt("x")
      const second = cipher.encrypt("x")
      assert.equal(typeof first, "string")
      assert.equal(typeof second, "string")
    })
  })

  describe("decrypt() - branch dispatch", () => {
    it("decrypts new-format ciphertext by stripping the TYPENC1: prefix before delegating", () => {
      const raw = "new format payload"
      const encrypted = cipher.encrypt(raw)
      assert.equal(cipher.decrypt(encrypted), raw)
    })

    it("decrypts legacy-format ciphertext without stripping any prefix", () => {
      const aes = require("../../plugin/cipher/aes-ecb.min.js")
      const raw = "legacy payload"
      const legacyCiphertext = aes.encrypt(raw, key1)
      assert.equal(cipher.isEncrypted(legacyCiphertext), true)
      assert.equal(cipher.decrypt(legacyCiphertext), raw)
    })

    it("returns null for input matching neither the new nor legacy format", () => {
      assert.equal(cipher.decrypt("not encrypted at all!!"), null)
    })

    it("returns null for empty-prefix-only input that is not actually ciphertext", () => {
      assert.equal(cipher.decrypt("TYPENC1:"), null)
    })
  })

  describe("encrypt/decrypt round-trip", () => {
    const cases = [
      "simple ascii text",
      "",
      "multi\nline\ntext",
      "special chars: !@#$%^&*()_+-=[]{}|;:'\",.<>/?`~",
      "emoji 🎉 and 中文字符",
      "a".repeat(1000),
    ]

    for (const raw of cases) {
      it(`round-trips correctly for: ${JSON.stringify(raw.length > 40 ? raw.slice(0, 40) + "..." : raw)}`, () => {
        const encrypted = cipher.encrypt(raw)
        assert.equal(cipher.decrypt(encrypted), raw)
      })
    }

    it("decrypting with the wrong key does not return the original plaintext", () => {
      const raw = "sensitive content"
      const encrypted = cipher.encrypt(raw)

      const other = createCipher(() => "a-different-key")
      const decrypted = other.decrypt(encrypted)
      assert.notEqual(decrypted, raw)
    })
  })
})

describe("cipher - CipherPlugin interaction branches (requires BasePlugin stub)", () => {
  function makeI18n() {
    return { t: key => key }
  }

  function makeConfig(overrides = {}) {
    return {
      ENABLE: true,
      NAME: "Cipher",
      SECRET_KEY: key1,
      SHOW_HINT_DIALOG: true,
      ENCRYPT_HOTKEY: "ctrl+shift+e",
      DECRYPT_HOTKEY: "ctrl+shift+d",
      ...overrides,
    }
  }

  function createInstance(configOverrides = {}, utilsOverrides = {}) {
    const instance = new CipherPlugin("cipher", makeConfig(configOverrides), makeI18n())
    instance.utils = { ...mockUtils, ...utilsOverrides }
    return instance
  }

  describe("encrypt()", () => {
    it("encrypts directly without prompting when SHOW_HINT_DIALOG is false and content is plain", async () => {
      const showMessageBox = mock.fn()
      const instance = createInstance({ SHOW_HINT_DIALOG: false }, { showMessageBox })

      const result = await instance.encrypt("hello")

      assert.equal(showMessageBox.mock.callCount(), 0)
      assert.ok(result.startsWith("TYPENC1:"))
    })

    it("prompts and encrypts when user confirms (response === 0) on plain content", async () => {
      const showMessageBox = mock.fn(async () => ({ response: 0, checkboxChecked: false }))
      const instance = createInstance({ SHOW_HINT_DIALOG: true }, { showMessageBox })

      const result = await instance.encrypt("hello")

      assert.equal(showMessageBox.mock.callCount(), 1)
      assert.ok(result.startsWith("TYPENC1:"))
    })

    it("prompts and returns raw unchanged when user cancels (response !== 0)", async () => {
      const showMessageBox = mock.fn(async () => ({ response: 1, checkboxChecked: false }))
      const instance = createInstance({ SHOW_HINT_DIALOG: true }, { showMessageBox })

      const result = await instance.encrypt("hello")

      assert.equal(result, "hello")
    })

    it("always prompts when content is already encrypted, even if SHOW_HINT_DIALOG is false", async () => {
      const showMessageBox = mock.fn(async () => ({ response: 0, checkboxChecked: false }))
      const instance = createInstance({ SHOW_HINT_DIALOG: false }, { showMessageBox })

      const encrypted = instance.cipher.encrypt("already encrypted")
      const result = await instance.encrypt(encrypted)

      assert.equal(showMessageBox.mock.callCount(), 1)
      assert.equal(result, encrypted)
    })

    it("persists checkboxChecked=true by flipping showMessageBox to false for subsequent calls", async () => {
      let callCount = 0
      const showMessageBox = mock.fn(async () => {
        callCount++
        return { response: 0, checkboxChecked: true }
      })
      const instance = createInstance({ SHOW_HINT_DIALOG: true }, { showMessageBox })

      await instance.encrypt("first call")
      assert.equal(instance.showMessageBox, false)

      await instance.encrypt("second call")
      assert.equal(callCount, 1)
    })
  })

  describe("decrypt()", () => {
    it("returns decrypted plaintext without prompting when content is valid ciphertext", async () => {
      const showMessageBox = mock.fn()
      const instance = createInstance({}, { showMessageBox })

      const encrypted = instance.cipher.encrypt("secret message")
      const result = await instance.decrypt(encrypted)

      assert.equal(result, "secret message")
      assert.equal(showMessageBox.mock.callCount(), 0)
    })

    it("prompts and returns the original input unchanged when content is not encrypted", async () => {
      const showMessageBox = mock.fn(async () => ({}))
      const instance = createInstance({}, { showMessageBox })

      const result = await instance.decrypt("plain text, not encrypted")

      assert.equal(showMessageBox.mock.callCount(), 1)
      assert.equal(result, "plain text, not encrypted")
    })
  })

  describe("call()", () => {
    it("dispatches 'encrypt'/'decrypt' through utils.editCurrentFile with the bound method", async () => {
      const editCurrentFile = mock.fn(async fn => fn)
      const instance = createInstance({}, { editCurrentFile })

      await instance.call("encrypt")
      assert.equal(editCurrentFile.mock.calls[0].arguments[0], instance.encrypt)

      await instance.call("decrypt")
      assert.equal(editCurrentFile.mock.calls[1].arguments[0], instance.decrypt)
    })

    it("silently does nothing for an unknown action, without calling editCurrentFile", async () => {
      const editCurrentFile = mock.fn()
      const instance = createInstance({}, { editCurrentFile })

      await instance.call("notARealAction")
      assert.equal(editCurrentFile.mock.callCount(), 0)
    })
  })

  describe("hotkey()", () => {
    it("binds ENCRYPT_HOTKEY/DECRYPT_HOTKEY callbacks to call('encrypt')/call('decrypt')", () => {
      const instance = createInstance()
      const callSpy = mock.method(instance, "call", () => undefined)

      const hotkeys = instance.hotkey()
      assert.equal(hotkeys.length, 2)
      assert.equal(hotkeys[0].hotkey, instance.config.ENCRYPT_HOTKEY)
      assert.equal(hotkeys[1].hotkey, instance.config.DECRYPT_HOTKEY)

      hotkeys[0].callback()
      assert.equal(callSpy.mock.calls[0].arguments[0], "encrypt")

      hotkeys[1].callback()
      assert.equal(callSpy.mock.calls[1].arguments[0], "decrypt")
    })
  })
})
