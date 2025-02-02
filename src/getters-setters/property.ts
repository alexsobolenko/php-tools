import {Position, TextDocument, TextEditor, TextLine} from 'vscode';
import {Class, Engine, Name, PropertyStatement} from 'php-parser';
import App from '../app';
import {D_REGEX_CLASS, R_SETTER, R_UNDEFINED_PROPERTY} from '../constants';
import Utils from '../utils';

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

    /**
     * @type {Engine}
     */
    protected _phpParser: Engine;

    /**
     * @type {TextEditor}
     */
    protected _editor: TextEditor;

    /**
     * @type {TextDocument}
     */
    protected _document: TextDocument;

    /**
     * @type {Position}
     */
    protected _position: Position;

    /**
     * @type {TextLine}
     */
    protected _activeLine: TextLine;

    /**
     * @param {TextEditor} editor
     */
    public constructor(editor: TextEditor) {
        this._editor = editor;
        this._document = this._editor.document;
        this._position = this._editor.selection.active;
        this._activeLine = this._document.lineAt(this._position.line);
        this._tab = this._activeLine.text.substring(0, this._activeLine.firstNonWhitespaceCharacterIndex);
        this._className = 'self';

        for (let i = 0; i < this._position.line; i++) {
            const text = this._document.lineAt(i).text as string;
            if (text.includes('class')) {
                const matches = this._document.lineAt(i).text.match(D_REGEX_CLASS);
                if (matches && matches.length > 2) {
                    this._className = matches[2] as string;
                }
            }
        }

        this._phpParser = new Engine({
            parser: {
                extractDoc: true,
                version: App.instance.composer('php-version', '7.4'),
            },
            ast: {
                withPositions: true,
            },
        });

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

            const varTypes: Array<string> = prop.type.kind === 'uniontype'
                ? prop.type.types.map((t: Name) => t.name)
                : [prop.type.name];

            const joinedVarTypes = varTypes.join('|');
            this._hint = joinedVarTypes;
            const index = varTypes.indexOf('null');
            if (index === -1) {
                this._type = joinedVarTypes;
            } else {
                varTypes.splice(index, 1);
                this._type = `?${varTypes.join('|')}`;
            }
        } catch (error: any) {
            this._name = R_UNDEFINED_PROPERTY;
            this._type = null;
            this._hint = null;
            Utils.instance.showErrorMessage(`Failed to parse property: ${error}`);
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
