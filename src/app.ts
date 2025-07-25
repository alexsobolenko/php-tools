import {CodeLensProvider, TextEditor, WorkspaceConfiguration, WorkspaceFolder, window, workspace} from 'vscode';
import fs from 'fs';
import path from 'path';
import {M_ERROR, M_INFO, M_WARNING} from './constants';
import Symfony from './framework/symfony/service';
import Yii2 from './framework/yii2/service';

export default class App {
    private static _instance: App;
    private _config: WorkspaceConfiguration;
    private _project: Map<string, any>|null;
    private _symfony: Symfony;
    private _yii2: Yii2;

    private constructor() {
        this._config = workspace.getConfiguration('advanced-php-tools');

        let isSymfonyUsed = false;
        let isYii2Used = false;
        this._project = new Map();
        const workspaceFolders = workspace.workspaceFolders as Array<WorkspaceFolder>;
        if (typeof workspaceFolders !== 'undefined' && workspaceFolders.length > 0) {
            const wf = workspaceFolders[0].uri.fsPath;
            this._project.set('workplacePath', wf);

            const composerFile = path.join(wf, 'composer.json');
            if (fs.existsSync(composerFile)) {
                const composerFileContent = fs.readFileSync(composerFile, 'utf-8');
                const data = JSON.parse(composerFileContent);
                isSymfonyUsed = Symfony.checkComposerData(data);
                isYii2Used = Yii2.checkComposerData(data);

                const phpSrc = data['require']['php'] ?? null;
                const phpVerCleaned = phpSrc.trim().replace(/^[~^<>=\s]+/, '');
                const phpVerMatch = phpVerCleaned.match(/^(\d+)\.(\d+)/);
                const phpVersion = phpVerMatch ? `${phpVerMatch[1]}.${phpVerMatch[2]}` : '7.4';
                this._project.set('php-version', phpVersion);

                this._project.set('php-parser-params', {
                    parser: {extractDoc: true, version: phpVersion},
                    ast: {withPositions: true},
                });

                const autoloadPsr4 = (data['autoload'] || {})['psr-4'] || [];
                const autoloadPsr4Dev = (data['autoload-dev'] || {})['psr-4'] || [];
                const autoloadPaths = {...autoloadPsr4, ...autoloadPsr4Dev};

                if (isYii2Used) {
                    const possiblePaths = [
                        {ns: 'app\\', dir: ''},
                        {ns: 'app\\', dir: 'app/'},
                        {ns: 'backend\\', dir: 'backend/'},
                        {ns: 'frontend\\', dir: 'frontend/'},
                        {ns: 'console\\', dir: 'console/'},
                    ];
                    for (const {ns, dir} of possiblePaths) {
                        const controllersPath = path.join(wf, dir, 'controllers');
                        const modelsPath = path.join(wf, dir, 'models');
                        if (fs.existsSync(controllersPath) || fs.existsSync(modelsPath)) {
                            autoloadPaths[ns] = dir;
                        }
                    }
                }

                this._project.set('autoload', autoloadPaths);
            }
        }

        this._symfony = new Symfony(isSymfonyUsed);
        this._yii2 = new Yii2(isYii2Used);
    }

    public static get instance(): App {
        if (!this._instance) {
            this._instance = new this();
        }

        return this._instance;
    }

    public get symfony(): Symfony {
        return this._symfony;
    }

    public get yii2(): Yii2 {
        return this._yii2;
    }

    public get providers(): Array<{selector: Object, provider: CodeLensProvider}> {
        return [
            ...this._symfony.providers,
            ...this._yii2.providers,
        ];
    }

    public get editor(): TextEditor {
        if (!window.activeTextEditor) {
            throw new Error('There are no active editors');
        }

        const editor: TextEditor = window.activeTextEditor;
        if (editor.document.languageId !== 'php') {
            throw new Error('Not a PHP file');
        }

        return editor;
    }

    public config(key: string, defaultValue: any = null): any {
        return this._config.get(key, defaultValue);
    }

    public composer(key: string, defaultValue: any = null): any {
        return this._project?.get(key) || defaultValue;
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

    public fillArray(element: any, cnt: number): Array<any> {
        const res = new Array(cnt);
        res.fill(element);

        return res;
    }

    public multiplyString(element: string, cnt: number, separator: string = ''): string {
        return this.fillArray(element, cnt).join(separator);
    }

    public hasKey(obj: object, key: string): key is keyof typeof obj {
        return key in obj;
    }

    public pathToNamespace(fullPath: string): string {
        const normalizedPath = fullPath.replace(/\\/g, '/');
        const normalizedWorkplace = App.instance.composer('workplacePath', '');
        const autoloadData = App.instance.composer('autoload', {});
        const relativePath = path.relative(normalizedWorkplace, normalizedPath).replace('.php', '').replace(/\\/g, '/');
        let result = relativePath;
        Object.entries(autoloadData).forEach(([namespaceStart, searchPath]) => {
            const normalizedSearchPath = (searchPath as string).replace(/\\/g, '/');
            if (relativePath.startsWith(normalizedSearchPath)) {
                result = namespaceStart + relativePath.slice(normalizedSearchPath.length).replace(/\//g, '\\');
            }
        });

        return result;
    }

    public splitPath(fullPath: string): [string, string] {
        const i = fullPath.lastIndexOf(path.sep);

        return (i === -1) ? ['', fullPath] : [fullPath.substring(0, i), fullPath.substring(i + 1)];
    }

    public capitalizeFirstCharTrimmed(input: string): string {
        const trimmedInput = input.trim();
        if (!trimmedInput) return trimmedInput;

        return trimmedInput.charAt(0).toUpperCase() + trimmedInput.slice(1);
    }

    public arrayToPhpdoc(data: Array<string>, tab: string = ''): string {
        const res: Array<string> = data.map((v) => `${tab} * ${v}`);
        res.unshift(`${tab}/**`);
        res.push(`${tab} */`);

        return `${res.join('\n')}\n`;
    }

    public looksLikeFqcn(serviceId: string): boolean {
        return /^[A-Za-z0-9_\\]+$/.test(serviceId);
    }
}
