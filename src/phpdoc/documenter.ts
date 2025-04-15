import {Position, TextEditorEdit} from 'vscode';
import App from '../app';
import {
    D_REGEX_CLASS,
    D_REGEX_CONSTANT,
    D_REGEX_FUNCTION,
    D_REGEX_PROPERTY,
    M_ERROR,
} from '../constants';
import {Block, ClassBlock, ConstantBlock, FunctionBlock, PropertyBlock} from './block';

export default class Documenter {
    private _block: Block;

    public constructor(position: Position) {
        const {text} = App.instance.editor.document.lineAt(position.line);
        if (text.match(D_REGEX_CLASS)) {
            this._block = new ClassBlock();
        } else if (text.match(D_REGEX_PROPERTY)) {
            this._block = new PropertyBlock();
        } else if (text.match(D_REGEX_CONSTANT)) {
            this._block = new ConstantBlock();
        } else if (text.match(D_REGEX_FUNCTION)) {
            this._block = new FunctionBlock();
        } else {
            this._block = new Block();
        }
    }

    public render() {
        try {
            const template = this._block.template as string;
            if (template === '') throw new Error('Missing template to render');

            App.instance.editor.edit((edit: TextEditorEdit) => {
                edit.replace(new Position(this._block.startLine, 0), template);
            });
        } catch (error: any) {
            App.instance.utils.showMessage(`Error generating object: '${error.message}'.`, M_ERROR);
        }
    }
}
