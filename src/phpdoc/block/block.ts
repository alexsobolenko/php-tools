import {Position, TextDocument, TextEditor, TextLine} from 'vscode';
import {Engine} from 'php-parser';
import App from '../../app';

export default abstract class Block {
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
        this._type = 'undefined';
        this._name = '';
        this._editor = editor;
        this._document = this._editor.document;
        this._position = this._editor.selection.active;
        this._activeLine = this._document.lineAt(this._position.line);
        this._tab = this._activeLine.text.substring(0, this._activeLine.firstNonWhitespaceCharacterIndex);
        this._startLine = this._position.line;

        this._phpParser = new Engine({
            parser: {
                extractDoc: true,
                version: App.instance.composer('php-version', '7.4'),
            },
            ast: {
                withPositions: true,
            },
        });
    }

    /**
     * @returns {string}
     */
    public get type(): string {
        return this._type;
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
    public get tab(): string {
        return this._tab;
    }

    /**
     * @returns {number}
     */
    public get startLine(): number {
        return this._startLine;
    }
}
