import {TextEditor, window, workspace} from 'vscode';
import {EXT_ID, MESSAGE} from './constants';

export default abstract class Feature {
    protected getConfig<T>(key: string, defaultValue: T): T {
        return workspace.getConfiguration(EXT_ID).get<T>(key, defaultValue);
    }

    protected get activeEditor(): TextEditor | undefined {
        const editor = window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'php') {
            return undefined;
        }

        return editor;
    }

    protected showMessage(buffer: string, type: string = 'info') {
        const message = buffer.replace(/\$\(.+?\)\s\s/, '');
        const fcn = Object.values(MESSAGE).includes(type) ? type : MESSAGE.INFO;
        if (fcn === MESSAGE.ERROR) {
            window.showErrorMessage(message);
        } else if (fcn === MESSAGE.WARNING) {
            window.showWarningMessage(message);
        } else {
            window.showInformationMessage(message);
        }
    }

    protected uniq<T>(items: T[]): T[] {
        return [...new Set(items)];
    }

    protected capitalizeFirstCharTrimmed(input: string): string {
        const trimmedInput = input.trim();
        if (!trimmedInput) {
            return trimmedInput;
        }

        return trimmedInput.charAt(0).toUpperCase() + trimmedInput.slice(1);
    }

    protected arrayToPhpdoc(data: Array<string>, tab: string = ''): string {
        const res: Array<string> = data.map((v) => `${tab} * ${v}`);
        res.unshift(`${tab}/**`);
        res.push(`${tab} */`);

        return `${res.join('\n')}\n`;
    }
}
