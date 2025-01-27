import App from '../app';
import {Position, TextEditorEdit} from 'vscode';
import {IParameter, IPHPDocHandler} from '../interfaces';
import Block from './block/block';
import ClassBlock from './block/class';
import ConstantBlock from './block/constant';
import FunctionBlock from './block/function';
import PropertyBlock from './block/property';
import Utils from '../utils';
import {
    P_REGEX_CLASS,
    P_REGEX_CONSTANT,
    P_REGEX_FUNCTION,
    P_REGEX_PROPERTY,
    P_TYPE_CLASS,
    P_TYPE_CONSTANT,
    P_TYPE_FUNCTION,
    P_TYPE_PROPERTY
} from './data-provider';

export default class Documenter {
    /**
     * @type {Block|null}
     */
    private _block: Block|null;

    public constructor() {
        const document = App.instance.editor.document;
        const position = App.instance.editor.selection.active;
        const activeLine = document.lineAt(position.line);
        if (activeLine.text.match(P_REGEX_CLASS)) {
            this._block = new ClassBlock(App.instance.editor);
        } else if (activeLine.text.match(P_REGEX_PROPERTY)) {
            this._block = new PropertyBlock(App.instance.editor);
        } else if (activeLine.text.match(P_REGEX_CONSTANT)) {
            this._block = new ConstantBlock(App.instance.editor);
        } else if (activeLine.text.match(P_REGEX_FUNCTION)) {
            this._block = new FunctionBlock(App.instance.editor);
        } else {
            this._block = null;
        }
    }

    public render() {
        const data: IPHPDocHandler = {
            [P_TYPE_FUNCTION]: () => this.functionTemplate(),
            [P_TYPE_CLASS]: () => this.classTemplate(),
            [P_TYPE_PROPERTY]: () => this.propertyTemplate(),
            [P_TYPE_CONSTANT]: () => this.constantTemplate(),
        };
        const type = this._block?.type || '';
        const template = type in data ? data[type]() : '';
        if (template === '') {
            Utils.instance.showErrorMessage('Missing template to render.');

            return;
        }

        App.instance.editor
            .edit((edit: TextEditorEdit) => {
                edit.replace(new Position(this._block?.startLine || 0, 0), template);
            })
            .then((error: any) => {
                Utils.instance.showErrorMessage(`Error generating phpdoc: ${error}`);
            });
    }

    /**
     * @returns {string}
     */
    private functionTemplate(): string {
        if (this._block === null) return '';

        const b = this._block as FunctionBlock;

        const showDescription = !!App.instance.config('phpdoc-function-show-description', false);
        const descriptionString = showDescription ? `${b.tab} * ${b.name} description.\n` : '';

        const emptyLinesAfterDescription = showDescription
            ? App.instance.config('phpdoc-empty-lines-after-description', 0)
            : 0;
        const afterDescription = Utils.instance.multiplyString(`${b.tab} *\n`, emptyLinesAfterDescription);

        const params = b.params.map((p: IParameter) => `${b.tab} * @param ${p.type} $${p.name}`)

        const returnVoid = !!App.instance.config('phpdoc-function-return-void', false);
        const returnString = (returnVoid || b.returnType !== 'void') ? `${b.tab} * @return ${b.returnType}\n` : '';

        const emptyLinesBeforeReturn = (!returnVoid && b.returnType === 'void')
            ? 0
            : App.instance.config('phpdoc-empty-lines-before-return', 0);
        const beforeReturn = Utils.instance.multiplyString(`${b.tab} *\n`, emptyLinesBeforeReturn);

        return `${b.tab}/**\n${descriptionString}${afterDescription}`
            + `${params.join("\n")}\n`
            + `${beforeReturn}${returnString}${b.tab} */\n`;
    }

    /**
     * @returns {string}
     */
    private classTemplate(): string {
        if (this._block === null) return '';

        const b = this._block as ClassBlock;

        return `${b.tab}/**\n`
            + `${b.tab} * ${Utils.instance.capitalizeFirstCharTrimmed(b.kind)} ${b.name} description.\n`
            + `${b.tab} */\n`;
    }

    /**
     * @returns {string}
     */
    private propertyTemplate(): string {
        if (this._block === null) return '';

        const b = this._block as PropertyBlock;

        const showDescription = !!App.instance.config('phpdoc-property-show-description', false);
        const descriptionString = showDescription ? `${b.tab} * ${b.name} description.\n` : '';

        const emptyLinesAfterDescription = showDescription
            ? App.instance.config('phpdoc-empty-lines-after-description', 0)
            : 0;
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

        const showDescription = !!App.instance.config('phpdoc-constant-show-description', false);
        const descriptionString = showDescription ? `${b.tab} * ${b.name} description.\n` : '';

        const emptyLinesAfterDescription = showDescription
            ? App.instance.config('phpdoc-empty-lines-after-description', 0)
            : 0;
        const afterDescription = Utils.instance.multiplyString(`${b.tab} *\n`, emptyLinesAfterDescription);

        return `${b.tab}/**\n${descriptionString}${afterDescription}`
            + `${b.tab} * @var ${b.constType || 'mixed'}\n`
            + `${b.tab} */\n`;
    }
}
