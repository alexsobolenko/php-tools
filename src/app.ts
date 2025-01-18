import {TextEditor, window} from 'vscode';
import {Action} from './interfaces';
import Resolver, {R_GETTER, R_SETTER} from './getters-setters/resolver';

export default class App {
    /**
     * @type {App}
     */
    private static _instance: App;

    /**
     * @type {TextEditor}
     */
    private _editor: TextEditor;

    private constructor() {
        if (!window.activeTextEditor) {
            throw new Error('There are no active editors.');
        }

        this._editor = window.activeTextEditor;
        if (this._editor.document.languageId !== 'php') {
            throw new Error('Not a PHP file.');
        }
    }

    /**
     * @returns {App}
     */
    public static get instance(): App {
        if (!this._instance) {
            this._instance = new this();
        }

        return this._instance;
    }

    /**
     * @returns {TextEditor}
     */
    public get editor(): TextEditor {
        return this._editor;
    }

    /**
     * @returns {Array<Action>}
     */
    public actions(): Array<Action> {
        return [
            {
                name: 'php-tools.insert-getter',
                handler: () => (new Resolver()).render([R_GETTER]),
            },
            {
                name: 'php-tools.insert-setter',
                handler: () => (new Resolver()).render([R_SETTER]),
            },
            {
                name: 'php-tools.insert-getter-setter',
                handler: () => (new Resolver()).render([R_GETTER, R_SETTER]),
            },
        ];
    }
}
