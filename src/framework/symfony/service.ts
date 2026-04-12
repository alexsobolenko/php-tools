import {CodeLensProvider, CompletionItemProvider, Location, Position, Uri, workspace} from 'vscode';
import yaml from 'yaml';
import {
    SymfonyDoctrineEntityFieldsProvider,
    SymfonyRouteReferencesProvider,
    SymfonyServiceArgumentsProvider,
    SymfonyServicesProvider,
    SymfonyServicesYamlProvider,
    SymfonyTemplatesProvider,
} from './providers';
import App from '../../app';

export default class Symfony {
    public routes: Map<string, Location>;
    public services: Map<string, Location>;
    public used: boolean;
    private routesLoaded: boolean;

    public constructor(used: boolean) {
        this.used = used;
        this.routes = new Map();
        this.routesLoaded = false;
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
            {
                selector: {language: 'twig'},
                provider: new SymfonyTemplatesProvider(),
            },
            {
                selector: {language: 'php'},
                provider: new SymfonyRouteReferencesProvider(),
            },
            {
                selector: {language: 'twig'},
                provider: new SymfonyRouteReferencesProvider(),
            },
        ];
    }

    public get completionProviders(): Array<{selector: Object, provider: CompletionItemProvider, triggers?: string[]}> {
        if (!this.used) {
            return [];
        }

        return [
            {
                selector: {language: 'yaml', pattern: '**/config/services.{yml,yaml}'},
                provider: new SymfonyServiceArgumentsProvider(),
                triggers: ['$'],
            },
            {
                selector: {language: 'php'},
                provider: new SymfonyDoctrineEntityFieldsProvider(),
                triggers: ['.'],
            },
        ];
    }

    public async updateServices(uri: Uri|null): Promise<void> {
        if (uri === null || !this.used) {
            return;
        }

        const doc = await workspace.openTextDocument(uri);
        const text = doc.getText();
        this.services.clear();
        let parsed;
        try {
            parsed = yaml.parse(text);
        } catch (error) {
            return;
        }

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

    public async getServicesConfigUri(): Promise<Uri|null> {
        if (!this.used || !workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
            return null;
        }

        const candidates = ['config/services.yaml', 'config/services.yml', 'app/config/services.yaml'];
        for (const candidate of candidates) {
            try {
                const uri = Uri.joinPath(workspace.workspaceFolders[0].uri, candidate);
                await workspace.fs.stat(uri);

                return uri;
            } catch (e) {}
        }

        return null;
    }

    public async createService(fqcn: string): Promise<Location|null> {
        const existingLocation = this.getServiceLocation(fqcn);
        if (existingLocation) {
            return existingLocation;
        }

        const uri = await this.resolveServicesConfigUri();
        const document = await workspace.openTextDocument(uri);
        const text = document.getText();
        const insertion = this.buildServiceInsertion(text, fqcn);
        const updatedText = `${text.slice(0, insertion.offset)}${insertion.content}${text.slice(insertion.offset)}`;
        await workspace.fs.writeFile(uri, Buffer.from(updatedText, 'utf8'));

        try {
            await this.updateServices(uri);
        } catch (e) {}

        return this.getServiceLocation(fqcn) || new Location(uri, new Position(insertion.line, 0));
    }

    public async getRouteLocation(routeName: string): Promise<Location|null> {
        if (!this.used) {
            return null;
        }

        if (!this.routesLoaded) {
            await this.updateRoutes();
        }

        return this.routes.get(routeName) || null;
    }

    public invalidateRoutes(): void {
        this.routesLoaded = false;
        this.routes.clear();
    }

    public async updateRoutes(): Promise<void> {
        if (!this.used) {
            return;
        }

        this.routes.clear();
        this.routesLoaded = true;

        const files = await workspace.findFiles('**/*.php', '**/{vendor,node_modules,var,cache}/**');
        for (const file of files) {
            const doc = await workspace.openTextDocument(file);
            this.collectRoutes(doc.getText(), file);
        }
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

    private async resolveServicesConfigUri(): Promise<Uri> {
        const existingUri = await this.getServicesConfigUri();
        if (existingUri) {
            return existingUri;
        }

        if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
            throw new Error('Workspace folder is not available');
        }

        const uri = Uri.joinPath(workspace.workspaceFolders[0].uri, 'config/services.yaml');
        await workspace.fs.createDirectory(Uri.joinPath(workspace.workspaceFolders[0].uri, 'config'));
        await workspace.fs.writeFile(uri, Buffer.from('services:\n', 'utf8'));

        return uri;
    }

    private buildServiceInsertion(text: string, fqcn: string): {offset: number, content: string, line: number} {
        const serviceBlock = `    ${fqcn}:\n        class: ${fqcn}\n`;
        const servicesMatch = text.match(/^services\s*:\s*$/mu);
        if (!servicesMatch || typeof servicesMatch.index === 'undefined') {
            const prefix = text.length > 0 && !text.endsWith('\n') ? '\n' : '';
            const offset = text.length;

            return {
                offset,
                content: `${prefix}services:\n${serviceBlock}`,
                line: this.offsetToLine(text, offset) + (prefix ? 1 : 0) + 1,
            };
        }

        const offset = this.findServicesInsertionOffset(text, servicesMatch.index + servicesMatch[0].length);
        const prefix = offset > 0 && text[offset - 1] !== '\n' ? '\n' : '';
        const blankLine = this.hasExistingServices(text, offset) ? '\n' : '';

        return {
            offset,
            content: `${prefix}${blankLine}${serviceBlock}`,
            line: this.offsetToLine(text, offset) + (prefix ? 1 : 0) + (blankLine ? 1 : 0),
        };
    }

    private findServicesInsertionOffset(text: string, fromOffset: number): number {
        const lines = text.split('\n');
        let offset = 0;
        let insideServices = false;
        let insertionOffset = text.length;

        for (const line of lines) {
            if (!insideServices) {
                if (/^services\s*:\s*$/u.test(line.trim())) {
                    insideServices = true;
                }

                offset += line.length + 1;
                continue;
            }

            if (line.trim() && !line.startsWith(' ')) {
                insertionOffset = offset;
                break;
            }

            offset += line.length + 1;
        }

        return insertionOffset;
    }

    private offsetToLine(text: string, offset: number): number {
        return text.slice(0, offset).split('\n').length - 1;
    }

    private hasExistingServices(text: string, offset: number): boolean {
        const before = text.slice(0, offset);
        const servicesIndex = before.lastIndexOf('services:');
        if (servicesIndex === -1) {
            return false;
        }

        const body = before.slice(servicesIndex + 'services:'.length);

        return body.split('\n').some((line) => line.trim().length > 0);
    }

    private collectRoutes(text: string, uri: Uri): void {
        const patterns = [
            {
                pattern: /#\[\s*(?:\\?[\w\\]+\\)?Route\s*\(([\s\S]*?)\)\s*\]/g,
                namePattern: /(?:^|[,(]\s*)name\s*:\s*['"]([^'"]+)['"]/u,
            },
            {
                pattern: /@Route\s*\(([\s\S]*?)\)/g,
                namePattern: /(?:^|[,(]\s*)name\s*=\s*['"]([^'"]+)['"]/u,
                normalizeArgs: (args: string) => args
                    .split('\n')
                    .map((line) => line.replace(/^\s*\*\s?/u, '').trim())
                    .join(' '),
            },
        ];

        patterns.forEach(({pattern, namePattern, normalizeArgs}) => {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                const args = normalizeArgs ? normalizeArgs(match[1] ?? '') : (match[1] ?? '');
                const routeMatch = args.match(namePattern);
                const routeName = routeMatch?.[1];
                if (!routeName) {
                    continue;
                }

                const methodOffset = this.findNextMethodOffset(text, (match.index ?? 0) + match[0].length);
                if (methodOffset === null) {
                    continue;
                }

                const lineNumber = text.slice(0, methodOffset).split('\n').length - 1;
                this.routes.set(routeName, new Location(uri, new Position(lineNumber, 0)));
            }
        });
    }

    private findNextMethodOffset(text: string, fromOffset: number): number | null {
        const methodRegex = /function\s+\w+\s*\(/g;
        methodRegex.lastIndex = fromOffset;
        const match = methodRegex.exec(text);

        return match?.index ?? null;
    }
}
