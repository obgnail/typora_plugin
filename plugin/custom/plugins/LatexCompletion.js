// ./plugin/custom/plugins/CompleteWithLLM.js

TrieNode = class {
    constructor() {
        this.children = new Map();
        this.commands = [];
    }
}

class LatexCommandTrie {
    constructor(commands) {
        this.root = new TrieNode();
        this.buildTrie(commands);
    }

    buildTrie(commands) {
        for (const cmd of commands) {
            let node = this.root;
            for (const char of cmd) {
                if (!node.children.has(char)) {
                    node.children.set(char, new TrieNode());
                }
                node = node.children.get(char);
            }
            node.commands.push(cmd);
        }
    }

    getCommandsWithPrefix(prefix) {
        let node = this.root;
        for (const char of prefix) {
            if (!node.children.has(char)) return [];
            node = node.children.get(char);
        }

        const commands = [];
        const queue = [node];
        while (queue.length > 0) {
            const current = queue.shift();
            commands.push(...current.commands);
            queue.push(...current.children.values());
        }
        return commands;
    }
}

// Example usage:
const latexCommands = [
    '\\alpha', '\\beta', '\\gamma', '\\Gamma', '\\mathcal{}', "\\mathscr{}"
];

const trie = new LatexCommandTrie(latexCommands);
// console.log(trie.getCommandsWithPrefix('\\ma'));

function moveCursorBackward(step) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    if (!range.collapsed) return;

    const { startContainer, startOffset } = range;

    if (startOffset === 0) {return;
    } else {
        range.setStart(startContainer, startOffset - step);
        range.setEnd(startContainer, startOffset - step);
    }

    selection.removeAllRanges();
    selection.addRange(range);
}

function getFocusPostion() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    return {
        left: rect.left,
        bottom: rect.bottom
    };
}

class LatexSuggestionBoxManager {
    constructor() {
        this.editor = File.editor;
        this.suggestionBox = this.createSuggestionBox();
        this.isListening = false;
        this.currentPrefix = '';
        this.commands = [];
        this.currentPage = 0;
        this.pageSize = 10;

        document.body.appendChild(this.suggestionBox);
    }

    createSuggestionBox() {
        const div = document.createElement('div');
        Object.assign(div.style, {
            position: 'absolute',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            background: 'white',
            border: '1px solid #ccc',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: '9999',
            maxHeight: '200px',
            overflowX: 'auto',
            fontFamily: 'Arial, sans-serif',
            padding: '4px 0',
            visibility: 'hidden',
            opacity: '0',
            transition: 'opacity 0.2s, visibility 2.0s'

        });
        return div;
    }

    updatePosition() {
        const coords = getFocusPostion();
        this.suggestionBox.style.left = `${coords.left}px`;
        this.suggestionBox.style.top = `${coords.bottom + 5}px`;
    }

    hideSuggestionBox() {
        this.suggestionBox.style.visibility = 'hidden';
        this.suggestionBox.style.opacity = '0';
    }

    displaySuggestions() {
        this.suggestionBox.innerHTML = '';
        const startIdx = this.currentPage * this.pageSize;
        const endIdx = startIdx + this.pageSize;
        const pageCommands = this.commands.slice(startIdx, endIdx);
        pageCommands.forEach((cmd, idx) => {
            const item = document.createElement('div');
            item.textContent = `${idx + 1}. \\ ${cmd}`;
            Object.assign(item.style, {
                padding: '4px 8px',
                cursor: 'pointer',
                borderRight: '1px solid #eee',
                whiteSpace: 'nowrap'
            });
            item.addEventListener('click', () => this.selectCandidate(idx));
            this.suggestionBox.appendChild(item);
        });
        Object.assign(this.suggestionBox.style, {
            display: 'flex',
        });
        this.suggestionBox.style.visibility = 'visible';
        this.suggestionBox.style.opacity = '1';
        this.updatePosition();
    }

    nextPage() {
        if ((this.currentPage + 1) * this.pageSize < this.commands.length) {
            this.currentPage++;
            this.displaySuggestions();
        }
    }

    previousPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.displaySuggestions();
        }
    }

    insertCommands(commands, currentPrefix) {
        // Implement command insertion logic here.
        if (commands.length === 0 || currentPrefix === ''){return ;}
        this.currentPage = 0;
        this.currentPrefix = currentPrefix;
        this.commands = commands;
        this.displaySuggestions();
    }

    selectCandidate(idx) {
        const selectedItem = this.commands[this.currentPage * this.pageSize + idx];

        if (!selectedItem) {
            console.error('Invalid selection index');
            return;
        }

        let text = selectedItem.text;

        if (this.currentPrefix && text.startsWith(this.currentPrefix)) {
            text = text.slice(this.currentPrefix.length);
        }

        File.editor.contextMenu.hide();
        File.editor.restoreLastCursor();

        File.editor.insertText(text);

        // if (text.includes('{}')) {
        //     const newPos = {
        //         line: this.startPos.line,
        //         ch: this.startPos.ch + text.indexOf('{') + 1
        //     };
        //     File.editor.setCursor(newPos);
        // }
        // moveCursorBackward(1);
        
        this.hideSuggestionBox();
    }

    empty() {
        this.currentPage = 0;
        this.currentPrefix = '';
        this.commands = [];
        this.hideSuggestionBox();
    }
}

const latexSuggestion = new LatexSuggestionBoxManager();
// latexSuggestion.insertCommands([
//     "\\mathcal{}", "\\mathbb{}",
// ], '\\ma')


function enable_listen(){
    const activeElement = document.activeElement;
    let hasWriteAncestor = false;
    if (activeElement) {
        let currentNode = activeElement.parentElement;
        while (currentNode) {
            if (currentNode.tagName && currentNode.tagName.toLowerCase() === 'content') {
                hasWriteAncestor = true;
                break;
            }
            currentNode = currentNode.parentElement;
        }
    }
    return hasWriteAncestor;
}
let currentPrefix = '';
let commands = []
document.addEventListener('keydown', (e) => {
    if (!enable_listen()) {return;};
    if (e.key === '\\'){
        currentPrefix = '\\';
        commands = trie.getCommandsWithPrefix(currentPrefix);
        latexSuggestion.insertCommands(commands, currentPrefix);
        return;
    }
    
    if (latexSuggestion.suggestionBox.style.visibility != 'visible'){return;};
    switch (e.key){
        case 'Escape':
            latexSuggestion.empty();
            break;
        case 'Backspace':
            currentPrefix = currentPrefix.slice(0, -1);
            commands = trie.getCommandsWithPrefix(currentPrefix);
            latexSuggestion.insertCommands(commands, currentPrefix);
            break;
        case 'ArrowDown':
            nextPage();
            break;
        case 'ArrowUp':
            previousPage();
            break;
        case 'Enter':
            if (latexSuggestion.commands.length > 0) latexSuggestion.selectCandidate(0);
            break;
        case 'Space':
            if (latexSuggestion.commands.length > 0) latexSuggestion.selectCandidate(0);
            break;
        default:
            if (e.key.match(/^[a-z]$/i)) {
                currentPrefix += e.key;
                commands = trie.getCommandsWithPrefix(currentPrefix);
                latexSuggestion.insertCommands(commands, currentPrefix);
            } else if (e.key >= '1' && e.key <= '9') {
                selectCandidate(parseInt(e.key) - 1);
            } else if (e.key === '0') {
                selectCandidate(9);
            }
    }
});

// Click-outside handler
document.addEventListener('click', (e) => {
    if (!suggestionBox.contains(e.target)) {
        latexSuggestion.hideSuggestionBox();
        isListening = false;
    }
});


class LatexCompletion extends BaseCustomPlugin {
    // 定义插件的快捷键
    hotkey = () => [none]

    // 定义插件的提示信息
    hint = () => "在$$ $$自动补全latex变量"

    // 定义插件的初始化逻辑
    init = () => {
        // 初始化变量
    }

    // 定义插件的样式
    style = () => `
        #latex-completion {
            margin: 10px;
        }
    `

    // 定义插件的 HTML 结构
    html = () => "<div id='latex-completion'></div>"

    // 定义插件的处理逻辑
    process = () => {
        // 这里可以添加一些初始化逻辑
    }

}

// 导出插件
module.exports = { plugin: LatexCompletion };

