const fs = require('fs');
const path_ = require('path');
const parse = require('node-html-parser').parse;
const tools = require('./tools');

const htmlTags = require('./htmlTags');

let classes_ = {};
let hierarchy_ = {children: []};
let css_ = '';
let html_ = '';
let js_ = '';
let elements_ = [];

/**
 * Nazca compiler v. 1.0.0
 *
 * @author Q'inti qinti.nazca@gmail.com
 *
 * Compiles nazca files into html/css and js files
 *
 * Algorithm:
 * 1. Go through the file, replacing *include with an actual file content
 * 2. Create a map of classes
 * 3. Create a hierarchy of the page
 * 4. Starting generating the html/css/js
 * 5. Go through the classes - define css classes with properties
 * 6. Go through the hierarchy - define html, generate ids for each element that can be referenced
 * 7. Go though the classes - generate functions (JS classes)
 * 8. Create global objects from hierarchy
 * 9. Write html, css, js file for each page
 */

let configLoadPromise = new Promise((resolve, reject) => {
    fs.readdir('.', (err, files) => {
        if (err) {
            return reject(err);
        }

        if (!files.includes('.nazca')) {
            return reject(new Error('Folder does not contain .nazca config file. Please add .nazca file to the project with compile instructions'));
        }

        fs.readFile('.nazca', (err, content) => {
            if (err) {
                return reject(err);
            }

            let config;
            try {
                config = JSON.parse(content);
            } catch (e) {
                return reject(e);
            }

            resolve(config);
        });
    });
});

configLoadPromise.then((config) => {
    if (!config.out) {
        config.out = 'www';
    }

    if (!config.sources) {
        throw {message: '.nazca structure is invalid. Should include "sources" array'};
    }

    if (config.sources || !config.sources.length) {
        for (let name in config.sources) {
            let file = config.sources[name];
            compile(file, name, config.out);
        }
    } else {
        throw {message: '.nazca config file should have sources array'}
    }
});

function read(file) {
    return new Promise((resolve, reject) => {
        fs.readFile(file, (err, content) => {
            if (err) {
                reject(err);
            }
            resolve(content.toString());
        });
    });
}

function compile(file, name, out) {
    classes_ = {};
    let content_;

    // 1. Find all includes and merge the file into one
    recursivelyInclude(file).then((content) => {
        content = content.replace(/''/g, "'");
        content_ = content;
        // 2. Create a map of classes
        classes_ = tools.getClassMap(content);
    }).then(() => {
        //3. Create a hierarchy of the page

        //removing all the classes from the file
        let classless = content_.slice();
        let classIndex = classless.indexOfCode('class ');
        while (classIndex >= 0) {
            let openBracket = classless.indexOfCode('{', classIndex);
            let closingBracket = tools.findClosingBracket(classless, openBracket);
            closingBracket += 2;
            classless = classless.slice(0, classIndex) + classless.slice(closingBracket);
            classIndex = classless.indexOfCode('class ');
        }

        hierarchy_ = {children: tools.getChildren(classless)};
    }).then(() => {
        // 4. Starting generating the html/css/js
        // 5. Go through the classes - define css classes with properties

        for (let className in classes_) {
            if (Object.keys(classes_[className].style).length) {
                css_ += `.${className} {\n`;

                let parents = [];
                classes_[className].parents.forEach((parent) => {
                    parents.unshift(parent);
                });
                parents.forEach((parent) => {
                    if (classes_[parent] && Object.keys(classes_[parent].style).length) {
                        for (let property in classes_[parent].style) {
                            css_ += `    ${property}: ${classes_[parent].style[property]};\n`
                        }
                    }
                });

                for (let property in classes_[className].style) {
                    css_ += `    ${property}: ${classes_[className].style[property]};\n`
                }


                css_ += `}\n\n`;
            }

            if (Object.keys(classes_[className].states).length) {
                for (let state in classes_[className].states) {
                    css_ += `.${className}:${state} ${classes_[className].states[state]}\n`;
                }
            }
        }
    }).then(() => {
        // 6. Go through the hierarchy - define html, generate ids for each element that can be referenced

        hierarchy_.children.forEach((child) => {
            html_ += getHTMLObject(child);
        });

        let root = parse(html_);
        let head = root.querySelector('head');
        if (!head) {
            root.appendChild('<head></head>');
            head = root.querySelector('head');
            root.appendChild(head);
        }

        head.appendChild(`<script src="${out.js}/${name}.js"></script>`);
        head.appendChild(`<link rel="stylesheet" type="text/css" href="${out.css}/${name}.css">`);
        html_ = root.innerHTML;
    }).then(() => {
        // 7. Go though the classes - generate functions (JS classes)

        for (let className in classes_) {
            let clss = classes_[className];
            let body = getClassCode(className, clss);
            js_ += body;
        }
    }).then(() => {
        //8. create global objects from hierarchy
        js_ += `document.addEventListener("DOMContentLoaded", function() {\n`;
        hierarchy_.children.forEach((child) => {
            js_ += getJSFromHierarchy(child) || '';
        });

        elements_.forEach((element) => {
            js_ += `${element}.__nazcaElementConstructor();\n`;
        });
        js_ += `});\n`;
    }).then(() => {
        // 9. Write html, css, js file for each page
        function writeCallback(err) {
            if (err) {
                console.error(err);
            }
        }

        [out.path, path_.join(out.path, out.js), path_.join(out.path, out.html), path_.join(out.path, out.css)].forEach((path) => {
            try {
                fs.mkdirSync(path);
            } catch (e) {
            }
        });

        js_ = `${js_}`;

        fs.writeFile(path_.join(out.path, out.js, `${name}.js`), js_, writeCallback);
        fs.writeFile(path_.join(out.path, out.html, `${name}.html`), html_, writeCallback);
        fs.writeFile(path_.join(out.path, out.css, `${name}.css`), css_, writeCallback);
    }).then((e) => console.log(`\nNazca compiled successfully`)
    ).catch((e) => {
        let errorLocation;
        console.log(e);
        if (e.line.length || e.column.length) {
            if (e.line.length) {
                errorLocation = `${e.line[0]}:${e.column[0] - e.line[1]}:${e.column[1]}`
            } else {
                errorLocation = `${e.line}:${e.column[0] - e.line}:${e.column[1]}`
            }
        } else {
            errorLocation = `${e.line}:${e.column}`;
        }
        console.error(`\n[${errorLocation}] ${e.message}`);
    });
}

function getJSFromHierarchy(object, local = false) {
    if (!object.name && local) {
        return;
    }

    let body = '';
    let variableIsSet = false;
    let className = tools.nextID();

    let hasParameters = {
        name: !!object.name,
        methods: !!Object.keys(object.methods.public).length,
        variables: !!Object.keys(object.variables.public).length,
        eventHandler: !!Object.keys(object.eventHandlers).length,
        getters: !!Object.keys(object.getters).length,
        setters: !!Object.keys(object.setters).length
    };

    if (Object.values(hasParameters).some((value) => value)) {
        if (Object.keys(object.variables.public).length === 1 &&
            object.variables.public.text &&
            ![hasParameters.methods, hasParameters.eventHandler, hasParameters.getters, hasParameters.setters].some((value) => value)
        ) {
            return;
        }
        object.parents = object.classes;
        body = getClassCode(className, object, object.id);
        setVariable();
    }

    function setVariable() {
        if (variableIsSet) {
            return;
        }

        if (!object.name) {
            object.name = tools.nextID();
        }

        if (local) {
            body += `__nazcaThis.__nazcaProtected.${object.name} = new ${object.id}();\n`;
        } else {
            body += `window.${object.name} = new ${object.id}();\n`;
        }
        variableIsSet = true;
        if (object.methods.public.constructor.body) {
            elements_.push(object.name);
        }
    }

    object.children.forEach((child) => {
        body += getJSFromHierarchy(child) || '';
    });

    if (variableIsSet) {
        return body;
    }
}

function getClassCode(className, clss, elementID = null) {
    let constructorParameters = [];
    let constructorBody;
    let body = '';

    //get constructor inputs
    if (clss.methods.public.constructor && clss.methods.public.constructor.parameters) {
        constructorParameters = clss.methods.public.constructor.parameters;
    }

    let classVariables = {
        protected: Object.assign({}, clss.variables.protected, clss.methods.protected),
        public: Object.assign({}, clss.variables.public, clss.methods.public, clss.getters, clss.setters),
        css: Object.assign({}, clss.style),
        attributes: Object.assign({}, clss.attributes)
    };

    constructorBody = clss.methods.public.constructor.body;
    if (constructorBody) {
        constructorBody = getFunctionBody(replaceVariablesAndFunctions(constructorBody, classVariables));
    }

    body += `function ${className}(${constructorParameters.join(', ')}) {\n`;
    if (constructorBody) {
        if (!elementID) {
            body += `${constructorBody}\n`;
        }
    }

    let isElementDefined = false;
    //Inherit classes
    let classes = [];
    for (let i = clss.parents.length - 1; i >= 0; i--) {
        let parent = clss.parents[i];
        if (parent && !htmlTags[parent]) {
            let regex = new RegExp(`\^\[${parent}\]\s{0,}}\(([a-z\d\s,]+)\);?`, 'gi');
            if (regex.test(body)) {
                let parametersString = regex.exec(body)[1];
                body = body.replace(regex, `${parent}.call(this${parametersString.length ? `, ${parametersString}` : ''});\n`);
            } else {
                body = body.replace(/\^\s?\(\s?\);?/, `${parent}.call(this};\n`);
            }

            classes.push(parent);
        } else if (parent && !elementID) {
            body += `this.__nazcaElement = document.createElement('${parent}');\n`;
            isElementDefined = true;
        }
    }

    if (elementID) {
        body += `this.__nazcaElement = document.getElementById('${elementID}');\n`;
        isElementDefined = true;
    }

    body += 'var __nazcaThis = this;\n';

    if (constructorBody && elementID) {
        body += `__nazcaThis.__nazcaElementConstructor = function () {\n`;
        body += `${constructorBody}\n`;
        body += `};\n`;
    }

    //Define variables
    let privateVariables = {};
    let protectedVariables = {};
    let publicVariables = {};

    for (let variable in clss.variables.private) {
        body += `var ${variable} = ${clss.variables.private[variable]};\n`;
        checkDuplicates(className, variable, className);
    }

    for (let variable in clss.variables.public) {
        if (variable === 'text') {
            continue;
        }
        let attribute = clss.variables.public[variable];
        if (variable.indexOfCode('-') >= 0) {
            body += `__nazcaThis['${variable}'] = '${attribute}';\n`;
        } else {
            body += `__nazcaThis.${variable} = '${attribute}';\n`;
        }
        checkDuplicates(className, variable, className);
    }

    body += `__nazcaThis.__nazcaProtected = {};\n`;

    for (let variable in clss.variables.protected) {
        body += `__nazcaThis.__nazcaProtected.${variable} = ${clss.variables.protected[variable]};\n`;
        checkDuplicates(className, variable, className);
    }

    if (clss.classes === undefined) {
        clss.children.forEach((child) => {
            let js = getJSFromHierarchy(child, true, className);
            if (js) {
                body += js;
            }
        });
    }

    // Define public protected, private functions
    for (let method in clss.methods.private) {
        body += `function ${method} (${clss.methods.private[method].parameters.join(', ')})`;
        let methodBody = replaceVariablesAndFunctions(clss.methods.private[method].body, classVariables);
        body += methodBody;
        body += `\n`;
        checkDuplicates(className, method, className);
    }

    for (let method in clss.methods.public) {
        if (method === 'constructor') {
            continue;
        }

        body += `__nazcaThis.${method} = function (${clss.methods.public[method].parameters.join(', ')})`;
        let methodBody = replaceVariablesAndFunctions(clss.methods.public[method].body, classVariables);
        body += methodBody;
        body += `\n`;
        checkDuplicates(className, method, className);
    }

    for (let method in clss.methods.protected) {
        body += `__nazcaThis.__nazcaProtected.${method} = function (${clss.methods.protected[method].parameters.join(', ')})`;
        let methodBody = replaceVariablesAndFunctions(clss.methods.protected[method].body, classVariables);
        body += methodBody;
        body += `\n`;
        checkDuplicates(className, method, className);
    }

    // Search for variables in constructor and replace them

    // Define attributes, css
    if (isElementDefined) {
        for (let key in clss.attributes) {
            body += `Object.defineProperty(__nazcaThis, '$${key}' ,{\n`;
            body += `get: () => __nazcaThis.__nazcaElement.getAttribute('${key}'),\n`;
            body += `set: (value) => {__nazcaThis.__nazcaElement.setAttribute('${key}', value);},\n`;
            body += `configurable: true\n`;
            body += `});\n`;
            body += `__nazcaThis.$${key} = '${clss.attributes[key]}';\n`;
        }

        for (let key in clss.style) {
            body += `Object.defineProperty(__nazcaThis, '${key}', {\n`;
            body += `get: () => __nazcaThis.__nazcaElement.style['${key}'],\n`;
            body += `set: (value) => {__nazcaThis.__nazcaElement.style['${key}'] =  value;},\n`;
            body += `configurable: true\n`;
            body += `});\n`;
        }

        body += `Object.defineProperty(__nazcaThis, 'text', {\n`;
        body += `get: () => __nazcaThis.__nazcaElement.innerText,\n`;
        body += `set: (value) => {__nazcaThis.__nazcaElement.innerText =  value;},\n`;
        body += `configurable: true\n`;
        body += `});\n`;

        classes.forEach((cls) => {
            body += `__nazcaThis.__nazcaElement.classList.add('${cls}');\n`;
        });
        body += `__nazcaThis.__nazcaElement.classList.add('${className}');\n`;
    }

    // Define getters, setters
    let definedGetters = {};
    for (let key in clss.getters) {
        body += `Object.defineProperty(__nazcaThis, '${key}'{\n`;
        body += `get: () => ${clss.getters[key].body},\n`;
        if (clss.setters) {
            body += `set: (${clss.setters[key].parameters.join(', ')}) => ${clss.setters[key].body},\n`;
        }
        body += `configurable: true\n`;
        body += `});\n`;
        definedGetters[key] = 1;
    }

    for (let key in clss.setters) {
        if (definedGetters[key] === 1) {
            continue;
        }

        body += `Object.defineProperty(__nazcaThis, '${key}', {\n`;
        body += `set: (${clss.setters[key].parameters.join(', ')}) => ${clss.setters[key].body},\n`;
        body += `configurable: true\n`;
        body += `});\n`;
    }

    // Define event listeners
    for (let event in clss.eventHandlers) {
        body += `__nazcaThis.__nazcaElement.addEventListener('${event}',function (${clss.eventHandlers[event].parameters.join(', ')}) ${clss.eventHandlers[event].body});\n`;
    }

    if (isElementDefined) {
        body += `var __nazcaChildren = {}\n`;
        body += `__nazcaChildren.add = (object) => {\n`;
        body += `if (object.__nazcaElement) {\n`;
        body += `__nazcaThis.__nazcaElement.appendChild(object.__nazcaElement)\n`;
        body += `} else {\n`;
        body += `console.error("Can't append a child without element")}}\n`;

        body += `__nazcaChildren.remove = (object) => {\n`;
        body += `if (object.__nazcaElement) {\n`;
        body += `__nazcaThis.__nazcaElement.removeChild(object.__nazcaElement)\n`;
        body += `} else {\n`;
        body += `console.error("Can't remove a child without element")}}\n`;

        body += `Object.defineProperty(__nazcaThis, 'children', {\n`;
        body += `get: () => __nazcaChildren,\n`;
        body += `configurable: true\n`;
        body += `});\n`;

        //TODO Probably should add some insertion function as well and removal by index
    }

    body += `}\n`;

    return body;

    function checkDuplicates(className, variable) {
        if (privateVariables[variable] === 1 || protectedVariables[variable] === 1 || publicVariables[variable] === 1) {
            throw {message: `private/protected/public variable or function with the same name (${className}::${variable}) is not allowed`};
        }
        protectedVariables[variable] = 1;
    }
}

function getHTMLObject(object, indent = 0) {
    let element = 'div';
    let classes = [];
    let style = [];
    let attributes = [];
    if (object.classes) {
        object.classes.forEach((clss) => {
            if (htmlTags[clss]) {
                element = clss;
            } else {
                classes.push(clss);
            }

            if (classes_[clss]) {
                classes_[clss].parents.forEach((clss) => {
                    if (htmlTags[clss]) {
                        element = clss;
                    }
                });
            }
        });
    }

    for (let key in object.style) {
        style.push(`${key}: ${object.style[key]};`);
    }

    for (let key in object.attributes) {
        attributes.push(`${key} = "${object.attributes[key]}"`);
    }

    let id = tools.nextID();
    object.id = id;

    let spaces = '';
    for (let i = 0; i < indent; i++) {
        spaces += ' ';
    }
    let nextSpaces = `    ${spaces}`;

    let html = `${spaces} <${element}`;
    html += `${classes.length ? ` class="${classes.join(' ')}"` : ''}`;
    html += `${style.length ? ` style="${style.join('')}"` : ''}`;
    html += `${attributes.length ? ` ${attributes.join(' ')}` : ''}`;
    html += ` id="${id}"`;
    html += '>\n';

    if (object.variables && object.variables.public && object.variables.public.text) {
        html += `${nextSpaces}${object.variables.public.text}\n`;
    }

    if (object.children) {
        object.children.forEach((child) => {
            html += getHTMLObject(child, indent + 4);
        });
    }
    html += `${spaces}</${element}>\n`;

    return html;
}

function recursivelyInclude(file) {
    let prePath = file.split(/\/|\\/);
    prePath.pop();
    prePath = prePath.join('/');
    return read(file).then((fileContent) => {
        let start = fileContent.indexOfCode('*include');
        let promises = [];
        let replacements = [];
        while (start >= 0) {
            let end = fileContent.indexOfCode(';', start);
            let includeString = fileContent.slice(start, end);

            let [name, path] = includeString.split(/:/);
            if (!path) {
                throw {message: '*include directive is invalid'};
            }

            path = path.replace(/'/g, '').trim();
            replacements.push({start, end});
            promises.push(recursivelyInclude(
                `${prePath}/${path}`
            ));

            start = fileContent.indexOfCode('*include', end);
        }

        return Promise.all(promises).then((contents) => {
            for (let i = contents.length - 1; i >= 0; i--) {
                fileContent = fileContent.slice(0, replacements[i].start) + contents[i] + fileContent.slice(replacements[i].end + 1);
            }

            return fileContent;
        });
    });
}

function getFunctionBody(bodyWithBrackets) {
    let openBracket = bodyWithBrackets.indexOfCode('{');
    let closeBracket = tools.findClosingBracket(bodyWithBrackets, openBracket + 1);
    return bodyWithBrackets.slice(openBracket + 1, closeBracket - 1);
}

function replaceVariablesAndFunctions(body, {protected, public, css, attributes}) {
    //separate function on lines
    let blockIndex = 0;
    let defined = [];

    let variables = Object.keys(protected).concat(Object.keys(public)).filter((variable) => variable !== 'constructor').concat(Object.keys(css)).concat(Object.keys(attributes));

    let innerBody = body.slice(1, body.length - 2);
    tools.buildStrings(innerBody);
    let lines = innerBody.splitLines();
    lines = lines.map((line) => {
        if (!line.trim()) {
            return;
        }
        let parts = line.split('{');
        parts = parts.map((part, index) => {
            if (!part.trim()) {
                return;
            }
            if (index > 1) {
                blockIndex++;
            }
            let subParts = part.split('}');
            subParts = subParts.map((part, subindex) => {
                if (!part.trim()) {
                    return;
                }

                if (index > 1 && subindex > 1) {
                    blockIndex--;
                }

                if (part.indexOfCode('var') >= 0 || part.indexOfCode('const') >= 0 || part.indexOfCode('let') >= 0) {
                    let variables1 = /\blet\s([a-z\d_$]+)\b/gi.exec(part);
                    let variables2 = /\b,\s{0,}([a-z\d_$]+)\b/gi.exec(part);
                    if (variables1) {
                        variables1.shift()
                    } else {
                        variables1 = []
                    }
                    if (variables1 && variables2) {
                        variables2.shift()
                    } else {
                        variables2 = []
                    }

                    let variables = variables1.concat(variables2);
                    for (let i = 0; i < variables.length; i++) {
                        let variable = variables[i];
                        defined[blockIndex] = defined[blockIndex] || {};
                        defined[blockIndex][variable] = 1;
                    }
                }

                variables.forEach((variable) => {
                    if (!(defined[blockIndex] && defined[blockIndex][variable]) && part.indexOfCode(variable) >= 0) {
                        part = replaceVariable(part, variable, protected[variable]);
                    }
                });

                return part;
            });

            return subParts.join('}');
        });

        return parts.join('{');
    });

    return `{\n${lines.join('\n')}}\n`;
}

function replaceVariable(content, variableName, isProtected = false) {
    tools.buildStrings(content);
    [variableName, `['${variableName}']`, `[\`${variableName}\`]`, `["${variableName}"]`].forEach((variable) => {
        let index = content.indexOfCode(variable);
        let point = variable.indexOf('[') === 0 ? '' : '.';
        let replacement = isProtected ? `__nazcaThis.__nazcaProtected${point}${variableName}` : `__nazcaThis${point}${variable}`;
        while (index >= 0) {
            if (content.charAt(index - 1) !== '.') {
                content = `${content.slice(0, index)}${replacement}${content.slice(index + variable.length)}`;
            }
            index += replacement.length;
            index = content.indexOfCode(variable, index);
        }
    });

    return content;
}