/**
 * grammar:
 *   <query> ::= <expr>
 *   <expr> ::= <term> ( <or> <term> )*
 *   <term> ::= <factor> ( <not_and> <factor> )*
 *   <factor> ::= <qualifier>? <match>
 *   <qualifier> ::= <scope> <operator>
 *   <match> ::= <keyword> | '"'<keyword>'"' | '/'<regexp>'/' | '('<expr>')'
 *   <not_and> ::= '-' | ' '
 *   <or> ::= 'OR' | '|'
 *   <keyword> ::= [^"]+
 *   <regexp> ::= [^/]+
 *   <operator> ::= ':' | '=' | '>=' | '<=' | '>' | '<'
 *   <scope> ::= 'default' | 'file' | 'path' | 'ext' | 'content' | 'size' | 'time'
 * */
class searchStringParser {
    constructor() {
        this.TYPE = {
            OR: "OR",
            AND: "AND",
            NOT: "NOT",
            PAREN_OPEN: "PAREN_OPEN",
            PAREN_CLOSE: "PAREN_CLOSE",
            KEYWORD: "KEYWORD",
            PHRASE: "PHRASE",
            REGEXP: "REGEXP",
            QUALIFIER: "QUALIFIER",
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
            QUALIFIER: (scope, operator) => ({ type: this.TYPE.QUALIFIER, scope, operator }),
        }
        this.setQualifier();
    }

    setQualifier(
        scope = ["default", "file", "path", "ext", "content", "time", "size"],
        operator = [">=", "<=", ":", "=", ">", "<"],
    ) {
        this.qualifierRegExp = new RegExp(`^(?<scope>${scope.join('|')})(?<operator>${operator.join('|')})`, "i");
    }

    _tokenize(query) {
        const tokens = [];
        let i = 0;
        let qualifierMatch = null;
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
            } else if (qualifierMatch = query.substring(i).match(this.qualifierRegExp)) {
                const { scope, operator } = qualifierMatch.groups;
                tokens.push(this.TOKEN.QUALIFIER(scope, operator));
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
        const invalidPre = [this.TYPE.NOT, this.TYPE.OR, this.TYPE.PAREN_OPEN, this.TYPE.QUALIFIER];
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
        const qualifier = (tokens[0].type === this.TYPE.QUALIFIER)
            ? tokens.shift()
            : this.TOKEN.QUALIFIER("default", ":");
        const node = this._parseMatch(tokens);
        return this._setQualifier(node, qualifier);
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

    _setQualifier(node, qualifier) {
        if (!node) return;
        const type = node.type;
        const isLeaf = type === this.TYPE.PHRASE || type === this.TYPE.KEYWORD || type === this.TYPE.REGEXP;
        if (isLeaf && (!node.scope || node.scope === "default")) {
            node.scope = qualifier.scope;
            node.operator = qualifier.operator;
        } else {
            this._setQualifier(node.left, qualifier);
            this._setQualifier(node.right, qualifier);
        }
        return node
    }

    parse(query) {
        const tokens = this._tokenize(query);
        if (tokens.length === 0) {
            return this.TOKEN.KEYWORD("")
        }
        const result = this._parseExpression(tokens);
        if (tokens.length !== 0) {
            throw new Error(`parse error. remind tokens: ${tokens}`)
        }
        return result
    }

    evaluate(ast, { keyword, phrase, regexp }) {
        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = this.TYPE;

        function _eval({ type, left, right, scope, operator, value }) {
            switch (type) {
                case KEYWORD:
                    return keyword(scope, operator, value);
                case PHRASE:
                    return phrase(scope, operator, value);
                case REGEXP:
                    return regexp(scope, operator, value);
                case OR:
                    return _eval(left) || _eval(right);
                case AND:
                    return _eval(left) && _eval(right);
                case NOT:
                    return (left ? _eval(left) : true) && !_eval(right);
                default:
                    throw new Error(`Unknown AST node type: ${type}`);
            }
        }

        return _eval(ast);
    }
}

module.exports = {
    searchStringParser
}