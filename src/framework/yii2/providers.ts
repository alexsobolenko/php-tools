import {TextDocument, CodeLens, Range, Command, CodeLensProvider, Uri, Position} from 'vscode';
import path from 'path';
import fs from 'fs';
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

export class Yii2DiProvider implements CodeLensProvider {
    public provideCodeLenses(document: TextDocument): CodeLens[] {
        if (!App.instance.yii2.used || !this.isClassFile(document)) {
            return [];
        }

        const className = this.extractFqcn(document);
        if (!className) {
            return [];
        }

        const classRange = this.findClassDeclaration(document);
        if (!classRange) {
            return [];
        }

        return this.findDiConfigs(className, document).map((config) => {
            const position = new Position(config.line, 0);

            return new CodeLens(classRange, {
                title: '⚙️ DI Config',
                command: 'vscode.open',
                arguments: [Uri.file(config.file), {
                    selection: new Range(position, position),
                }],
            });
        });
    }

    private isClassFile(document: TextDocument): boolean {
        return document.fileName.endsWith('.php') && document.getText().includes('class ');
    }

    private findClassDeclaration(document: TextDocument): Range|null {
        const text = document.getText();
        const classRegex = /class\s+(\w+)/;
        const match = classRegex.exec(text);
        if (match) {
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);

            return new Range(startPos, endPos);
        }

        return null;
    }

    private extractFqcn(document: TextDocument): string|null {
        const text = document.getText();
        const nsMatch = text.match(/namespace\s+([\w\\]+)/);
        const classMatch = text.match(/class\s+(\w+)/);

        return (!nsMatch || !classMatch) ? null : `${nsMatch[1]}\\${classMatch[1]}`;
    }

    private findDiConfigs(className: string, document: TextDocument): Array<{file: string, line: number}> {
        const projectRoot = App.instance.composer('workplacePath');
        const shortName = className.split('\\').pop() || '';
        const results = [];
        for (const configFile of App.instance.yii2.diConfigFiles) {
            const file = path.join(projectRoot, configFile);
            if (!fs.existsSync(file)) {
                continue;
            }

            const content = fs.readFileSync(file, 'utf-8');
            const lines = content.split('\n');
            for (let line = 0; line < lines.length; line++) {
                const lineString = lines[line];
                if (
                    this.isDirectDefinition(lineString, className)
                    || this.isClassConstDefinition(lineString, shortName, content)
                    || this.isComponentClassDefinition(lineString, className)
                    || this.isComponentClassConstDefinition(lineString, shortName, content)
                    || this.isContainerSetDefinition(lineString, className)
                    || this.isContainerSetClassConstDefinition(lineString, shortName, content)
                ) {
                    results.push({file, line});
                }
            }
        }

        return results;
    }

    private isDirectDefinition(line: string, className: string): boolean {
        const regex = new RegExp(`['"]${this.escapeForRegex(className)}['"]\\s*=>\\s*\\[`);

        return regex.test(line);
    }

    private isClassConstDefinition(line: string, shortName: string, content: string): boolean {
        const useStatement = this.findUseStatement(shortName, content);
        if (!useStatement) {
            return false;
        }

        const regex = new RegExp(`${shortName}::class\\s*=>\\s*\\[`);

        return regex.test(line);
    }

    private isComponentClassDefinition(line: string, className: string): boolean {
        const regex = new RegExp(`'class'\\s*=>\\s*['"]${this.escapeForRegex(className)}['"]`);

        return regex.test(line);
    }

    private isComponentClassConstDefinition(line: string, shortName: string, content: string): boolean {
        const useStatement = this.findUseStatement(shortName, content);
        if (!useStatement) {
            return false;
        }

        const regex = new RegExp(`'class'\\s*=>\\s*${shortName}::class`);

        return regex.test(line);
    }

    private isContainerSetDefinition(line: string, className: string): boolean {
        const regex = new RegExp(`Yii::\\$container->set\\(['"]${this.escapeForRegex(className)}['"]`);

        return regex.test(line);
    }

    private isContainerSetClassConstDefinition(line: string, shortName: string, content: string): boolean {
        const useStatement = this.findUseStatement(shortName, content);
        if (!useStatement) {
            return false;
        }

        const regex = new RegExp(`Yii::\\$container->set\\(${shortName}::class`);

        return regex.test(line);
    }

    private findUseStatement(shortName: string, content: string): string | null {
        const useRegex = new RegExp(`use\\s+([\\w\\\\]+${shortName})(?:\\s+as\\s+\\w+)?\\s*;`);
        const match = content.match(useRegex);

        return match ? match[1] : null;
    }

    private escapeForRegex(str: string): string {
        return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }
}

export class Yii2ConfigToClassProvider implements CodeLensProvider {
    public provideCodeLenses(document: TextDocument): CodeLens[] {
        if (!App.instance.yii2.used || !this.isConfigFile(document)) {
            return [];
        }

        const text = document.getText();

        return this.findClassReferences(text, document);
    }

    private isConfigFile(document: TextDocument): boolean {
        const workspaceRoot = App.instance.composer('workplacePath');

        return App.instance.yii2.diConfigFiles.some((file) => document.uri.fsPath === path.join(workspaceRoot, file));
    }

    private findClassReferences(text: string, document: TextDocument): CodeLens[] {
        const lenses: CodeLens[] = [];
        const patterns = [
            /['"]([a-zA-Z][a-zA-Z0-9_\\]+)['"]\s*=>\s*\[/g,
            /([a-zA-Z][a-zA-Z0-9_]+)::class\s*=>\s*\[/g,
            /'class'\s*=>\s*['"]([a-zA-Z][a-zA-Z0-9_\\]+)['"]/g,
            /'class'\s*=>\s*([a-zA-Z][a-zA-Z0-9_]+)::class/g,
            /Yii::\$container->set\(['"]([a-zA-Z][a-zA-Z0-9_\\]+)['"]/g,
            /Yii::\$container->set\(([a-zA-Z][a-zA-Z0-9_]+)::class/g,
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const className = this.resolveClassName(match[1], document);
                if (!className || !this.isProjectClass(className)) continue;

                const classPath = this.findClassFile(className);
                if (!classPath) continue;

                const line = text.substring(0, match.index).split('\n').length - 1;
                const range = new Range(
                    new Position(line, match.index),
                    new Position(line, match.index + match[0].length),
                );

                lenses.push(new CodeLens(range, {
                    title: '📦 Go to Class',
                    command: 'vscode.open',
                    arguments: [Uri.file(classPath)],
                }));
            }
        }

        return lenses;
    }

    private resolveClassName(className: string, document: TextDocument): string|null {
        if (!className.includes('\\')) {
            return this.resolveUseStatement(className, document);
        }

        return className.replace(/^\\/, '');
    }

    private resolveUseStatement(shortName: string, document: TextDocument): string|null {
        const text = document.getText();
        const useRegex = new RegExp(`use\\s+([\\w\\\\]+\\\\)?${shortName}(\\s+as\\s+\\w+)?\\s*;`);
        const match = text.match(useRegex);

        return match ? match[1] + shortName : null;
    }

    private isProjectClass(className: string): boolean {
        const autoload = App.instance.composer('autoload', {});
        for (const prefix of Object.keys(autoload)) {
            if (className.startsWith(prefix)) {
                return true;
            }
        }

        return false;
    }

    private findClassFile(className: string): string | null {
        const autoload = App.instance.composer('autoload');
        const workspaceRoot = App.instance.composer('workplacePath', null);
        if (!workspaceRoot) {
            return null;
        }

        for (const [prefix, paths] of Object.entries(autoload)) {
            if (className.startsWith(prefix)) {
                const relativePath = `${className.slice(prefix.length).replace(/\\/g, '/')}.php`;
                const searchPaths = Array.isArray(paths) ? paths : [paths];
                for (const basePath of searchPaths) {
                    const fullPath = path.join(workspaceRoot, basePath, relativePath);
                    if (fs.existsSync(fullPath)) {
                        return fullPath;
                    }
                }
            }
        }

        return null;
    }
}
