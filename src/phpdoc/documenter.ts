import {Position, Range, TextDocument, TextEditorEdit} from 'vscode';
import App from '../app';
import {
    D_REGEX_CLASS,
    D_REGEX_CONSTANT,
    D_REGEX_FUNCTION,
    D_REGEX_PROPERTY,
    M_ERROR,
    M_INFO,
} from '../constants';
import {Block, ClassBlock, ConstantBlock, FunctionBlock, PropertyBlock} from './block';

export default class Documenter {
    public block: Block|null;

    public constructor(position: Position) {
        const {document} = App.instance.editor;
        if (this.hasExistingPhpDoc(document, position)) {
            App.instance.utils.showMessage('PHPDOC already exists', M_INFO);
            this.block = null;

            return;
        }

        const {text} = App.instance.editor.document.lineAt(position.line);
        if (text.match(D_REGEX_CLASS)) {
            this.block = new ClassBlock();
        } else if (text.match(D_REGEX_PROPERTY)) {
            this.block = new PropertyBlock();
        } else if (text.match(D_REGEX_CONSTANT)) {
            this.block = new ConstantBlock();
        } else if (text.match(D_REGEX_FUNCTION)) {
            this.block = new FunctionBlock();
        } else {
            this.block = new Block();
        }
    }

    public render() {
        try {
            const template = this.block === null ? '' : this.block.template as string;
            if (template === '') {
                throw new Error('Missing template to render');
            }

            App.instance.editor.edit((edit: TextEditorEdit) => {
                edit.replace(new Position(this.block?.startLine || 0, 0), template);
            });
        } catch (error: any) {
            App.instance.utils.showMessage(`Error generating object: '${error.message}'.`, M_ERROR);
        }
    }

    private hasExistingPhpDoc(document: TextDocument, position: Position): boolean {
        const lineNumber = position.line;
        const range = new Range(new Position(Math.max(0, lineNumber - 3), 0), new Position(lineNumber, 0));
        const textBefore = document.getText(range);

        return /\/\*\*[\s\S]*?\*\//.test(textBefore);
    }
}
