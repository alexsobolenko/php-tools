import {TextEditor} from 'vscode';
import {Class, Method, Name, Parameter} from 'php-parser';
import {IParameter} from '../../interfaces';
import Block from './block';
import {P_TYPE_FUNCTION} from '../data-provider';
import Utils from '../../utils';

export default class FunctionBlock extends Block {
    /**
     * @type {string}
     */
    private _params: Array<IParameter>;

    /**
     * @type {string}
     */
    private _returnType: string;

    /**
     * @param {TextEditor} editor
     */
    public constructor(editor: TextEditor) {
        super(editor);

        this._type = P_TYPE_FUNCTION;
        this._params = [];
        this._returnType = '';

        const lines = [];
        while (this._startLine >= 0) {
            const line = this._document.lineAt(this._startLine).text.trim();

            if (line.includes('function')) {
                lines.unshift(line);
                break;
            }

            --this._startLine;
        }
        if (lines.length === 0) {
            return;
        }

        for (let i = this._startLine + 1; i < this._document.lineCount; i++) {
            const line = this._document.lineAt(i).text.trim();
            lines.push(line);
            if (line.includes('{') || line.endsWith(')')) {
                break;
            }
        }

        try {
            const functionDeclaration = lines.join(' ');
            const additional = functionDeclaration.includes('{') ? '}' : ' {}';
            const phpCode = `<?php \n class A { \n ${functionDeclaration} ${additional} \n }`;

            const ast = this._phpParser.parseCode(phpCode, '');
            const klass = ast.children.find((node) => node.kind === 'class') as Class|undefined;
            if (typeof klass === 'undefined') {
                throw new Error('Invalid PHP code.');
            }

            const func = klass.body.find((node) => node.kind === 'method') as Method|undefined;
            if (typeof func === 'undefined') {
                throw new Error('Invalid PHP code.');
            }

            const functionName = func.name as Name;
            this._name = functionName.name;
            func.arguments.forEach((argument: Parameter) => {
                const argumentType = argument.type as any|null;
                let type = 'mixed';
                if (argumentType !== null) {
                    if (argumentType.kind === 'uniontype') {
                       type = argumentType.types.map((t: Name) => t.name).join('|');
                    } else {
                        type = argumentType.name;
                    }
                }
                this._params.push({
                    name: (argument.name as Name).name,
                    type,
                });
            });
            this._returnType = func.type ? func.type.name : 'void';
        } catch (error: any) {
            Utils.instance.showErrorMessage('Failed to parse function.');
        }
    }

    /**
     * @returns {Array<IParameter>}
     */
    public get params(): Array<IParameter> {
        return this._params;
    }

    /**
     * @returns {string}
     */
    public get returnType(): string {
        return this._returnType;
    }
}
