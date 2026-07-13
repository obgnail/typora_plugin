const PANEL_SELECTOR = ".md-diagram-panel"
const SURFACE_SELECTOR = ".plugin-diagram-surface"
const CONTENT_SELECTOR = ".plugin-diagram-content"
const TOOLBAR_SELECTOR = ".plugin-diagram-toolbar"
const HANDLE_SELECTOR = ".plugin-diagram-resize-handle"

const buildStyle = () => `
    #write ${PANEL_SELECTOR}.plugin-diagram-enhance {
      position: relative;
    }
    ${SURFACE_SELECTOR} {
      position: relative;
      box-sizing: border-box;
      overflow: hidden !important;
      touch-action: auto;
      background-color: transparent;
      box-shadow: inset 0 0 0 1px transparent;
      transition: background-color .14s ease, box-shadow .14s ease;
    }
    ${SURFACE_SELECTOR}:hover,
    ${SURFACE_SELECTOR}:focus-within,
    ${SURFACE_SELECTOR}.plugin-diagram-panning,
    ${SURFACE_SELECTOR}.plugin-diagram-resizing-active {
      background-color: rgba(66, 133, 244, .035);
      background-color: color-mix(in srgb, var(--active-file-bg-color, #4285f4) 5%, transparent);
      box-shadow: inset 0 0 0 1px var(--active-file-border-color, rgba(66, 133, 244, .72));
    }
    ${SURFACE_SELECTOR}.plugin-diagram-touch-enabled {
      touch-action: none;
    }
    ${CONTENT_SELECTOR} {
      position: relative;
      width: 100%;
      min-width: 100%;
      min-height: 100%;
      transform: translate3d(0, 0, 0) scale(1);
      transform-origin: 0 0;
      will-change: transform;
    }
    ${SURFACE_SELECTOR}.plugin-diagram-pan-enabled ${CONTENT_SELECTOR} {
      cursor: grab;
    }
    ${SURFACE_SELECTOR}.plugin-diagram-panning ${CONTENT_SELECTOR} {
      cursor: grabbing;
      transition: none !important;
    }
    ${TOOLBAR_SELECTOR} {
      position: absolute;
      z-index: 40;
      right: 10px;
      bottom: 10px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-sizing: border-box;
      min-height: 38px;
      padding: 5px 7px;
      color: var(--text-color);
      background: var(--bg-color, rgba(255, 255, 255, .92));
      background: color-mix(in srgb, var(--bg-color) 88%, transparent);
      border: 1px solid var(--window-border, rgba(127, 127, 127, .35));
      border-radius: 6px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, .18);
      backdrop-filter: blur(8px);
      user-select: none;
    }
    ${TOOLBAR_SELECTOR} button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: 28px;
      height: 28px;
      padding: 0;
      color: inherit;
      background: var(--active-file-bg-color, rgba(127, 127, 127, .16));
      border: 1px solid transparent;
      border-radius: 4px;
      outline: none;
      cursor: pointer;
    }
    ${TOOLBAR_SELECTOR} button:hover,
    ${TOOLBAR_SELECTOR} button:focus-visible {
      background: var(--item-hover-bg-color, rgba(127, 127, 127, .28));
      border-color: var(--active-file-border-color, rgba(127, 127, 127, .4));
    }
    ${TOOLBAR_SELECTOR} button:disabled {
      cursor: not-allowed;
      opacity: .45;
    }
    ${TOOLBAR_SELECTOR} .plugin-diagram-wheel-toggle {
      width: auto;
      gap: 5px;
      padding: 0 8px;
      font-size: 12px;
      white-space: nowrap;
    }
    ${TOOLBAR_SELECTOR} .plugin-diagram-wheel-toggle.is-active {
      color: var(--active-file-text-color, #fff);
      background: var(--active-file-bg-color, #4285f4);
    }
    ${TOOLBAR_SELECTOR} output {
      min-width: 48px;
      color: inherit;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      line-height: 28px;
      text-align: center;
    }
    ${HANDLE_SELECTOR} {
      position: absolute;
      z-index: 30;
    }
    ${HANDLE_SELECTOR}[data-position="top-left"],
    ${HANDLE_SELECTOR}[data-position="bottom-right"] {
      width: 12px;
      height: 12px;
      cursor: nwse-resize;
    }
    ${HANDLE_SELECTOR}[data-position="top-right"],
    ${HANDLE_SELECTOR}[data-position="bottom-left"] {
      width: 12px;
      height: 12px;
      cursor: nesw-resize;
    }
    ${HANDLE_SELECTOR}[data-position="top"],
    ${HANDLE_SELECTOR}[data-position="bottom"] {
      right: 12px;
      left: 12px;
      height: 6px;
      cursor: ns-resize;
    }
    ${HANDLE_SELECTOR}[data-position="left"],
    ${HANDLE_SELECTOR}[data-position="right"] {
      top: 12px;
      bottom: 12px;
      width: 6px;
      cursor: ew-resize;
    }
    ${HANDLE_SELECTOR}[data-position^="top"] { top: 0; }
    ${HANDLE_SELECTOR}[data-position^="bottom"] { bottom: 0; }
    ${HANDLE_SELECTOR}[data-position$="left"] { left: 0; }
    ${HANDLE_SELECTOR}[data-position$="right"] { right: 0; }
    body.plugin-diagram-resizing,
    body.plugin-diagram-resizing * {
      user-select: none !important;
    }
    body.plugin-diagram-resizing-nwse,
    body.plugin-diagram-resizing-nwse * { cursor: nwse-resize !important; }
    body.plugin-diagram-resizing-nesw,
    body.plugin-diagram-resizing-nesw * { cursor: nesw-resize !important; }
    body.plugin-diagram-resizing-ns,
    body.plugin-diagram-resizing-ns * { cursor: ns-resize !important; }
    body.plugin-diagram-resizing-ew,
    body.plugin-diagram-resizing-ew * { cursor: ew-resize !important; }
    ${SURFACE_SELECTOR}:fullscreen,
    ${SURFACE_SELECTOR}:-webkit-full-screen {
      box-sizing: border-box;
      width: 100vw !important;
      height: 100vh !important;
      max-width: none !important;
      max-height: none !important;
      margin: 0 !important;
      padding: 16px;
      background: var(--bg-color, #fff);
      box-shadow: none;
    }
    .plugin-diagram-exporting ${SURFACE_SELECTOR} {
      background-color: transparent !important;
      box-shadow: none !important;
    }
    .plugin-diagram-exporting ${TOOLBAR_SELECTOR},
    .plugin-diagram-exporting ${HANDLE_SELECTOR} {
      display: none !important;
    }
    @media print {
      ${TOOLBAR_SELECTOR},
      ${HANDLE_SELECTOR} {
        display: none !important;
      }
    }
  `

const buildExportStyle = () => `
    ${TOOLBAR_SELECTOR}, ${HANDLE_SELECTOR} { display: none !important; }
    ${SURFACE_SELECTOR} { background-color: transparent !important; box-shadow: none !important; }
    ${CONTENT_SELECTOR} { transform: none !important; }
  `

module.exports = { buildExportStyle, buildStyle }
