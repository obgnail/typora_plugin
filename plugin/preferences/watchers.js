const { utils } = require("../global/core/utils")

// `SetValue` will write file, and a short write event interval can cause bugs
function setValueDelay(context, key, value, delay = 500) {
    setTimeout(() => {
        context.setValue(key, value)
        utils.notification.show("Cascade Modify", "info")
    }, delay)
}

function createBidirectionalConstraint(keyX, keyY, logic) {
    const directions = [
        { source: keyX, target: keyY, getCorrection: logic.getCorrectYFromX },
        { source: keyY, target: keyX, getCorrection: logic.getCorrectXFromY },
    ]
    return directions.reduce((acc, dir) => {
        const watcherKey = `_sync_${dir.target}_from_${dir.source}`
        acc[watcherKey] = {
            when: { [dir.source]: { $ne: null } },
            effect: (isConditionMet, context) => {
                if (!isConditionMet) return
                const valueX = context.getValue(keyX)
                const valueY = context.getValue(keyY)
                if (!logic.isValid(valueX, valueY)) {
                    const sourceValue = context.getValue(dir.source)
                    const correctedTargetValue = dir.getCorrection(sourceValue)
                    setValueDelay(context, dir.target, correctedTargetValue)
                }
            }
        }
        return acc
    }, {})
}

module.exports = {
    echarts: {
        ...createBidirectionalConstraint("RENDERER", "EXPORT_TYPE", {
            isValid(renderer, exportType) {
                if (!renderer || !exportType) return true
                const isSvgValid = renderer === "svg" && exportType === "svg"
                const isCanvasValid = renderer === "canvas" && ["png", "jpg"].includes(exportType)
                return isSvgValid || isCanvasValid
            },
            getCorrectYFromX(renderer) {
                if (renderer === "svg") return "svg"
                if (renderer === "canvas") return "png"
                return null
            },
            getCorrectXFromY(exportType) {
                if (exportType === "svg") return "svg"
                if (["png", "jpg"].includes(exportType)) return "canvas"
                return null
            }
        })
    },
}
