import {Declaration, Name} from 'php-parser';
import Block from './block';
import Utils from '../../utils';
import {D_TYPE_CLASS, M_ERROR} from '../../constants';

export default class ClassBlock extends Block {
    /**
     * @type {string}
     */
    private _kind: string;

    public constructor() {
        super();

        this._type = D_TYPE_CLASS;
        this._kind = '';

        try {
            let declr = this._activeLine.text.trim();
            declr = `${declr} ${declr.includes('{') ? '}' : ' {}'}`;
            const program = this.parseCode(`<?php \n ${declr} \n`);
            const types = ['class', 'enum', 'interface', 'trait'];

            const klass = program.children.find((node) => types.includes(node.kind)) as Declaration|undefined;
            if (typeof klass === 'undefined') throw new Error('Invalid PHP code');

            const className = klass.name as Name;
            this._name = className.name;
            this._kind = klass.kind;
        } catch (error: any) {
            Utils.instance.showMessage(`Failed to parse class: ${error}.`, M_ERROR);
        }
    }

    /**
     * @returns {string}
     */
    public get template(): string {
        const name = `${Utils.instance.capitalizeFirstCharTrimmed(this._kind)} ${this._name}`;

        return `${this._tab}/**\n${this._tab} * ${name} description.\n${this._tab} */\n`;
    }
}
