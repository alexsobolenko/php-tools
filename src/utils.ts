import {window} from 'vscode';

export default class Utils
{
    /**
     * @type {Utils}
     */
    private static _instance: Utils;

    private constructor() {}

    /**
     * @returns {Utils}
     */
    public static get instance(): Utils {
        if (!this._instance) {
            this._instance = new this();
        }

        return this._instance;
    }

    /**
     * @param {string} message
     */
    public showErrorMessage(message: string): void {
        window.showErrorMessage(message.replace(/\$\(.+?\)\s\s/, ''));
    }

    /**
     * @param {string} message
     */
    public showInformationMessage(message: string): void {
        window.showInformationMessage(message.replace(/\$\(.+?\)\s\s/, ''));
    }

    /**
     * @param {string} type
     * @returns {string}
     */
    public convertNullable(type: string): string {
        return type.startsWith('?') ? `${type.substring(1)}|null` : type;
    }

    /**
     * @param {string} text
     * @returns {string}
     */
    public stripComments(text: string): string {
        let uncommentedText = '';
        let index = 0;
        while (index !== text.length) {
            if ((text.charAt(index) === '/') && (text.charAt(index + 1) === '*')) {
                if ((index + 2) !== text.length) {
                    index += 2;
                    while ((text.charAt(index) !== '*') && (text.charAt(index + 1) !== '/')) index++;
                }
                index += 2;
            } else if ((text.charAt(index) === '/') && (text.charAt(index + 1) === '/')) {
                while ((text.charAt(index) !== '\n') && (index < text.length)) index++;
            } else {
                uncommentedText = uncommentedText + text.charAt(index);
                index++;
            }
        }

        return uncommentedText;
    }

    /**
     * @param {any} element
     * @param {number} cnt
     * @returns {Array<any>}
     */
    public fillArray(element: any, cnt: number): Array<any>
    {
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
    public multiplyString(element: string, cnt: number, separator: string = ''): string
    {
        return this.fillArray(element, cnt).join(separator);
    }
}
