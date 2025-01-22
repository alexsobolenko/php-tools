import {TextEditor} from 'vscode';
import Utils from '../utils';

export default class File {
    /**
     * @type {string}
     */
    private _name: string;

    /**
     * @type {string}
     */
    private _namespace: string;

    public constructor(editor: TextEditor) {
        const nameData = Utils.instance.splitPath(editor.document.fileName);
        this._namespace = Utils.instance.pathToNamespace(nameData[0]);
        this._name = nameData[1].replace('.php', '');
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
    public get namespace(): string {
        return this._namespace;
    }

    /**
     * @param {string} namespace
     */
    public set namespace(namespace: string) {
        this._namespace = namespace;
    }
}
