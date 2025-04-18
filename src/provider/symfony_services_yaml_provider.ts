import {CodeLens, CodeLensProvider, Position, Range, TextDocument, Uri, workspace} from 'vscode';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

export default class SymfonyServicesYamlProvider implements CodeLensProvider {
    public provideCodeLenses(document: TextDocument): Array<CodeLens> {
        const text: string = document.getText();
        const parsed = yaml.parse(text);
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
        if (!classPath) return;

        const range = this.findServiceRange(document, serviceId);
        if (!range) return;

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
