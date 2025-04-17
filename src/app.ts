import {Location, Position, TextEditor, Uri, WorkspaceConfiguration, window, workspace} from 'vscode';
import * as yaml from 'yaml';
import {Utils} from './utils';
import SymfonyServicesProvider from './provider/symfony_services_provider';
import SymfonyTemplatesProvider from './provider/symfony_templates_provider';

export default class App {
    private static _instance: App;
    private _utils: Utils;
    private _config: WorkspaceConfiguration;
    private _composerData: {[k: string]: any};
    private _symfonyServicesProvider: SymfonyServicesProvider;
    private _symfonyServicesMap: Map<string, Location>;
    private _symfonyTemplatesProvider: SymfonyTemplatesProvider;

    private constructor() {
        this._utils = Utils.get();
        this._config = workspace.getConfiguration('advanced-php-tools');
        this._composerData = this._utils.composerData();
        this._symfonyServicesProvider = new SymfonyServicesProvider();
        this._symfonyServicesMap = new Map();
        this._symfonyTemplatesProvider = new SymfonyTemplatesProvider();
    }

    public static get instance(): App {
        if (!this._instance) {
            this._instance = new this();
        }

        return this._instance;
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

    public get utils(): Utils {
        return this._utils;
    }

    public config(key: string, defaultValue: any = null): any {
        return this._config.get(key, defaultValue);
    }

    public composer(key: string, defaultValue: any = null): any {
        return this._utils.hasKey(this._composerData, key) ? this._composerData[key] : defaultValue;
    }

    public get phpParserParams(): object {
        return {
            parser: {
                extractDoc: true,
                version: App.instance.composer('php-version', '7.4'),
            },
            ast: {
                withPositions: true,
            },
        };
    }

    public get symfonyServicesProvider(): SymfonyServicesProvider {
        return this._symfonyServicesProvider;
    }

    public get symfonyTemplatesProvider(): SymfonyTemplatesProvider {
        return this._symfonyTemplatesProvider;
    }

    public async updateSymfonyServices(uri: Uri): Promise<void> {
        const doc = await workspace.openTextDocument(uri);
        const text = doc.getText();
        const parsed = yaml.parse(text);

        this._symfonyServicesMap.clear();
        if (parsed.services) {
            for (const [serviceId, config] of Object.entries(parsed.services)) {
                if (typeof config === 'object' && (config as any).class) {
                    const fqcn = (config as any).class.trim();
                    const position = this.findServicePosition(text, serviceId);
                    if (position) {
                        this._symfonyServicesMap.set(fqcn, new Location(uri, position));
                    }
                } else if (this.looksLikeFqcn(serviceId)) {
                    const position = this.findServicePosition(text, serviceId);
                    if (position) {
                        this._symfonyServicesMap.set(serviceId, new Location(uri, position));
                    }
                }
            }
        }
    }

    public getServiceLocation(fqcn: string): Location|undefined {
        return this._symfonyServicesMap.get(fqcn);
    }

    private findServicePosition(text: string, serviceId: string): Position|undefined {
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`${serviceId}:`)) {
                return new Position(i, 0);
            }
        }

        return undefined;
    }

    private looksLikeFqcn(serviceId: string): boolean {
        return /^[A-Za-z0-9_\\]+$/.test(serviceId);
    }
}
