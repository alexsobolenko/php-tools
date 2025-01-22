import {Position, TextEditorEdit} from 'vscode';
import App from '../app';
import Utils from '../utils';
import Property from './property';

export const R_GETTER = 'r_getter';
export const R_SETTER = 'r_setter';

export default class Resolver {
    /**
     * @type {Property|null}
     */
    public property: Property|null;

    public constructor() {
        this.property = null;
        for (let index = 0; index < App.instance.editor.selections.length; index++) {
            const selection = App.instance.editor.selections[index];

            try {
                this.property = Property.fromEditorPosition(App.instance.editor, selection.active);
            } catch (error: any) {
                Utils.instance.showErrorMessage(error.message);
            }
        }
    }

    /**
     * @returns {string}
     */
    public getterTemplate(): string {
        if (!this.property) return '';

        Utils.instance.showInformationMessage(`Getter for property '${this.property.name}' created.`);

        const generatePhpdoc = !!this.config('generate-phpdoc', true);
        let phpdoc = "\n";
        if (generatePhpdoc) {
            const showDescription = !!this.config('show-description', false);
            const description = showDescription ? `${this.property.tab} * Getter for ${this.property.name}\n` : '';

            const emptyLinesBeforeReturn = showDescription ? this.config('empty-lines-before-return', 0) : 0;
            const beforeReturn = Utils.instance.multiplyString(`${this.property.tab} *\n`, emptyLinesBeforeReturn);

            phpdoc = `\n${this.property.tab}/**\n${description}${beforeReturn}`
                + `${this.property.tab} * @return ${this.property.hint}\n`
                + `${this.property.tab} */\n`;
        }

        return `${phpdoc}`
            + `${this.property.tab}public function ${this.property.getterName()}(): ${this.property.type}\n`
            + `${this.property.tab}{\n`
            + `${this.property.tab}${this.property.tab}return $this->${this.property.name};\n`
            + `${this.property.tab}}\n`;
    }

    /**
     * @returns {string}
     */
    public setterTemplate(): string {
        if (!this.property) return '';

        Utils.instance.showInformationMessage(`Setter for property '${this.property.name}' created.`);

        const returnSelf = !!this.config('return-self', false);
        let returnHint = '';
        let returnType = 'void';
        let returnInstructions = '';
        if (returnSelf) {
            returnHint = `${this.property.tab} * @return self\n`
            returnType = 'self';
            returnInstructions = `\n${this.property.tab}${this.property.tab}return $this;\n`;
        }

        const generatePhpdoc = !!this.config('generate-phpdoc', true);
        let phpdoc = "\n";

        if (generatePhpdoc) {
            const showDescription = !!this.config('show-description', false);
            const description = showDescription ? `${this.property.tab} * Getter for ${this.property.name}\n` : '';

            const emptyLinesBeforeParams = showDescription ? this.config('empty-lines-before-params', 0) : 0;
            const beforeParams = Utils.instance.multiplyString(`${this.property.tab} *\n`, emptyLinesBeforeParams);

            const emptyLinesBeforeReturn = returnSelf ? this.config('empty-lines-before-return', 0) : 0;
            const beforeReturn = Utils.instance.multiplyString(`${this.property.tab} *\n`, emptyLinesBeforeReturn);

            phpdoc = `\n${this.property.tab}/**\n${description}${beforeParams}`
                + `${this.property.tab} * @param ${this.property.hint} $${this.property.name}\n`
                + `${beforeReturn}${returnHint}${this.property.tab} */\n`;
        }

        return `${phpdoc}`
            + `${this.property.tab}public function `
            + `${this.property.setterName()}(${this.property.type} $${this.property.name}): ${returnType}\n`
            + `${this.property.tab}{\n`
            + `${this.property.tab}${this.property.tab}$this->${this.property.name}`
            + ` = $${this.property.name};\n${returnInstructions}`
            + `${this.property.tab}}\n`;
    }

    /**
     * @param {Array<string>} items
     */
    public render(items: Array<string>) {
        const data: Array<string> = [];
        if (items.includes(R_GETTER)) data.push(this.getterTemplate());
        if (items.includes(R_SETTER)) data.push(this.setterTemplate());

        const template = data.join('');
        if (template === '') {
            Utils.instance.showErrorMessage('Missing template to render.');

            return;
        }

        let insertLine = null;
        for (let lineNumber = App.instance.editor.document.lineCount - 1; lineNumber > 0; lineNumber--) {
            const line = App.instance.editor.document.lineAt(lineNumber);
            if (line.text.startsWith('}')) {
                insertLine = line;
            }
        }

        if (insertLine === null) {
            Utils.instance.showErrorMessage('Unable to detect insert line for template.');

            return;
        }

        App.instance.editor
            .edit((edit: TextEditorEdit) => {
                edit.replace(new Position(insertLine.lineNumber, 0), template);
            })
            .then((error: any) => {
                Utils.instance.showErrorMessage(`Error generating functions: ${error}`);
            });
    }

    /**
     * @param {string} key
     * @param {any} defaultValue
     * @returns {any}
     */
    private config(key: string, defaultValue: any): any {
        return App.instance.config(`getter-setter-${key}`, defaultValue);
    }
}
