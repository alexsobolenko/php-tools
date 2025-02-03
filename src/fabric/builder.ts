import {Position, TextEditorEdit} from 'vscode';
import File from './file';
import App from '../app';
import Utils from '../utils';
import {A_FAB_GENERATE_PHPDOC, A_FAB_STRICT_TYPES, F_UNDEFINED_TYPE} from '../constants';

export default class Builder {
    /**
     * @type {File}
     */
    private _file: File;

    /**
     * @param {string} type
     */
    constructor(type: string) {
        this._file = new File(type);
    }

    public render() {
        try {
            const template = this.template();
            if (template === '') {
                throw new Error('Missing template to render');
            }

            App.instance.editor.edit((edit: TextEditorEdit) => {
                edit.replace(new Position(0, 0), template);
            });
        } catch (error: any) {
            Utils.instance.showMessage(`Error generating object: '${error.message}'.`, 'error');
        }
    }

    /**
     * @returns {string}
     */
    private template(): string {
        const keyword = this._file.keyword as string;
        let result = '';
        if (keyword !== F_UNDEFINED_TYPE) {
            const addStrictTypes = !!App.instance.config(A_FAB_STRICT_TYPES, true);
            const strictTypes = addStrictTypes ? 'declare(strict_types=1);\n\n' : '';

            const addPhpdoc = !!App.instance.config(A_FAB_GENERATE_PHPDOC, false);
            const name = `${Utils.instance.capitalizeFirstCharTrimmed(keyword)} ${this._file.name}`;
            const phpdoc = addPhpdoc ? `/**\n * ${name}\n */\n` : '';

            result = `<?php\n\n${strictTypes}`
                + `namespace ${this._file.namespace};\n\n`
                + `${phpdoc}${keyword} ${this._file.name}\n`
                + '{\n}\n';
        }

        return result;
    }
}
