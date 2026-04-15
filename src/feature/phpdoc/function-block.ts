import fs from 'fs';
import path from 'path';
import {Position, TextDocument} from 'vscode';
import {Engine, Name, Parameter} from 'php-parser';
import App from '../../app';
import {
    A_DOC_LINES_AFTER_DESCR,
    A_DOC_LINES_BEFORE_RETURN,
    A_DOC_LINES_BEFORE_THROWS,
    A_DOC_RETURN_VOID,
    A_DOC_SHOW_DESCR,
    A_DOC_SHOW_THROWS_ON_DIFF_LINES,
    D_REGEX_FUNCTION,
    D_TYPE_FUNCTION,
    M_ERROR,
} from '../../constants';
import {IParameter} from '../../interfaces';
import {collectUseStatements, nodeName, walkPhp} from '../../utils/php-ast';
import {Block} from './base-block';

type TRelations = Map<string, {extends: string | null, implements: Array<string>}>;
type TThrowsContext = {
    functionMap: Map<string, any>,
    methodMap: Map<string, any>,
    ownerClass: any | null,
    currentClassName: string | null,
    namespaceName: string | null,
    relations: TRelations,
    uses: Map<string, string>,
};
type TCallable = {node: any, ownerClass: any | null};
type TResolvedCallable = {node: any, className: string | null, context: TThrowsContext};

const FALLBACK_PHP_PARSER_PARAMS = {
    parser: {extractDoc: true, suppressErrors: true, version: '8.4'},
    ast: {withPositions: true},
};

export class FunctionBlock extends Block {
    public params: Array<IParameter>;
    public returnHint: string;
    public throws: Array<string>;
    public renderedThrows: Array<string>;

    public constructor(position: Position) {
        super(position);

        this.type = D_TYPE_FUNCTION;
        this.params = [];
        this.throws = [];
        this.renderedThrows = [];
        this.returnHint = '';

        const document = App.instance.editor.document as TextDocument;
        const code = document.getText();

        try {
            const funcDeclr = document.lineAt(this.startLine).text.trim();
            const matches = funcDeclr.match(D_REGEX_FUNCTION) as Array<any>;
            if (!matches[1]) {
                throw new Error('Function name not found');
            }

            this.name = matches[1] as string;

            const ast = this.parseCode(code);
            const namespaceName = this.extractNamespaceName(ast);
            const uses = collectUseStatements(ast);
            const callable = this.findCallableAtLine(ast, this.startLine)
                ?? this.parseCallableDeclaration(document, this.startLine);
            if (callable === null) {
                throw new Error('Invalid method declaration');
            }

            try {
                this.params = callable.node.arguments.map((arg: Parameter) => this.convertParam(arg));
            } catch (error) {
                const fallbackCallable = this.parseCallableDeclaration(document, this.startLine);
                if (fallbackCallable === null) {
                    throw error;
                }

                this.params = fallbackCallable.node.arguments.map((arg: Parameter) => this.convertParam(arg));
            }

            const methodMap = callable.ownerClass
                ? this.collectClassMethods(callable.ownerClass)
                : new Map<string, any>();
            const functionMap = this.collectFunctions(ast);
            const relations = this.collectClassRelations(ast, namespaceName, uses);
            this.throws = Array.from(this.collectThrows(
                callable.node.body,
                {
                    functionMap,
                    methodMap,
                    ownerClass: callable.ownerClass,
                    currentClassName: callable.ownerClass
                        ? this.resolveTypeName(callable.ownerClass.name, namespaceName, uses)
                        : null,
                    namespaceName,
                    relations,
                    uses,
                },
                new Set<string>(),
                [],
            ));
            this.renderedThrows = [...this.throws];

            if (this.name === '__construct') {
                this.returnHint = 'void';
            } else {
                const funcType = callable.node.type as any;
                const types = funcType
                    ? (
                        callable.node.type.kind === 'uniontype'
                            ? funcType.types.map((t: Name) => t.name)
                            : [funcType.name]
                    )
                    : ['mixed'];
                if (callable.node.nullable && !types.includes('void') && !types.includes('null')) {
                    types.push('null');
                }
                this.returnHint = types.join('|');
            }
        } catch (error: any) {
            this.returnHint = '';
            this.params = [];
            App.instance.showMessage(`Failed to parse function: ${error}.`, M_ERROR);
        }
    }

    public get template(): string {
        const data = [];

        if (!!App.instance.config(A_DOC_SHOW_DESCR, false)) {
            data.push(`${this.name} description.`);
            for (let i = 0; i < App.instance.config(A_DOC_LINES_AFTER_DESCR, 0); i++) {
                data.push('');
            }
        }

        this.params.forEach((p: IParameter) => {
            data.push(`@param ${p.hint} $${p.name}`);
        });

        const returnVoid = !!App.instance.config(A_DOC_RETURN_VOID, false);
        const emptyLinesBeforeReturn = (!returnVoid && this.returnHint === 'void')
            ? 0
            : App.instance.config(A_DOC_LINES_BEFORE_RETURN, 0);
        for (let i = 0; i < emptyLinesBeforeReturn; i++) {
            data.push('');
        }

        if (returnVoid || this.returnHint !== 'void') {
            data.push(`@return ${this.returnHint}`);
        }

        const emptyLinesBeforeThrows = App.instance.config(A_DOC_LINES_BEFORE_THROWS, 0);
        if (this.renderedThrows.length > 0 && emptyLinesBeforeThrows > 0) {
            for (let i = 0; i < emptyLinesBeforeThrows; i++) {
                data.push('');
            }
        }

        const showThrowsOnDiffLines = !!App.instance.config(A_DOC_SHOW_THROWS_ON_DIFF_LINES, true);
        (showThrowsOnDiffLines ? this.renderedThrows : [this.renderedThrows.join('|')]).forEach((v: string) => {
            data.push(`@throws ${v}`);
        });

        return App.instance.arrayToPhpdoc(data, this.tab);
    }

    public prepareThrowsForRender(
        existingImports: Set<string>,
        usedAliases: Set<string>,
        namespaceName: string | null,
    ): void {
        this.importsToAdd = [];
        this.renderedThrows = this.throws.map((exceptionName) => {
            if (this.isGlobalType(exceptionName)) {
                const cleanName = exceptionName.replace(/^\\/, '');

                return existingImports.has(cleanName) ? cleanName : exceptionName;
            }

            if (!exceptionName.includes('\\')) {
                return this.shortTypeName(exceptionName);
            }

            if (namespaceName && exceptionName.startsWith(`${namespaceName}\\`)) {
                return this.shortTypeName(exceptionName);
            }

            if (existingImports.has(exceptionName)) {
                return this.shortTypeName(exceptionName);
            }

            const shortName = this.shortTypeName(exceptionName);
            if (usedAliases.has(shortName)) {
                return exceptionName;
            }

            this.importsToAdd.push(exceptionName);
            existingImports.add(exceptionName);
            usedAliases.add(shortName);

            return shortName;
        });
    }

    private convertParam(arg: Parameter): IParameter {
        const argType = arg.type as any;
        if (arg.type === null) {
            return {
                name: (arg.name as Name).name,
                hint: 'mixed',
            };
        }

        const types = argType.kind === 'uniontype' ? argType.types.map((t: Name) => t.name) : [argType.name];
        if (arg.nullable && !types.includes('null')) {
            types.push('null');
        }

        return {
            name: (arg.name as Name).name,
            hint: types.join('|'),
        };
    }

    private shortTypeName(typeName: string): string {
        return typeName.split('\\').pop() ?? typeName;
    }

    private isGlobalType(typeName: string): boolean {
        return typeName.startsWith('\\') && !typeName.slice(1).includes('\\');
    }

    private extractNamespaceName(program: any): string|null {
        let namespace: string|null = null;

        walkPhp(program, (node) => {
            if (namespace === null && node.kind === 'namespace') {
                namespace = nodeName(node.name);
            }
        });

        return namespace;
    }

    private findCallableAtLine(program: any, line: number): TCallable | null {
        let result: TCallable | null = null;

        walkPhp(program, (node, parent) => {
            if (result !== null || !['method', 'function'].includes(node.kind ?? '')) {
                return;
            }

            const startLine = node.loc?.start?.line;
            const endLine = node.loc?.end?.line;
            if (typeof startLine !== 'number' || typeof endLine !== 'number') {
                return;
            }

            if (startLine - 1 <= line && line <= endLine - 1) {
                result = {
                    node,
                    ownerClass: parent?.kind === 'class' ? parent : null,
                };
            }
        });

        return result;
    }

    private parseCallableDeclaration(document: TextDocument, line: number): TCallable | null {
        const declaration = this.extractCallableDeclaration(document, line);
        if (declaration === null) {
            return null;
        }

        try {
            const parser = new Engine(FALLBACK_PHP_PARSER_PARAMS);
            const program = parser.parseCode(`<?php\nclass PhpToolsPhpDocCallable\n{\n${declaration}\n{\n}\n}\n`, '');

            return this.findCallableAtLine(program, 3);
        } catch (error) {
            return null;
        }
    }

    private extractCallableDeclaration(document: TextDocument, line: number): string | null {
        const parts: Array<string> = [];
        let hasArguments = false;
        let parenthesesDepth = 0;
        let finished = false;

        for (let lineNumber = line; lineNumber < document.lineCount && !finished; lineNumber++) {
            const lineText = document.lineAt(lineNumber).text;
            let buffer = '';

            for (const char of lineText) {
                if (char === '(') {
                    hasArguments = true;
                    parenthesesDepth++;
                }

                if (char === ')') {
                    parenthesesDepth--;
                }

                if (hasArguments && parenthesesDepth === 0 && ['{', ';'].includes(char)) {
                    finished = true;
                    break;
                }

                buffer += char;
            }

            parts.push(buffer);
        }

        if (!hasArguments || parenthesesDepth !== 0) {
            return null;
        }

        return parts.join('\n');
    }

    private collectClassMethods(ownerClass: any): Map<string, any> {
        const methods = new Map<string, any>();
        (ownerClass?.body ?? []).forEach((node: any) => {
            if (node.kind !== 'method') {
                return;
            }

            const name = nodeName(node.name);
            if (name) {
                methods.set(name, node);
            }
        });

        return methods;
    }

    private collectFunctions(program: any): Map<string, any> {
        const functions = new Map<string, any>();

        walkPhp(program, (node, parent) => {
            if (node.kind !== 'function' || parent?.kind === 'class') {
                return;
            }

            const name = nodeName(node.name);
            if (name) {
                functions.set(name, node);
            }
        });

        return functions;
    }

    private collectClassRelations(
        program: any,
        namespaceName: string | null,
        uses: Map<string, string>,
    ): TRelations {
        const relations = new Map<string, {extends: string | null, implements: Array<string>}>();

        walkPhp(program, (node) => {
            if (!['class', 'interface'].includes(node.kind ?? '')) {
                return;
            }

            const className = this.resolveTypeName(node.name, namespaceName, uses);
            if (!className) {
                return;
            }

            const extendsName = this.resolveTypeName(node.extends, namespaceName, uses);
            const interfaces = (node.implements ?? [])
                .map((entry: any) => this.resolveTypeName(entry, namespaceName, uses))
                .filter((entry: string | null): entry is string => entry !== null);

            relations.set(className, {
                extends: extendsName,
                implements: interfaces,
            });
        });

        return relations;
    }

    private collectThrows(
        node: any,
        context: TThrowsContext,
        visited: Set<string>,
        caughtTypes: Array<string>,
    ): Set<string> {
        const throwsSet = new Set<string>();

        if (Array.isArray(node)) {
            node.forEach((child) => {
                this.collectThrows(child, context, visited, caughtTypes).forEach((item) => throwsSet.add(item));
            });

            return throwsSet;
        }

        if (!node || typeof node !== 'object') {
            return throwsSet;
        }

        const current = node.kind === 'expressionstatement' ? node.expression : node;
        if (!current || typeof current !== 'object') {
            return throwsSet;
        }

        if (current.kind === 'throw') {
            const exceptionName = this.resolveThrownType(current.what, context.namespaceName, context.uses);
            if (exceptionName && !this.isCaughtException(exceptionName, caughtTypes, context.relations)) {
                throwsSet.add(exceptionName);
            }
        }

        if (current.kind === 'call') {
            this.collectThrowsFromCall(current, context, visited, caughtTypes).forEach((item) => throwsSet.add(item));
        }

        if (current.kind === 'try') {
            const tryCaughtTypes = [
                ...caughtTypes,
                ...this.collectCatchTypes(current.catches ?? [], context.namespaceName, context.uses),
            ];

            this.collectThrows(current.body, context, visited, tryCaughtTypes)
                .forEach((item) => throwsSet.add(item));
            (current.catches ?? []).forEach((catchNode: any) => {
                this.collectThrows(catchNode.body, context, visited, caughtTypes)
                    .forEach((item) => throwsSet.add(item));
            });
            this.collectThrows(current.always, context, visited, caughtTypes)
                .forEach((item) => throwsSet.add(item));

            return throwsSet;
        }

        Object.values(current).forEach((value) => {
            if (!value || typeof value !== 'object') {
                return;
            }

            this.collectThrows(value, context, visited, caughtTypes).forEach((item) => throwsSet.add(item));
        });

        return throwsSet;
    }

    private collectThrowsFromCall(
        callNode: any,
        context: TThrowsContext,
        visited: Set<string>,
        caughtTypes: Array<string>,
    ): Set<string> {
        const throwsSet = new Set<string>();
        const targetCallable = this.resolveCalledCallable(callNode, context);
        if (!targetCallable) {
            return throwsSet;
        }

        const callableName = nodeName(targetCallable.node.name) ?? '__anonymous__';
        const visitedKey = `${targetCallable.className ?? 'local'}:${targetCallable.node.kind}:${callableName}`;
        if (visited.has(visitedKey)) {
            return throwsSet;
        }

        const nextVisited = new Set(visited);
        nextVisited.add(visitedKey);
        this.collectThrows(targetCallable.node.body, targetCallable.context, nextVisited, caughtTypes)
            .forEach((item) => throwsSet.add(item));

        return throwsSet;
    }

    private resolveCalledCallable(callNode: any, context: TThrowsContext): TResolvedCallable | null {
        const target = callNode.what;
        if (!target || typeof target !== 'object') {
            return null;
        }

        if (target.kind === 'propertylookup' && nodeName(target.what) === 'this') {
            const methodName = nodeName(target.offset);
            const node = methodName ? (context.methodMap.get(methodName) ?? null) : null;

            return node ? {node, className: context.currentClassName, context} : null;
        }

        if (target.kind === 'staticlookup' && ['self', 'static', 'parent'].includes(nodeName(target.what) ?? '')) {
            const methodName = nodeName(target.offset);
            const node = methodName ? (context.methodMap.get(methodName) ?? null) : null;

            return node ? {node, className: context.currentClassName, context} : null;
        }

        if (target.kind === 'staticlookup') {
            const className = this.resolveTypeName(target.what, context.namespaceName, context.uses);
            const methodName = nodeName(target.offset);
            if (className && methodName) {
                return this.resolveExternalMethod(className, methodName);
            }
        }

        if (target.kind === 'propertylookup') {
            const methodName = nodeName(target.offset);
            const className = this.resolveCallOwnerClass(target.what, context);
            if (className && methodName) {
                return this.resolveExternalMethod(className, methodName);
            }
        }

        const functionName = nodeName(target);
        const node = functionName ? (context.functionMap.get(functionName) ?? null) : null;

        return node ? {node, className: null, context} : null;
    }

    private collectCatchTypes(
        catches: Array<any>,
        namespaceName: string | null,
        uses: Map<string, string>,
    ): Array<string> {
        const types = new Set<string>();

        catches.forEach((catchNode) => {
            (catchNode.what ?? []).forEach((entry: any) => {
                const resolved = this.resolveTypeName(entry, namespaceName, uses);
                if (resolved) {
                    types.add(resolved);
                }
            });
        });

        return Array.from(types);
    }

    private resolveThrownType(node: any, namespaceName: string | null, uses: Map<string, string>): string | null {
        if (!node || typeof node !== 'object') {
            return null;
        }

        if (node.kind === 'new') {
            return this.resolveTypeName(node.what, namespaceName, uses);
        }

        return this.resolveTypeName(node, namespaceName, uses);
    }

    private resolveTypeName(node: any, namespaceName: string | null, uses: Map<string, string>): string | null {
        const rawName = nodeName(node);
        if (!rawName) {
            return null;
        }

        const cleanName = rawName.replace(/^\\/, '');
        if (rawName.startsWith('\\')) {
            return cleanName.includes('\\') ? cleanName : rawName;
        }

        if (uses.has(cleanName)) {
            return uses.get(cleanName) ?? cleanName;
        }

        return namespaceName ? `${namespaceName}\\${cleanName}` : cleanName;
    }

    private isCaughtException(
        exceptionName: string,
        caughtTypes: Array<string>,
        relations: TRelations,
    ): boolean {
        return caughtTypes.some((caughtType) => this.matchesCaughtType(exceptionName, caughtType, relations));
    }

    private matchesCaughtType(exceptionName: string, caughtType: string, relations: TRelations): boolean {
        if (exceptionName === caughtType || caughtType === 'Throwable') {
            return true;
        }

        if (caughtType === 'Exception' && exceptionName.endsWith('Exception')) {
            return true;
        }

        const relation = relations.get(exceptionName);
        if (!relation) {
            return false;
        }

        if (relation.extends && this.matchesCaughtType(relation.extends, caughtType, relations)) {
            return true;
        }

        return relation.implements.some((entry) => this.matchesCaughtType(entry, caughtType, relations));
    }

    private resolveCallOwnerClass(
        node: any,
        context: {
            ownerClass: any | null,
            namespaceName: string | null,
            uses: Map<string, string>,
        },
    ): string | null {
        if (!node || typeof node !== 'object') {
            return null;
        }

        if (node.kind === 'new') {
            return this.resolveTypeName(node.what, context.namespaceName, context.uses);
        }

        if (node.kind === 'propertylookup' && nodeName(node.what) === 'this') {
            const propertyName = nodeName(node.offset);

            return propertyName ? this.resolveThisPropertyType(propertyName, context) : null;
        }

        return null;
    }

    private resolveThisPropertyType(
        propertyName: string,
        context: {
            ownerClass: any | null,
            namespaceName: string | null,
            uses: Map<string, string>,
        },
    ): string | null {
        const {ownerClass} = context;
        if (!ownerClass) {
            return null;
        }

        for (const classNode of ownerClass.body ?? []) {
            if (classNode.kind === 'propertystatement') {
                for (const property of classNode.properties ?? []) {
                    if (nodeName(property.name) === propertyName) {
                        return this.resolveTypeName(property.type, context.namespaceName, context.uses);
                    }
                }
            }

            if (classNode.kind === 'method' && nodeName(classNode.name) === '__construct') {
                for (const arg of classNode.arguments ?? []) {
                    if (arg.flags > 0 && nodeName(arg.name) === propertyName) {
                        return this.resolveTypeName(arg.type, context.namespaceName, context.uses);
                    }
                }
            }
        }

        return null;
    }

    private resolveExternalMethod(className: string, methodName: string): TResolvedCallable | null {
        const classPath = this.fqcnToPath(className);
        if (!classPath || !fs.existsSync(classPath)) {
            return null;
        }

        try {
            const code = fs.readFileSync(classPath, 'utf-8');
            const program = this.parseCode(code);
            const namespaceName = this.extractNamespaceName(program);
            const uses = collectUseStatements(program);
            const ownerClass = this.findClassByName(program, className, namespaceName, uses);
            if (!ownerClass) {
                return null;
            }

            const methodMap = this.collectClassMethods(ownerClass);
            const node = methodMap.get(methodName) ?? null;
            if (!node) {
                return null;
            }

            return {
                node,
                className,
                context: {
                    functionMap: this.collectFunctions(program),
                    methodMap,
                    ownerClass,
                    currentClassName: className,
                    namespaceName,
                    relations: this.collectClassRelations(program, namespaceName, uses),
                    uses,
                },
            };
        } catch (error) {
            return null;
        }
    }

    private findClassByName(
        program: any,
        fqcn: string,
        namespaceName: string | null,
        uses: Map<string, string>,
    ): any | null {
        let result: any | null = null;

        walkPhp(program, (node) => {
            if (result !== null || node.kind !== 'class') {
                return;
            }

            const className = this.resolveTypeName(node.name, namespaceName, uses);
            if (className === fqcn) {
                result = node;
            }
        });

        return result;
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
}
