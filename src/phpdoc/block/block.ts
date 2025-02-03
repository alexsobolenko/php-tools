import {TextLine} from 'vscode';
import {Engine, Program} from 'php-parser';
import App from '../../app';

export default class Block {
    /**
     * @type {string}
     */
    protected _type: string;

    /**
     * @type {string}
     */
    protected _name: string;

    /**
     * @type {string}
     */
    protected _tab: string;

    /**
     * @type {string}
     */
    protected _startLine: number;

    /**
     * @type {TextLine}
     */
    protected _activeLine: TextLine;

    /**
     * @type {Engine}
     */
    protected _phpParser: Engine;

    public constructor() {
        const position = App.instance.editor.selection.active;

        this._phpParser = new Engine(App.instance.phpParserParams);
        this._type = 'undefined';
        this._name = '';
        this._activeLine = App.instance.editor.document.lineAt(position.line);
        this._tab = this._activeLine.text.substring(0, this._activeLine.firstNonWhitespaceCharacterIndex);
        this._startLine = position.line;
    }

    /**
     * @returns {number}
     */
    public get startLine(): number {
        return this._startLine;
    }

    /**
     * @returns {string}
     */
    public get template(): string {
        return '';
    }

    /**
     * @param {string} buffer
     * @returns {Program}
     */
    protected parseCode(buffer: string): Program {
        return this._phpParser.parseCode(buffer, '');
    }
}
