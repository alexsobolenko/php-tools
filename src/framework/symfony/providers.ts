import {CodeLens, CodeLensProvider, Position, Range, TextDocument, Uri, workspace} from 'vscode';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import App from '../../app';
import {nodeName, nodeRange, parsePhp, walkPhp} from '../../utils/php-ast';

export class SymfonyServicesProvider implements CodeLensProvider {
    public provideCodeLenses(document: TextDocument): Array<CodeLens> {
        if (!App.instance.symfony.used) {
            return [];
        }

        const text: string = document.getText();
        let program;
        try {
            program = parsePhp(text);
        } catch (error) {
            App.instance.showMessage(`Failed to parse PHP file: ${error}`, 'warning');

            return [];
        }

        const lenses: Array<CodeLens> = [];
        const namespace = this.extractNamespace(program);

        walkPhp(program, (node) => {
            if (node.kind !== 'class') {
                return;
            }

            const className = nodeName(node.name);
            const range = nodeRange(document, node);
            if (!className || !range) {
                return;
            }

            const fqcn = namespace ? `${namespace}\\${className}` : className;
            const serviceLocation = App.instance.symfony.getServiceLocation(fqcn);
            if (!serviceLocation) {
                return;
            }

            lenses.push(new CodeLens(range, {
                title: '⚙️ Open in services.yaml',
                command: 'vscode.open',
                arguments: [serviceLocation.uri, {
                    selection: new Range(serviceLocation.range.start, serviceLocation.range.start),
                }],
            }));
        });

        return lenses;
    }

    private extractNamespace(program: any): string|null {
        let namespace: string|null = null;

        walkPhp(program, (node) => {
            if (namespace !== null || node.kind !== 'namespace') {
                return;
            }

            namespace = nodeName(node.name);
        });

        return namespace;
    }
}

export class SymfonyServicesYamlProvider implements CodeLensProvider {
    public provideCodeLenses(document: TextDocument): Array<CodeLens> {
        if (!App.instance.symfony.used) {
            return [];
        }

        const text: string = document.getText();
        let parsed;
        try {
            parsed = yaml.parse(text);
        } catch (error) {
            App.instance.showMessage(`Invalid Symfony YAML config: ${error}`, 'warning');

            return [];
        }

        const lenses: Array<CodeLens> = [];

        if (parsed?.services) {
            for (const [serviceId, config] of Object.entries(parsed.services)) {
                if (typeof config === 'object' && (config as any).class) {
                    this.addClassLens(document, serviceId, (config as any).class, lenses);
                } else if (this.isFQCN(serviceId)) {
                    this.addClassLens(document, serviceId, serviceId, lenses);
                }
            }
        }

        return lenses;
    }

    private addClassLens(document: TextDocument, serviceId: string, fqcn: string, lenses: Array<CodeLens>) {
        const classPath = this.fqcnToPath(fqcn);
        if (!classPath) {
            return;
        }

        const range = this.findServiceRange(document, serviceId);
        if (!range) {
            return;
        }

        lenses.push(new CodeLens(range, {
            title: '📦 Go to Class',
            command: 'vscode.open',
            arguments: [Uri.file(classPath)],
        }));
    }

    private fqcnToPath(fqcn: string): string|null {
        if (!workspace.workspaceFolders) {
            return null;
        }

        const relativePath = fqcn.replace(/^@/, '').replace(/\\/g, '/').replace(/^App/, 'src');
        for (const folder of workspace.workspaceFolders) {
            const fullPath = path.join(folder.uri.fsPath, `${relativePath}.php`);
            if (fs.existsSync(fullPath)) {
                return fullPath;
            }
        }

        return null;
    }

    private findServiceRange(document: TextDocument, serviceId: string): Range | null {
        const text = document.getText();
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`${serviceId}:`)) {
                return new Range(new Position(i, 0), new Position(i, serviceId.length));
            }
        }

        return null;
    }

    private isFQCN(serviceId: string): boolean {
        return /^[A-Za-z0-9_\\]+$/.test(serviceId) && serviceId.includes('\\');
    }
}

export class SymfonyTemplatesProvider implements CodeLensProvider {
    public provideCodeLenses(document: TextDocument): Array<CodeLens> {
        if (!App.instance.symfony.used) {
            return [];
        }

        const text = document.getText();
        const lenses: Array<CodeLens> = [];
        const twigPatterns: Array<{pattern: RegExp, index: number}> = [
            {pattern: /(?:->render\(|render\()['"]([^'"]+\.twig)['"]/g, index: 1},
            {pattern: /(\$[\w]+)\s*=\s*['"]([^'"]+\.twig)['"]/g, index: 2},
        ];

        twigPatterns.forEach((t) => {
            const matches = text.matchAll(t.pattern);
            for (const match of matches) {
                const fullPath = this.resolveTemplatePath(match[t.index]);
                if (fullPath) {
                    const range = new Range(
                        document.positionAt(match.index!),
                        document.positionAt(match.index! + match[0].length),
                    );
                    lenses.push(new CodeLens(range, {
                        title: '📝 Open twig template',
                        command: 'vscode.open',
                        arguments: [Uri.file(fullPath)],
                    }));
                }
            }
        });

        return lenses;
    }

    private resolveTemplatePath(templatePath: string): string|null {
        if (!workspace.workspaceFolders) return null;

        const searchPaths = ['templates', 'templates/bundles', 'app/Resources/views'];
        for (const folder of workspace.workspaceFolders) {
            for (const basePath of searchPaths) {
                const fullPath = path.join(
                    folder.uri.fsPath,
                    basePath,
                    templatePath.replace('@', ''),
                );
                if (fs.existsSync(fullPath)) {
                    return fullPath;
                }
            }
        }

        return null;
    }
}
