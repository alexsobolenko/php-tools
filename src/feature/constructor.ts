import {Position, TextEditorEdit, window} from 'vscode';
import Feature from '../feature';
import {CONSTRUCT_ARGS_MAX_LENGTH, DOC_SHOW_DESCR, MESSAGE, PHPDOC, PROP} from '../constants';
import Property from '../service/property';

export default class Constructor extends Feature {
    private properties: Array<Property> = [];
    private lastPropertyLine: number = 0;
    private className: string = '';

    public async fill(): Promise<boolean> {
        if (!this.activeEditor) {
            return false;
        }

        const propertyNames: Array<string> = [];
        const properties: Array<Property> = [];

        const {document} = this.activeEditor;
        for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
            const lineText = document.lineAt(lineNumber).text;

            const propertyMatch = PHPDOC.PROPERTY.REGEX.exec(lineText);
            if (propertyMatch !== null) {
                const position = new Position(lineNumber, 5);
                const property = new Property(document, position);
                if (property.name !== PROP.UNDEFINED) {
                    properties.push(property);
                    propertyNames.push(property.name);
                    this.lastPropertyLine = lineNumber;
                }
            }

            const classMatch = PHPDOC.CLASS.REGEX.exec(lineText);
            if (classMatch !== null) {
                this.className = classMatch[2] as string;
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

        return true;
    }

    public render() {
        if (!this.activeEditor) {
            return;
        }

        try {
            const template = this.template();
            if (template === '') {
                throw new Error('Missing template to render');
            }

            let insertLine: number|null = null;
            const {document} = this.activeEditor;
            if (this.lastPropertyLine === 0) {
                for (let lineNumber = document.lineCount - 1; lineNumber > 0; lineNumber--) {
                    if (document.lineAt(lineNumber).text.startsWith('}')) {
                        insertLine = lineNumber;
                    }
                }
            } else {
                insertLine = this.lastPropertyLine + 1;
            }

            if (insertLine === null) {
                throw new Error('Unable to detect insert line for template.');
            }

            this.activeEditor.edit((edit: TextEditorEdit) => {
                edit.replace(new Position(insertLine as number, 0), template);
            });
        } catch (error) {
            this.showMessage(`Error generating constructor: '${(error as Error).message}'.`, MESSAGE.ERROR);
        }
    }

    private template(): string {
        const len = this.properties.length;
        const phpdocData: Array<string> = [];
        const argProps: Array<string> = [];
        const bodyProps: Array<string> = [];

        const showDescription = !!this.getConfig(DOC_SHOW_DESCR, false);
        if (showDescription) {
            phpdocData.push(`${this.className} constructor.`);
        }

        let tab = '    ';
        this.properties.forEach((property, i) => {
            const comma = i === len - 1 ? '' : ',';
            phpdocData.push(`@param ${property.hint} $${property.name}`);
            argProps.push(`${property.type} $${property.name}${comma}`);
            bodyProps.push(`${property.tab}${property.tab}$this->${property.name} = $${property.name};`);
            ({tab} = property);
        });

        const phpdoc = this.arrayToPhpdoc(phpdocData, tab);
        if (len === 0) {
            return `\n${phpdoc}${tab}public function __construct()\n${tab}{}\n`;
        }

        const oneLineArgs = `${tab}public function __construct(${argProps.join(' ')})`;
        const maxLength = this.getConfig(CONSTRUCT_ARGS_MAX_LENGTH, 120);
        if (oneLineArgs.length <= maxLength) {
            return `\n${phpdoc}${oneLineArgs}\n${tab}{\n${bodyProps.join('\n')}\n${tab}}\n`;
        }

        return `\n${phpdoc}${tab}public function __construct(\n${tab}${tab}${argProps.join(`\n${tab}${tab}`)}\n${tab})`
            + ` {\n${bodyProps.join('\n')}\n${tab}}\n`;
    }
}
