/**
 * List JS reserved words
 * @author Q'inti qinti.nazca@gmail.com
 */

const reservedWords = ['Array', 'Date', 'Infinity', 'JavaObject', 'JavaPackage', 'Math', 'NaN', 'Number', 'Object',
    'String', 'abstract', 'alert', 'all', 'anchor', 'anchors', 'area', 'arguments', 'assign', 'await', 'blur',
    'boolean', 'break', 'button', 'byte', 'case', 'catch', 'char', 'checkbox', 'class', 'clearInterval', 'clearTimeout',
    'clientInformation', 'close', 'closed', 'confirm', 'const', 'constructor', 'continue', 'crypto', 'debugger',
    'decodeURI', 'decodeURIComponent', 'default', 'defaultStatus', 'delete', 'do', 'document', 'double', 'element',
    'elements', 'else', 'embed', 'embeds', 'encodeURI', 'encodeURIComponent', 'enum', 'escape', 'eval', 'event',
    'export', 'extends', 'false', 'fileUpload', 'final', 'finally', 'float', 'focus', 'for', 'form', 'forms', 'frame',
    'frameRate', 'frames', 'function', 'goto', 'hasOwnProperty', 'hidden', 'history', 'if', 'image', 'images',
    'implements', 'import', 'in', 'innerHeight', 'innerWidth', 'instanceof', 'int', 'interface', 'isFinite', 'isNaN',
    'isPrototypeOf', 'layer', 'layers', 'length', 'let', 'link', 'location', 'long', 'mimeTypes', 'name', 'native',
    'navigate', 'navigator', 'new', 'null', 'offscreenBuffering', 'onblur', 'onclick', 'onerror', 'onfocus',
    'onkeydown', 'onkeypress', 'onkeyup', 'onload', 'onmousedown', 'onmouseover', 'onmouseup', 'onsubmit', 'open',
    'opener', 'option', 'outerHeight', 'outerWidth', 'package', 'packages', 'pageXOffset', 'pageYOffset', 'parent',
    'parseFloat', 'parseInt', 'password', 'pkcs11', 'plugin', 'private', 'prompt', 'propertyIsEnum', 'protected',
    'prototype', 'public', 'radio', 'reset', 'return', 'screenX', 'screenY', 'scroll', 'secure', 'select', 'self',
    'setInterval', 'setTimeout', 'short', 'static', 'status', 'submit', 'super', 'switch', 'synchronized', 'taint',
    'text', 'textarea', 'this', 'throw', 'throws', 'toString', 'top', 'transient', 'true', 'try', 'typeof', 'undefined',
    'unescape', 'untaint', 'valueOf', 'var', 'void', 'volatile', 'while', 'window', 'with', 'yield'];

let reservedMap = {};
reservedWords.forEach((property) => {
    reservedMap[property] = 1;
});

module.exports = reservedMap;
