import {Class, Name, PropertyStatement} from 'php-parser';
import Block from './block';
import App from '../../app';
import Utils from '../../utils';
import {A_DOC_LINES_AFTER_DESCR, A_DOC_SHOW_DESCR, D_TYPE_PROPERTY, M_ERROR} from '../../constants';

export default class PropertyBlock extends Block {
    /**
     * @type {string}
     */
    private _varHint: string;

    public constructor() {
        super();

        this._type = D_TYPE_PROPERTY;

        try {
            let declr = this._activeLine.text.trim();
            if (!declr.includes(';')) {
                if (declr.endsWith('[')) {
                    declr = `${declr}];`;
                } else if (declr.endsWith('\'')) {
                    declr = `${declr}';`;
                } else if (declr.endsWith('"')) {
                    declr = `${declr}";`;
                } else {
                    declr = `${declr};`;
                }
            }
            const program = this.parseCode(`<?php \n class Foo { \n ${declr} \n } \n`);

            const klass = program.children.find((node) => node.kind === 'class') as Class|undefined;
            if (typeof klass === 'undefined') throw new Error('Invalid PHP code');

            const stmt = klass.body.find((node) => node.kind === 'propertystatement') as PropertyStatement|undefined;
            if (typeof stmt === 'undefined') throw new Error('Invalid PHP code');

            const prop = stmt.properties.find((node) => node.kind === 'property') as any;
            if (typeof prop === 'undefined') throw new Error('Invalid PHP code');

            this._name = (prop.name as Name).name;

            const types = prop.type.kind === 'uniontype' ? prop.type.types.map((t: Name) => t.name) : [prop.type.name];
            if (prop.nullable && !types.includes('null')) types.push('null');

            this._varHint = types.join('|');
        } catch (error: any) {
            this._varHint = 'mixed';
            Utils.instance.showMessage(`Failed to parse class: ${error}.`, M_ERROR);
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

        return `${this._tab}/**\n${descriptionString}${afterDescription}`
            + `${this._tab} * @var ${this._varHint}\n`
            + `${this._tab} */\n`;
    }
}
