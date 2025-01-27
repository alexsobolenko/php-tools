import {Position, TextEditorEdit} from 'vscode';
import App from '../app';
import Utils from '../utils';
import File from './file';

export const B_CLASS = 'b_class';
export const B_ABSTRACT_CLASS = 'b_abstract_class';
export const B_FINAL_CLASS = 'b_final_class';
export const B_INTERFACE = 'b_interface';
export const B_TRAIT = 'b_trait';
export const B_ENUM = 'b_enum';

export default class Builder {
    /**
     * @type {File}
     */
    private _file: File;

    constructor() {
        this._file = new File(App.instance.editor);
    }

    /**
     * @param {string} type
     */
    public render(type: string) {
        const template = this.template(type);
        if (template === '') {
            Utils.instance.showErrorMessage('Missing template to render.');

            return;
        }

        App.instance.editor
            .edit((edit: TextEditorEdit) => {
                edit.replace(new Position(0, 0), template);
            })
            .then((error: any) => {
                Utils.instance.showErrorMessage(`Error generating object: ${error}`);
            });
    }

    /**
     * @returns {File}
     */
    public get file(): File {
        return this._file;
    }

    /**
     * @param {string} type
     * @returns {string}
     */
    private template(type: string): string {
        const data = {
            [B_ABSTRACT_CLASS]: 'abstract class',
            [B_CLASS]: 'class',
            [B_ENUM]: 'enum',
            [B_INTERFACE]: 'interface',
            [B_FINAL_CLASS]: 'final class',
            [B_TRAIT]: 'trait',
        };
        if (!Utils.instance.hasKey(data, type)) return '';

        const addStrictTypes = !!App.instance.config('builder-builder-strict-types', true);
        const strictTypes = addStrictTypes ? `declare(strict_types=1);\n\n` : '';

        const addPhpdoc = !!App.instance.config('builder-generate-phpdoc', false);
        const phpdoc = addPhpdoc
            ? `/**\n * ${Utils.instance.capitalizeFirstCharTrimmed(data[type])} ${this.file.name}\n */\n`
            : '';

        return `<?php\n\n${strictTypes}`
            + `namespace ${this.file.namespace};\n\n`
            + `${phpdoc}${data[type]} ${this.file.name}\n`
            + `{\n}\n`;
    }
}
