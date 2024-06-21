var parser = require('./parser');
var compiler = require('./compiler');
var stringify = require('./stringify');

module.exports = {
  parse: function(input) {
    var nodes = parser.parse(input.toString());
    return compiler.compile(nodes);
  },
  stringify,
};
