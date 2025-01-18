import {Position, TextEditorEdit} from 'vscode';
import App from '../app';
import Utils from '../utils';
import Property from './property';

export const R_GETTER = 'getter';
export const R_SETTER = 'setter';

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

        return `\n${this.property.indentation}/**\n`
            + `${this.property.indentation} * @return ${this.property.hint}\n`
            + `${this.property.indentation} */\n`
            + `${this.property.indentation}public function ${this.property.getterName()}(): ${this.property.type}\n`
            + `${this.property.indentation}{\n`
            + `${this.property.indentation}${this.property.indentation}return $this->${this.property.name};\n`
            + `${this.property.indentation}}\n`;
    }

    /**
     * @returns {string}
     */
    public setterTemplate(): string {
        if (!this.property) return '';

        Utils.instance.showInformationMessage(`Setter for property '${this.property.name}' created.`);

        return `\n${this.property.indentation}/**\n`
            + `${this.property.indentation} * @param ${this.property.hint} $${this.property.name}\n`
            + `${this.property.indentation} */\n`
            + `${this.property.indentation}public function `
            + `${this.property.setterName()}(${this.property.type} $${this.property.name}): void\n`
            + `${this.property.indentation}{\n`
            + `${this.property.indentation}${this.property.indentation}$this->${this.property.name} = $${this.property.name};\n`
            + `${this.property.indentation}}\n`;
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
}
