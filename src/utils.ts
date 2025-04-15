import {window, workspace, WorkspaceFolder} from 'vscode';
import {platform} from 'os';
import fs from 'fs';
import path from 'path';
import {M_ERROR, M_INFO, M_WARNING} from './constants';
import App from './app';

// * BASE UTILS CLASS
export class Utils {
    protected _workplaceFolder: WorkspaceFolder|null;

    public constructor() {
        if (typeof workspace.workspaceFolders === 'undefined' || workspace.workspaceFolders.length === 0) {
            this._workplaceFolder = null;
        } else {
            [this._workplaceFolder] = workspace.workspaceFolders as Array<WorkspaceFolder>;
        }
    }

    public static get(): Utils {
        // TODO add more specific OS?
        if (platform() === 'win32') {
            return new WinUtils();
        }

        return new Utils();
    }

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

    public capitalizeFirstCharTrimmed(input: string): string {
        const trimmedInput = input.trim();
        if (!trimmedInput) return trimmedInput;

        return trimmedInput.charAt(0).toUpperCase() + trimmedInput.slice(1);
    }

    public hasKey(obj: object, key: string): key is keyof typeof obj {
        return key in obj;
    }

    public get workplacePath(): string {
        return this._workplaceFolder?.uri.path || '';
    }

    public composerData(): {[k: string]: any} {
        const res: {[k: string]: any} = {};
        const composerFile = path.join(this.workplacePath, 'composer.json');
        if (fs.existsSync(composerFile)) {
            const composerFileContent = fs.readFileSync(composerFile, 'utf-8');
            const data = JSON.parse(composerFileContent);

            const phpSrc = data['require']['php'] ?? null;
            res['php-version'] = phpSrc === null ? '7.4' : phpSrc.replace(/.+(\d+\.\d+)/, '$1');

            const psr4data: {[k: string]: string} = data['autoload']['psr-4'];
            res['autoload'] = {};
            Object.keys(psr4data).forEach((k: string) => {
                res['autoload'][k] = this.transformAutoload(psr4data[k]);
            });
        }

        return res;
    }

    public pathToNamespace(fullPath: string): string {
        const autoloadData = App.instance.composer('autoload');
        const relativePath = fullPath.replace(this.workplacePath, '').replace('.php', '').substring(1);
        let result = relativePath;
        Object.keys(autoloadData).forEach((namespaceStart) => {
            const searchString = autoloadData[namespaceStart];
            if (relativePath.startsWith(searchString)) {
                result = relativePath.replace(searchString, namespaceStart).replaceAll('/', '\\');
            }
        });

        return result;
    }

    public splitPath(fullPath: string): [string, string] {
        const lastSlashIndex = fullPath.lastIndexOf(this.slashSymbol);
        if (lastSlashIndex === -1) {
            return ['', fullPath];
        }

        return [fullPath.substring(0, lastSlashIndex), fullPath.substring(lastSlashIndex + 1)];
    }

    public arrayToPhpdoc(data: Array<string>, tab: string = ''): string {
        const res: Array<string> = data.map((v) => `${tab} * ${v}`);
        res.unshift(`${tab}/**`);
        res.push(`${tab} */`);

        return `${res.join('\n')}\n`;
    }

    protected get slashSymbol(): string {
        return '/';
    }

    protected transformAutoload(value: string): string {
        return value;
    }
}

// * REDECLARATIONS FOR WINDOWS
export class WinUtils extends Utils {
    public get workplacePath(): string {
        return this._workplaceFolder?.uri.path.substring(1).replaceAll('/', '\\') || '';
    }

    protected get slashSymbol(): string {
        return '\\';
    }

    protected transformAutoload(value: string): string {
        return value.replace('/', '\\');
    }
}
