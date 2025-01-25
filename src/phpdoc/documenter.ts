import App from '../app';
import {Position, TextEditorEdit} from 'vscode';
import {IParameter} from '../interfaces';
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
        if (activeLine.text.match(P_REGEX_FUNCTION)) {
            this._block = new FunctionBlock(App.instance.editor);
        } else if (activeLine.text.match(P_REGEX_CLASS)) {
            this._block = new ClassBlock(App.instance.editor);
        } else if (activeLine.text.match(P_REGEX_PROPERTY)) {
            this._block = new PropertyBlock(App.instance.editor);
        } else if (activeLine.text.match(P_REGEX_CONSTANT)) {
            this._block = new ConstantBlock(App.instance.editor);
        } else {
            this._block = null;
        }
    }

    public render() {
        let template = '';
        const line = this._block?.startLine || 0;
        switch (this._block?.type) {
            case P_TYPE_FUNCTION:
                template = this.functionTemplate();
                break;
            case P_TYPE_CLASS:
                template = this.classTemplate();
                break;
            case P_TYPE_PROPERTY:
                template = this.propertyTemplate();
                break;
            case P_TYPE_CONSTANT:
                template = this.constantTemplate();
                break;
        }

        App.instance.editor
            .edit((edit: TextEditorEdit) => {
                edit.replace(new Position(line, 0), template);
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

        const showDescription = !!this.config('function-show-description', false);
        const descriptionString = showDescription ? `${b.tab} * ${b.name} description.\n` : '';

        const emptyLinesAfterDescription = showDescription ? this.config('empty-lines-after-description', 0) : 0;
        const afterDescription = Utils.instance.multiplyString(`${b.tab} *\n`, emptyLinesAfterDescription);

        const params = b.params.map((p: IParameter) => `${b.tab} * @param ${p.type} $${p.name}`)

        const returnVoid = !!this.config('function-return-void', false);
        const returnString = (returnVoid || b.returnType !== 'void') ? `${b.tab} * @return ${b.returnType}\n` : '';

        const emptyLinesBeforeReturn = (!returnVoid && b.returnType === 'void') ? 0 : this.config('empty-lines-before-return', 0);
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
        const descriptionString = `${b.tab} * ${Utils.instance.capitalizeFirstCharTrimmed(b.kind)} ${b.name} description.\n`;

        return `${b.tab}/**\n${descriptionString}${b.tab} */\n`;
    }

    /**
     * @returns {string}
     */
    private propertyTemplate(): string {
        if (this._block === null) return '';

        const b = this._block as PropertyBlock;

        const showDescription = !!this.config('property-show-description', false);
        const descriptionString = showDescription ? `${b.tab} * ${b.name} description.\n` : '';

        const emptyLinesAfterDescription = showDescription ? this.config('empty-lines-after-description', 0) : 0;
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

        const showDescription = !!this.config('constant-show-description', false);
        const descriptionString = showDescription ? `${b.tab} * ${b.name} description.\n` : '';

        const emptyLinesAfterDescription = showDescription ? this.config('empty-lines-after-description', 0) : 0;
        const afterDescription = Utils.instance.multiplyString(`${b.tab} *\n`, emptyLinesAfterDescription);

        return `${b.tab}/**\n${descriptionString}${afterDescription}`
            + `${b.tab} * @var ${b.constType || 'mixed'}\n`
            + `${b.tab} */\n`;
    }

    /**
     * @param {string} key
     * @param {any} defaultValue
     * @returns {any}
     */
    private config(key: string, defaultValue: any): any {
        return App.instance.config(`phpdoc-${key}`, defaultValue);
    }
}
