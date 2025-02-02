import App from '../app';
import {Position, TextDocument, TextEditorEdit} from 'vscode';
import {IParameter, IPHPDocHandler} from '../interfaces';
import Block from './block/block';
import ClassBlock from './block/class';
import ConstantBlock from './block/constant';
import FunctionBlock from './block/function';
import PropertyBlock from './block/property';
import Utils from '../utils';
import {
    A_DOC_LINES_AFTER_DESCR,
    A_DOC_LINES_BEFORE_RETURN,
    A_DOC_RETURN_VOID,
    A_DOC_SHOW_DESCR,
    D_REGEX_CLASS,
    D_REGEX_CONSTANT,
    D_REGEX_FUNCTION,
    D_REGEX_PROPERTY,
    D_TYPE_CLASS,
    D_TYPE_CONSTANT,
    D_TYPE_FUNCTION,
    D_TYPE_PROPERTY,
} from '../constants';

export default class Documenter {
    /**
     * @type {Block|null}
     */
    private _block: Block|null;

    public constructor() {
        const document = App.instance.editor.document as TextDocument;
        const position = App.instance.editor.selection.active;
        const activeLine = document.lineAt(position.line);
        if (activeLine.text.match(D_REGEX_CLASS)) {
            this._block = new ClassBlock(App.instance.editor);
        } else if (activeLine.text.match(D_REGEX_PROPERTY)) {
            this._block = new PropertyBlock(App.instance.editor);
        } else if (activeLine.text.match(D_REGEX_CONSTANT)) {
            this._block = new ConstantBlock(App.instance.editor);
        } else if (activeLine.text.match(D_REGEX_FUNCTION)) {
            this._block = new FunctionBlock(App.instance.editor);
        } else {
            this._block = null;
        }
    }

    public render() {
        try {
            const data: IPHPDocHandler = {
                [D_TYPE_FUNCTION]: () => this.functionTemplate(),
                [D_TYPE_CLASS]: () => this.classTemplate(),
                [D_TYPE_PROPERTY]: () => this.propertyTemplate(),
                [D_TYPE_CONSTANT]: () => this.constantTemplate(),
            };
            const type = this._block?.type || '';
            const template = type in data ? data[type]() : '';
            if (template === '') throw new Error('Missing template to render');

            App.instance.editor.edit((edit: TextEditorEdit) => {
                edit.replace(new Position(this._block?.startLine || 0, 0), template);
            });
        } catch (error: any) {
            Utils.instance.showErrorMessage(`Error generating object: '${error.message}'.`);
        }
    }

    /**
     * @returns {string}
     */
    private functionTemplate(): string {
        if (this._block === null) return '';

        const b = this._block as FunctionBlock;

        const showDescription = !!App.instance.config(A_DOC_SHOW_DESCR, false);
        const descriptionString = showDescription ? `${b.tab} * ${b.name} description.\n` : '';

        const emptyLinesAfterDescription = showDescription ? App.instance.config(A_DOC_LINES_AFTER_DESCR, 0) : 0;
        const afterDescription = Utils.instance.multiplyString(`${b.tab} *\n`, emptyLinesAfterDescription);

        const params = b.params.map((p: IParameter) => `${b.tab} * @param ${p.type} $${p.name}`);

        const returnVoid = !!App.instance.config(A_DOC_RETURN_VOID, false);
        const returnString = (returnVoid || b.returnType !== 'void') ? `${b.tab} * @return ${b.returnType}\n` : '';

        // eslint-disable-next-line max-len
        const emptyLinesBeforeReturn = (!returnVoid && b.returnType === 'void') ? 0 : App.instance.config(A_DOC_LINES_BEFORE_RETURN, 0);
        const beforeReturn = Utils.instance.multiplyString(`${b.tab} *\n`, emptyLinesBeforeReturn);

        return `${b.tab}/**\n${descriptionString}${afterDescription}`
            + `${params.join('\n')}\n`
            + `${beforeReturn}${returnString}${b.tab} */\n`;
    }

    /**
     * @returns {string}
     */
    private classTemplate(): string {
        if (this._block === null) return '';

        const b = this._block as ClassBlock;
        const name = `${Utils.instance.capitalizeFirstCharTrimmed(b.kind)} ${b.name}`;

        return `${b.tab}/**\n${b.tab} * ${name} description.\n${b.tab} */\n`;
    }

    /**
     * @returns {string}
     */
    private propertyTemplate(): string {
        if (this._block === null) return '';

        const b = this._block as PropertyBlock;

        const showDescription = !!App.instance.config(A_DOC_SHOW_DESCR, false);
        const descriptionString = showDescription ? `${b.tab} * ${b.name} description.\n` : '';

        const emptyLinesAfterDescription = showDescription ? App.instance.config(A_DOC_LINES_AFTER_DESCR, 0) : 0;
        const afterDescription = Utils.instance.multiplyString(`${b.tab} *\n`, emptyLinesAfterDescription);

        return `${b.tab}/**\n${descriptionString}${afterDescription}`
            + `${b.tab} * @var ${b.varTypes.join('|')}\n`
            + `${b.tab} */\n`;
    }

    /**
     * @returns {string}
     */
    private constantTemplate(): string {
        if (this._block === null) return '';

        const b = this._block as ConstantBlock;

        const showDescription = !!App.instance.config(A_DOC_SHOW_DESCR, false);
        const descriptionString = showDescription ? `${b.tab} * ${b.name} description.\n` : '';

        const emptyLinesAfterDescription = showDescription ? App.instance.config(A_DOC_LINES_AFTER_DESCR, 0) : 0;
        const afterDescription = Utils.instance.multiplyString(`${b.tab} *\n`, emptyLinesAfterDescription);

        return `${b.tab}/**\n${descriptionString}${afterDescription}`
            + `${b.tab} * @var ${b.constType || 'mixed'}\n`
            + `${b.tab} */\n`;
    }
}
