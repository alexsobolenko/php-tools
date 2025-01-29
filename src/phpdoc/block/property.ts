import {TextEditor} from 'vscode';
import {Class, Name, PropertyStatement} from 'php-parser';
import Block from './block';
import {P_TYPE_PROPERTY} from '../data-provider';
import Utils from '../../utils';

export default class PropertyBlock extends Block {
    /**
     * @type {Array<string>}
     */
    private _varTypes: Array<string>;

    /**
     * @param {TextEditor} editor
     */
    public constructor(editor: TextEditor) {
        super(editor);

        this._type = P_TYPE_PROPERTY;
        this._varTypes = [];

        try {
            const propertyDeclaration = this._activeLine.text.trim();
            let additional = '';
            if (!propertyDeclaration.includes(';')) {
                if (propertyDeclaration.endsWith('[')) {
                    additional = '];';
                } else if (propertyDeclaration.endsWith('\'')) {
                    additional = '\';';
                } else if (propertyDeclaration.endsWith('"')) {
                    additional = '";';
                } else {
                    additional = ';';
                }
            }
            const phpCode = `<?php \n class Foo { \n ${propertyDeclaration} ${additional} \n } \n`;

            const ast = this._phpParser.parseCode(phpCode, '');
            const klass = ast.children.find((node) => node.kind === 'class') as Class|undefined;
            if (typeof klass === 'undefined') {
                throw new Error('Invalid PHP code.');
            }

            const stmt = klass.body.find((node) => node.kind === 'propertystatement') as PropertyStatement|undefined;
            if (typeof stmt === 'undefined') {
                throw new Error('Invalid PHP code.');
            }

            const prop = stmt.properties.find((node) => node.kind === 'property') as any;
            if (typeof prop === 'undefined') {
                throw new Error('Invalid PHP code.');
            }

            this._name = (prop.name as Name).name;
            const t = prop.type;
            if (t.kind === 'uniontype') {
                t.types.forEach((t: Name) => {
                    this._varTypes.push(t.name);
                });
            } else {
                this._varTypes.push(t.name);
            }
        } catch (error: any) {
            Utils.instance.showErrorMessage('Failed to parse class.');
        }
    }

    /**
     * @returns {Array<string>}
     */
    public get varTypes(): Array<string> {
        return this._varTypes;
    }
}
