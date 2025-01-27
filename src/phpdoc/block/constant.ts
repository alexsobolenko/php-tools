import {TextEditor} from 'vscode';
import {Class, ClassConstant, Name} from 'php-parser';
import Block from './block';
import {P_REGEX_CONSTANT, P_TYPE_CONSTANT} from '../data-provider';
import Utils from '../../utils';

export default class ConstantBlock extends Block {
    /**
     * @type {string|null}
     */
    private _constType: string|null;

    /**
     * @param {TextEditor} editor
     */
    public constructor(editor: TextEditor) {
        super(editor);

        this._type = P_TYPE_CONSTANT;
        this._constType = null;

        try {
            const constantDeclaration = this._activeLine.text.trim();
            let additional = '';
            if (!constantDeclaration.includes(';')) {
                if (constantDeclaration.endsWith('[')) {
                    additional = '];';
                } else if (constantDeclaration.endsWith('\'')) {
                    additional = '\';';
                } else if (constantDeclaration.endsWith('"')) {
                    additional = '";';
                } else {
                    additional = ';';
                }
            }
            const phpCode = `<?php \n class Foo { \n ${constantDeclaration} ${additional} \n } \n`;

            const ast = this._phpParser.parseCode(phpCode, '');
            const klass = ast.children.find((node) => node.kind === 'class') as Class|undefined;
            if (typeof klass === 'undefined') {
                throw new Error('Invalid PHP code.');
            }

            const stmt = klass.body.find((node) => node.kind === 'classconstant') as ClassConstant|undefined;
            if (typeof stmt === 'undefined') {
                throw new Error('Invalid PHP code.');
            }

            const konst = stmt.constants.find((node) => node.kind === 'constant') as any;
            if (typeof konst === 'undefined') {
                throw new Error('Invalid PHP code.');
            }

            this._name = (konst.name as Name).name;
            const m = constantDeclaration.match(P_REGEX_CONSTANT) as Array<string>|null;
            if (m !== null && m.length >= 3) {
                this._constType = /^[A-Z]+$/.test(m[2]) ? 'mixed' : m[2];
            }
        } catch (error: any) {
            Utils.instance.showErrorMessage('Failed to parse class.');
        }
    }

    /**
     * @returns {string|null}
     */
    public get constType(): string|null {
        return this._constType;
    }
}
