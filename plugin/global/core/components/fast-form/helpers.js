function validateDefinition(name, definition, checks, options = {}) {
  const { prefix } = options
  if (prefix && (typeof name !== "string" || !name.startsWith(prefix))) {
    throw new TypeError(`Name '${name}' must be a string and start with '${prefix}'.`)
  }
  if (!definition || typeof definition !== "object") {
    throw new TypeError(`The definition for '${name}' must be a non-null object.`)
  }
  for (const [key, rule] of Object.entries(checks)) {
    const value = definition[key]
    if (rule.required && (value === undefined || value === null)) {
      throw new TypeError(`'${name}' must have a '${key}' of type '${rule.type}'.`)
    }
    if (Object.hasOwn(definition, key)) {
      if (rule.type === "function" && typeof value !== "function") {
        throw new TypeError(`The '${key}' property for '${name}' must be a function.`)
      }
      if (rule.type === "plainObject" && (typeof value !== "object" || value === null || Array.isArray(value))) {
        throw new TypeError(`The '${key}' property for '${name}' must be a plain object.`)
      }
    }
  }
}

const uniqueNum = (() => {
  let n = 0
  return () => n++
})()

function revealElement(el, { key, timers, className = "input-focus", duration = 3000, scroll = false } = {}) {
  if (!el || !className || !duration) return false

  el.closest(".box-container.collapsed")?.classList.remove("collapsed")
  if (timers) {
    const prevTimer = timers.get(key)
    if (prevTimer) clearTimeout(prevTimer)
  }

  el.classList.add(className)
  if (scroll) el.scrollIntoView({ behavior: "smooth", block: "center" })

  const timerId = setTimeout(() => {
    el.classList.remove(className)
    timers?.delete(key)
  }, duration)

  timers?.set(key, timerId)
  return true
}

module.exports = { validateDefinition, uniqueNum, revealElement }
