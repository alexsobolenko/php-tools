import {Position, Range, TextDocument, TextEditorEdit, window} from 'vscode';
import App from '../../app';
import {
    D_REGEX_CLASS,
    D_REGEX_CONSTANT,
    D_REGEX_FUNCTION,
    D_REGEX_PROPERTY,
    M_ERROR,
    M_INFO,
} from '../../constants';
import {Block, ClassBlock, ConstantBlock, FunctionBlock, PropertyBlock} from './block';

export default class Documenter {
    public blocks: Array<Block>;

    public constructor(positions: Array<Position>) {
        this.blocks = [];
        const {document} = App.instance.editor;
        positions.forEach((p) => {
            if (!this.hasExistingPhpDoc(document, p)) {
                const {text} = App.instance.editor.document.lineAt(p.line);
                if (text.match(D_REGEX_CLASS)) {
                    this.blocks.push(new ClassBlock(p));
                } else if (text.match(D_REGEX_PROPERTY)) {
                    this.blocks.push(new PropertyBlock(p));
                } else if (text.match(D_REGEX_CONSTANT)) {
                    this.blocks.push(new ConstantBlock(p));
                } else if (text.match(D_REGEX_FUNCTION)) {
                    this.blocks.push(new FunctionBlock(p));
                } else {
                    this.blocks.push(new Block(p));
                }
            }
        });
        if (this.blocks.length < 1) {
            App.instance.showMessage('Phpdoc already exists', M_INFO);
        }
    }

    public render() {
        const data: Array<{startLine: number, template: string}> = [];
        this.blocks.forEach((b) => {
            try {
                const {template} = b;
                if (template === '') {
                    throw new Error('Missing template to render');
                }
                data.push({startLine: b.startLine, template});
            } catch (error: any) {
                App.instance.showMessage(`${error.message} - in block ${b.name}`, M_ERROR);
            }
        });
        App.instance.editor.edit((edit: TextEditorEdit) => {
            data.forEach((d) => {
                edit.replace(new Position(d.startLine, 0), d.template);
            });
        });
    }

    public static async selectBlocks(placeHolder: string): Promise<Array<Position>> {
        const {document} = App.instance.editor;
        const positions: Array<{name: string, position: Position}> = [];
        for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
            const lineText = document.lineAt(lineNumber).text;
            let charNumber = null;
            let name = null;
            let matches = null;
            let type = null;

            matches = D_REGEX_CLASS.exec(lineText) as Array<string>|null;
            if (matches !== null) {
                charNumber = 0;
                name = matches[2] as string;
                type = App.instance.capitalizeFirstCharTrimmed(matches[1]);
            }

            matches = D_REGEX_CONSTANT.exec(lineText) as Array<string>|null;
            if (matches !== null) {
                charNumber = 5;
                name = matches.length < 4 ? matches[2] : `${matches[2]} ${matches[3]}`;
                type = 'Constant';
            }

            matches = D_REGEX_PROPERTY.exec(lineText) as Array<string>|null;
            if (matches !== null) {
                charNumber = 5;
                name = matches.length < 4 ? matches[2] : `${matches[2]} ${matches[3]}`;
                type = 'Property';
            }

            matches = D_REGEX_FUNCTION.exec(lineText) as Array<string>|null;
            if (matches !== null) {
                charNumber = 5;
                name = matches[1] as string;
                type = matches.includes('static') ? 'Static function' : 'Function';
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
}
