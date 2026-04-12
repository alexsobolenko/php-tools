import {
    CodeLens,
    CodeLensProvider,
    CompletionItem,
    CompletionItemKind,
    CompletionItemProvider,
    Position,
    Range,
    TextDocument,
    Uri,
    workspace,
} from 'vscode';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import App from '../../app';
import {CMD_SYMFONY_CREATE_SERVICE} from '../../constants';
import {
    collectUseStatements,
    nodeName,
    nodeRange,
    resolveClassReference,
    tryParsePhp,
    walkPhp,
} from '../../utils/php-ast';

export class SymfonyServicesProvider implements CodeLensProvider {
    public provideCodeLenses(document: TextDocument): Array<CodeLens> {
        if (!App.instance.symfony.used) {
            return [];
        }

        const text: string = document.getText();
        const program = tryParsePhp(text);
        if (program === null) {
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
            if (serviceLocation) {
                lenses.push(new CodeLens(range, {
                    title: '⚙️ Open in services.yaml',
                    command: 'vscode.open',
                    arguments: [serviceLocation.uri, {
                        selection: new Range(serviceLocation.range.start, serviceLocation.range.start),
                    }],
                }));

                return;
            }

            lenses.push(new CodeLens(range, {
                title: '➕ Create in services.yaml',
                command: CMD_SYMFONY_CREATE_SERVICE,
                arguments: [fqcn],
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
        const references = document.languageId === 'twig'
            ? this.findTwigTemplateReferences(text, document)
            : this.findPhpTemplateReferences(text, document);
        const lenses: Array<CodeLens> = [];
        references.forEach((reference) => {
            const fullPath = this.resolveTemplatePath(reference.templatePath);
            if (!fullPath) {
                return;
            }

            lenses.push(new CodeLens(reference.range, {
                title: '📝 Open twig template',
                command: 'vscode.open',
                arguments: [Uri.file(fullPath)],
            }));
        });

        return lenses;
    }

    private findPhpTemplateReferences(
        text: string,
        document: TextDocument,
    ): Array<{templatePath: string, range: Range}> {
        return this.collectTemplateReferences(
            [
                {pattern: /(?:->render\(|render\()['"]([^'"]+\.twig)['"]/g, index: 1},
                {pattern: /(\$[\w]+)\s*=\s*['"]([^'"]+\.twig)['"]/g, index: 2},
            ],
            text,
            document,
        );
    }

    private findTwigTemplateReferences(
        text: string,
        document: TextDocument,
    ): Array<{templatePath: string, range: Range}> {
        return this.collectTemplateReferences(
            [
                {pattern: /\{%\s*extends\s+['"]([^'"]+\.twig)['"]\s*%\}/g, index: 1},
                {pattern: /\{%\s*include\s+['"]([^'"]+\.twig)['"](?:\s+with\b[\s\S]*?)?\s*%\}/g, index: 1},
            ],
            text,
            document,
        );
    }

    private collectTemplateReferences(
        patterns: Array<{pattern: RegExp, index: number}>,
        text: string,
        document: TextDocument,
    ): Array<{templatePath: string, range: Range}> {
        const references: Array<{templatePath: string, range: Range}> = [];

        patterns.forEach(({pattern, index}) => {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                const templatePath = match[index];
                if (!templatePath) {
                    continue;
                }

                const matchOffset = match.index ?? 0;
                const templateOffset = match[0].indexOf(templatePath);
                const start = document.positionAt(matchOffset + templateOffset);
                const end = document.positionAt(matchOffset + templateOffset + templatePath.length);
                references.push({
                    templatePath,
                    range: new Range(start, end),
                });
            }
        });

        return references;
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

export class SymfonyRouteReferencesProvider implements CodeLensProvider {
    public async provideCodeLenses(document: TextDocument): Promise<Array<CodeLens>> {
        if (!App.instance.symfony.used) {
            return [];
        }

        const text = document.getText();
        const references = document.languageId === 'twig'
            ? this.findTwigRouteReferences(text, document)
            : this.findPhpRouteReferences(text, document);

        const lenses: Array<CodeLens> = [];
        for (const reference of references) {
            const location = await App.instance.symfony.getRouteLocation(reference.routeName);
            if (!location) {
                continue;
            }

            lenses.push(new CodeLens(reference.range, {
                title: '🛣️ Open route action',
                command: 'vscode.open',
                arguments: [location.uri, {
                    selection: new Range(location.range.start, location.range.start),
                }],
            }));
        }

        return lenses;
    }

    private findPhpRouteReferences(text: string, document: TextDocument): Array<{routeName: string, range: Range}> {
        const patterns = [
            /redirectToRoute\(\s*['"]([^'"]+)['"]/g,
            /generateUrl\(\s*['"]([^'"]+)['"]/g,
            /->generate\(\s*['"]([^'"]+)['"]/g,
        ];

        return this.collectRouteReferences(patterns, text, document);
    }

    private findTwigRouteReferences(text: string, document: TextDocument): Array<{routeName: string, range: Range}> {
        const patterns = [
            /path\(\s*['"]([^'"]+)['"]/g,
            /url\(\s*['"]([^'"]+)['"]/g,
            /route\(\s*['"]([^'"]+)['"]/g,
        ];

        return this.collectRouteReferences(patterns, text, document);
    }

    private collectRouteReferences(
        patterns: Array<RegExp>,
        text: string,
        document: TextDocument,
    ): Array<{routeName: string, range: Range}> {
        const references: Array<{routeName: string, range: Range}> = [];

        patterns.forEach((pattern) => {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                const [, routeName] = match;
                const matchOffset = match.index ?? 0;
                const routeOffset = match[0].indexOf(routeName);
                const start = document.positionAt(matchOffset + routeOffset);
                const end = document.positionAt(matchOffset + routeOffset + routeName.length);
                references.push({
                    routeName,
                    range: new Range(start, end),
                });
            }
        });

        return references;
    }
}

export class SymfonyServiceArgumentsProvider implements CompletionItemProvider {
    public async provideCompletionItems(
        document: TextDocument,
        position: Position,
    ): Promise<Array<CompletionItem>> {
        if (!App.instance.symfony.used) {
            return [];
        }

        const context = this.findArgumentsContext(document, position);
        if (!context) {
            return [];
        }

        const argumentNames = await this.loadConstructorArguments(context.fqcn);
        if (argumentNames.length === 0) {
            return [];
        }

        const existingArguments = this.collectExistingArguments(document, context);

        return argumentNames
            .filter((name) => !existingArguments.has(name))
            .map((name) => this.createArgumentItem(document, position, name));
    }

    private findArgumentsContext(
        document: TextDocument,
        position: Position,
    ): {argumentsLine: number, argumentsIndent: number, serviceLine: number, fqcn: string} | null {
        const lines = document.getText().split('\n');
        let argumentsLine = -1;
        let argumentsIndent = -1;

        for (let lineIndex = position.line; lineIndex >= 0; lineIndex--) {
            const line = lines[lineIndex] ?? '';
            if (!line.trim()) {
                continue;
            }

            const trimmed = line.trim();
            if (/^arguments\s*:\s*$/u.test(trimmed)) {
                argumentsLine = lineIndex;
                argumentsIndent = this.lineIndent(line);
                break;
            }
        }

        if (argumentsLine === -1) {
            return null;
        }

        for (let lineIndex = argumentsLine + 1; lineIndex <= position.line; lineIndex++) {
            const line = lines[lineIndex] ?? '';
            if (!line.trim()) {
                continue;
            }

            if (this.lineIndent(line) <= argumentsIndent) {
                return null;
            }
        }

        const serviceLine = this.findServiceLine(lines, argumentsLine, argumentsIndent);
        if (serviceLine === -1) {
            return null;
        }

        const fqcn = this.resolveServiceClass(lines, serviceLine);

        return fqcn ? {argumentsLine, argumentsIndent, serviceLine, fqcn} : null;
    }

    private findServiceLine(lines: Array<string>, argumentsLine: number, argumentsIndent: number): number {
        for (let lineIndex = argumentsLine - 1; lineIndex >= 0; lineIndex--) {
            const line = lines[lineIndex] ?? '';
            if (!line.trim()) {
                continue;
            }

            const indent = this.lineIndent(line);
            if (indent >= argumentsIndent) {
                continue;
            }

            if (/^[^#][^:]+:\s*$/u.test(line.trim())) {
                return lineIndex;
            }
        }

        return -1;
    }

    private resolveServiceClass(lines: Array<string>, serviceLine: number): string | null {
        const serviceLineText = lines[serviceLine] ?? '';
        const serviceIndent = this.lineIndent(serviceLineText);
        const serviceId = this.extractYamlKey(serviceLineText);
        if (!serviceId) {
            return null;
        }

        if (App.instance.looksLikeFqcn(serviceId) && serviceId.includes('\\')) {
            return serviceId;
        }

        for (let lineIndex = serviceLine + 1; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex] ?? '';
            if (!line.trim()) {
                continue;
            }

            const indent = this.lineIndent(line);
            if (indent <= serviceIndent) {
                break;
            }

            const classMatch = line.match(/^\s*class\s*:\s*['"]?([^'"]+)['"]?\s*$/u);
            if (classMatch?.[1]) {
                return classMatch[1].trim();
            }
        }

        return null;
    }

    private async loadConstructorArguments(fqcn: string): Promise<Array<string>> {
        const classPath = this.fqcnToPath(fqcn);
        if (!classPath || !fs.existsSync(classPath)) {
            return [];
        }

        const document = await workspace.openTextDocument(Uri.file(classPath));
        const program = tryParsePhp(document.getText());
        if (program === null) {
            return [];
        }

        let result: Array<string> = [];
        walkPhp(program, (node, parent) => {
            if (result.length > 0 || node.kind !== 'method' || nodeName(node.name) !== '__construct') {
                return;
            }

            if (parent?.kind !== 'class') {
                return;
            }

            const className = nodeName(parent.name);
            const namespace = parent?.loc ? this.extractNamespace(program) : null;
            const resolvedFqcn = className
                ? (namespace ? `${namespace}\\${className}` : className)
                : null;
            if (resolvedFqcn !== fqcn) {
                return;
            }

            result = (node.arguments ?? [])
                .map((argument: any) => nodeName(argument.name))
                .filter((name: string | null): name is string => !!name)
                .map((name: string) => `$${name}`);
        });

        return result;
    }

    private collectExistingArguments(
        document: TextDocument,
        context: {argumentsLine: number, argumentsIndent: number},
    ): Set<string> {
        const lines = document.getText().split('\n');
        const existing = new Set<string>();

        for (let lineIndex = context.argumentsLine + 1; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex] ?? '';
            if (!line.trim()) {
                continue;
            }

            const indent = this.lineIndent(line);
            if (indent <= context.argumentsIndent) {
                break;
            }

            const key = this.extractYamlKey(line);
            if (key?.startsWith('$')) {
                existing.add(key);
            }
        }

        return existing;
    }

    private createArgumentItem(document: TextDocument, position: Position, name: string): CompletionItem {
        const item = new CompletionItem(name, CompletionItemKind.Variable);
        const range = document.getWordRangeAtPosition(position, /\$[\w]*/u);
        item.range = range ?? new Range(position, position);
        item.insertText = `${name}: `;
        item.detail = 'Symfony constructor argument';

        return item;
    }

    private extractNamespace(program: any): string | null {
        let namespace: string | null = null;

        walkPhp(program, (node) => {
            if (namespace !== null || node.kind !== 'namespace') {
                return;
            }

            namespace = nodeName(node.name);
        });

        return namespace;
    }

    private extractYamlKey(line: string): string | null {
        const match = line.match(/^\s*(['"]?)([^'":]+(?:\\[^'":]+)*)\1\s*:\s*$/u);

        return match?.[2]?.trim() ?? null;
    }

    private fqcnToPath(fqcn: string): string | null {
        const autoload = App.instance.composer('autoload', {});
        const workplacePath = App.instance.composer('workplacePath', null);
        if (!workplacePath) {
            return null;
        }

        for (const [prefix, paths] of Object.entries(autoload)) {
            if (!fqcn.startsWith(prefix)) {
                continue;
            }

            const relativePath = `${fqcn.slice(prefix.length).replace(/\\/g, '/')}.php`;
            const searchPaths = Array.isArray(paths) ? paths : [paths];
            for (const basePath of searchPaths) {
                const fullPath = path.join(workplacePath, basePath as string, relativePath);
                if (fs.existsSync(fullPath)) {
                    return fullPath;
                }
            }
        }

        return null;
    }

    private lineIndent(line: string): number {
        const match = line.match(/^(\s*)/u);

        return match?.[1].length ?? 0;
    }
}

export class SymfonyDoctrineEntityFieldsProvider implements CompletionItemProvider {
    private entityFieldsCache = new Map<string, {mtime: number, fields: Array<string>}>();
    private relationTargetCache = new Map<string, {mtime: number, target: string | null}>();

    public async provideCompletionItems(
        document: TextDocument,
        position: Position,
    ): Promise<Array<CompletionItem>> {
        if (!App.instance.symfony.used || document.languageId !== 'php') {
            return [];
        }

        const aliasContext = this.findAliasContext(document, position);
        if (!aliasContext) {
            return [];
        }

        const program = tryParsePhp(document.getText());
        if (program === null) {
            return [];
        }

        const entityFqcn = this.resolveEntityForAlias(program, document.uri.fsPath, position.line, aliasContext.alias);
        if (!entityFqcn) {
            return [];
        }

        const fields = await this.loadEntityFields(entityFqcn);
        if (fields.length === 0) {
            return [];
        }

        return fields
            .filter((field) => field.startsWith(aliasContext.prefix))
            .map((field) => this.createFieldItem(document, position, aliasContext.prefix, field, entityFqcn));
    }

    private findAliasContext(
        document: TextDocument,
        position: Position,
    ): {alias: string, prefix: string} | null {
        const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
        const match = linePrefix.match(/([A-Za-z_]\w*)\.([A-Za-z_]\w*)?$/u);
        if (!match) {
            return null;
        }

        return {
            alias: match[1],
            prefix: match[2] ?? '',
        };
    }

    private resolveEntityForAlias(program: any, filePath: string, line: number, alias: string): string | null {
        const namespace = this.extractNamespace(program);
        const uses = collectUseStatements(program);
        const currentClass = this.findCurrentClass(program, line);
        if (!currentClass) {
            return null;
        }

        const repositoryEntity = this.resolveRepositoryEntity(currentClass, filePath, namespace, uses);
        if (!repositoryEntity) {
            return null;
        }

        const currentMethod = this.findCurrentMethod(currentClass, line);
        const methodAliases = this.collectAliases(currentMethod, repositoryEntity, namespace, uses);
        if (methodAliases.has(alias)) {
            return methodAliases.get(alias) ?? null;
        }

        const classAliases = this.collectAliases(currentClass, repositoryEntity, namespace, uses);

        return classAliases.get(alias) ?? null;
    }

    private findCurrentClass(program: any, line: number): any | null {
        let result: any | null = null;

        walkPhp(program, (node) => {
            if (result !== null || node.kind !== 'class' || !this.nodeContainsLine(node, line)) {
                return;
            }

            result = node;
        });

        return result;
    }

    private findCurrentMethod(classNode: any, line: number): any | null {
        for (const node of classNode.body ?? []) {
            if (node.kind === 'method' && this.nodeContainsLine(node, line)) {
                return node;
            }
        }

        return null;
    }

    private resolveRepositoryEntity(
        classNode: any,
        filePath: string,
        namespace: string | null,
        uses: Map<string, string>,
    ): string | null {
        for (const node of classNode.body ?? []) {
            if (node.kind !== 'method' || nodeName(node.name) !== '__construct') {
                continue;
            }

            let entityFqcn: string | null = null;
            walkPhp(node.body, (child) => {
                if (entityFqcn !== null || child.kind !== 'call' || child.what?.kind !== 'staticlookup') {
                    return;
                }

                const parentCall = child.what.what;
                const isParentReference = nodeName(parentCall) === 'parent' || parentCall?.kind === 'parentreference';
                if (!isParentReference || nodeName(child.what.offset) !== '__construct') {
                    return;
                }

                entityFqcn = this.resolveClassName(child.arguments?.[1], namespace, uses);
            });

            if (entityFqcn) {
                return entityFqcn;
            }
        }

        const className = nodeName(classNode.name);
        const inferredEntity = this.inferRepositoryEntity(className, namespace, filePath);
        if (inferredEntity) {
            return inferredEntity;
        }

        return null;
    }

    private collectAliases(
        scopeNode: any,
        repositoryEntity: string,
        namespace: string | null,
        uses: Map<string, string>,
    ): Map<string, string> {
        const aliases = new Map<string, string>();
        if (!scopeNode) {
            return aliases;
        }

        walkPhp(scopeNode, (node) => {
            if (node.kind !== 'call') {
                return;
            }

            const methodName = node.what?.kind === 'propertylookup'
                ? nodeName(node.what.offset)
                : node.what?.kind === 'identifier'
                    ? nodeName(node.what)
                    : null;

            if (methodName === 'createQueryBuilder') {
                const alias = nodeName(node.arguments?.[0]);
                if (alias) {
                    aliases.set(alias, repositoryEntity);
                }

                return;
            }

            if (methodName === 'from') {
                const entityFqcn = this.resolveClassName(node.arguments?.[0], namespace, uses);
                const alias = nodeName(node.arguments?.[1]);
                if (entityFqcn && alias) {
                    aliases.set(alias, entityFqcn);
                }

                return;
            }

            if (['join', 'leftJoin', 'innerJoin', 'rightJoin'].includes(methodName ?? '')) {
                const relationPath = nodeName(node.arguments?.[0]);
                const alias = nodeName(node.arguments?.[1]);
                if (!relationPath || !alias) {
                    return;
                }

                const relationMatch = relationPath.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)$/u);
                if (!relationMatch) {
                    return;
                }

                const [, sourceAlias, propertyName] = relationMatch;
                const sourceEntity = aliases.get(sourceAlias);
                if (!sourceEntity) {
                    return;
                }

                const targetEntity = this.resolveEntityPropertyTarget(sourceEntity, propertyName);
                if (targetEntity) {
                    aliases.set(alias, targetEntity);
                }
            }
        });

        return aliases;
    }

    private async loadEntityFields(fqcn: string): Promise<Array<string>> {
        const entityPath = this.fqcnToPath(fqcn);
        if (!entityPath || !fs.existsSync(entityPath)) {
            return [];
        }

        const cached = this.entityFieldsCache.get(entityPath);
        const mtime = fs.statSync(entityPath).mtimeMs;
        if (cached && cached.mtime === mtime) {
            return cached.fields;
        }

        const document = await workspace.openTextDocument(Uri.file(entityPath));
        const program = tryParsePhp(document.getText());
        if (program === null) {
            return [];
        }

        const namespace = this.extractNamespace(program);
        const fields: Array<string> = [];

        walkPhp(program, (node) => {
            if (node.kind !== 'class') {
                return;
            }

            const className = nodeName(node.name);
            const classFqcn = className
                ? (namespace ? `${namespace}\\${className}` : className)
                : null;
            if (classFqcn !== fqcn) {
                return;
            }

            for (const child of node.body ?? []) {
                if (child.kind !== 'propertystatement') {
                    continue;
                }

                for (const property of child.properties ?? []) {
                    const propertyName = nodeName(property.name);
                    if (propertyName) {
                        fields.push(propertyName);
                    }
                }
            }
        });

        const result = Array.from(new Set(fields)).sort((left, right) => left.localeCompare(right));
        this.entityFieldsCache.set(entityPath, {mtime, fields: result});

        return result;
    }

    private createFieldItem(
        document: TextDocument,
        position: Position,
        prefix: string,
        field: string,
        entityFqcn: string,
    ): CompletionItem {
        const item = new CompletionItem(field, CompletionItemKind.Field);
        const start = new Position(position.line, position.character - prefix.length);
        item.range = new Range(start, position);
        item.insertText = field;
        item.detail = entityFqcn;

        return item;
    }

    private resolveClassName(node: any, namespace: string | null, uses: Map<string, string>): string | null {
        const resolved = resolveClassReference(node, uses);
        if (resolved) {
            return resolved;
        }

        const name = nodeName(node);
        if (!name) {
            return null;
        }

        if (uses.has(name)) {
            return uses.get(name) ?? null;
        }

        if (name.includes('\\')) {
            return name.replace(/^\\/, '');
        }

        return namespace ? `${namespace}\\${name}` : name;
    }

    private resolveEntityPropertyTarget(entityFqcn: string, propertyName: string): string | null {
        const entityPath = this.fqcnToPath(entityFqcn);
        if (!entityPath || !fs.existsSync(entityPath)) {
            return null;
        }

        const mtime = fs.statSync(entityPath).mtimeMs;
        const cacheKey = `${entityPath}::${propertyName}`;
        const cached = this.relationTargetCache.get(cacheKey);
        if (cached && cached.mtime === mtime) {
            return cached.target;
        }

        const program = tryParsePhp(fs.readFileSync(entityPath, 'utf-8'));
        if (program === null) {
            return null;
        }

        const namespace = this.extractNamespace(program);
        const uses = collectUseStatements(program);
        let resolvedTarget: string | null = null;

        walkPhp(program, (node) => {
            if (resolvedTarget !== null || node.kind !== 'propertystatement') {
                return;
            }

            const property = (node.properties ?? []).find((item: any) => nodeName(item.name) === propertyName);
            if (!property) {
                return;
            }

            resolvedTarget = this.resolvePropertyTarget(property, node, namespace, uses);
        });

        this.relationTargetCache.set(cacheKey, {mtime, target: resolvedTarget});

        return resolvedTarget;
    }

    private resolvePropertyTarget(
        property: any,
        propertyStatement: any,
        namespace: string | null,
        uses: Map<string, string>,
    ): string | null {
        const typedTarget = this.resolveClassName(property.type, namespace, uses);
        if (typedTarget && !this.isScalarType(typedTarget)) {
            return typedTarget;
        }

        const attrTarget = this.resolveRelationTargetFromAttributes(property.attrGroups ?? [], namespace, uses);
        if (attrTarget) {
            return attrTarget;
        }

        return this.resolveRelationTargetFromComments(propertyStatement.leadingComments ?? [], namespace, uses);
    }

    private resolveRelationTargetFromAttributes(
        attrGroups: Array<any>,
        namespace: string | null,
        uses: Map<string, string>,
    ): string | null {
        for (const group of attrGroups) {
            for (const attr of group.attrs ?? []) {
                const attrName = nodeName(attr.name) ?? '';
                if (!/(ManyToOne|OneToOne|OneToMany|ManyToMany)$/u.test(attrName)) {
                    continue;
                }

                for (const arg of attr.args ?? []) {
                    if (nodeName(arg.name) !== 'targetEntity') {
                        continue;
                    }

                    const target = this.resolveClassName(arg.value, namespace, uses);
                    if (target) {
                        return target;
                    }
                }
            }
        }

        return null;
    }

    private resolveRelationTargetFromComments(
        comments: Array<any>,
        namespace: string | null,
        uses: Map<string, string>,
    ): string | null {
        for (const comment of comments) {
            const text = typeof comment?.value === 'string' ? comment.value : '';
            if (!/(ManyToOne|OneToOne|OneToMany|ManyToMany)/u.test(text)) {
                continue;
            }

            const match = text.match(
                /targetEntity\s*=\s*(?:['"])?([A-Za-z_\\][A-Za-z0-9_\\]*)::class|targetEntity\s*=\s*['"]([^'"]+)['"]/u,
            );
            const targetName = match?.[1] ?? match?.[2] ?? null;
            if (!targetName) {
                continue;
            }

            const fakeNode = {kind: 'name', name: targetName};
            const target = this.resolveClassName(fakeNode, namespace, uses);
            if (target) {
                return target;
            }
        }

        return null;
    }

    private isScalarType(typeName: string): boolean {
        return [
            'int',
            'float',
            'string',
            'bool',
            'array',
            'callable',
            'iterable',
            'object',
            'mixed',
        ].includes(typeName);
    }

    private inferRepositoryEntity(
        className: string | null,
        namespace: string | null,
        filePath: string,
    ): string | null {
        if (!className?.endsWith('Repository')) {
            return null;
        }

        const entityName = className.slice(0, -'Repository'.length);
        const namespaceCandidate = namespace
            ? namespace.replace(/\\Repository(?:\\.*)?$/u, '\\Entity')
            : null;
        const candidates = [
            namespaceCandidate ? `${namespaceCandidate}\\${entityName}` : null,
            this.inferEntityFromRepositoryPath(filePath, entityName),
            this.inferEntityFromRepositoryFsPath(filePath, entityName),
        ].filter((candidate): candidate is string => !!candidate);

        for (const candidate of candidates) {
            if (this.fqcnToPath(candidate)) {
                return candidate;
            }
        }

        return null;
    }

    private inferEntityFromRepositoryPath(filePath: string, entityName: string): string | null {
        const namespace = App.instance.pathToNamespace(filePath);
        if (!namespace.endsWith('Repository')) {
            return null;
        }

        const entityNamespace = namespace
            .replace(/\\Repository\\/u, '\\Entity\\')
            .replace(/\\Repository$/u, '\\Entity')
            .replace(/\\[^\\]+$/u, `\\${entityName}`);

        return entityNamespace;
    }

    private inferEntityFromRepositoryFsPath(filePath: string, entityName: string): string | null {
        const workplacePath = App.instance.composer('workplacePath', null);
        if (!workplacePath) {
            return null;
        }

        const normalizedPath = filePath.replace(/\\/g, '/');
        const normalizedRoot = workplacePath.replace(/\\/g, '/');
        if (!normalizedPath.startsWith(normalizedRoot)) {
            return null;
        }

        const relativePath = normalizedPath.slice(normalizedRoot.length).replace(/^\/+/u, '');
        const entityRelativePath = relativePath
            .replace(/\/Repository\//u, '/Entity/')
            .replace(/\/Repository\/[^/]+$/u, `/Entity/${entityName}.php`)
            .replace(/Repository\.php$/u, `${entityName}.php`);
        const fullEntityPath = path.join(workplacePath, entityRelativePath);
        if (!fs.existsSync(fullEntityPath)) {
            return null;
        }

        return App.instance.pathToNamespace(fullEntityPath);
    }

    private extractNamespace(program: any): string | null {
        let namespace: string | null = null;

        walkPhp(program, (node) => {
            if (namespace !== null || node.kind !== 'namespace') {
                return;
            }

            namespace = nodeName(node.name);
        });

        return namespace;
    }

    private fqcnToPath(fqcn: string): string | null {
        const autoload = App.instance.composer('autoload', {});
        const workplacePath = App.instance.composer('workplacePath', null);
        if (!workplacePath) {
            return null;
        }

        for (const [prefix, paths] of Object.entries(autoload)) {
            if (!fqcn.startsWith(prefix)) {
                continue;
            }

            const relativePath = `${fqcn.slice(prefix.length).replace(/\\/g, '/')}.php`;
            const searchPaths = Array.isArray(paths) ? paths : [paths];
            for (const basePath of searchPaths) {
                const fullPath = path.join(workplacePath, basePath as string, relativePath);
                if (fs.existsSync(fullPath)) {
                    return fullPath;
                }
            }
        }

        return null;
    }

    private nodeContainsLine(node: any, line: number): boolean {
        const startLine = node.loc?.start?.line;
        const endLine = node.loc?.end?.line;
        if (typeof startLine !== 'number' || typeof endLine !== 'number') {
            return false;
        }

        const zeroBasedStart = startLine - 1;
        const zeroBasedEnd = endLine - 1;

        return line >= zeroBasedStart && line <= zeroBasedEnd;
    }
}
