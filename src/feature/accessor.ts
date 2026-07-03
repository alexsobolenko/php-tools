import {Position, TextEditorEdit, window} from 'vscode';
import Feature from '../feature';
import {
    DOC_LINES_AFTER_DESCR,
    DOC_LINES_BEFORE_RETURN,
    DOC_SHOW_DESCR,
    GS_GENERATE_PHPDOC,
    GS_RETURN_SELF,
    MESSAGE,
    PROP,
} from '../constants';
import Property from '../model/property';
import {nodeName, parsePhp, walkPhp} from '../service/php-ast';

export default class Accessor extends Feature {
    private properties: Array<Property>;

    public constructor(positions: Array<Position>) {
        super();
        const document = this.activeEditor?.document;
        this.properties = document ? positions.map((position) => new Property(document, position)) : [];
    }

    public static async selectProperties(placeHolder: string): Promise<Array<Position>> {
        const positions = this.collectProperties();
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

    private static collectProperties(): Array<{name: string, position: Position}> {
        const positions: Array<{name: string, position: Position}> = [];
        const editor = window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'php') {
            return positions;
        }

        try {
            const {document} = editor;
            const seen = new Set<string>();
            const program = parsePhp(document.getText());
            walkPhp(program, (node, parent) => {
                if (node.kind === 'property') {
                    const name = nodeName(node.name);
                    const offset = node.loc?.start?.offset;
                    if (!name || typeof offset !== 'number') {
                        return;
                    }

                    const key = `property:${name}:${offset}`;
                    if (seen.has(key)) {
                        return;
                    }

                    seen.add(key);
                    positions.push({name, position: document.positionAt(offset)});

                    return;
                }

                if (
                    node.kind === 'parameter'
                    && parent?.kind === 'method'
                    && nodeName(parent.name) === '__construct'
                    && typeof node.flags === 'number'
                    && node.flags > 0
                ) {
                    const name = nodeName(node.name);
                    const offset = node.loc?.start?.offset;
                    if (!name || typeof offset !== 'number') {
                        return;
                    }

                    const key = `promoted:${name}:${offset}`;
                    if (seen.has(key)) {
                        return;
                    }

                    seen.add(key);
                    positions.push({name, position: document.positionAt(offset)});
                }
            });

            return positions;
        } catch (error) {
            window.showErrorMessage(`Failed to parse properties: ${(error as Error).message}.`);

            return positions;
        }
    }

    public getterTemplate(property: Property): string {
        if (property.name === PROP.UNDEFINED) {
            return '';
        }

        const fcnName = property.getFunction(PROP.GETTER);
        const generatePhpdoc = !!this.getConfig(GS_GENERATE_PHPDOC, true);
        let phpdoc = '';
        if (generatePhpdoc) {
            const data: Array<string> = [];

            if (!!this.getConfig(DOC_SHOW_DESCR, false)) {
                data.push(`Getter for ${property.name}`);
                for (let i = 0; i < this.getConfig(DOC_LINES_AFTER_DESCR, 0); i++) {
                    data.push('');
                }
            }

            data.push(`@return ${property.hint}`);
            phpdoc = this.arrayToPhpdoc(data, property.tab);
        }

        return `\n${phpdoc}`
            + `${property.tab}public function ${fcnName}(): ${property.type}\n`
            + `${property.tab}{\n`
            + `${property.tab}${property.tab}return $this->${property.name};\n`
            + `${property.tab}}\n`;
    }

    public setterTemplate(property: Property): string {
        if (property.name === PROP.UNDEFINED) {
            return '';
        }

        const fcnName = property.getFunction(PROP.SETTER);
        const returnSelf = !!this.getConfig(GS_RETURN_SELF, false);
        const returnType = returnSelf ? property.className : 'void';
        const returnInstructions = returnSelf ? `\n${property.tab}${property.tab}return $this;\n` : '';
        const generatePhpdoc = !!this.getConfig(GS_GENERATE_PHPDOC, true);
        let phpdoc = '';
        if (generatePhpdoc) {
            const data: Array<string> = [];

            if (!!this.getConfig(DOC_SHOW_DESCR, false)) {
                data.push(`Setter for ${property.name}`);
                for (let i = 0; i < this.getConfig(DOC_LINES_AFTER_DESCR, 0); i++) {
                    data.push('');
                }
            }

            data.push(`@param ${property.hint} $${property.name}`);

            if (returnSelf) {
                for (let i = 0; i < this.getConfig(DOC_LINES_BEFORE_RETURN, 0); i++) {
                    data.push('');
                }
                data.push(`@return ${property.className}`);
            }

            phpdoc = this.arrayToPhpdoc(data, property.tab);
        }

        return `\n${phpdoc}`
            + `${property.tab}public function `
            + `${fcnName}(${property.type} $${property.name}): ${returnType}\n`
            + `${property.tab}{\n`
            + `${property.tab}${property.tab}$this->${property.name} = $${property.name};\n${returnInstructions}`
            + `${property.tab}}\n`;
    }

    public render(items: Array<string>) {
        const editor = this.activeEditor;
        if (!editor) {
            return;
        }

        const templates: Array<string> = [];
        this.properties.forEach((property) => {
            const data: Array<string> = [];
            if (items.includes(PROP.GETTER)) {
                data.push(this.getterTemplate(property));
            }
            if (items.includes(PROP.SETTER)) {
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

            let insertLine: number|null = null;
            for (let lineNumber = editor.document.lineCount - 1; lineNumber > 0; lineNumber--) {
                if (editor.document.lineAt(lineNumber).text.startsWith('}')) {
                    insertLine = lineNumber;
                }
            }

            if (insertLine === null) {
                throw new Error('Unable to detect insert line for template.');
            }

            editor.edit((edit: TextEditorEdit) => {
                edit.replace(new Position(insertLine as number, 0), templates.join(''));
            });
        } catch (error) {
            this.showMessage(`Error generating object: '${(error as Error).message}'.`, MESSAGE.ERROR);
        }
    }
}
