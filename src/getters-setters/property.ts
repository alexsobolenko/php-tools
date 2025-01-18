import {Position, TextEditor} from 'vscode';
import Utils from '../utils';

export default class Property
{
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
     * @param {string} name
     */
    public constructor(name: string) {
        this._name = name;
        this._tab = null;
        this._type = null;
        this._hint = null;
    }

    /**
     * @param {TextEditor} editor
     * @returns {Property}
     */
    public static fromEditorSelection(editor: TextEditor): Property {
        return Property.fromEditorPosition(editor, editor.selection.active);
    }

    /**
     * @param {TextEditor} editor
     * @param {Position} activePosition
     * @returns {Property}
     */
    public static fromEditorPosition(editor: TextEditor, activePosition: Position): Property {
        const wordRange = editor.document.getWordRangeAtPosition(activePosition);
        if (wordRange === undefined) {
            throw new Error('No property found. Please select a property to use this extension.');
        }

        const selectedWord = editor.document.getText(wordRange);
        if (selectedWord[0] !== '$') {
            throw new Error('No property found. Please select a property to use this extension.');
        }

        const property = new Property(selectedWord.substring(1, selectedWord.length));
        const activeLineNumber = activePosition.line;
        const activeLine = editor.document.lineAt(activeLineNumber);
        const previousLineNumber = activeLineNumber - 1;

        property.tab = activeLine.text.substring(0, activeLine.firstNonWhitespaceCharacterIndex);
        if (previousLineNumber <= 0) {
            return property;
        }

        const text = activeLine.text.split('$')[0];
        const textData = text.split(' ').filter((v) => v !== '');
        if (typeof textData[1] !== 'undefined') {
            property.type = textData[1];
            property.hint = Utils.instance.convertNullable(textData[1]);
        }

        const previousLine = editor.document.lineAt(previousLineNumber);
        if (previousLine.text.endsWith('*/')) {
            let processed = false;
            for (let line = previousLineNumber - 1; line > 0; line--) {
                if (processed) break;

                const text = editor.document.lineAt(line).text;
                if (text.includes('/**') || !text.includes('*')) break;

                const lineParts = text.split(' ').filter((v) => v !== '' && v !== "\t" && v !== '*');
                const varPosition = lineParts.indexOf('@var');
                if (-1 !== varPosition) {
                    processed = true;
                    const type = lineParts[varPosition + 1];
                    property.hint = Utils.instance.convertNullable(type);
                    if (!property.type) {
                        property.type = type;
                    }
                    continue;
                }
            }
        }

        return property;
    }

    /**
     * @returns {string}
     */
    public get name(): string {
        return this._name;
    }

    /**
     * @param {string} name
     */
    public set name(name: string) {
        this._name = name;
    }

    /**
     * @returns {string}
     */
    public get type(): string {
        return this._type || 'mixed';
    }

    /**
     * @param {string} type
     */
    public set type(type: string) {
        this._type = type;
    }

    /**
     * @returns {string}
     */
    public get hint(): string {
        return this._hint || 'mixed';
    }

    /**
     * @param {string} hint
     */
    public set hint(hint: string) {
        this._hint = hint;
    }

    /**
     * @returns {string}
     */
    public get tab(): string {
        return this._tab || '';
    }

    /**
     * @param {string} tab
     */
    public set tab(tab: string) {
        this._tab = tab;
    }

    /**
     * @returns {string}
     */
    public getterName(): string {
        return this.generateMethodName('get');
    }

    /**
     * @returns {string}
     */
    public setterName(): string {
        return this.generateMethodName('set');
    }

    /**
     * @param {string} prefix
     * @returns {string}
     */
    private generateMethodName(prefix: string): string {
        return prefix + this.name.charAt(0).toUpperCase() + this.name.substring(1);
    }
}
