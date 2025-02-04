import {TextEditor, WorkspaceConfiguration, WorkspaceFolder, window, workspace} from 'vscode';
import fs from 'fs';
import path from 'path';
import {M_ERROR, M_INFO, M_WARNING} from './constants';

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
        return App.instance.hasKey(this._composerData, key) ? this._composerData[key] : defaultValue;
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
     * @param {string} buffer
     * @param {string} type
     */
    public showMessage(buffer: string, type: string = 'info') {
        const message = buffer.replace(/\$\(.+?\)\s\s/, '');
        const data = [M_ERROR, M_INFO, M_WARNING];
        const fcn = data.includes(type) ? type : M_INFO;
        if (fcn === M_ERROR) {
            window.showErrorMessage(message);
        } else if (fcn === M_WARNING) {
            window.showWarningMessage(message);
        } else {
            window.showInformationMessage(message);
        }
    }

    /**
     * @param {any} element
     * @param {number} cnt
     * @returns {Array<any>}
     */
    public fillArray(element: any, cnt: number): Array<any> {
        const res = new Array(cnt);
        res.fill(element);

        return res;
    }

    /**
     * @param {string} element
     * @param {number} cnt
     * @param {string} separator
     * @returns {string}
     */
    public multiplyString(element: string, cnt: number, separator: string = ''): string {
        return this.fillArray(element, cnt).join(separator);
    }

    /**
     * @param {object} obj
     * @param {string} key
     * @returns {key is keyof typeof obj}
     */
    public hasKey(obj: object, key: string): key is keyof typeof obj {
        return key in obj;
    }

    /**
     * @param {string} fullPath
     * @returns {string}
     */
    public pathToNamespace(fullPath: string): string {
        const autoloadData = App.instance.composer('autoload');
        const relativePath = fullPath.replace(App.instance.workplacePath, '').replace('.php', '').substring(1);
        let result = relativePath;
        Object.keys(autoloadData).forEach((namespaceStart) => {
            const searchString = autoloadData[namespaceStart];
            if (relativePath.startsWith(searchString)) {
                result = relativePath.replace(searchString, namespaceStart).replaceAll('/', '\\');
            }
        });

        return result;
    }

    /**
     * @param {string} fullPath
     * @returns {[string, string]}
     */
    public splitPath(fullPath: string): [string, string] {
        const lastSlashIndex = fullPath.lastIndexOf('/');
        if (lastSlashIndex === -1) {
            return ['', fullPath];
        }

        return [fullPath.substring(0, lastSlashIndex), fullPath.substring(lastSlashIndex + 1)];
    }

    /**
     * @param {string} input
     * @returns {string}
     */
    public capitalizeFirstCharTrimmed(input: string): string {
        const trimmedInput = input.trim();
        if (!trimmedInput) return trimmedInput;

        return trimmedInput.charAt(0).toUpperCase() + trimmedInput.slice(1);
    }
}
