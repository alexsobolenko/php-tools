import {Class, Engine, Name, PropertyStatement} from 'php-parser';
import App from '../app';
import Utils from '../utils';
import {D_REGEX_CLASS, M_ERROR, R_SETTER, R_UNDEFINED_PROPERTY} from '../constants';

export default class Property {
    /**
     * @type {string}
     */
    private _name: string;

    /**
     * @type {string|null}
     */
    private _tab: string|null;

    /**
     * @type {string|null}
     */
    private _type: string|null;

    /**
     * @type {string|null}
     */
    private _hint: string|null;

    /**
     * @type {string}
     */
    private _className: string;

    public constructor() {
        const position = App.instance.editor.selection.active;
        const activeLine = App.instance.editor.document.lineAt(position.line);

        this._tab = activeLine.text.substring(0, activeLine.firstNonWhitespaceCharacterIndex);
        this._className = 'self';

        for (let i = 0; i < position.line; i++) {
            const text = App.instance.editor.document.lineAt(i).text as string;
            if (text.includes('class')) {
                const matches = App.instance.editor.document.lineAt(i).text.match(D_REGEX_CLASS);
                if (matches && matches.length > 2) this._className = matches[2] as string;
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
            this._hint = joinedVarTypes;
            const index = varTypes.indexOf('null');
            if (index === -1) {
                this._type = joinedVarTypes;
            } else {
                varTypes.splice(index, 1);
                this._type = `?${varTypes.join('|')}`;
            }

            this._name = (prop.name as Name).name;
        } catch (error: any) {
            this._name = R_UNDEFINED_PROPERTY;
            this._type = null;
            this._hint = null;
            Utils.instance.showMessage(`Failed to parse property: ${error}.`, M_ERROR);
        }
    }

    /**
     * @param {string} type
     * @returns {string}
     */
    public getFunction(type: string): string {
        const name = Utils.instance.capitalizeFirstCharTrimmed(this._name);
        switch (true) {
            case (type === R_SETTER):
                return `set${name}`;
            case (['bool', 'boolean'].includes(this._hint ?? '')):
                return `is${name}`;
            default:
                return `get${name}`;
        }
    }

    /**
     * @returns {string}
     */
    public get name(): string {
        return this._name;
    }

    /**
     * @returns {string}
     */
    public get type(): string {
        return this._type || 'mixed';
    }

    /**
     * @returns {string}
     */
    public get hint(): string {
        return this._hint || 'mixed';
    }

    /**
     * @returns {string}
     */
    public get tab(): string {
        return this._tab || '';
    }

    /**
     * @returns {string}
     */
    public get className(): string {
        return this._className;
    }
}
