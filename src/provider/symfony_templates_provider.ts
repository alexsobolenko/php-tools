import {CodeLens, CodeLensProvider, Range, TextDocument, Uri, workspace} from 'vscode';
import path from 'path';
import fs from 'fs';

export default class SymfonyTemplatesProvider implements CodeLensProvider {
    public provideCodeLenses(document: TextDocument): Array<CodeLens> {
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
