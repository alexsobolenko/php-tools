import {TextEditor, WorkspaceConfiguration, WorkspaceFolder, window, workspace} from 'vscode';
import fs from 'fs';
import path from 'path';
import {IAction} from './interfaces';
import Utils from './utils';
import Resolver from './getters-setters/resolver';
import Builder from './fabric/builder';
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
    F_ABSTRACT_CLASS,
    F_CLASS,
    F_ENUM,
    F_FINAL_CLASS,
    F_INTERFACE,
    F_TRAIT,
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
        if (!window.activeTextEditor) throw new Error('There are no active editors');

        this._editor = window.activeTextEditor;
        if (this._editor.document.languageId !== 'php') throw new Error('Not a PHP file');

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
     * @returns {object}
     */
    public get phpParserParams(): object {
        return {
            parser: {
                extractDoc: true,
                version: App.instance.composer('php-version', '7.4'),
            },
            ast: {
                withPositions: true,
            },
        };
    }

    /**
     * @returns {Array<IAction>}
     */
    public actions(): Array<IAction> {
        return [
            {name: CMD_INSERT_GETTER, handler: () => this.getterSetter([R_GETTER])},
            {name: CMD_INSERT_SETTER, handler: () => this.getterSetter([R_SETTER])},
            {name: CMD_INSERT_GETTER_SETTER, handler: () => this.getterSetter([R_GETTER, R_SETTER])},
            {name: CMD_GENERATE_CLASS, handler: () => this.fabric(F_CLASS)},
            {name: CMD_GENERATE_ABSTRACT_CLASS, handler: () => this.fabric(F_ABSTRACT_CLASS)},
            {name: CMD_GENERATE_FINAL_CLASS, handler: () => this.fabric(F_FINAL_CLASS)},
            {name: CMD_GENERATE_ENUM, handler: () => this.fabric(F_ENUM)},
            {name: CMD_GENERATE_INTERFACE, handler: () => this.fabric(F_INTERFACE)},
            {name: CMD_GENERATE_TRAIT, handler: () => this.fabric(F_TRAIT)},
            {name: CMD_GENERATE_PHPDOC, handler: () => this.phpdoc()},
        ];
    }

    /**
     * @param {Array<string>} items
     */
    private getterSetter(items: Array<string>) {
        const resolver = new Resolver();
        resolver.render(items);
    }

    /**
     * @param {string} type
     */
    private fabric(type: string) {
        const builder = new Builder(type);
        builder.render();
    }

    private phpdoc() {
        const documenter = new Documenter();
        documenter.render();
    }
}
