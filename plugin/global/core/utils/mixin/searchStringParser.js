/**
 * grammar:
 *   <query> ::= <expression>
 *   <expression> ::= <term> ( <or> <term> )*
 *   <term> ::= <factor> ( <minus_and> <factor> )*
 *   <factor> ::= <quoted_phrase> | <word> | <l_parent> <expression> <r_parent>
 *   <quoted_phrase> ::= <quote> {word} <quote>
 *   <word> ::= \w+
 *   <minus_and> ::= <minus> | <and>
 *   <minus> ::= '-'
 *   <and> ::= ' '
 *   <or> ::= 'or'
 *   <quote> ::= '"'
 *   <l_parent> ::= '('
 *   <r_parent> ::= ')'
 * example:
 *   foo bar
 *   "foo bar"
 *   foo OR bar
 *   foo -bar
 *   (a OR b) (c OR d)
 *   aaa "foo bar bbb" -ccc baz -qux OR (a b -c)
 */
class searchStringParser {
    constructor() {
        this.TYPE = {
            OR: "OR",
            AND: "AND",
            MINUS: "MINUS",
            PAREN_OPEN: "PAREN_OPEN",
            PAREN_CLOSE: "PAREN_CLOSE",
            KEYWORD: "KEYWORD",
            QUOTED_PHRASE: "QUOTED_PHRASE",
        }
        this.TOKEN = {
            OR: { type: this.TYPE.OR, value: "OR" },
            AND: { type: this.TYPE.AND, value: " " },
            MINUS: { type: this.TYPE.MINUS, value: "-" },
            PAREN_OPEN: { type: this.TYPE.PAREN_OPEN, value: "(" },
            PAREN_CLOSE: { type: this.TYPE.PAREN_CLOSE, value: ")" },
            QUOTED_PHRASE: value => ({ type: this.TYPE.QUOTED_PHRASE, value }),
            KEYWORD: value => ({ type: this.TYPE.KEYWORD, value })
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
                tokens.push(this.TOKEN.QUOTED_PHRASE(query.substring(start, i)));
                i++;
            } else if (query[i] === "(") {
                tokens.push(this.TOKEN.PAREN_OPEN);
                i++;
            } else if (query[i] === ")") {
                tokens.push(this.TOKEN.PAREN_CLOSE);
                i++;
            } else if (query[i].toUpperCase() === "O" && query.substring(i, i + 2).toUpperCase() === "OR") {
                tokens.push(this.TOKEN.OR);
                i += 2;
            } else if (query[i] === "-") {
                tokens.push(this.TOKEN.MINUS);
                i++;
            } else if (/\s/.test(query[i])) {
                i++; // skip whitespace
            } else {
                const start = i;
                while (i < query.length && !/\s|"|\(|\)|-/.test(query[i])) {
                    i++;
                }
                tokens.push(this.TOKEN.KEYWORD(query.substring(start, i)));
            }
        }

        const result = [];
        const l1 = [this.TYPE.MINUS, this.TYPE.OR, this.TYPE.PAREN_OPEN];
        const l2 = [this.TYPE.MINUS, this.TYPE.OR, this.TYPE.PAREN_CLOSE];
        for (let i = 0; i < tokens.length; i++) {
            const current = tokens[i];
            const previous = tokens[i - 1];
            const should = previous && !l1.includes(previous.type) && !l2.includes(current.type);
            if (should) {
                result.push(this.TOKEN.AND)
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
            if (type === this.TYPE.MINUS || type === this.TYPE.AND) {
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
        if (type === this.TYPE.QUOTED_PHRASE || type === this.TYPE.KEYWORD) {
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

    parse(query) {
        const tokens = this._tokenize(query);
        if (tokens.length === 0) {
            return this.TOKEN.KEYWORD("")
        }
        const result = this._parseExpression(tokens);
        if (tokens.length !== 0) {
            throw "parse error"
        }
        return result
    }

    traverse(ast, callback) {
        if (ast == null) return;
        this.traverse(ast.left, callback);
        this.traverse(ast.right, callback);
        callback(ast);
    }

    parseAndTraverse(query, callback) {
        const ast = this.parse(query);
        this.traverse(ast, callback);
        return ast
    }

    checkByAST(ast, content) {
        const { KEYWORD, QUOTED_PHRASE, OR, AND, MINUS } = this.TYPE;
        this.traverse(ast, node => {
            const { type, left, right, value } = node;
            switch (type) {
                case KEYWORD:
                case QUOTED_PHRASE:
                    node._result = content.includes(value);
                    break
                case OR:
                    node._result = left._result || right._result;
                    break
                case AND:
                    node._result = left._result && right._result;
                    break
                case MINUS:
                    node._result = (left ? left._result : true) && !right._result;
                    break
                default:
                    throw `Error Node: {type: ${node.type}, value: ${node.value}}`
            }
        });
        // console.log(JSON.stringify(ast, null, 2));
        return ast._result
    }

    /**
     * 检查内容是否匹配给定的查询条件。
     *
     * @param {string} query 查询条件
     * @param {string} content 检查内容
     * @param {object} [option={}] 选项
     * @param {boolean} [option.caseSensitive=false] 是否区分大小写
     * @returns {boolean} 是否匹配
     */
    check(query, content, option = {}) {
        if (!option.caseSensitive) {
            query = query.toLowerCase();
            content = content.toLowerCase();
        }
        const ast = this.parse(query);
        return this.checkByAST(ast, content);
    }

    getQueryTokens(query) {
        const { KEYWORD, QUOTED_PHRASE, OR, AND, MINUS } = this.TYPE;
        const ast = this.parseAndTraverse(query, node => {
            const { type, left, right, value } = node;
            switch (type) {
                case KEYWORD:
                case QUOTED_PHRASE:
                    node._result = [value];
                    break
                case OR:
                case AND:
                    node._result = [...left._result, ...right._result];
                    break
                case MINUS:
                    node._result = (left ? left._result : []).filter(e => !right._result.includes(e));
                    break
                default:
                    throw `Error Node: {type: ${node.type}, value: ${node.value}}`
            }
        })
        // console.log(JSON.stringify(ast, null, 2));
        return ast._result;
    }
}

module.exports = {
    searchStringParser
}