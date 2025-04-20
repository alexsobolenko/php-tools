import {TextDocument, CodeLens, Range, Command, CodeLensProvider, Uri} from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import App from '../../app';

export class Yii2ViewProvider implements CodeLensProvider {
    public async provideCodeLenses(document: TextDocument): Promise<Array<CodeLens>> {
        if (!App.instance.yii2.used) {
            return [];
        }

        const text: string = document.getText();
        const lenses: Array<CodeLens> = [];
        const controllerPath: string = document.uri.fsPath;
        const renderPatterns: Array<RegExp> = [
            /->render\(['"]([^'"]+)['"][^)]*\)/g,
            /->renderPartial\(['"]([^'"]+)['"][^)]*\)/g,
            /->renderAjax\(['"]([^'"]+)['"][^)]*\)/g,
        ];
        for (const pattern of renderPatterns) {
            let match: RegExpExecArray|null;
            while ((match = pattern.exec(text)) !== null) {
                const viewName = match[1] as string;
                const viewPath = await this.resolveViewPath(controllerPath, viewName);
                if (viewPath) {
                    const startPos = document.positionAt(match.index);
                    const endPos = document.positionAt(match.index + match[0].length);
                    lenses.push(this.createViewLens(new Range(startPos, endPos), viewPath));
                }
            }
        }

        return lenses;
    }

    private async resolveViewPath(controllerPath: string, viewName: string): Promise<string|null> {
        const projectRoot = App.instance.composer('workplacePath');
        const controllerDir = path.dirname(controllerPath);
        const cleanViewName = viewName.replace(/^@\w+\//, '');

        const possiblePaths = [
            path.join(projectRoot, 'views', this.getControllerId(controllerPath), `${cleanViewName}.php`),
            path.join(controllerDir.replace(/controllers$/, 'views'), `${cleanViewName}.php`),
            path.join(projectRoot, `${cleanViewName}.php`),
            ...await this.resolveViewAliases(projectRoot, viewName),
        ];

        for (const viewPath of possiblePaths) {
            try {
                if (fs.existsSync(viewPath)) {
                    return viewPath;
                }
            } catch (e) {
                console.error(`Error checking path ${viewPath}:`, e);
            }
        }

        return null;
    }

    private async resolveViewAliases(projectRoot: string, viewName: string): Promise<string[]> {
        const paths = [];
        if (viewName.startsWith('@')) {
            const [alias, ...rest] = viewName.split('/');
            const viewFile = `${rest.join('/')}.php`;
            const aliasPattern = /Yii::setAlias\(['"](@[\w-]+)['"]\s*,\s*['"]([^'"]+)['"]\)/g;
            const aliases: {[k: string]: string} = {
                '@app': 'app',
                '@frontend': 'frontend',
                '@backend': 'backend',
                '@console': 'console',
                '@common': 'common',
            };

            [
                [App.instance.composer('wf'), 'config', 'web.php'],
            ].forEach((f) => {
                const configPath = path.join(...f);
                if (fs.existsSync(configPath)) {
                    let match;
                    const configContent = fs.readFileSync(configPath, 'utf-8');
                    while ((match = aliasPattern.exec(configContent)) !== null) {
                        aliases[match[1] as string] = match[2] as string;
                    }
                }
            });

            if (App.instance.hasKey(aliases, alias)) {
                paths.push(path.join(projectRoot, aliases[alias], 'views', viewFile));
            }
        }

        return paths;
    }

    private getControllerId(controllerPath: string): string {
        return path.basename(controllerPath, 'Controller.php').toLowerCase();
    }

    private createViewLens(range: Range, viewPath: string): CodeLens {
        const command: Command = {
            title: '📄 Open View',
            command: 'vscode.open',
            arguments: [Uri.file(viewPath)],
        };

        return new CodeLens(range, command);
    }
}
