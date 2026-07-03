import {Position, Range, TextDocument, TextEditorEdit, window} from 'vscode';
import Feature from '../feature';
import {MESSAGE, PHPDOC} from '../constants';
import {Block, ClassBlock, ConstantBlock, FunctionBlock, PropertyBlock, VariableBlock} from '../service/doc-block';

const D_REGEX_VARIABLE = /^\s*(\$\w+)\s*=/u;

interface IImportState {
    imports: Set<string>;
    aliases: Set<string>;
    useLines: Array<string>;
    firstUseLine: number;
    namespaceName: string|null;
    lastUseLine: number;
    namespaceLine: number;
}

interface IImportInsert {
    position: Position;
    text: string;
    replaceUntilLine?: number;
}

export default class Documenter extends Feature {
    private blocks: Array<Block> = [];

    public constructor(positions: Array<Position>) {
        super();

        const document = this.activeEditor?.document;
        if (!document) {
            return;
        }

        positions.forEach((p) => {
            const declarationPosition = this.resolveDeclarationPosition(document, p);
            if (declarationPosition && !this.hasExistingPhpDoc(document, declarationPosition)) {
                const block = this.createBlock(document, declarationPosition);
                if (block) {
                    this.blocks.push(block);
                }
            }
        });

        if (this.blocks.length < 1) {
            this.showMessage('Phpdoc already exists', MESSAGE.INFO);
        }
    }

    public render() {
        const editor = this.activeEditor;
        if (!editor) {
            return;
        }

        const {document} = editor;
        const importState = this.collectImportState(document);
        this.blocks.forEach((block) => {
            if (block instanceof FunctionBlock) {
                block.prepareThrowsForRender(importState.imports, importState.aliases, importState.namespaceName);
            }
        });

        const data: Array<{startLine: number, template: string}> = [];
        this.blocks.forEach((b) => {
            if (b.error) {
                this.showMessage(`${b.error} - in block ${b.name}`, MESSAGE.ERROR);
            }

            try {
                const {template} = b;
                if (template === '') {
                    throw new Error('Missing template to render');
                }
                data.push({startLine: b.startLine, template});
            } catch (error) {
                this.showMessage(`${(error as Error).message} - in block ${b.name}`, MESSAGE.ERROR);
            }
        });

        editor.edit((edit: TextEditorEdit) => {
            const importsToInsert = this.blocks
                .flatMap((block) => block.importsToAdd)
                .filter((value, index, array) => array.indexOf(value) === index);
            const importInsert = this.buildImportInsert(document, importsToInsert, importState);
            if (importInsert) {
                if (typeof importInsert.replaceUntilLine === 'number') {
                    edit.replace(
                        new Range(importInsert.position, new Position(importInsert.replaceUntilLine, 0)),
                        importInsert.text,
                    );
                } else {
                    edit.insert(importInsert.position, importInsert.text);
                }
            }

            data.forEach((d) => {
                edit.replace(new Position(d.startLine, 0), d.template);
            });
        });
    }

    public static async selectBlocks(placeHolder: string): Promise<Array<Position>> {
        const editor = window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'php') {
            return [];
        }

        const {document} = editor;
        const positions: Array<{name: string, position: Position}> = [];
        for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
            const lineText = document.lineAt(lineNumber).text;
            let charNumber = null;
            let name = null;
            let matches = null;
            let type = null;

            matches = PHPDOC.CLASS.REGEX.exec(lineText) as Array<string>|null;
            if (matches !== null) {
                charNumber = 0;
                name = matches[2] as string;
                type = matches[1].charAt(0).toUpperCase() + matches[1].slice(1);
            }

            matches = PHPDOC.CONSTANT.REGEX.exec(lineText) as Array<string>|null;
            if (matches !== null) {
                charNumber = 5;
                name = matches.length < 4 ? matches[2] : `${matches[2]} ${matches[3]}`;
                type = 'Constant';
            }

            matches = PHPDOC.PROPERTY.REGEX.exec(lineText) as Array<string>|null;
            if (matches !== null) {
                charNumber = 5;
                name = matches.length < 4 ? matches[2] : `${matches[2]} ${matches[3]}`;
                type = 'Property';
            }

            matches = PHPDOC.FUNCTION.REGEX.exec(lineText) as Array<string>|null;
            if (matches !== null) {
                charNumber = 5;
                name = matches[1] as string;
                type = matches.includes('static') ? 'Static function' : 'Function';
            }

            matches = D_REGEX_VARIABLE.exec(lineText) as Array<string>|null;
            if (matches !== null) {
                charNumber = document.lineAt(lineNumber).firstNonWhitespaceCharacterIndex;
                name = matches[1] as string;
                type = 'Variable';
            }

            if (charNumber !== null && name !== null && type !== null) {
                positions.push({
                    name: `${positions.length + 1}. ${name} (${type})`,
                    position: new Position(lineNumber, charNumber),
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

    private hasExistingPhpDoc(document: TextDocument, position: Position): boolean {
        const lineNumber = position.line;
        const range = new Range(new Position(Math.max(0, lineNumber - 3), 0), new Position(lineNumber, 0));
        const textBefore = document.getText(range);

        return /\/\*\*[\s\S]*?\*\//.test(textBefore);
    }

    private createBlock(document: TextDocument, position: Position): Block|null {
        const {text} = document.lineAt(position.line);
        if (text.match(PHPDOC.CLASS.REGEX)) {
            return new ClassBlock(document, position);
        }

        if (text.match(PHPDOC.PROPERTY.REGEX)) {
            return new PropertyBlock(document, position);
        }

        if (text.match(PHPDOC.CONSTANT.REGEX)) {
            return new ConstantBlock(document, position);
        }

        if (text.match(PHPDOC.FUNCTION.REGEX)) {
            return new FunctionBlock(document, position);
        }

        if (text.match(D_REGEX_VARIABLE)) {
            return new VariableBlock(document, position);
        }

        return null;
    }

    private resolveDeclarationPosition(document: TextDocument, position: Position): Position|null {
        const currentText = document.lineAt(position.line).text;
        if (this.createBlock(document, position) !== null) {
            return position;
        }

        if (currentText.trim().startsWith('#[')) {
            for (let lineNumber = position.line + 1; lineNumber < document.lineCount; lineNumber++) {
                const lineText = document.lineAt(lineNumber).text.trim();
                if (lineText === '' || lineText.startsWith('#[')) {
                    continue;
                }

                const resolved = new Position(lineNumber, document.lineAt(lineNumber).firstNonWhitespaceCharacterIndex);

                return this.createBlock(document, resolved) !== null ? resolved : null;
            }
        }

        return null;
    }

    private collectImportState(document: TextDocument): IImportState {
        const imports = new Set<string>();
        const aliases = new Set<string>();
        const useLines: Array<string> = [];
        let namespaceName: string|null = null;
        let firstUseLine = -1;
        let lastUseLine = -1;
        let namespaceLine = -1;

        for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
            const lineText = document.lineAt(lineNumber).text.trim();
            const namespaceMatch = lineText.match(/^namespace\s+([^;]+);$/u);
            if (namespaceMatch) {
                namespaceName = namespaceMatch[1] as string;
                namespaceLine = lineNumber;
            }

            const useMatch = lineText.match(/^use\s+([^;]+);$/u);
            if (!useMatch) {
                continue;
            }

            if (firstUseLine === -1) {
                firstUseLine = lineNumber;
            }
            lastUseLine = lineNumber;
            useLines.push(lineText);
            const parts = (useMatch[1] as string).split(/\s+as\s+/iu);
            const fqcn = (parts[0] as string).trim().replace(/^\\/, '');
            const alias = (parts[1] as string|undefined)?.trim() ?? fqcn.split('\\').pop() ?? fqcn;
            imports.add(fqcn);
            aliases.add(alias);
        }

        return {
            imports,
            aliases,
            useLines,
            firstUseLine,
            namespaceName,
            lastUseLine,
            namespaceLine,
        };
    }

    private buildImportInsert(
        document: TextDocument,
        importsToInsert: Array<string>,
        importState: IImportState,
    ): IImportInsert|null {
        if (importsToInsert.length === 0) {
            return null;
        }

        const lines = [
            ...importState.useLines,
            ...importsToInsert.map((entry) => `use ${entry};`),
        ]
            .filter((value, index, array) => array.indexOf(value) === index)
            .sort((left, right) => left.localeCompare(right));
        let insertLine = 0;
        let prefix = '';
        let suffix = '';
        let replaceUntilLine: number|undefined;

        if (importState.firstUseLine >= 0 && importState.lastUseLine >= 0) {
            insertLine = importState.firstUseLine;
            replaceUntilLine = importState.lastUseLine + 1;
        } else if (importState.namespaceLine >= 0) {
            insertLine = importState.namespaceLine + 1;
            prefix = '\n';
        } else {
            insertLine = 0;
        }

        if (
            typeof replaceUntilLine === 'undefined'
            && insertLine < document.lineCount
            && document.lineAt(insertLine).text.trim() !== ''
        ) {
            suffix = '\n';
        }

        return {
            position: new Position(insertLine, 0),
            text: `${prefix}${lines.join('\n')}\n${suffix}`,
            replaceUntilLine,
        };
    }
}
