import App from '../app';
import Utils from '../utils';
import {F_ABSTRACT_CLASS, F_CLASS, F_ENUM, F_FINAL_CLASS, F_INTERFACE, F_TRAIT, F_UNDEFINED_TYPE} from '../constants';

export default class File {
    /**
     * @type {string}
     */
    private _name: string;

    /**
     * @type {string}
     */
    private _namespace: string;

    /**
     * @type {string}
     */
    private _type: string;

    /**
     * @param {string} type
     */
    public constructor(type: string) {
        const nameData = Utils.instance.splitPath(App.instance.editor.document.fileName);
        this._namespace = Utils.instance.pathToNamespace(nameData[0]);
        this._name = nameData[1].replace('.php', '');
        this._type = type;
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
    public get namespace(): string {
        return this._namespace;
    }

    /**
     * @returns {string}
     */
    public get keyword(): string {
        const data = {
            [F_ABSTRACT_CLASS]: 'abstract class',
            [F_CLASS]: 'class',
            [F_ENUM]: 'enum',
            [F_INTERFACE]: 'interface',
            [F_FINAL_CLASS]: 'final class',
            [F_TRAIT]: 'trait',
        };

        return Utils.instance.hasKey(data, this._type) ? data[this._type] : F_UNDEFINED_TYPE;
    }
}
