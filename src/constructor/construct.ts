import {Position, TextEditorEdit, window} from 'vscode';
import App from '../app';
import {A_DOC_SHOW_DESCR, D_REGEX_CLASS, D_REGEX_PROPERTY, M_ERROR} from '../constants';
import Property from '../getters-setters/property';

export default class Construct {
    public properties: Array<Property> = [];
    public lastPropertyLine: number = 0;
    public className: string = '';

    public async fill() {
        const propertyNames: Array<string> = [];
        const properties: Array<Property> = [];

        const {document} = App.instance.editor;
        for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
            const lineText = document.lineAt(lineNumber).text;

            let matches = D_REGEX_PROPERTY.exec(lineText) as Array<string>|null;
            if (matches !== null) {
                const position = new Position(lineNumber, 5);
                const property = new Property(position);
                properties.push(property);
                propertyNames.push(property.name);
                this.lastPropertyLine = lineNumber;
            }

            matches = D_REGEX_CLASS.exec(lineText) as Array<string>|null;
            if (matches !== null) {
                this.className = matches[2] as string;
            }
        }

        const selectedProps = await window.showQuickPick(propertyNames, {
            canPickMany: true,
            placeHolder: 'Select properties to include in the constructor',
        });

        properties.forEach((property) => {
            if (selectedProps?.includes(property.name)) {
                this.properties.push(property);
            }
        });
    }

    public render() {
        try {
            const template = this.template();
            if (template === '') {
                throw new Error('Missing template to render');
            }

            let insertLine;
            if (this.lastPropertyLine === 0) {
                insertLine = null;
                for (let lineNumber = App.instance.editor.document.lineCount - 1; lineNumber > 0; lineNumber--) {
                    const line = App.instance.editor.document.lineAt(lineNumber);
                    if (line.text.startsWith('}')) {
                        insertLine = line;
                    }
                }
            } else {
                insertLine = App.instance.editor.document.lineAt(this.lastPropertyLine + 1);
            }

            if (insertLine === null) {
                throw new Error('Unable to detect insert line for template.');
            }

            App.instance.editor.edit((edit: TextEditorEdit) => {
                edit.replace(new Position(insertLine.lineNumber, 0), template);
            });
        } catch (error: any) {
            App.instance.utils.showMessage(`Error generating constructor: '${error.message}'.`, M_ERROR);
        }
    }

    private template() {
        const len = this.properties.length;
        const phpdocData: Array<string> = [];
        const argProps: Array<string> = [];
        const bodyProps: Array<string> = [];

        const showDescription = !!App.instance.config(A_DOC_SHOW_DESCR, false);
        if (showDescription) {
            phpdocData.push(`${this.className} constructor.`);
        }

        let tab = '    ';
        this.properties.forEach((property, i) => {
            const comma = i === len - 1 ? '' : ',';
            phpdocData.push(`@param ${property.hint} $${property.name}`);
            argProps.push(`${property.type} $${property.name}${comma}`);
            bodyProps.push(`${property.tab}${property.tab}$this->${property.name} = $${property.name};`);
            tab = property.tab as string;
        });

        const phpdoc = App.instance.utils.arrayToPhpdoc(phpdocData, tab);
        if (len === 0) {
            return `\n${phpdoc}${tab}public function __construct()\n${tab}{}\n`;
        }

        const oneLineArgs = `${tab}public function __construct(${argProps.join(' ')})`;
        const maxLength = App.instance.config('constructor-args-one-line-max-length', 120);
        if (oneLineArgs.length <= maxLength) {
            return `\n${phpdoc}${oneLineArgs}\n${tab}{\n${bodyProps.join('\n')}\n${tab}}\n`;
        }

        return `\n${phpdoc}${tab}public function __construct(\n${tab}${tab}${argProps.join(`\n${tab}${tab}`)}\n${tab})`
            + ` {\n${bodyProps.join('\n')}\n${tab}}\n`;
    }
}
