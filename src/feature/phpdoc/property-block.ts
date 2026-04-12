import {Position} from 'vscode';
import {Class, Name, PropertyStatement} from 'php-parser';
import App from '../../app';
import {
    A_DOC_LINES_AFTER_DESCR,
    A_DOC_SHOW_DESCR,
    D_TYPE_PROPERTY,
    D_VALID_KLASS,
    M_ERROR,
} from '../../constants';
import {nodeName, parsePhp, walkPhp} from '../../utils/php-ast';
import {Block} from './base-block';

export class PropertyBlock extends Block {
    public varHint: string = 'mixed';

    public constructor(position: Position) {
        super(position);

        this.type = D_TYPE_PROPERTY;

        try {
            if (this.resolvePropertyFromDocument(position)) {
                return;
            }

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

            const stmt = klass.body.find((node) => node.kind === 'propertystatement') as PropertyStatement|undefined;
            if (typeof stmt === 'undefined') {
                throw new Error('Invalid property statement declaration');
            }

            const prop = stmt.properties.find((node) => node.kind === 'property') as any;
            if (typeof prop === 'undefined') {
                throw new Error('Invalid property declaration');
            }

            this.name = (prop.name as Name).name;

            const types = prop.type.kind === 'uniontype'
                ? prop.type.types.map((t: Name) => t.name)
                : [prop.type.name];
            if (prop.nullable && !types.includes('null')) {
                types.push('null');
            }

            this.varHint = types.join('|');
        } catch (error: any) {
            this.varHint = 'mixed';
            App.instance.showMessage(`Failed to parse property: ${error}.`, M_ERROR);
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

        data.push(`@var ${this.varHint}`);

        return this.wrapTemplate(App.instance.arrayToPhpdoc(data, this.tab), true);
    }

    private resolvePropertyFromDocument(position: Position): boolean {
        const {document} = App.instance.editor;
        const offset = document.offsetAt(position);
        const program = parsePhp(document.getText());
        let resolved = false;

        walkPhp(program, (node) => {
            if (resolved || node.kind !== 'property') {
                return;
            }

            const start = node.loc?.start?.offset;
            const end = node.loc?.end?.offset;
            if (typeof start !== 'number' || typeof end !== 'number' || offset < start || offset > end) {
                return;
            }

            const name = nodeName(node.name);
            const types = this.resolveTypeNames(node.type);
            if (node.nullable && !types.includes('null')) {
                types.push('null');
            }

            this.name = name ?? this.name;
            this.varHint = types.length > 0 ? types.join('|') : 'mixed';
            resolved = true;
        });

        return resolved;
    }

    private resolveTypeNames(typeNode: any): Array<string> {
        if (!typeNode || typeof typeNode !== 'object') {
            return [];
        }

        if (typeNode.kind === 'uniontype' || typeNode.kind === 'intersectiontype') {
            return typeNode.types.flatMap((node: any) => this.resolveTypeNames(node));
        }

        const typeName = nodeName(typeNode);

        return typeName ? [typeName] : [];
    }
}
