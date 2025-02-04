import {Class, ClassConstant, Name} from 'php-parser';
import Block from './block';
import App from '../../app';
import {
    A_DOC_SHOW_DESCR,
    A_DOC_LINES_AFTER_DESCR,
    D_TYPE_CONSTANT,
    D_REGEX_CONSTANT,
    M_ERROR,
} from '../../constants';

export default class ConstantBlock extends Block {
    /**
     * @type {string|null}
     */
    private _constType: string|null;

    public constructor() {
        super();

        this._type = D_TYPE_CONSTANT;

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

            const stmt = klass.body.find((node) => node.kind === 'classconstant') as ClassConstant|undefined;
            if (typeof stmt === 'undefined') throw new Error('Invalid PHP code');

            const konst = stmt.constants.find((node) => node.kind === 'constant') as any;
            if (typeof konst === 'undefined') throw new Error('Invalid PHP code');

            this._name = (konst.name as Name).name;
            const matches = declr.match(D_REGEX_CONSTANT) as Array<string>|null;

            // eslint-disable-next-line max-len
            this._constType = (matches && matches.length >= 3) ? (/^[A-Z]+$/.test(matches[2]) ? 'mixed' : matches[2]) : 'mixed';
        } catch (error: any) {
            this._constType = 'mixed';
            App.instance.showMessage(`Failed to parse class: ${error}.`, M_ERROR);
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

        return `${this._tab}/**\n${descriptionString}${afterDescription}`
            + `${this._tab} * @var ${this._constType}\n`
            + `${this._tab} */\n`;
    }
}
