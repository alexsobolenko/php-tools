import {Position, TextEditorEdit, window} from 'vscode';
import App from '../../app';
import {
    A_DOC_LINES_AFTER_DESCR,
    A_DOC_LINES_BEFORE_RETURN,
    A_DOC_SHOW_DESCR,
    A_GS_GENERATE_PHPDOC,
    A_GS_RETURN_SELF,
    D_REGEX_PROPERTY,
    M_ERROR,
    R_GETTER,
    R_SETTER,
    R_UNDEFINED_PROPERTY,
} from '../../constants';
import Property from './property';

export default class Resolver {
    public properties: Array<Property>;

    public constructor(positions: Array<Position>) {
        this.properties = positions.map((position: Position) => new Property(position));
    }

    public static async selectProperties(placeHolder: string): Promise<Array<Position>> {
        const {document} = App.instance.editor;
        const positions: Array<{name: string, position: Position}> = [];
        for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
            const lineText = document.lineAt(lineNumber).text;
            const matches = D_REGEX_PROPERTY.exec(lineText) as Array<string>|null;
            if (matches !== null) {
                const position = new Position(lineNumber, 5);
                const property = new Property(position);
                positions.push({
                    name: property.name,
                    position,
                });
            }
        }

        const selectedProps = await window.showQuickPick(positions.map((p) => p.name), {
            canPickMany: true,
            placeHolder,
        });

        const result: Array<Position> = [];
        positions.forEach((position) => {
            if (selectedProps?.includes(position.name)) {
                result.push(position.position);
            }
        });

        return result;
    }

    public getterTemplate(property: Property): string {
        if (property.name === R_UNDEFINED_PROPERTY) return '';

        const fcnName = property.getFunction(R_GETTER);

        const generatePhpdoc = !!App.instance.config(A_GS_GENERATE_PHPDOC, true);
        let phpdoc = '';
        if (generatePhpdoc) {
            const data = [];

            if (!!App.instance.config(A_DOC_SHOW_DESCR, false)) {
                data.push(`Getter for ${property.name}`);
                for (let i = 0; i < App.instance.config(A_DOC_LINES_AFTER_DESCR, 0); i++) {
                    data.push('');
                }
            }

            data.push(`@return ${property.hint}`);
            phpdoc = App.instance.arrayToPhpdoc(data, property.tab);
        }

        return `\n${phpdoc}`
            + `${property.tab}public function ${fcnName}(): ${property.type}\n`
            + `${property.tab}{\n`
            + `${property.tab}${property.tab}return $this->${property.name};\n`
            + `${property.tab}}\n`;
    }

    public setterTemplate(property: Property): string {
        if (property.name === R_UNDEFINED_PROPERTY) return '';

        const fcnName = property.getFunction(R_SETTER);

        const returnSelf = !!App.instance.config(A_GS_RETURN_SELF, false);
        const returnType = returnSelf ? property.className : 'void';
        const returnInstructions = returnSelf ? `\n${property.tab}${property.tab}return $this;\n` : '';

        const generatePhpdoc = !!App.instance.config(A_GS_GENERATE_PHPDOC, true);
        let phpdoc = '';
        if (generatePhpdoc) {
            const data = [];

            if (!!App.instance.config(A_DOC_SHOW_DESCR, false)) {
                data.push(`Getter for ${property.name}`);
                for (let i = 0; i < App.instance.config(A_DOC_LINES_AFTER_DESCR, 0); i++) {
                    data.push('');
                }
            }

            data.push(`@param ${property.hint} $${property.name}`);

            if (returnSelf) {
                for (let i = 0; i < App.instance.config(A_DOC_LINES_BEFORE_RETURN, 0); i++) {
                    data.push('');
                }
                data.push(`@return ${property.className}`);
            }

            phpdoc = App.instance.arrayToPhpdoc(data, property.tab);
        }

        return `\n${phpdoc}`
            + `${property.tab}public function `
            + `${fcnName}(${property.type} $${property.name}): ${returnType}\n`
            + `${property.tab}{\n`
            + `${property.tab}${property.tab}$this->${property.name} = $${property.name};\n${returnInstructions}`
            + `${property.tab}}\n`;
    }

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
