import {Class, Method, Name, Namespace, Parameter, UseGroup, UseItem} from 'php-parser';
import App from '../../app';
import {IParameter} from '../../interfaces';
import {Declaration, TextDocument} from 'vscode';
import Block from './block';
import {
    A_DOC_LINES_AFTER_DESCR,
    A_DOC_LINES_BEFORE_RETURN,
    A_DOC_LINES_BEFORE_THROWS,
    A_DOC_RETURN_VOID,
    A_DOC_SHOW_DESCR,
    A_DOC_SHOW_THROWS_ON_DIFF_LINES,
    D_REGEX_FUNCTION,
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

    /**
     * @type {Array<string>}
     */
    private _throws: Array<string>;

    public constructor() {
        super();

        this._type = D_TYPE_FUNCTION;
        this._params = [];
        this._throws = [];
        this._returnHint = '';

        const startLine = App.instance.editor.selection.active.line;
        const document = App.instance.editor.document as TextDocument;
        const code = document.getText();

        let ast = null;
        try {
            const funcDeclr = document.lineAt(startLine).text.trim();
            const matches = funcDeclr.match(D_REGEX_FUNCTION) as Array<any>;
            if (!matches[3]) throw new Error('Function name not found');
            this._name = matches[3] as string;

            ast = this.parseCode(code);

            let klass: Class|undefined;
            const uses: Array<string> = [];
            const namespace = ast.children.find((node) => node.kind === 'namespace') as Namespace|undefined;
            if (namespace) {
                klass = namespace.children.find((node: any) => node.kind === 'class') as Class|undefined;
                namespace.children.forEach((ug: any) => {
                    const name = ug.name as string;
                    if ('items' in ug) {
                        const items = ug.items as Array<any>;
                        items.forEach((item: UseItem) => {
                            uses.push(name === null ? item.name : `${name}\\${item.name}`);
                        });
                    }
                });
            } else {
                klass = ast.children.find((node: any) => node.kind === 'class') as Class|undefined;
            }

            if (typeof klass === 'undefined') throw new Error('Class declaration not found');

            let func: Method|undefined;
            klass.body.forEach((node) => {
                if (node.kind === 'method') {
                    const name = node.name as Name;
                    if (name.name === this._name) {
                        func = node as Method;
                    }
                }
            });
            if (typeof func === 'undefined') throw new Error('Method declaration not found');

            this._params = func.arguments.map((arg: Parameter) => this.convertParam(arg));

            this.findThrows(func.body);

            const funcType = func.type as any;
            // eslint-disable-next-line max-len
            const types = funcType ? (func.type.kind === 'uniontype' ? funcType.types.map((t: Name) => t.name) : [funcType.name]) : ['mixed'];
            if (func.nullable && !types.includes('void') && !types.includes('null')) types.push('null');
            this._returnHint = types.join('|');
        } catch (error: any) {
            this._returnHint = '';
            this._params = [];
            App.instance.showMessage(`Failed to parse function: ${error}.`, M_ERROR);
        }
    }

    /**
     * @returns {string}
     */
    public get template(): string {
        const showDescription = !!App.instance.config(A_DOC_SHOW_DESCR, false);
        const descriptionString = showDescription ? `${this._tab} * ${this._name} description.\n` : '';

        const emptyLinesAfterDescription = showDescription ? App.instance.config(A_DOC_LINES_AFTER_DESCR, 0) : 0;
        const afterDescription = App.instance.multiplyString(`${this._tab} *\n`, emptyLinesAfterDescription);

        const params = this._params.map((p: IParameter) => `${this._tab} * @param ${p.hint} $${p.name}`);
        const paramsString = `${params.join('\n')}${params.length > 0 ? '\n' : ''}`;

        const returnVoid = !!App.instance.config(A_DOC_RETURN_VOID, false);
        // eslint-disable-next-line max-len
        const returnString = (returnVoid || this._returnHint !== 'void') ? `${this._tab} * @return ${this._returnHint}\n` : '';

        // eslint-disable-next-line max-len
        const emptyLinesBeforeReturn = (!returnVoid && this._returnHint === 'void') ? 0 : App.instance.config(A_DOC_LINES_BEFORE_RETURN, 0);
        const beforeReturn = App.instance.multiplyString(`${this._tab} *\n`, emptyLinesBeforeReturn);

        let throwsString = '';
        const showThrowsOnDiffLines = !!App.instance.config(A_DOC_SHOW_THROWS_ON_DIFF_LINES, true);
        if (showThrowsOnDiffLines) {
            const throws = this._throws.map((th) => `${this._tab} * @throws ${th}`);
            throwsString = `${throws.join('\n')}${throws.length > 0 ? '\n' : ''}`;
        } else {
            throwsString = this._throws.length === 0 ? '' : `${this._tab} * @throws ${this._throws.join('|')}\n`;
        }

        const emptyLinesBeforeThrows = throwsString === '' ? 0 : App.instance.config(A_DOC_LINES_BEFORE_THROWS, 0);
        const beforeThrows = App.instance.multiplyString(`${this._tab} *\n`, emptyLinesBeforeThrows);

        return `${this._tab}/**\n${descriptionString}${afterDescription}`
            + `${paramsString}${beforeReturn}${returnString}`
            + `${beforeThrows}${throwsString}${this._tab} */\n`;
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

    /**
     * @param {any} body
     * @returns
     */
    private findThrows(body: any) {
        if (!body || !('children' in body)) return;

        body.children.forEach((node: any) => {
            if (node.kind === 'throw') {
                const name = node.what.name || node.what.what.name;
                if (!this._throws.includes(name)) this._throws.push(name);
            } else {
                if (node.body) this.findThrows(node.body);
                if (node.alternate) this.findThrows(node.alternate);
            }
        });
    }
}
