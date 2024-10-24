class searchStringParser {
    constructor(utils) {
        this.utils = utils;
        this.TYPE = {
            OR: "OR",
            AND: "AND",
            NOT: "NOT",
            PAREN_OPEN: "PAREN_OPEN",
            PAREN_CLOSE: "PAREN_CLOSE",
            KEYWORD: "KEYWORD",
            PHRASE: "PHRASE",
            REGEXP: "REGEXP",
            CONDITION: "CONDITION",
        }
        this.TOKEN = {
            OR: { type: this.TYPE.OR, value: "OR" },
            AND: { type: this.TYPE.AND, value: " " },
            NOT: { type: this.TYPE.NOT, value: "-" },
            PAREN_OPEN: { type: this.TYPE.PAREN_OPEN, value: "(" },
            PAREN_CLOSE: { type: this.TYPE.PAREN_CLOSE, value: ")" },
            PHRASE: value => ({ type: this.TYPE.PHRASE, value }),
            KEYWORD: value => ({ type: this.TYPE.KEYWORD, value }),
            REGEXP: value => ({ type: this.TYPE.REGEXP, value }),
            CONDITION: (scope, operator) => ({ type: this.TYPE.CONDITION, scope, operator }),
        }
        this.setConditionRegExp();
    }

    setConditionRegExp(scope = ["all", "file", "path", "ext", "content"], operator = [":", "=", ">=", "<=", ">"]) {
        this.scopeRegExp = new RegExp(`^(?<scope>${scope.join('|')})(?<operator>${operator.join('|')})`, "i");
    }

    _tokenize(query) {
        const tokens = [];
        let i = 0;
        let match = null;
        while (i < query.length) {
            if (query[i] === '"') {
                const start = i + 1;
                i++;
                while (i < query.length && query[i] !== '"') {
                    i++;
                }
                tokens.push(this.TOKEN.PHRASE(query.substring(start, i)));
                i++;
            } else if (query[i] === "(") {
                tokens.push(this.TOKEN.PAREN_OPEN);
                i++;
            } else if (query[i] === ")") {
                tokens.push(this.TOKEN.PAREN_CLOSE);
                i++;
            } else if (/^OR\b/i.test(query.substring(i))) {
                tokens.push(this.TOKEN.OR);
                i += 2;
            } else if (query[i] === "|") {
                tokens.push(this.TOKEN.OR);
                i++;
            } else if (query[i] === "-") {
                tokens.push(this.TOKEN.NOT);
                i++;
            } else if (/\s/.test(query[i])) {
                i++; // skip whitespace
            } else if (match = query.substring(i).match(this.scopeRegExp)) {
                const { scope, operator } = match.groups;
                tokens.push(this.TOKEN.CONDITION(scope, operator));
                i += scope.length + operator.length;
            } else if (query[i] === "/") {
                const regexpStart = i;
                i++;
                while (i < query.length && query[i] !== "/") {
                    if (query[i] === "\\" && query.substring(i, i + 2) === "\\/") {
                        i += 2;
                    } else {
                        i++;
                    }
                }
                tokens.push(this.TOKEN.REGEXP(query.substring(regexpStart + 1, i)));
                i++;
            } else {
                const keywordStart = i;
                while (i < query.length && !/\s|"|\(|\)|-/.test(query[i])) {
                    i++;
                }
                tokens.push(this.TOKEN.KEYWORD(query.substring(keywordStart, i)));
            }
        }

        const result = [];
        const invalidPre = [this.TYPE.NOT, this.TYPE.OR, this.TYPE.PAREN_OPEN, this.TYPE.CONDITION];
        const invalidCur = [this.TYPE.NOT, this.TYPE.OR, this.TYPE.PAREN_CLOSE];
        for (let i = 0; i < tokens.length; i++) {
            const current = tokens[i];
            const previous = tokens[i - 1];
            const should = previous && !invalidPre.includes(previous.type) && !invalidCur.includes(current.type);
            if (should) {
                result.push(this.TOKEN.AND);
            }
            result.push(current);
        }
        return result;
    }

    _parseExpression(tokens) {
        let node = this._parseTerm(tokens);
        while (tokens.length > 0) {
            const type = tokens[0].type;
            if (type === this.TYPE.OR) {
                tokens.shift();
                const right = this._parseTerm(tokens);
                node = { type, left: node, right };
            } else {
                break;
            }
        }
        return node;
    }

    _parseTerm(tokens) {
        let node = this._parseFactor(tokens);
        while (tokens.length > 0) {
            const type = tokens[0].type;
            if (type === this.TYPE.NOT || type === this.TYPE.AND) {
                tokens.shift();
                const right = this._parseFactor(tokens);
                node = { type, left: node, right };
            } else {
                break;
            }
        }
        return node;
    }

    _parseFactor(tokens) {
        const condition = (tokens[0].type === this.TYPE.CONDITION)
            ? tokens.shift()
            : this.TOKEN.CONDITION("all", ":");
        const node = this._parseMatch(tokens);
        return this._setCondition(node, condition);
    }

    _parseMatch(tokens) {
        const type = tokens[0].type;
        if (type === this.TYPE.PHRASE || type === this.TYPE.KEYWORD || type === this.TYPE.REGEXP) {
            return { type, value: tokens.shift().value };
        } else if (type === this.TYPE.PAREN_OPEN) {
            tokens.shift();
            const node = this._parseExpression(tokens);
            if (tokens.shift().type !== this.TYPE.PAREN_CLOSE) {
                throw new Error("Expected ')'");
            }
            return node;
        }
    }

    _setCondition(node, condition) {
        if (!node) return;
        const isLeaf = [this.TYPE.REGEXP, this.TYPE.KEYWORD, this.TYPE.PHRASE].includes(node.type);
        if (isLeaf && (!node.scope || node.scope === "all")) {
            node.scope = condition.scope;
            node.operator = condition.operator;
        } else {
            this._setCondition(node.left, condition);
            this._setCondition(node.right, condition);
        }
        return node
    }

    _withNotification(func) {
        try {
            return func();
        } catch (e) {
            this.utils.notification.show("语法解析错误，请检查输入内容", "error");
        }
    }

    parse(query) {
        return this._withNotification(() => {
            const tokens = this._tokenize(query);
            if (tokens.length === 0) {
                return this.TOKEN.KEYWORD("")
            }
            const result = this._parseExpression(tokens);
            if (tokens.length !== 0) {
                throw new Error(`parse error. remind tokens: ${tokens}`)
            }
            return result
        })
    }

    checkByAST(ast, getContent) {
        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = this.TYPE;

        function evaluate({ type, left, right, value, scope, operator }) {
            switch (type) {
                case KEYWORD:
                case PHRASE:
                    return getContent(scope, operator).includes(value);
                case REGEXP:
                    return new RegExp(value).test(getContent(scope, operator));
                case OR:
                    return evaluate(left) || evaluate(right);
                case AND:
                    return evaluate(left) && evaluate(right);
                case NOT:
                    return (left ? evaluate(left) : true) && !evaluate(right);
                default:
                    throw new Error(`Unknown AST node type: ${type}`);
            }
        }

        return evaluate(ast);
    }

    showGrammar() {
        const table1 = `
            <table>
                <tr><th>关键字</th><th>说明</th></tr>
                <tr><td>whitespace</td><td>表示与，文档应该同时包含全部关键词</td></tr>
                <tr><td>|</td><td>表示或，文档应该包含关键词之一，等价于 OR</td></tr>
                <tr><td>-</td><td>表示非，文档不能包含关键词</td></tr>
                <tr><td>""</td><td>词组</td></tr>
                <tr><td>scope:</td><td>限定查找范围（all、file、path、ext、content），默认为 all</td></tr>
                <tr><td>//</td><td>JavaScript 风格的正则表达式</td></tr>
                <tr><td>()</td><td>小括号，用于调整运算顺序</td></tr>
            </table>
        `
        const table2 = `
            <table>
                <tr><th>示例</th><th>搜索文档</th></tr>
                <tr><td>foo bar</td><td>包含 foo 和 bar</td></tr>
                <tr><td>foo OR bar</td><td>包含 foo 或 bar</td></tr>
                <tr><td>foo bar -zoo</td><td>包含 foo 和 bar 但不包含 zoo</td></tr>
                <tr><td>"foo bar"</td><td>包含 foo bar 这一词组</td></tr>
                <tr><td>(a OR b) (c | d)</td><td>包含 a 或 b，且包含 c 或 d</td></tr>
                <tr><td>path:/[a-z]{3}/ content:bar</td><td>路径匹配 [a-z]{3} 且内容包含 bar</td></tr>
                <tr><td>file:(info | warn | err) -ext:log</td><td>文件名包含 info 或 warn 或 err，但扩展名不为 log</td></tr>
            </table>
        `
        const content = `
<query> ::= <expr>
<expr> ::= <term> ( <or> <term> )*
<term> ::= <factor> ( <not_and> <factor> )*
<factor> ::= <condition>? <match>
<not_and> ::= '-' | ' '
<or> ::= 'OR' | '|'
<condition> ::= <scope> <operator> 
<scope> ::= 'all' | 'file' | 'path' | 'ext' | 'content'
<operator> ::= ':' | '=' | '>=' | '<=' | '>'
<match> ::= <keyword> | '"'<keyword>'"' | '/'<regexp>'/' | '('<expr>')'
<keyword> ::= [^"]+
<regexp> ::= [^/]+`
        const title = "你可以将这段内容塞给AI，它会为你解释";
        const components = [{ label: table1, type: "p" }, { label: table2, type: "p" }, { label: "", type: "textarea", rows: 10, content, title }];
        this.utils.dialog.modal({ title: "搜索语法", width: "550px", components });
    }
}

module.exports = {
    searchStringParser
}