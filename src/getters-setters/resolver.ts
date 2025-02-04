import {Position, TextEditorEdit} from 'vscode';
import App from '../app';
import Property from './property';
import {
    A_DOC_LINES_AFTER_DESCR,
    A_DOC_LINES_BEFORE_RETURN,
    A_DOC_SHOW_DESCR,
    A_GS_GENERATE_PHPDOC,
    A_GS_RETURN_SELF,
    M_ERROR,
    R_GETTER,
    R_SETTER,
    R_UNDEFINED_PROPERTY,
} from '../constants';

export default class Resolver {
    /**
     * @type {Array<Property>}
     */
    public properties: Array<Property>;

    public constructor(positions: Array<Position>) {
        this.properties = positions.map((position: Position) => new Property(position));
    }

    /**
     * @param {Property} property
     * @returns {string}
     */
    public getterTemplate(property: Property): string {
        if (property.name === R_UNDEFINED_PROPERTY) return '';

        App.instance.showMessage(`Getter for property '${property.name}' created.`);

        const fcnName = property.getFunction(R_GETTER);

        const generatePhpdoc = !!App.instance.config(A_GS_GENERATE_PHPDOC, true);
        let phpdoc = '\n';
        if (generatePhpdoc) {
            const showDescription = !!App.instance.config(A_DOC_SHOW_DESCR, false);
            const description = showDescription ? `${property.tab} * Getter for ${property.name}\n` : '';

            const emptyLinesAfterDescription = showDescription ? App.instance.config(A_DOC_LINES_AFTER_DESCR, 0) : 0;
            const afterDescription = App.instance.multiplyString(`${property.tab} *\n`, emptyLinesAfterDescription);

            phpdoc = `\n${property.tab}/**\n${description}${afterDescription}`
                + `${property.tab} * @return ${property.hint}\n`
                + `${property.tab} */\n`;
        }

        return `${phpdoc}`
            + `${property.tab}public function ${fcnName}(): ${property.type}\n`
            + `${property.tab}{\n`
            + `${property.tab}${property.tab}return $this->${property.name};\n`
            + `${property.tab}}\n`;
    }

    /**
     * @param {Property} property
     * @returns {string}
     */
    public setterTemplate(property: Property): string {
        if (property.name === R_UNDEFINED_PROPERTY) return '';

        App.instance.showMessage(`Setter for property '${property.name}' created.`);

        const fcnName = property.getFunction(R_SETTER);

        const returnSelf = !!App.instance.config(A_GS_RETURN_SELF, false);
        const returnType = returnSelf ? property.className : 'void';
        const returnInstructions = returnSelf ? `\n${property.tab}${property.tab}return $this;\n` : '';

        const generatePhpdoc = !!App.instance.config(A_GS_GENERATE_PHPDOC, true);
        let phpdoc = '\n';

        if (generatePhpdoc) {
            const returnHint = returnSelf ? `${property.tab} * @return ${property.className}\n` : '';

            const showDescription = !!App.instance.config(A_DOC_SHOW_DESCR, false);
            const description = showDescription ? `${property.tab} * Getter for ${property.name}\n` : '';

            const emptyLinesAfterDescription = showDescription ? App.instance.config(A_DOC_LINES_AFTER_DESCR, 0) : 0;
            const afterDescription = App.instance.multiplyString(`${property.tab} *\n`, emptyLinesAfterDescription);

            const emptyLinesBeforeReturn = returnSelf ? App.instance.config(A_DOC_LINES_BEFORE_RETURN, 0) : 0;
            const beforeReturn = App.instance.multiplyString(`${property.tab} *\n`, emptyLinesBeforeReturn);

            phpdoc = `\n${property.tab}/**\n${description}${afterDescription}`
                + `${property.tab} * @param ${property.hint} $${property.name}\n`
                + `${beforeReturn}${returnHint}${property.tab} */\n`;
        }

        return `${phpdoc}`
            + `${property.tab}public function `
            + `${fcnName}(${property.type} $${property.name}): ${returnType}\n`
            + `${property.tab}{\n`
            + `${property.tab}${property.tab}$this->${property.name} = $${property.name};\n${returnInstructions}`
            + `${property.tab}}\n`;
    }

    /**
     * @param {Array<string>} items
     */
    public render(items: Array<string>) {
        const templates: Array<string> = [];
        this.properties.forEach((property: Property) => {
            const data: Array<string> = [];
            if (items.includes(R_GETTER)) {
                data.push(this.getterTemplate(property));
            }
            if (items.includes(R_SETTER)) {
                data.push(this.setterTemplate(property));
            }

            const template = data.join('');
            if (template !== '') {
                templates.push(template);
            }
        });

        try {
            if (templates.length === 0) {
                throw new Error('Missing template to render');
            }

            let insertLine = null;
            for (let lineNumber = App.instance.editor.document.lineCount - 1; lineNumber > 0; lineNumber--) {
                const line = App.instance.editor.document.lineAt(lineNumber);
                if (line.text.startsWith('}')) {
                    insertLine = line;
                }
            }

            if (insertLine === null) {
                throw new Error('Unable to detect insert line for template.');
            }

            App.instance.editor.edit((edit: TextEditorEdit) => {
                edit.replace(new Position(insertLine.lineNumber, 0), templates.join(''));
            });
        } catch (error: any) {
            App.instance.showMessage(`Error generating object: '${error.message}'.`, M_ERROR);
        }
    }
}
