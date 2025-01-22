import {TextEditor, WorkspaceConfiguration, window, workspace} from 'vscode';
import fs from 'fs';
import path from 'path';
import {Action} from './interfaces';
import Resolver, {R_GETTER, R_SETTER} from './getters-setters/resolver';
import Builder, {B_ABSTRACT_CLASS, B_CLASS, B_ENUM, B_FINAL_CLASS, B_INTERFACE, B_TRAIT} from './fabric/builder';
import Utils from './utils';

export default class App {
    /**
     * @type {App}
     */
    private static _instance: App;

    /**
     * @type {TextEditor}
     */
    private _editor: TextEditor;

    /**
     * @type {WorkspaceConfiguration}
     */
    private _config: WorkspaceConfiguration;

    /**
     * @type {string}
     */
    private _workplacePath: string;

    /**
     * @type {{[k: string]: any}}
     */
    private _composerData: {[k: string]: any}

    private constructor() {
        if (!window.activeTextEditor) {
            throw new Error('There are no active editors.');
        }

        this._editor = window.activeTextEditor;
        if (this._editor.document.languageId !== 'php') {
            throw new Error('Not a PHP file.');
        }

        this._config = workspace.getConfiguration('advanced-php-tools');

        this._workplacePath = '';
        this._composerData = {};
        const workspaceFolders = workspace.workspaceFolders;
        if (typeof workspaceFolders !== 'undefined' && workspaceFolders.length > 0) {
            this._workplacePath = workspaceFolders[0].uri.path;
            // const composerFile = `${this._workplacePath}/composer.json`;
            const composerFile = path.join(this._workplacePath, 'composer.json');
            if (fs.existsSync(composerFile)) {
                const composerFileContent = fs.readFileSync(composerFile, 'utf-8');
                const data = JSON.parse(composerFileContent);
                this._composerData['autoload'] = data['autoload']['psr-4'];
            }
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
     * @returns {string}
     */
    public get workplacePath(): string {
        return this._workplacePath;
    }

    /**
     * @param {string} key
     * @param {any} defaultValue
     * @returns {any}
     */
    public config(key: string, defaultValue: any = null): any {
        return this._config.get(key, defaultValue);
    }

    /**
     * @param {string} key
     * @param {any} defaultValue
     * @returns {any}
     */
    public composer(key: string, defaultValue: any = null): any {
        return Utils.instance.hasKey(this._composerData, key) ? this._composerData[key] : defaultValue;
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
            {
                name: 'php-tools.generate-class',
                handler: () => (new Builder()).render(B_CLASS),
            },
            {
                name: 'php-tools.generate-abstract-class',
                handler: () => (new Builder()).render(B_ABSTRACT_CLASS),
            },
            {
                name: 'php-tools.generate-final-class',
                handler: () => (new Builder()).render(B_FINAL_CLASS),
            },
            {
                name: 'php-tools.generate-enum',
                handler: () => (new Builder()).render(B_ENUM),
            },
            {
                name: 'php-tools.generate-interface',
                handler: () => (new Builder()).render(B_INTERFACE),
            },
            {
                name: 'php-tools.generate-trait',
                handler: () => (new Builder()).render(B_TRAIT),
            },
        ];
    }
}
