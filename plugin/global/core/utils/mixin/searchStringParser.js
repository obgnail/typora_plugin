/**
 * grammar:
 *   <query> ::= <expr>
 *   <expr> ::= <term> ( <or> <term> )*
 *   <term> ::= <factor> ( <not_and> <factor> )*
 *   <factor> ::= '"' <keyword> '"' | <keyword> | '/' <regexp> '/' | '(' <expr> ')'
 *   <not_and> ::= '-' | ' '
 *   <or> ::= 'OR' | '|'
 *   <keyword> ::= [^"]+
 *   <regexp> ::= [^/]+
 */
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
        }
    }

    _tokenize(query) {
        const tokens = [];
        let i = 0;
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
        const l1 = [this.TYPE.NOT, this.TYPE.OR, this.TYPE.PAREN_OPEN];
        const l2 = [this.TYPE.NOT, this.TYPE.OR, this.TYPE.PAREN_CLOSE];
        for (let i = 0; i < tokens.length; i++) {
            const current = tokens[i];
            const previous = tokens[i - 1];
            const should = previous && !l1.includes(previous.type) && !l2.includes(current.type);
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

    _withNotification(func) {
        try {
            return func();
        } catch (e) {
            this.utils.notification.show("语法解析错误，请检查输入内容", "error");
        }
    }

    showGrammar() {
        const table1 = `
            <table>
                <tr><th>Token</th><th>Description</th></tr>
                <tr><td>whitespace</td><td>表示与，文档应该同时包含全部关键词</td></tr>
                <tr><td>OR</td><td>表示或，文档应该包含关键词之一</td></tr>
                <tr><td>-</td><td>表示非，文档不能包含关键词</td></tr>
                <tr><td>""</td><td>词组</td></tr>
                <tr><td>//</td><td>正则表达式</td></tr>
                <tr><td>()</td><td>调整运算顺序</td></tr>
            </table>
        `
        const table2 = `
            <table>
                <tr><th>Example</th><th>Description</th></tr>
                <tr><td>foo bar</td><td>搜索包含 foo 和 bar 的文档</td></tr>
                <tr><td>foo OR bar</td><td>搜索包含 foo 或 bar 的文档</td></tr>
                <tr><td>foo -bar</td><td>搜索包含 foo 但不包含 bar 的文档</td></tr>
                <tr><td>"foo bar"</td><td>搜索包含 foo bar 这一词组的文档</td></tr>
                <tr><td>foo /bar\\d/ baz</td><td>搜索包含 foo 和 正则 bar\\d 和 baz 的文档</td></tr>
                <tr><td>(a OR b) (c OR d)</td><td>搜索包含 a 或 b，且包含 c 或 d 的文档</td></tr>
            </table>
        `
        const content = `
<query> ::= <expr>
<expr> ::= <term> ( <or> <term> )*
<term> ::= <factor> ( <not_and> <factor> )*
<factor> ::= '"'<keyword>'"' | <keyword> | '/'<regexp>'/' | '('<expr>')'
<not_and> ::= '-' | ' '
<or> ::= 'OR' | '|'
<keyword> ::= [^"]+
<regexp> ::= [^/]+`
        const title = "你可以将这段内容塞给AI，它会为你解释";
        const components = [{ label: table1, type: "p" }, { label: table2, type: "p" }, { label: "", type: "textarea", rows: 8, content, title }];
        this.utils.dialog.modal({ title: "搜索语法", width: "550px", components });
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

    checkByAST(ast, content) {
        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = this.TYPE;

        function evaluate({ type, left, right, value }) {
            switch (type) {
                case KEYWORD:
                case PHRASE:
                    return content.includes(value);
                case REGEXP:
                    return new RegExp(value).test(content);
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

    getQueryTokens(query) {
        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = this.TYPE;

        function evaluate({ type, left, right, value }) {
            switch (type) {
                case KEYWORD:
                case PHRASE:
                    return [value];
                case REGEXP:
                    return [];
                case OR:
                case AND:
                    return [...evaluate(left), ...evaluate(right)];
                case NOT:
                    const wont = evaluate(right);
                    return (left ? evaluate(left) : []).filter(e => !wont.includes(e));
                default:
                    throw new Error(`Unknown AST node type: ${type}`);
            }
        }

        return evaluate(this.parse(query));
    }

    check(query, content, option = {}) {
        if (!option.caseSensitive) {
            query = query.toLowerCase();
            content = content.toLowerCase();
        }
        return this.checkByAST(this.parse(query), content);
    }
}

module.exports = {
    searchStringParser
}