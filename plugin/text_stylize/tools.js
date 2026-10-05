const valued = ({ icon, initialValue, apply }) => ({
  icon,
  value: initialValue,
  invoke(stylizer) {
    apply(stylizer, this.value)
  },
})

const stepping = (prop, unit, fallback, min, zeroValue) => num => styleObj => {
  styleObj[prop] = styleObj[prop] || fallback
  const next = Math.max(min, parseFloat(styleObj[prop]) + num)
  if (next !== zeroValue) {
    styleObj[prop] = (+next.toFixed(1)) + unit
  } else {
    delete styleObj[prop]
  }
}
const stepFontSize = stepping("font-size", "em", "1.0em", 0.1, 1)
const stepLetterSpacing = stepping("letter-spacing", "pt", "1pt", 0, 0)

const brushPairs = initialStyle => {
  let brush = initialStyle
  return {
    setBrush: {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M240-120q-45 0-89-22t-71-58q26 0 53-20.5t27-59.5q0-50 35-85t85-35q50 0 85 35t35 85q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T320-280q0-17-11.5-28.5T280-320q-17 0-28.5 11.5T240-280q0 23-5.5 42T220-202q5 2 10 2h10Zm230-160L360-470l358-358q11-11 27.5-11.5T774-827l57 57q11 11 11 27.5T831-714L470-360Z"/><path transform="translate(480,-20) scale(0.48)" d="M480-200 240-440l56-56 144 143v-467h80v467l144-143 56 56-240 240Z"/></svg>`,
      invoke: s => brush = s.read(),
    },
    useBrush: {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M240-120q-45 0-89-22t-71-58q26 0 53-20.5t27-59.5q0-50 35-85t85-35q50 0 85 35t35 85q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T320-280q0-17-11.5-28.5T280-320q-17 0-28.5 11.5T240-280q0 23-5.5 42T220-202q5 2 10 2h10Zm230-160L360-470l358-358q11-11 27.5-11.5T774-827l57 57q11 11 11 27.5T831-714L470-360Z"/><path transform="translate(480,-20) scale(0.48)" d="M480-760 240-520l56 56 144-143v467h80v-467l144 143 56-56-240-240Z"/></svg>`,
      invoke: s => s.replace(brush),
    },
  }
}

module.exports = config => ({
  weight: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M272-200v-560h221q65 0 120 40t55 111q0 51-23 78.5T602-491q25 11 55.5 41t30.5 90q0 89-65 124.5T501-200H272Zm121-112h104q48 0 58.5-24.5T566-372q0-11-10.5-35.5T494-432H393v120Zm0-228h93q33 0 48-17t15-38q0-24-17-39t-44-15h-95v109Z"/></svg>`,
    invoke: s => s.edit({ toggle: { "font-weight": "bold" } }),
  },
  italic: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M200-200v-100h160l120-360H320v-100h400v100H580L460-300h140v100H200Z"/></svg>`,
    invoke: s => s.edit({ toggle: { "font-style": "italic" } }),
  },
  underline: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M200-120v-80h560v80H200Zm280-160q-101 0-157-63t-56-167v-330h103v336q0 56 28 91t82 35q54 0 82-35t28-91v-336h103v330q0 104-56 167t-157 63Z"/></svg>`,
    invoke: s => s.edit({ toggleToken: { "text-decoration": "underline" } }),
  },
  throughline: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M80-400v-80h800v80H80Zm340-160v-120H200v-120h560v120H540v120H420Zm0 400v-160h120v160H420Z"/></svg>`,
    invoke: s => s.edit({ toggleToken: { "text-decoration": "line-through" } }),
  },
  overline: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M200-760v-80h560v80H200Zm280 640q-117 0-198.5-81.5T200-400q0-117 81.5-198.5T480-680q117 0 198.5 81.5T760-400q0 117-81.5 198.5T480-120Zm0-100q75 0 127.5-52.5T660-400q0-75-52.5-127.5T480-580q-75 0-127.5 52.5T300-400q0 75 52.5 127.5T480-220Z"/></svg>`,
    invoke: s => s.edit({ toggleToken: { "text-decoration": "overline" } }),
  },
  title: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M420-160v-520H200v-120h560v120H540v520H420Z"/></svg>`,
    invoke: s => s.edit({ toggle: { "font-size": "2em" } }),
  },
  superScript: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M760-600v-80q0-17 11.5-28.5T800-720h80v-40H760v-40h120q17 0 28.5 11.5T920-760v40q0 17-11.5 28.5T880-680h-80v40h120v40H760ZM235-160l185-291-172-269h106l124 200h4l123-200h107L539-451l186 291H618L482-377h-4L342-160H235Z"/></svg>`,
    invoke: s => s.edit({ toggle: { "vertical-align": "super" } }),
  },
  subScript: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M760-160v-80q0-17 11.5-28.5T800-280h80v-40H760v-40h120q17 0 28.5 11.5T920-320v40q0 17-11.5 28.5T880-240h-80v40h120v40H760Zm-525-80 185-291-172-269h106l124 200h4l123-200h107L539-531l186 291H618L482-457h-4L342-240H235Z"/></svg>`,
    invoke: s => s.edit({ toggle: { "vertical-align": "sub" } }),
  },
  emphasis: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M477-80q-83 0-156-31.5T194-197q-54-54-85.5-127T77-480q0-83 31.5-156T194-763q54-54 127-85.5T477-880q83 0 156 31.5T760-763q54 54 85.5 127T877-480q0 83-31.5 156T760-197q-54 54-127 85.5T477-80Zm91-93q78-23 135.5-80.5T784-389L568-173ZM171-574l212-212q-77 23-133 79t-79 133Zm-4 176 392-391q-12-3-24-5t-25-4L159-447q2 13 3.5 25t4.5 24Zm57 114 449-450q-8-6-16.5-12T639-757L200-318q5 9 11 17.5t13 16.5Zm91 81 438-439q-5-9-11-17.5T730-676L281-226q8 6 16.5 12t17.5 11Zm129 41 351-351q-2-13-4-25t-5-24L395-171q12 3 24 5t25 4Z"/></svg>`,
    invoke: s => s.edit({ toggleToken: { "text-emphasis": "filled red" } }),
  },
  blur: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="25"><path d="M13.47 7.41158L15.93 6.20158C16.23 6.05158 16.31 5.66158 16.08 5.42158C15.19 4.44158 14.29 3.62158 13.57 3.00158C13.24 2.72158 12.75 2.95158 12.75 3.38158V6.96158C12.75 7.33158 13.14 7.57158 13.47 7.41158Z"/><path d="M12.75 19.7384V21.3884C12.75 21.6884 13.02 21.9384 13.32 21.8884C16.05 21.4384 18.33 19.6084 19.41 17.1484C19.6 16.7284 19.14 16.3084 18.72 16.5084L13.03 19.2984C12.86 19.3784 12.75 19.5484 12.75 19.7384Z"/><path d="M11.2505 3.36159C11.2505 2.93159 10.7605 2.70159 10.4305 2.97159C8.07046 4.95159 3.88046 9.12158 3.90046 13.9016C3.90046 17.9216 6.84046 21.2516 10.6805 21.8916C10.9805 21.9416 11.2505 21.6916 11.2505 21.3916V3.36159Z"/><path d="M13.4402 12.4714L18.7302 10.2514C19.0002 10.1314 19.1302 9.82141 19.0002 9.56141C18.6302 8.83141 18.2002 8.12141 17.7302 7.46141C17.5902 7.26141 17.3302 7.20141 17.1102 7.30141L13.0202 9.29141C12.8502 9.37141 12.7402 9.55141 12.7402 9.74141V12.0114C12.7502 12.3614 13.1102 12.6114 13.4402 12.4714Z"/><path d="M19.83 14.3107C19.99 14.2307 20.09 14.0807 20.09 13.9107C20.09 13.2707 20.01 12.6407 19.87 12.0207C19.8 11.7207 19.47 11.5607 19.19 11.6807L13.05 14.3007C12.87 14.3807 12.75 14.5607 12.75 14.7607V16.9607C12.75 17.3307 13.14 17.5707 13.47 17.4107L19.37 14.5407L19.83 14.3107Z"/></svg>`,
    invoke: s => s.edit({ toggleToken: { filter: "blur(0.5em)" } }),
  },
  family: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M186-80q-54 0-80-22t-26-66q0-58 49-74t116-16h21v-56q0-34-1-55.5t-6-35.5q-5-14-11.5-19.5T230-430q-9 0-16.5 3t-12.5 8q-4 5-5 10.5t1 11.5q6 11 14 21.5t8 24.5q0 25-17.5 42.5T159-291q-25 0-42.5-17.5T99-351q0-27 12-44t32.5-27q20.5-10 47.5-14t58-4q85 0 118 30.5T400-302v147q0 19 4.5 28t15.5 9q12 0 19.5-18t9.5-56h11q-3 62-23.5 87T368-80q-43 0-67.5-13.5T269-134q-10 29-29.5 41.5T186-80Zm373 0q-20 0-32.5-16.5T522-132l102-269q7-17 22-28t34-11q19 0 34 11t22 28l102 269q8 19-4.5 35.5T801-80q-12 0-22-7t-15-19l-20-58H616l-20 58q-4 11-14 18.5T559-80Zm-324-29q13 0 22-20.5t9-49.5v-67q-26 0-38 15.5T216-180v11q0 36 4 48t15 12Zm407-125h77l-39-114-38 114Zm-37-285q-48 0-76.5-33.5T500-643q0-104 66-170.5T735-880q42 0 68 9.5t26 24.5q0 6-2 12t-7 11q-5 7-12.5 10t-15.5 1q-14-4-32-7t-33-3q-71 0-114 48t-43 127q0 22 8 46t36 24q11 0 21.5-5t18.5-14q17-18 31.5-60T712-758q2-13 10.5-18.5T746-782q18 0 27.5 9.5T779-749q-12 43-17.5 75t-5.5 58q0 20 5.5 29t16.5 9q11 0 21.5-8t29.5-30q2-3 15-7 8 0 12 6t4 17q0 28-32 54t-67 26q-26 0-44.5-14T691-574q-15 26-37 40.5T605-519Zm-485-1v-220q0-58 41-99t99-41q58 0 99 41t41 99v220h-80v-80H200v80h-80Zm80-160h120v-60q0-25-17.5-42.5T260-800q-25 0-42.5 17.5T200-740v60Z"/></svg>`,
    invoke: s => s.edit({ toggle: { "font-family": "serif" } }),
  },
  increaseSize: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="m40-200 210-560h100l210 560h-96l-51-143H187l-51 143H40Zm176-224h168l-82-232h-4l-82 232Zm504 104v-120H600v-80h120v-120h80v120h120v80H800v120h-80Z"/></svg>`,
    invoke: s => s.edit({ mutate: stepFontSize(0.1) }),
  },
  decreaseSize: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="m40-200 210-560h100l210 560h-96l-51-143H187l-51 143H40Zm176-224h168l-82-232h-4l-82 232Zm384-16v-80h320v80H600Z"/></svg>`,
    invoke: s => s.edit({ mutate: stepFontSize(-0.1) }),
  },
  increaseLetterSpacing: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M120-160v-640h80v640h-80Zm640 0v-640h80v640h-80ZM294-280l150-400h72l150 400h-70l-34-102H400l-36 102h-70Zm126-160h120l-58-166-62 166Z"/></svg>`,
    invoke: s => s.edit({ mutate: stepLetterSpacing(1) }),
  },
  decreaseLetterSpacing: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M160-160v-640h80v640h-80Zm560 0v-640h80v640h-80ZM294-280l150-400h72l150 400h-69l-36-102H399l-36 102h-69Zm126-160h120l-58-166h-4l-58 166Z"/></svg>`,
    invoke: s => s.edit({ mutate: stepLetterSpacing(-1) }),
  },
  erase: {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="m528-546-93-93-121-121h486v120H568l-40 94ZM792-56 460-388l-80 188H249l119-280L56-792l56-56 736 736-56 56Z"/></svg>`,
    invoke: s => s.replace({}),
  },
  foregroundColor: valued({
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 -960 960 960" width="22"><path d="M80 0v-80Zm140-280 210-560h100l210 560h-96l-50-144H368l-52 144h-96Zm176-224h168l-82-232h-4l-82 232Z"/><path class="color-indicator" d="M80 0v-160h800V0"/></svg>`,
    initialValue: config.DEFAULT_COLORS.FOREGROUND,
    apply: (s, color) => s.edit({ toggle: { color } }),
  }),
  backgroundColor: valued({
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 -960 960 960" width="22"><path d="m247-904 57-56 343 343q23 23 23 57t-23 57L457-313q-23 23-57 23t-57-23L153-503q-23-23-23-57t23-57l190-191-96-96Zm153 153L209-560h382L400-751Zm360 471q-33 0-56.5-23.5T680-360q0-21 12.5-45t27.5-45q9-12 19-25t21-25q11 12 21 25t19 25q15 21 27.5 45t12.5 45q0 33-23.5 56.5T760-280ZM80 0"/><path class="color-indicator" d="M80 0v-160h800V0"/></svg>`,
    initialValue: config.DEFAULT_COLORS.BACKGROUND,
    apply: (s, color) => s.edit({ toggle: { background: color } }),
  }),
  borderColor: valued({
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 -960 960 960" width="22"><path d="M80 0v-800V0H80Zm160-320h56l312-311-29-29-28-28-311 312v56Zm-80 80v-170l448-447q11-11 25.5-17t30.5-6q16 0 31 6t27 18l55 56q12 11 17.5 26t5.5 31q0 15-5.5 29.5T777-687L330-240H160Zm560-504-56-56 56 56ZM608-631l-29-29-28-28 57 57Z"/><path class="color-indicator" d="M80 0v-160h800V0"/></svg>`,
    initialValue: config.DEFAULT_COLORS.BORDER,
    apply: (s, color) => s.edit({ toggle: { border: `1px solid ${color}` } }),
  }),
  ...brushPairs(config.DEFAULT_FORMAT_BRUSH),
})
