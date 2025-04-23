import {CodeLensProvider, Location, Position, Uri, workspace} from 'vscode';
import yaml from 'yaml';
import {SymfonyServicesProvider, SymfonyServicesYamlProvider, SymfonyTemplatesProvider} from './providers';
import App from '../../app';

export default class Symfony {
    public services: Map<string, Location>;
    public used: boolean;

    public constructor(used: boolean) {
        this.used = used;
        this.services = new Map();
    }

    public static checkComposerData(data: any): boolean {
        if (data.require?.['symfony/symfony'] || data.require?.['symfony/framework-bundle']) {
            return true;
        }

        if (data.extra?.['symfony-app-dir'] || data.extra?.['symfony-var-dir']) {
            return true;
        }

        return false;
    }

    public get providers(): Array<{selector: Object, provider: CodeLensProvider}> {
        if (!this.used) {
            return [];
        }

        return [
            {
                selector: {language: 'php'},
                provider: new SymfonyServicesProvider(),
            },
            {
                selector: {language: 'yaml', pattern: '**/config/services.{yml,yaml}'},
                provider: new SymfonyServicesYamlProvider(),
            },
            {
                selector: {language: 'php'},
                provider: new SymfonyTemplatesProvider(),
            },
        ];
    }

    public async updateServices(uri: Uri|null): Promise<void> {
        if (uri === null || !this.used) {
            return;
        }

        const doc = await workspace.openTextDocument(uri);
        const text = doc.getText();
        const parsed = yaml.parse(text);
        this.services.clear();
        if (parsed.services) {
            for (const [serviceId, config] of Object.entries(parsed.services)) {
                if (typeof config === 'object' && (config as any).class) {
                    const fqcn = (config as any).class.trim();
                    const position = this.findServicePosition(text, serviceId);
                    if (position) {
                        this.services.set(fqcn, new Location(uri, position));
                    }
                } else if (App.instance.looksLikeFqcn(serviceId)) {
                    const position = this.findServicePosition(text, serviceId);
                    if (position) {
                        this.services.set(serviceId, new Location(uri, position));
                    }
                }
            }
        }
    }

    public getServiceLocation(fqcn: string): Location|null {
        return this.used ? (this.services.get(fqcn) || null) : null;
    }

    private findServicePosition(text: string, serviceId: string): Position|null {
        if (!this.used) {
            return null;
        }

        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`${serviceId}:`)) {
                return new Position(i, 0);
            }
        }

        return null;
    }
}
