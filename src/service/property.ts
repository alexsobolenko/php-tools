import {Position, TextDocument} from 'vscode';
import {PHPDOC, PROP} from '../constants';
import {IPhpNode, nodeName, parsePhp, walkPhp} from './php-ast';

export default class Property {
    public name: string = PROP.UNDEFINED;
    public tab: string;
    public type: string|null = null;
    public hint: string|null = null;
    public className: string = 'self';
    public error: string|null = null;

    public constructor(document: TextDocument, position: Position) {
        this.tab = this.resolveClassIndent(document, position);
        try {
            this.className = this.resolveClassName(document, position);
            if (!this.resolveFromAst(document, position)) {
                this.resolveFromFallback(document, position);
            }
        } catch (error) {
            this.name = PROP.UNDEFINED;
            this.type = null;
            this.hint = null;
            this.error = `Failed to parse property: ${(error as Error).message}.`;
        }
    }

    private resolveFromAst(document: TextDocument, position: Position): boolean {
        const offset = document.offsetAt(position);
        const program = parsePhp(document.getText());
        let resolved = false;

        walkPhp(program, (node) => {
            if (resolved || !this.nodeHasOffset(node, offset)) {
                return;
            }

            const isProperty = node.kind === 'property';
            const isPromotedParameter = node.kind === 'parameter' && typeof node.flags === 'number' && node.flags > 0;
            if (!isProperty && !isPromotedParameter) {
                return;
            }

            const varTypes = this.resolveTypeNames(node.type);
            if (node.nullable && !varTypes.includes('null')) {
                varTypes.push('null');
            }

            if (varTypes.length === 0) {
                throw new Error('Invalid PHP code');
            }

            this.applyResolvedProperty(nodeName(node.name), varTypes);
            resolved = true;
        });

        return resolved;
    }

    private resolveFromFallback(document: TextDocument, position: Position): void {
        const activeLine = document.lineAt(position.line);
        for (let i = 0; i < position.line; i++) {
            const {text} = document.lineAt(i);
            if (text.includes('class')) {
                const matches = text.match(PHPDOC.CLASS.REGEX);
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

        const varTypes = this.resolveTypeNames(fallbackProperty.type);
        if (fallbackProperty.nullable && !varTypes.includes('null')) {
            varTypes.push('null');
        }

        if (varTypes.length === 0) {
            throw new Error('Invalid PHP code');
        }

        this.applyResolvedProperty(nodeName(fallbackProperty.name), varTypes);
    }

    private applyResolvedProperty(name: string|null, varTypes: Array<string>): void {
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

    private resolveClassName(document: TextDocument, position: Position): string {
        const offset = document.offsetAt(position);
        const program = parsePhp(document.getText());
        let result = 'self';

        walkPhp(program, (node) => {
            if (this.classLikeName(node) && this.nodeHasOffset(node, offset)) {
                result = this.classLikeName(node) ?? result;
            }
        });

        return result;
    }

    private resolveClassIndent(document: TextDocument, position: Position): string {
        const offset = document.offsetAt(position);
        const program = parsePhp(document.getText());
        let classNode: IPhpNode|null = null;

        walkPhp(program, (node) => {
            if (this.classLikeName(node) && this.nodeHasOffset(node, offset)) {
                classNode = node;
            }
        });

        const resolvedClassNode: IPhpNode|null = classNode as IPhpNode|null;
        if (resolvedClassNode && resolvedClassNode.loc?.start?.line && resolvedClassNode.loc.end?.line) {
            const classStartLine = resolvedClassNode.loc.start.line - 1;
            const classEndLine = resolvedClassNode.loc.end.line - 1;
            const classLineTab = this.resolveLineTab(document, classStartLine);

            for (let lineNumber = classStartLine + 1; lineNumber < classEndLine; lineNumber++) {
                const line = document.lineAt(lineNumber);
                const trimmed = line.text.trim();
                if (trimmed === '' || trimmed === '{' || trimmed === '}') {
                    continue;
                }

                const lineTab = this.resolveLineTab(document, lineNumber);
                if (lineTab.length > classLineTab.length) {
                    return lineTab;
                }
            }

            const classLine = document.lineAt(classStartLine).text;
            const indentUnit = classLine.includes('\t') ? '\t' : '    ';

            return `${classLineTab}${indentUnit}`;
        }

        return this.resolveLineTab(document, position.line);
    }

    private resolveLineTab(document: TextDocument, line: number): string {
        const textLine = document.lineAt(line);

        return textLine.text.substring(0, textLine.firstNonWhitespaceCharacterIndex);
    }

    private classLikeName(node: IPhpNode|null|undefined): string|null {
        if (!node || !['class', 'trait', 'enum'].includes(node.kind ?? '')) {
            return null;
        }

        return nodeName(node.name);
    }

    private nodeHasOffset(node: IPhpNode|null|undefined, offset: number): boolean {
        const start = node?.loc?.start?.offset;
        const end = node?.loc?.end?.offset;

        return typeof start === 'number' && typeof end === 'number' && start <= offset && offset <= end;
    }

    private resolveTypeNames(typeNode: any): Array<string> {
        if (!typeNode || typeof typeNode !== 'object') {
            return [];
        }

        if (typeNode.kind === 'uniontype' || typeNode.kind === 'intersectiontype') {
            return typeNode.types.flatMap((node: any) => this.resolveTypeNames(node));
        }

        const typeName = nodeName(typeNode);

        return typeName ? [typeName] : [];
    }

    public getFunction(type: string): string {
        const isBoolHint = ['bool', 'boolean'].includes(this.hint ?? '');
        const prefix = type === PROP.SETTER ? 'set' : (isBoolHint ? 'is' : 'get');

        return prefix + this.capitalizeFirstCharTrimmed(this.name);
    }

    private capitalizeFirstCharTrimmed(input: string): string {
        const trimmedInput = input.trim();
        if (!trimmedInput) {
            return trimmedInput;
        }

        return trimmedInput.charAt(0).toUpperCase() + trimmedInput.slice(1);
    }
}
