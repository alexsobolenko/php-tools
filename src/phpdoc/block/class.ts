import {TextEditor} from 'vscode';
import {Class, Enum, Interface, Name, Trait} from 'php-parser';
import Block from './block';
import {P_TYPE_CLASS} from '../data-provider';
import Utils from '../../utils';

export default class ClassBlock extends Block {
    /**
     * @type {string}
     */
    private _kind: string;

    /**
     * @param {TextEditor} editor
     */
    public constructor(editor: TextEditor) {
        super(editor);

        this._type = P_TYPE_CLASS;
        this._kind = '';

        try {
            const classDeclaration = this._activeLine.text.trim();
            const additional = classDeclaration.includes('{') ? '}' : ' {}';
            const phpCode = `<?php \n ${classDeclaration} ${additional} \n`;

            const ast = this._phpParser.parseCode(phpCode, '');
            const types = ['class', 'enum', 'interface', 'trait'];
            // eslint-disable-next-line max-len
            const klass = ast.children.find((node) => types.includes(node.kind)) as Class|Trait|Interface|Enum|undefined;
            if (typeof klass === 'undefined') {
                throw new Error('Invalid PHP code.');
            }

            const className = klass.name as Name;
            this._name = className.name;
            this._kind = klass.kind;
        } catch (error: any) {
            Utils.instance.showErrorMessage('Failed to parse class.');
        }
    }

    /**
     * @returns {string}
     */
    public get kind(): string {
        return this._kind;
    }
}
