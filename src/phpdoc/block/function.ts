import {Class, Method, Name, Parameter} from 'php-parser';
import Block from './block';
import App from '../../app';
import Utils from '../../utils';
import {IParameter} from '../../interfaces';
import {
    A_DOC_LINES_AFTER_DESCR,
    A_DOC_LINES_BEFORE_RETURN,
    A_DOC_RETURN_VOID,
    A_DOC_SHOW_DESCR,
    D_TYPE_FUNCTION,
    M_ERROR,
} from '../../constants';

export default class FunctionBlock extends Block {
    /**
     * @type {Array<IParameter>}
     */
    private _params: Array<IParameter>;

    /**
     * @type {string}
     */
    private _returnHint: string;

    public constructor() {
        super();

        this._type = D_TYPE_FUNCTION;
        this._params = [];
        this._returnHint = '';

        const lines = [];
        while (this._startLine >= 0) {
            const line = App.instance.editor.document.lineAt(this._startLine).text.trim();
            if (line.includes('function')) {
                lines.unshift(line);
                break;
            }

            --this._startLine;
        }
        if (lines.length === 0) return;

        for (let i = this._startLine + 1; i < App.instance.editor.document.lineCount; i++) {
            const line = App.instance.editor.document.lineAt(i).text.trim();
            lines.push(line);
            if (line.includes('{') || line.endsWith(')')) break;
        }

        try {
            let declr = lines.join(' ');
            declr = `${declr} ${declr.includes('{') ? '}' : ' {}'}`;
            const program = this.parseCode(`<?php \n class Foo { \n ${declr} \n }`);

            const klass = program.children.find((node) => node.kind === 'class') as Class|undefined;
            if (typeof klass === 'undefined') throw new Error('Invalid PHP code');

            const func = klass.body.find((node) => node.kind === 'method') as Method|undefined;
            if (typeof func === 'undefined') throw new Error('Invalid PHP code');

            const functionName = func.name as Name;
            this._name = functionName.name;
            this._params = func.arguments.map((arg: Parameter) => this.convertParam(arg));

            const funcType = func.type as any;
            // eslint-disable-next-line max-len
            const types = funcType ? (func.type.kind === 'uniontype' ? funcType.types.map((t: Name) => t.name) : [funcType.name]) : ['mixed'];
            if (func.nullable && !types.includes('void') && !types.includes('null')) types.push('null');

            const nullIndex = types.indexOf('null');
            this._returnHint = (nullIndex === -1 || types.length > 2) ? types.join('|') : `?${types[1 - nullIndex]}`;
        } catch (error: any) {
            this._returnHint = '';
            this._params = [];
            Utils.instance.showMessage(`Failed to parse function: ${error}.`, M_ERROR);
        }
    }

    /**
     * @returns {string}
     */
    public get template(): string {
        const showDescription = !!App.instance.config(A_DOC_SHOW_DESCR, false);
        const descriptionString = showDescription ? `${this._tab} * ${this._name} description.\n` : '';

        const emptyLinesAfterDescription = showDescription ? App.instance.config(A_DOC_LINES_AFTER_DESCR, 0) : 0;
        const afterDescription = Utils.instance.multiplyString(`${this._tab} *\n`, emptyLinesAfterDescription);

        const params = this._params.map((p: IParameter) => `${this._tab} * @param ${p.hint} $${p.name}`);

        const returnVoid = !!App.instance.config(A_DOC_RETURN_VOID, false);
        // eslint-disable-next-line max-len
        const returnString = (returnVoid || this._returnHint !== 'void') ? `${this._tab} * @return ${this._returnHint}\n` : '';

        // eslint-disable-next-line max-len
        const emptyLinesBeforeReturn = (!returnVoid && this._returnHint === 'void') ? 0 : App.instance.config(A_DOC_LINES_BEFORE_RETURN, 0);
        const beforeReturn = Utils.instance.multiplyString(`${this._tab} *\n`, emptyLinesBeforeReturn);

        return `${this._tab}/**\n${descriptionString}${afterDescription}`
            + `${params.join('\n')}${params.length > 0 ? '\n' : ''}`
            + `${beforeReturn}${returnString}${this._tab} */\n`;
    }

    /**
     * @param {Parameter} arg
     * @returns {IParameter}
     */
    private convertParam(arg: Parameter): IParameter {
        const argType = arg.type as any;
        if (arg.type === null) {
            return {
                name: (arg.name as Name).name,
                hint: 'mixed',
            };
        }

        const types = argType.kind === 'uniontype' ? argType.types.map((t: Name) => t.name) : [argType.name];
        if (arg.nullable && !types.includes('null')) types.push('null');

        return {
            name: (arg.name as Name).name,
            hint: types.join('|'),
        };
    }
}
