import {CodeLens, CodeLensProvider, Range, TextDocument} from 'vscode';
import App from '../app';

export default class SymfonyServicesProvider implements CodeLensProvider {
    public provideCodeLenses(document: TextDocument): Array<CodeLens> {
        const text: string = document.getText();
        const lenses: Array<CodeLens> = [];
        const classMatches = text.matchAll(/^[ \t]*(?:final\s+|abstract\s+)?class\s+(\w+)/gm);

        for (const match of classMatches) {
            const className = match[1] as string;
            const line = document.lineAt(document.positionAt(match.index!).line);
            const range = new Range(line.range.start, line.range.end);

            const namespace = this.extractNamespace(text, line.lineNumber);
            const fqcn = namespace ? `${namespace}\\${className}` : className;

            const serviceLocation = App.instance.getServiceLocation(fqcn);
            if (serviceLocation) {
                lenses.push(new CodeLens(range, {
                    title: '📦 Open in services.yaml',
                    command: 'vscode.open',
                    arguments: [serviceLocation.uri, {
                        selection: new Range(serviceLocation.range.start, serviceLocation.range.start),
                    }],
                }));
            }
        }

        return lenses;
    }

    private extractNamespace(text: string, classLine: number): string|null {
        const namespaceMatch = text.match(/namespace\s+([\w\\]+)\s*;/);

        return namespaceMatch?.[1] ?? null;
    }
}
