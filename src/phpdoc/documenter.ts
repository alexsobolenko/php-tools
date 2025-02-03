import {Position, TextDocument, TextEditorEdit} from 'vscode';
import Block from './block/block';
import ClassBlock from './block/class';
import ConstantBlock from './block/constant';
import FunctionBlock from './block/function';
import PropertyBlock from './block/property';
import App from '../app';
import Utils from '../utils';
import {D_REGEX_CLASS, D_REGEX_CONSTANT, D_REGEX_FUNCTION, D_REGEX_PROPERTY, M_ERROR} from '../constants';

export default class Documenter {
    /**
     * @type {Block}
     */
    private _block: Block;

    public constructor() {
        const document = App.instance.editor.document as TextDocument;
        const position = App.instance.editor.selection.active;
        const text = document.lineAt(position.line).text as string;
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
            Utils.instance.showMessage(`Error generating object: '${error.message}'.`, M_ERROR);
        }
    }
}
