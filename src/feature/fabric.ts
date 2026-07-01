import path from 'path';
import {Position, TextEditorEdit} from 'vscode';
import Feature from '../feature';
import {FAB_GENERATE_PHPDOC, FAB_STRICT_TYPES, FABRIC, MESSAGE} from '../constants';
import {pathToNamespace} from '../service/project';

export default class Fabric extends Feature {
    private readonly type: string;
    private readonly name: string;
    private readonly namespace: string;

    public constructor(type: string) {
        super();
        this.type = type;

        const editor = this.activeEditor;
        const [dir, file] = editor ? this.splitPath(editor.document.fileName) : ['', ''];
        this.name = file.replace(/\.php$/, '');
        this.namespace = editor ? pathToNamespace(dir) : '';
    }

    public render() {
        const editor = this.activeEditor;
        if (!editor) {
            this.showMessage('Not a PHP file', MESSAGE.WARNING);

            return;
        }

        try {
            const template = this.template();
            if (template === '') {
                throw new Error('Missing template to render');
            }

            editor.edit((edit: TextEditorEdit) => {
                edit.replace(new Position(0, 0), template);
            });
        } catch (error) {
            this.showMessage(`Error generating object: '${(error as Error).message}'.`, MESSAGE.ERROR);
        }
    }

    private get keyword(): string {
        const data: {[k: string]: string} = {
            [FABRIC.ABSTRACT_CLASS]: 'abstract class',
            [FABRIC.CLASS]: 'class',
            [FABRIC.ENUM]: 'enum',
            [FABRIC.INTERFACE]: 'interface',
            [FABRIC.FINAL_CLASS]: 'final class',
            [FABRIC.TRAIT]: 'trait',
        };

        return data[this.type] || FABRIC.UNDEFINED_TYPE;
    }

    private template(): string {
        const {keyword} = this;
        if (keyword === FABRIC.UNDEFINED_TYPE) {
            return '';
        }

        const addStrictTypes = !!this.getConfig(FAB_STRICT_TYPES, true);
        const strictTypes = addStrictTypes ? 'declare(strict_types=1);\n\n' : '';

        const addPhpdoc = !!this.getConfig(FAB_GENERATE_PHPDOC, false);
        const name = `${this.capitalizeFirstCharTrimmed(keyword)} ${this.name}`;
        const phpdoc = addPhpdoc ? this.arrayToPhpdoc([`${name} description.`]) : '';

        return `<?php\n\n${strictTypes}`
            + `namespace ${this.namespace};\n\n`
            + `${phpdoc}${keyword} ${this.name}\n`
            + '{\n}\n';
    }

    private splitPath(fullPath: string): [string, string] {
        const i = fullPath.lastIndexOf(path.sep);
        if (i === -1) {
            return ['', fullPath];
        }

        return [
            fullPath.substring(0, i),
            fullPath.substring(i + 1),
        ];
    }
}
