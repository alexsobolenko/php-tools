import {CodeLens, CodeLensProvider, Command, Position, Range, TextDocument, Uri, window} from 'vscode';
import fs from 'fs';
import path from 'path';
import {
    collectUseStatements,
    nodeName,
    nodeRange,
    parsePhp,
    resolveClassReference,
    tryParsePhp,
    walkPhp,
} from '../../service/php-ast';
import {fqcnToPath, getAutoload, getWorkspacePath} from '../../service/project';
import Yii2 from './service';

function resolveYiiContainerSetClass(node: any, uses: Map<string, string>): string|null {
    if (node.kind !== 'call' || node.what?.kind !== 'propertylookup') {
        return null;
    }

    const methodName = nodeName(node.what.offset);
    const owner = node.what.what;
    if (methodName !== 'set' || owner?.kind !== 'staticlookup') {
        return null;
    }

    if (nodeName(owner.what) !== 'Yii' || nodeName(owner.offset) !== 'container') {
        return null;
    }

    return resolveClassReference(node.arguments?.[0], uses);
}

function resolveYiiConfigClassReference(node: any, uses: Map<string, string>): string|null {
    if (node.kind === 'entry') {
        if (node.value?.kind === 'array') {
            return resolveClassReference(node.key, uses);
        }

        if (nodeName(node.key) === 'class') {
            return resolveClassReference(node.value, uses);
        }
    }

    return resolveYiiContainerSetClass(node, uses);
}

export class Yii2ViewProvider implements CodeLensProvider {
    private aliasCache: {[k: string]: string}|null = null;
    private aliasCacheMtime: number|null = null;

    public constructor(private readonly yii2: Yii2) {}

    public async provideCodeLenses(document: TextDocument): Promise<Array<CodeLens>> {
        if (!this.yii2.used) {
            return [];
        }

        const text: string = document.getText();
        const program = tryParsePhp(text);
        if (program === null) {
            return [];
        }

        const lenses: Array<CodeLens> = [];
        const controllerPath: string = document.uri.fsPath;

        const calls: Array<{name: string, range: Range}> = [];
        walkPhp(program, (node) => {
            if (node.kind !== 'call' || node.what?.kind !== 'propertylookup') {
                return;
            }

            const method = nodeName(node.what.offset);
            const owner = node.what.what;
            const firstArg = node.arguments?.[0];
            const viewName = nodeName(firstArg);
            if (
                !['render', 'renderPartial', 'renderAjax'].includes(method ?? '')
                || nodeName(owner) !== 'this'
                || !viewName
            ) {
                return;
            }

            const range = nodeRange(document, node);
            if (range) {
                calls.push({name: viewName, range});
            }
        });

        for (const call of calls) {
            const viewPath = await this.resolveViewPath(controllerPath, call.name);
            if (viewPath) {
                lenses.push(this.createViewLens(call.range, viewPath));
            }
        }

        return lenses;
    }

    private async resolveViewPath(controllerPath: string, viewName: string): Promise<string|null> {
        const projectRoot = getWorkspacePath();
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
            } catch (error) {
                console.error(`Error checking path ${viewPath}:`, error);
            }
        }

        return null;
    }

    private async resolveViewAliases(projectRoot: string, viewName: string): Promise<Array<string>> {
        const paths = [];
        if (viewName.startsWith('@')) {
            const [alias, ...rest] = viewName.split('/');
            const viewFile = `${rest.join('/')}.php`;
            const aliases = this.loadAliases(projectRoot);

            if (alias in aliases) {
                paths.push(path.join(projectRoot, aliases[alias], 'views', viewFile));
            }
        }

        return paths;
    }

    private loadAliases(projectRoot: string): {[k: string]: string} {
        const configPath = path.join(projectRoot, 'config', 'web.php');
        const defaults: {[k: string]: string} = {
            '@app': 'app',
            '@frontend': 'frontend',
            '@backend': 'backend',
            '@console': 'console',
            '@common': 'common',
        };

        if (!fs.existsSync(configPath)) {
            return defaults;
        }

        const mtime = fs.statSync(configPath).mtimeMs;
        if (this.aliasCache !== null && this.aliasCacheMtime === mtime) {
            return this.aliasCache;
        }

        const aliases = {...defaults};
        const configContent = fs.readFileSync(configPath, 'utf-8');
        let program;
        try {
            program = parsePhp(configContent);
        } catch (error) {
            window.showWarningMessage(`Failed to parse Yii2 config: ${(error as Error).message}`);

            return defaults;
        }

        walkPhp(program, (node) => {
            if (node.kind !== 'call' || node.what?.kind !== 'staticlookup') {
                return;
            }

            const className = nodeName(node.what.what);
            const methodName = nodeName(node.what.offset);
            if (className !== 'Yii' || methodName !== 'setAlias') {
                return;
            }

            const [aliasName, aliasPath] = node.arguments ?? [];
            const resolvedAlias = nodeName(aliasName);
            const resolvedPath = nodeName(aliasPath);
            if (resolvedAlias && resolvedPath) {
                aliases[resolvedAlias] = resolvedPath;
            }
        });

        this.aliasCache = aliases;
        this.aliasCacheMtime = mtime;

        return aliases;
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
    public constructor(private readonly yii2: Yii2) {}

    public provideCodeLenses(document: TextDocument): Array<CodeLens> {
        if (!this.yii2.used) {
            return [];
        }

        const program = tryParsePhp(document.getText());
        if (program === null) {
            return [];
        }

        const className = this.extractFqcn(program);
        if (!className) {
            return [];
        }

        const classRange = this.findClassDeclaration(document, program);
        if (!classRange) {
            return [];
        }

        return this.findDiConfigs(className).map((config) => {
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

    private findClassDeclaration(document: TextDocument, program: any): Range|null {
        let result: Range|null = null;

        walkPhp(program, (node) => {
            if (result !== null || node.kind !== 'class') {
                return;
            }

            result = nodeRange(document, node);
        });

        return result;
    }

    private extractFqcn(program: any): string|null {
        let namespace: string|null = null;
        let className: string|null = null;

        walkPhp(program, (node) => {
            if (namespace === null && node.kind === 'namespace') {
                namespace = nodeName(node.name);
            }

            if (className === null && node.kind === 'class') {
                className = nodeName(node.name);
            }
        });

        return (!namespace || !className) ? null : `${namespace}\\${className}`;
    }

    private findDiConfigs(className: string): Array<{file: string, line: number}> {
        const projectRoot = getWorkspacePath();
        const results: Array<{file: string, line: number}> = [];
        for (const configFile of this.yii2.diConfigFiles) {
            const file = path.join(projectRoot, configFile);
            if (!fs.existsSync(file)) {
                continue;
            }

            const content = fs.readFileSync(file, 'utf-8');
            let program;
            try {
                program = parsePhp(content);
            } catch (error) {
                window.showWarningMessage(`Failed to parse Yii2 config: ${(error as Error).message}`);

                continue;
            }

            const uses = collectUseStatements(program);

            walkPhp(program, (node) => {
                const resolved = resolveYiiConfigClassReference(node, uses);
                if (!resolved || resolved !== className) {
                    return;
                }

                const line = Math.max((node.loc?.start?.offset ?? 0), 0);
                const lineNumber = content.slice(0, line).split('\n').length - 1;
                results.push({file, line: lineNumber});
            });
        }

        return results;
    }
}

export class Yii2ConfigToClassProvider implements CodeLensProvider {
    public constructor(private readonly yii2: Yii2) {}

    public provideCodeLenses(document: TextDocument): Array<CodeLens> {
        if (!this.yii2.used || !this.isConfigFile(document)) {
            return [];
        }

        const text = document.getText();

        return this.findClassReferences(text, document);
    }

    private isConfigFile(document: TextDocument): boolean {
        const workspaceRoot = getWorkspacePath();

        return this.yii2.diConfigFiles.some((file) => document.uri.fsPath === path.join(workspaceRoot, file));
    }

    private findClassReferences(text: string, document: TextDocument): Array<CodeLens> {
        const lenses: Array<CodeLens> = [];
        let program;
        try {
            program = parsePhp(text);
        } catch (error) {
            window.showWarningMessage(`Failed to parse Yii2 config: ${(error as Error).message}`);

            return [];
        }

        const uses = collectUseStatements(program);

        walkPhp(program, (node) => {
            const className = resolveYiiConfigClassReference(node, uses);
            if (!className || !this.isProjectClass(className)) {
                return;
            }

            const classPath = fqcnToPath(className);
            const range = nodeRange(document, node);
            if (!classPath || !range) {
                return;
            }

            lenses.push(new CodeLens(range, {
                title: '📦 Go to Class',
                command: 'vscode.open',
                arguments: [Uri.file(classPath)],
            }));
        });

        return lenses;
    }

    private isProjectClass(className: string): boolean {
        const autoload = getAutoload();

        return Object.keys(autoload).some((prefix) => className.startsWith(prefix));
    }
}
