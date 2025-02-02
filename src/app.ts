import {TextEditor, WorkspaceConfiguration, WorkspaceFolder, window, workspace} from 'vscode';
import fs from 'fs';
import path from 'path';
import {IAction} from './interfaces';
import Utils from './utils';
import Resolver from './getters-setters/resolver';
import Builder, {B_ABSTRACT_CLASS, B_CLASS, B_ENUM, B_FINAL_CLASS, B_INTERFACE, B_TRAIT} from './fabric/builder';
import Documenter from './phpdoc/documenter';
import {
    CMD_GENERATE_ABSTRACT_CLASS,
    CMD_GENERATE_CLASS,
    CMD_GENERATE_ENUM,
    CMD_GENERATE_FINAL_CLASS,
    CMD_GENERATE_INTERFACE,
    CMD_GENERATE_PHPDOC,
    CMD_GENERATE_TRAIT,
    CMD_INSERT_GETTER,
    CMD_INSERT_GETTER_SETTER,
    CMD_INSERT_SETTER,
    R_GETTER,
    R_SETTER,
} from './constants';

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
    private _composerData: {[k: string]: any};

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
        const workspaceFolders = workspace.workspaceFolders as Array<WorkspaceFolder>;
        if (typeof workspaceFolders !== 'undefined' && workspaceFolders.length > 0) {
            this._workplacePath = workspaceFolders[0].uri.path;
            const composerFile = path.join(this._workplacePath, 'composer.json');
            if (fs.existsSync(composerFile)) {
                const composerFileContent = fs.readFileSync(composerFile, 'utf-8');
                const data = JSON.parse(composerFileContent);
                this._composerData['autoload'] = data['autoload']['psr-4'];

                const phpSrc = data['require']['php'] ?? null;
                this._composerData['php-version'] = phpSrc === null ? '7.4' : phpSrc.replace(/.+(\d+\.\d+)/, '$1');
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
     * @returns {Array<IAction>}
     */
    public actions(): Array<IAction> {
        return [
            {
                name: CMD_INSERT_GETTER,
                handler: () => (new Resolver()).render([R_GETTER]),
            },
            {
                name: CMD_INSERT_SETTER,
                handler: () => (new Resolver()).render([R_SETTER]),
            },
            {
                name: CMD_INSERT_GETTER_SETTER,
                handler: () => (new Resolver()).render([R_GETTER, R_SETTER]),
            },
            {
                name: CMD_GENERATE_CLASS,
                handler: () => (new Builder()).render(B_CLASS),
            },
            {
                name: CMD_GENERATE_ABSTRACT_CLASS,
                handler: () => (new Builder()).render(B_ABSTRACT_CLASS),
            },
            {
                name: CMD_GENERATE_FINAL_CLASS,
                handler: () => (new Builder()).render(B_FINAL_CLASS),
            },
            {
                name: CMD_GENERATE_ENUM,
                handler: () => (new Builder()).render(B_ENUM),
            },
            {
                name: CMD_GENERATE_INTERFACE,
                handler: () => (new Builder()).render(B_INTERFACE),
            },
            {
                name: CMD_GENERATE_TRAIT,
                handler: () => (new Builder()).render(B_TRAIT),
            },
            {
                name: CMD_GENERATE_PHPDOC,
                handler: () => (new Documenter()).render(),
            },
        ];
    }
}
