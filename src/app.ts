import {TextEditor, WorkspaceConfiguration, window, workspace} from 'vscode';
import {Utils} from './utils';

export default class App {
    private static _instance: App;
    private _config: WorkspaceConfiguration;
    private _composerData: {[k: string]: any};
    private _utils: Utils;

    private constructor() {
        this._utils = Utils.get();
        this._config = workspace.getConfiguration('advanced-php-tools');
        this._composerData = this._utils.composerData();
    }

    public static get instance(): App {
        if (!this._instance) {
            this._instance = new this();
        }

        return this._instance;
    }

    public get utils(): Utils {
        return this._utils;
    }

    public get editor(): TextEditor {
        if (!window.activeTextEditor) {
            throw new Error('There are no active editors');
        }

        const editor: TextEditor = window.activeTextEditor;
        if (editor.document.languageId !== 'php') {
            throw new Error('Not a PHP file');
        }

        return editor;
    }

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

    public config(key: string, defaultValue: any = null): any {
        return this._config.get(key, defaultValue);
    }

    public composer(key: string, defaultValue: any = null): any {
        return this._utils.hasKey(this._composerData, key) ? this._composerData[key] : defaultValue;
    }
}
