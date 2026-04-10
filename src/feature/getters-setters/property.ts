import {Position, TextDocument} from 'vscode';
import App from '../../app';
import {D_REGEX_CLASS, M_ERROR, R_SETTER, R_UNDEFINED_PROPERTY} from '../../constants';
import {IPhpNode, nodeName, parsePhp, walkPhp} from '../../utils/php-ast';

function nodeHasOffset(node: IPhpNode | null | undefined, offset: number): boolean {
    const start = node?.loc?.start?.offset;
    const end = node?.loc?.end?.offset;

    return typeof start === 'number' && typeof end === 'number' && start <= offset && offset <= end;
}

function classLikeName(node: IPhpNode | null | undefined): string | null {
    if (!node || !['class', 'trait', 'enum'].includes(node.kind ?? '')) {
        return null;
    }

    return nodeName(node.name);
}

function resolveTypeNames(typeNode: any): Array<string> {
    if (!typeNode || typeof typeNode !== 'object') {
        return [];
    }

    if (typeNode.kind === 'uniontype' || typeNode.kind === 'intersectiontype') {
        return typeNode.types.flatMap((node: any) => resolveTypeNames(node));
    }

    const typeName = nodeName(typeNode);

    return typeName ? [typeName] : [];
}

function resolveClassName(document: TextDocument, position: Position): string {
    const offset = document.offsetAt(position);
    const program = parsePhp(document.getText());
    let result = 'self';

    walkPhp(program, (node) => {
        if (classLikeName(node) && nodeHasOffset(node, offset)) {
            result = classLikeName(node) ?? result;
        }
    });

    return result;
}

function resolveClassIndent(document: TextDocument, position: Position): string {
    const offset = document.offsetAt(position);
    const program = parsePhp(document.getText());
    let classNode: IPhpNode | null = null;

    walkPhp(program, (node) => {
        if (classLikeName(node) && nodeHasOffset(node, offset)) {
            classNode = node;
        }
    });

    const resolvedClassNode: IPhpNode | null = classNode as IPhpNode | null;
    if (resolvedClassNode && resolvedClassNode.loc?.start?.line && resolvedClassNode.loc.end?.line) {
        const classStartLine = resolvedClassNode.loc.start.line - 1;
        const classEndLine = resolvedClassNode.loc.end.line - 1;
        const classLineTab = resolveLineTab(document, classStartLine);

        for (let lineNumber = classStartLine + 1; lineNumber < classEndLine; lineNumber++) {
            const line = document.lineAt(lineNumber);
            const trimmed = line.text.trim();
            if (trimmed === '' || trimmed === '{' || trimmed === '}') {
                continue;
            }

            const lineTab = resolveLineTab(document, lineNumber);
            if (lineTab.length > classLineTab.length) {
                return lineTab;
            }
        }

        const classLine = document.lineAt(classStartLine).text;
        const indentUnit = classLine.includes('\t') ? '\t' : '    ';

        return `${classLineTab}${indentUnit}`;
    }

    return resolveLineTab(document, position.line);
}

function resolveLineTab(document: TextDocument, line: number): string {
    const textLine = document.lineAt(line);

    return textLine.text.substring(0, textLine.firstNonWhitespaceCharacterIndex);
}

export default class Property {
    public name: string = R_UNDEFINED_PROPERTY;
    public tab: string;
    public type: string|null = null;
    public hint: string|null = null;
    public className: string = 'self';

    public constructor(position: Position) {
        const {document} = App.instance.editor;
        this.tab = resolveClassIndent(document, position);
        try {
            this.className = resolveClassName(document, position);

            const offset = document.offsetAt(position);
            const program = parsePhp(document.getText());
            let resolved = false;

            walkPhp(program, (node) => {
                if (resolved || !nodeHasOffset(node, offset)) {
                    return;
                }

                if (node.kind === 'property') {
                    const varTypes = resolveTypeNames(node.type);
                    if (node.nullable && !varTypes.includes('null')) {
                        varTypes.push('null');
                    }

                    if (varTypes.length === 0) {
                        throw new Error('Invalid PHP code');
                    }

                    this.applyResolvedProperty(nodeName(node.name), varTypes);
                    resolved = true;
                }

                if (node.kind === 'parameter' && typeof node.flags === 'number' && node.flags > 0) {
                    const varTypes = resolveTypeNames(node.type);
                    if (node.nullable && !varTypes.includes('null')) {
                        varTypes.push('null');
                    }

                    if (varTypes.length === 0) {
                        throw new Error('Invalid PHP code');
                    }

                    this.applyResolvedProperty(nodeName(node.name), varTypes);
                    resolved = true;
                }
            });

            if (resolved) {
                return;
            }

            const activeLine = document.lineAt(position.line);
            for (let i = 0; i < position.line; i++) {
                const text = document.lineAt(i).text as string;
                if (text.includes('class')) {
                    const matches = document.lineAt(i).text.match(D_REGEX_CLASS);
                    if (matches && matches.length > 2) {
                        this.className = matches[2] as string;
                    }
                }
            }

            let declr = activeLine.text.trim();
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

            const fallbackProgram = parsePhp(`<?php \n class Foo { \n ${declr} \n } \n`);
            let fallbackProperty: any = null;
            walkPhp(fallbackProgram, (node) => {
                if (fallbackProperty === null && node.kind === 'property') {
                    fallbackProperty = node;
                }
            });

            if (fallbackProperty === null) {
                throw new Error('Invalid PHP code');
            }

            const varTypes = resolveTypeNames(fallbackProperty.type);
            if (fallbackProperty.nullable && !varTypes.includes('null')) {
                varTypes.push('null');
            }

            if (varTypes.length === 0) {
                throw new Error('Invalid PHP code');
            }

            this.applyResolvedProperty(nodeName(fallbackProperty.name), varTypes);
        } catch (error: any) {
            this.name = R_UNDEFINED_PROPERTY;
            this.type = null;
            this.hint = null;
            App.instance.showMessage(`Failed to parse property: ${error}.`, M_ERROR);
        }
    }

    private applyResolvedProperty(name: string | null, varTypes: Array<string>) {
        if (!name || varTypes.length === 0) {
            throw new Error('Invalid PHP code');
        }

        const joinedVarTypes = varTypes.join('|');
        this.hint = joinedVarTypes;

        const cleanTypes = [...varTypes];
        const index = cleanTypes.indexOf('null');
        if (index === -1) {
            this.type = joinedVarTypes;
        } else {
            cleanTypes.splice(index, 1);
            this.type = `?${cleanTypes.join('|')}`;
        }

        this.name = name;
    }

    public getFunction(type: string): string {
        const isBoolHint = ['bool', 'boolean'].includes(this.hint ?? '');
        const prefix = type === R_SETTER ? 'set' : (isBoolHint ? 'is' : 'get');

        return prefix + App.instance.capitalizeFirstCharTrimmed(this.name);
    }
}
