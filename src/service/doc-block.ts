import fs from 'fs';
import {Position, TextDocument, TextLine, workspace} from 'vscode';
import {Name, Parameter} from 'php-parser';
import {
    DOC_CONST_DESCR,
    DOC_LINES_AFTER_DESCR,
    DOC_LINES_BEFORE_RETURN,
    DOC_LINES_BEFORE_THROWS,
    DOC_PROPERTY_DESCR,
    DOC_RETURN_VOID,
    DOC_SHOW_DESCR,
    DOC_SHOW_THROWS_ON_DIFF_LINES,
    EXT_ID,
    PHPDOC,
    PROP,
} from '../constants';
import {IParameter} from '../interfaces';
import {collectUseStatements, nodeName, parsePhp, walkPhp} from './php-ast';
import {fqcnToPath} from './project';
import Property from './property';

function getConfig<T>(key: string, defaultValue: T): T {
    return workspace.getConfiguration(EXT_ID).get<T>(key, defaultValue);
}

function capitalizeFirstCharTrimmed(input: string): string {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
        return trimmedInput;
    }

    return trimmedInput.charAt(0).toUpperCase() + trimmedInput.slice(1);
}

function arrayToPhpdoc(data: Array<string>, tab: string = ''): string {
    const res: Array<string> = data.map((v) => `${tab} * ${v}`);
    res.unshift(`${tab}/**`);
    res.push(`${tab} */`);

    return `${res.join('\n')}\n`;
}

export class Block {
    public type: string;
    public name: string;
    public tab: string;
    public startLine: number;
    public activeLine: TextLine;
    public importsToAdd: Array<string>;
    public error: string|null = null;
    protected document: TextDocument;

    public constructor(document: TextDocument, position: Position) {
        this.document = document;
        this.type = 'undefined';
        this.name = '';
        this.importsToAdd = [];
        this.activeLine = document.lineAt(position.line);
        this.tab = this.activeLine.text.substring(0, this.activeLine.firstNonWhitespaceCharacterIndex);
        this.startLine = position.line;
    }

    public get template(): string {
        return '';
    }

    protected parseCode(buffer: string) {
        return parsePhp(buffer);
    }

    protected wrapTemplate(template: string, addLeadingEmptyLine: boolean = false): string {
        if (!addLeadingEmptyLine) {
            return template;
        }

        for (let lineNumber = this.startLine - 1; lineNumber >= 0; lineNumber--) {
            const prevLine = this.document.lineAt(lineNumber).text.trim();
            if (prevLine === '') {
                return template;
            }

            if (prevLine.endsWith('{')) {
                return template;
            }

            return `\n${template}`;
        }

        return template;
    }
}

export class ClassBlock extends Block {
    public kind: string;

    public constructor(document: TextDocument, position: Position) {
        super(document, position);

        this.type = PHPDOC.CLASS.TYPE;
        this.kind = '';

        try {
            let declr = this.activeLine.text.trim();
            declr = `${declr} ${declr.includes('{') ? '}' : ' {}'}`;
            const program = this.parseCode(`<?php \n ${declr} \n`);

            const klass = program.children.find((node: any) => PHPDOC.VALID_KLASS.includes(node.kind)) as any;
            if (typeof klass === 'undefined') {
                throw new Error('Invalid class declaration');
            }

            this.name = (klass.name as Name).name;
            this.kind = klass.kind;
        } catch (error) {
            this.error = `Failed to parse class: ${(error as Error).message}.`;
        }
    }

    public get template(): string {
        const name = `${capitalizeFirstCharTrimmed(this.kind)} ${this.name}`;

        return arrayToPhpdoc([`${name} description.`], this.tab);
    }
}

export class ConstantBlock extends Block {
    public constType: string|null;

    public constructor(document: TextDocument, position: Position) {
        super(document, position);

        this.type = PHPDOC.CONSTANT.TYPE;
        this.constType = null;

        try {
            let declr = this.activeLine.text.trim();
            if (!declr.includes(';')) {
                if (declr.endsWith('[')) {
                    declr = `${declr}];`;
                } else if (declr.endsWith('\'')) {
                    declr = `${declr}';`;
                } else if (declr.endsWith('"')) {
                    declr = `${declr}";`;
                } else {
                    declr = `${declr};`;
                }
            }
            const program = this.parseCode(`<?php \n class Foo { \n ${declr} \n } \n`);

            const klass = program.children.find((node: any) => PHPDOC.VALID_KLASS.includes(node.kind)) as any;
            if (typeof klass === 'undefined') {
                throw new Error('Invalid class declaration');
            }

            const stmt = klass.body.find((node: any) => node.kind === 'classconstant');
            if (typeof stmt === 'undefined') {
                throw new Error('Invalid constant statement declaration');
            }

            const konst = stmt.constants.find((node: any) => node.kind === 'constant');
            if (typeof konst === 'undefined') {
                throw new Error('Invalid constant');
            }

            this.name = (konst.name as Name).name;
            const matches = declr.match(PHPDOC.CONSTANT.REGEX) as Array<string>|null;

            this.constType = (matches && matches.length >= 3)
                ? (/^[A-Z]+$/.test(matches[2]) ? 'mixed' : matches[2])
                : 'mixed';
        } catch (error) {
            this.constType = 'mixed';
            this.error = `Failed to parse constant: ${(error as Error).message}.`;
        }
    }

    public get template(): string {
        const data: Array<string> = [];

        if (!!getConfig(DOC_CONST_DESCR, false)) {
            data.push(`${this.name} description.`);
            for (let i = 0; i < getConfig(DOC_LINES_AFTER_DESCR, 0); i++) {
                data.push('');
            }
        }

        data.push(`@var ${this.constType}`);

        return this.wrapTemplate(arrayToPhpdoc(data, this.tab), true);
    }
}

export class VariableBlock extends Block {
    public varHint: string;

    public constructor(document: TextDocument, position: Position) {
        super(document, position);

        this.type = 'variable';
        this.varHint = 'mixed';

        try {
            const line = this.activeLine.text.trim();
            const declr = line.endsWith(';') ? line : `${line};`;
            const program = this.parseCode(`<?php function demo() { ${declr} }`);

            const func = program.children.find((node: any) => node.kind === 'function') as any;
            const body = func?.body?.children ?? [];
            const exprStmt = body.find((node: any) => node.kind === 'expressionstatement') as any;
            const assign = exprStmt?.expression;
            if (!assign || assign.kind !== 'assign' || assign.operator !== '=') {
                throw new Error('Invalid variable assignment');
            }

            const variable = assign.left;
            if (!variable || variable.kind !== 'variable' || typeof variable.name !== 'string') {
                throw new Error('Invalid variable declaration');
            }

            this.name = variable.name;
            this.varHint = this.detectVarHint(assign.right);
        } catch (error) {
            this.varHint = 'mixed';
            this.error = `Failed to parse variable: ${(error as Error).message}.`;
        }
    }

    public get template(): string {
        return `${this.tab}/** @var ${this.varHint} $${this.name} */\n`;
    }

    private detectVarHint(node: any): string {
        if (!node || typeof node !== 'object') {
            return 'mixed';
        }

        switch (node.kind) {
            case 'number':
                return String(node.value).includes('.') ? 'float' : 'int';
            case 'string':
            case 'encapsed':
            case 'nowdoc':
                return 'string';
            case 'boolean':
                return 'bool';
            case 'array':
            case 'list':
                return 'array';
            case 'nullkeyword':
                return 'null';
            case 'new':
                return node.what?.name ?? 'object';
            default:
                return 'mixed';
        }
    }
}

export class PropertyBlock extends Block {
    public varHint: string = 'mixed';

    public constructor(document: TextDocument, position: Position) {
        super(document, position);

        this.type = PHPDOC.PROPERTY.TYPE;

        const property = new Property(document, position);
        if (property.error) {
            this.error = property.error;
        }

        if (property.name !== PROP.UNDEFINED) {
            this.name = property.name;
        }
        this.varHint = property.hint ?? 'mixed';
    }

    public get template(): string {
        const data: Array<string> = [];

        if (!!getConfig(DOC_PROPERTY_DESCR, false)) {
            data.push(`${this.name} description.`);
            for (let i = 0; i < getConfig(DOC_LINES_AFTER_DESCR, 0); i++) {
                data.push('');
            }
        }

        data.push(`@var ${this.varHint}`);

        return this.wrapTemplate(arrayToPhpdoc(data, this.tab), true);
    }
}

type TRelations = Map<string, {extends: string|null, implements: Array<string>}>;
type TThrowsContext = {
    functionMap: Map<string, any>,
    methodMap: Map<string, any>,
    ownerClass: any|null,
    currentClassName: string|null,
    namespaceName: string|null,
    relations: TRelations,
    uses: Map<string, string>,
};
type TCallable = {node: any, ownerClass: any|null};
type TResolvedCallable = {node: any, className: string|null, context: TThrowsContext};

export class FunctionBlock extends Block {
    public params: Array<IParameter>;
    public returnHint: string;
    public throws: Array<string>;
    public renderedThrows: Array<string>;

    public constructor(document: TextDocument, position: Position) {
        super(document, position);

        this.type = PHPDOC.FUNCTION.TYPE;
        this.params = [];
        this.throws = [];
        this.renderedThrows = [];
        this.returnHint = '';

        const code = document.getText();

        try {
            const funcDeclr = document.lineAt(this.startLine).text.trim();
            const matches = funcDeclr.match(PHPDOC.FUNCTION.REGEX) as Array<any>;
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
        } catch (error) {
            this.returnHint = '';
            this.params = [];
            this.error = `Failed to parse function: ${(error as Error).message}.`;
        }
    }

    public get template(): string {
        const data = [];

        if (!!getConfig(DOC_SHOW_DESCR, false)) {
            data.push(`${this.name} description.`);
            for (let i = 0; i < getConfig(DOC_LINES_AFTER_DESCR, 0); i++) {
                data.push('');
            }
        }

        this.params.forEach((p: IParameter) => {
            data.push(`@param ${p.hint} $${p.name}`);
        });

        const returnVoid = !!getConfig(DOC_RETURN_VOID, false);
        const emptyLinesBeforeReturn = (!returnVoid && this.returnHint === 'void')
            ? 0
            : getConfig(DOC_LINES_BEFORE_RETURN, 0);
        for (let i = 0; i < emptyLinesBeforeReturn; i++) {
            data.push('');
        }

        if (returnVoid || this.returnHint !== 'void') {
            data.push(`@return ${this.returnHint}`);
        }

        const emptyLinesBeforeThrows = getConfig(DOC_LINES_BEFORE_THROWS, 0);
        if (this.renderedThrows.length > 0 && emptyLinesBeforeThrows > 0) {
            for (let i = 0; i < emptyLinesBeforeThrows; i++) {
                data.push('');
            }
        }

        const showThrowsOnDiffLines = !!getConfig(DOC_SHOW_THROWS_ON_DIFF_LINES, true);
        (showThrowsOnDiffLines ? this.renderedThrows : [this.renderedThrows.join('|')]).forEach((v: string) => {
            data.push(`@throws ${v}`);
        });

        return arrayToPhpdoc(data, this.tab);
    }

    public prepareThrowsForRender(
        existingImports: Set<string>,
        usedAliases: Set<string>,
        namespaceName: string|null,
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

    private findCallableAtLine(program: any, line: number): TCallable|null {
        let result: TCallable|null = null;

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

    private parseCallableDeclaration(document: TextDocument, line: number): TCallable|null {
        const declaration = this.extractCallableDeclaration(document, line);
        if (declaration === null) {
            return null;
        }

        try {
            const program = this.parseCode(`<?php\nclass PhpToolsPhpDocCallable\n{\n${declaration}\n{\n}\n}\n`);

            return this.findCallableAtLine(program, 3);
        } catch (error) {
            return null;
        }
    }

    private extractCallableDeclaration(document: TextDocument, line: number): string|null {
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
        namespaceName: string|null,
        uses: Map<string, string>,
    ): TRelations {
        const relations = new Map<string, {extends: string|null, implements: Array<string>}>();

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
                .filter((entry: string|null): entry is string => entry !== null);

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

    private resolveCalledCallable(callNode: any, context: TThrowsContext): TResolvedCallable|null {
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
        namespaceName: string|null,
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

    private resolveThrownType(node: any, namespaceName: string|null, uses: Map<string, string>): string|null {
        if (!node || typeof node !== 'object') {
            return null;
        }

        if (node.kind === 'new') {
            return this.resolveTypeName(node.what, namespaceName, uses);
        }

        return this.resolveTypeName(node, namespaceName, uses);
    }

    private resolveTypeName(node: any, namespaceName: string|null, uses: Map<string, string>): string|null {
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
            ownerClass: any|null,
            namespaceName: string|null,
            uses: Map<string, string>,
        },
    ): string|null {
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
            ownerClass: any|null,
            namespaceName: string|null,
            uses: Map<string, string>,
        },
    ): string|null {
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

    private resolveExternalMethod(className: string, methodName: string): TResolvedCallable|null {
        const classPath = fqcnToPath(className);
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
        namespaceName: string|null,
        uses: Map<string, string>,
    ): any|null {
        let result: any|null = null;

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
}
