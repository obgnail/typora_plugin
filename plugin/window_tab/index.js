(() => {
    (() => {
        const css =`
        #plugin-window-tab .container {
            position: relative;
            width: 100%;
            height: 40px
        }
        
        #plugin-window-tab .tab-bar-container {
            position: fixed;
            top: 0;
            width: 100%;
            height: 40px;
            z-index: 1
        }
        
        #plugin-window-tab .grab-container {
            height: 100%;
            width: fit-content
        }
        
        #plugin-window-tab .tab-clone {
            pointer-events: none;
            width: fit-content;
            height: 40px;
            position: absolute;
            top: 0;
            z-index: 1000
        }
        
        #plugin-window-tab .clone-container {
            position: relative
        }
        
        #plugin-window-tab .tab-bar {
            background-color: var(--bg-color, white);
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            box-sizing: border-box;
            overflow-x: scroll
        }
        
        #plugin-window-tab .tab-bar::after {
            content: "";
            height: 100%;
            width: 100vw;
            background-color: var(--side-bar-bg-color, gray);
            border-bottom: solid 1px rgba(0, 0, 0, 0.07)
        }
        
        #plugin-window-tab .invisible {
            opacity: 0
        }
        
        #plugin-window-tab .tab-bar:hover::-webkit-scrollbar-thumb {
            visibility: visible
        }
        
        #plugin-window-tab .tab-bar::-webkit-scrollbar {
            height: 5px
        }
        
        #plugin-window-tab .tab-bar::-webkit-scrollbar-thumb {
            height: 5px;
            background-color: var(----active-file-bg-color, gray);
            visibility: hidden
        }
        
        #plugin-window-tab .tab-container {
            background-color: var(--side-bar-bg-color, gray);
            height: 100%;
            min-width: 100px;
            position: relative;
            padding: 0 15px;
            padding-right: 10px;
            border-bottom: solid 1px rgba(0, 0, 0, 0.07);
            display: flex;
            align-items: center;
            justify-content: space-between;
            user-select: none;
            flex-shrink: 0;
            cursor: pointer
        }
        
        #plugin-window-tab .name {
            max-width: 350px;
            padding-right: 15px;
            font-size: 14px;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            pointer-events: none
        }
        
        #plugin-window-tab .close-button {
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 5px
        }
        
        #plugin-window-tab .tab-container:hover>.close-button {
            visibility: visible !important
        }
        
        #plugin-window-tab .close-icon {
            position: relative;
            width: 11px;
            height: 11px;
            display: flex;
            flex-direction: column;
            justify-content: center
        }
        
        #plugin-window-tab .close-icon::before,
        #plugin-window-tab .close-icon::after {
            content: "";
            position: absolute;
            width: 100%;
            height: 2px;
            background-color: var(--active-file-border-color, black)
        }
        
        #plugin-window-tab .close-icon::before {
            transform: rotate(45deg)
        }
        
        #plugin-window-tab .close-icon::after {
            transform: rotate(-45deg)
        }
        
        #plugin-window-tab .close-button:hover {
            background-color: var(--active-file-bg-color, lightgray)
        }
        
        #plugin-window-tab .active {
            border: solid 1px rgba(0, 0, 0, 0.07);
            border-bottom: none;
            background-color: var(--bg-color, white)
        }
        
        #plugin-window-tab .active-indicator {
            position: absolute;
            top: -1px;
            left: -1px;
            width: calc(100% + 2px);
            height: 3px;
            background-color: var(--active-file-border-color, black)
        }
        
        #plugin-window-tab .preview {
            font-style: italic !important
        }
        
        #plugin-window-tab .single {
            visibility: hidden;
            opacity: 0
        }
        `
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);

        const div = `
            <div class="container">
                <div class="tab-bar-container">
                    <div class="clone-container"></div>
                    <div class="tab-bar">
                        <div class="grab-container">
                            <div class="tab-container active">
                                <div class="active-indicator" style="display: block;"></div>
                                    <span class="name">messing1.md</span>
                                    <span class="close-button" style="visibility: visible;">
                                    <div class="close-icon"></div>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
        const windowTab = document.createElement("div");
        windowTab.id = "plugin-window-tab";
        windowTab.innerHTML = div;
        document.getElementById("write-style").parentElement
            .insertBefore(windowTab, document.getElementById("write-style"));
    })()

    console.log("window_tab.js had been injected");
})()