import {Position} from 'vscode';
import {Class, Engine, Name, PropertyStatement} from 'php-parser';
import App from '../app';
import {D_REGEX_CLASS, M_ERROR, R_SETTER, R_UNDEFINED_PROPERTY} from '../constants';

export default class Property {
    public name: string;
    public tab: string;
    public type: string|null;
    public hint: string|null;
    public className: string = 'self';

    public constructor(position: Position) {
        const activeLine = App.instance.editor.document.lineAt(position.line);
        this.tab = activeLine.text.substring(0, activeLine.firstNonWhitespaceCharacterIndex);
        for (let i = 0; i < position.line; i++) {
            const text = App.instance.editor.document.lineAt(i).text as string;
            if (text.includes('class')) {
                const matches = App.instance.editor.document.lineAt(i).text.match(D_REGEX_CLASS);
                if (matches && matches.length > 2) this.className = matches[2] as string;
            }
        }

        try {
            let declr = activeLine.text.trim();
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

            const phpParser = new Engine(App.instance.phpParserParams);
            const program = phpParser.parseCode(`<?php \n class Foo { \n ${declr} \n } \n`, '');

            const klass = program.children.find((node) => node.kind === 'class') as Class|undefined;
            if (typeof klass === 'undefined') throw new Error('Invalid PHP code');

            const stmt = klass.body.find((node) => node.kind === 'propertystatement') as PropertyStatement|undefined;
            if (typeof stmt === 'undefined') throw new Error('Invalid PHP code');

            const prop = stmt.properties.find((node) => node.kind === 'property') as any;
            if (typeof prop === 'undefined') throw new Error('Invalid PHP code');

            // eslint-disable-next-line max-len
            const varTypes: Array<string> = prop.type.kind === 'uniontype' ? prop.type.types.map((t: Name) => t.name) : [prop.type.name];
            if (prop.nullable && !varTypes.includes('null')) varTypes.push('null');

            const joinedVarTypes = varTypes.join('|');
            this.hint = joinedVarTypes;
            const index = varTypes.indexOf('null');
            if (index === -1) {
                this.type = joinedVarTypes;
            } else {
                varTypes.splice(index, 1);
                this.type = `?${varTypes.join('|')}`;
            }

            this.name = (prop.name as Name).name;
        } catch (error: any) {
            this.name = R_UNDEFINED_PROPERTY;
            this.type = null;
            this.hint = null;
            App.instance.utils.showMessage(`Failed to parse property: ${error}.`, M_ERROR);
        }
    }

    public getFunction(type: string): string {
        const isBoolHint = ['bool', 'boolean'].includes(this.hint ?? '');
        const prefix = type === R_SETTER ? 'set' : (isBoolHint ? 'is' : 'get');

        return prefix + App.instance.utils.capitalizeFirstCharTrimmed(this.name);
    }
}
