import {Position} from 'vscode';
import {Class, ClassConstant, Name} from 'php-parser';
import App from '../../app';
import {
    A_DOC_LINES_AFTER_DESCR,
    A_DOC_SHOW_DESCR,
    D_REGEX_CONSTANT,
    D_TYPE_CONSTANT,
    D_VALID_KLASS,
    M_ERROR,
} from '../../constants';
import {Block} from './base-block';

export class ConstantBlock extends Block {
    public constType: string|null;

    public constructor(position: Position) {
        super(position);

        this.type = D_TYPE_CONSTANT;

        try {
            let declr = this.activeLine.text.trim();
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

            const klass = program.children.find((node) => D_VALID_KLASS.includes(node.kind)) as Class|undefined;
            if (typeof klass === 'undefined') {
                throw new Error('Invalid class declaration');
            }

            const stmt = klass.body.find((node) => node.kind === 'classconstant') as ClassConstant|undefined;
            if (typeof stmt === 'undefined') {
                throw new Error('Invalid constant statement declaration');
            }

            const konst = stmt.constants.find((node) => node.kind === 'constant') as any;
            if (typeof konst === 'undefined') {
                throw new Error('Invalid constant');
            }

            this.name = (konst.name as Name).name;
            const matches = declr.match(D_REGEX_CONSTANT) as Array<string>|null;

            this.constType = (matches && matches.length >= 3)
                ? (/^[A-Z]+$/.test(matches[2]) ? 'mixed' : matches[2])
                : 'mixed';
        } catch (error: any) {
            this.constType = 'mixed';
            App.instance.showMessage(`Failed to parse constant: ${error}.`, M_ERROR);
        }
    }

    public get template(): string {
        const data = [];

        if (!!App.instance.config(A_DOC_SHOW_DESCR, false)) {
            data.push(`${this.name} description.`);
            for (let i = 0; i < App.instance.config(A_DOC_LINES_AFTER_DESCR, 0); i++) {
                data.push('');
            }
        }

        data.push(`@var ${this.constType}`);

        return this.wrapTemplate(App.instance.arrayToPhpdoc(data, this.tab), true);
    }
}
