import {Position} from 'vscode';
import {Declaration, Name} from 'php-parser';
import App from '../../app';
import {D_TYPE_CLASS, D_VALID_KLASS, M_ERROR} from '../../constants';
import {Block} from './base-block';

export class ClassBlock extends Block {
    public kind: string;

    public constructor(position: Position) {
        super(position);

        this.type = D_TYPE_CLASS;
        this.kind = '';

        try {
            let declr = this.activeLine.text.trim();
            declr = `${declr} ${declr.includes('{') ? '}' : ' {}'}`;
            const program = this.parseCode(`<?php \n ${declr} \n`);

            const klass = program.children.find((node) => D_VALID_KLASS.includes(node.kind)) as Declaration|undefined;
            if (typeof klass === 'undefined') {
                throw new Error('Invalid class declaration');
            }

            const className = klass.name as Name;
            this.name = className.name;
            this.kind = klass.kind;
        } catch (error: any) {
            App.instance.showMessage(`Failed to parse class: ${error}.`, M_ERROR);
        }
    }

    public get template(): string {
        const name = `${App.instance.capitalizeFirstCharTrimmed(this.kind)} ${this.name}`;

        return App.instance.arrayToPhpdoc([`${name} description.`], this.tab);
    }
}
