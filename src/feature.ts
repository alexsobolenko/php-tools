import {TextEditor, window, workspace} from 'vscode';
import {EXT_ID, MESSAGE} from './constants';
import {arrayToPhpdoc, capitalizeFirstCharTrimmed} from './service/text';

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
        return capitalizeFirstCharTrimmed(input);
    }

    protected arrayToPhpdoc(data: Array<string>, tab: string = ''): string {
        return arrayToPhpdoc(data, tab);
    }
}
