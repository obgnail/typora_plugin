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
class SearchStringParser {
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
            } else if (query[i] === "O" && query.substring(i, i + 2) === "OR") {
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

        const result = [tokens[0]];
        for (let i = 1; i < tokens.length; i++) {
            const current = tokens[i];
            const previous = tokens[i - 1];
            const skip1 = [this.TYPE.MINUS, this.TYPE.OR, this.TYPE.PAREN_OPEN].includes(previous.type);
            const skip2 = [this.TYPE.MINUS, this.TYPE.OR, this.TYPE.PAREN_CLOSE].includes(current.type);
            if (!skip1 && !skip2) {
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

    _parse(query) {
        const tokens = this._tokenize(query);
        const result = this._parseExpression(tokens);
        if (tokens.length !== 0) {
            throw "parse error"
        }
        return result;
    }

    _traverse(node, callback) {
        if (node == null) return;
        this._traverse(node.left, callback);
        this._traverse(node.right, callback);
        callback(node);
    }

    parse(query, callback) {
        const ast = this._parse(query);
        this._traverse(ast, callback);
    }
}

module.exports = {
    SearchStringParser
}