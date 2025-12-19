const utils = require("../global/core/utils")

function createBidirectionalConstraint(keyX, keyY, logic) {
    // `setValue` will write file, and a short write event interval can cause bugs
    const setValueDelay = (context, key, value, delay = 500) => {
        setTimeout(() => {
            context.setValue(key, value)
            utils.notification.show(`Cascade Modify: Auto-correct Field "${key}"`, "info")
        }, delay)
    }
    const directions = [
        { source: keyX, target: keyY, getCorrection: logic.getCorrectYFromX },
        { source: keyY, target: keyX, getCorrection: logic.getCorrectXFromY },
    ]
    return directions.map(dir => ({
        name: `_sync_${dir.target}_from_${dir.source}`,
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
    }))
}

const rendererConstraints = createBidirectionalConstraint("RENDERER", "EXPORT_TYPE", {
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

module.exports = {
    echarts: rendererConstraints,
    plantUML: [{
        name: "showServerHint",
        when: { $and: [{ enable: true }, { $meta: { $isMounting: false } }] },
        affects: [],
        effect: (isConditionMet, context) => {
            if (isConditionMet) utils.notification.show(`Plugin Enabled!\nPlease ensure server ${context.getValue("SERVER_URL")} is available.`)
        }
    }],
    sidebar_enhance: [{
        when: { $and: [{ CUSTOMIZE_SIDEBAR_ICONS: true }, { $meta: { $isMounting: false, $isBetaTypora: true } }] },
        affects: [],
        effect: (isMet) => {
            if (isMet) utils.notification.show('The Beta version of Typora has NOT the "ty-file-icon" style.\nPlease switch to Font-Awesome or Ion-Icons')
        },
    }],
}
