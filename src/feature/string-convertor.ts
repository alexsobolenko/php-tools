import {Position, Range, TextDocument, TextEditor, TextEditorEdit} from 'vscode';
import Feature from '../feature';
import {CONV, MESSAGE} from '../constants';
import {IPhpNode, nodeName, tryParsePhp, walkPhp} from '../service/php-ast';

export default class StringConvertor extends Feature {
    public target: string;
    private range: Range|null = null;

    public constructor(target: string) {
        super();
        this.target = target;
    }

    public render() {
        if (!this.activeEditor) {
            return;
        }

        const template = this.template();
        if (template === '' || this.range === null) {
            // eslint-disable-next-line max-len
            this.showMessage('No string expression found to convert, or the expression already does not need conversion.', MESSAGE.INFO);

            return;
        }

        this.activeEditor.edit((edit: TextEditorEdit) => {
            edit.replace(this.range as Range, template);
        });
    }

    private template(): string {
        if (!this.activeEditor) {
            return '';
        }

        const {document, selection} = this.activeEditor;
        const source = this.findSource(document, selection.active);
        if (source === null || source.type === this.target) {
            return '';
        }

        const range = this.nodeRange(document, source.node);
        if (range === null) {
            return '';
        }

        const parts = this.collectParts(document, source.type, source.node);
        if (parts === null || !this.hasExpression(parts)) {
            return '';
        }

        let template = '';
        if (this.target === CONV.CONCATENATION) {
            template = this.concatenationTemplate(parts);
        } else if (this.target === CONV.INTERPOLATION) {
            template = this.interpolationTemplate(parts);
        } else if (this.target === CONV.SPRINTF) {
            template = this.sprintfTemplate(parts);
        }

        if (template === '' || document.getText(range).trim() === template) {
            return '';
        }

        this.range = range;

        return template;
    }

    private findSource(document: TextDocument, position: Position): {type: string, node: IPhpNode}|null {
        const program = tryParsePhp(document.getText());
        if (program === null) {
            return null;
        }

        const offset = document.offsetAt(position);
        const candidates: Array<{type: string, node: IPhpNode}> = [];
        walkPhp(program, (node, parent) => {
            if (!this.nodeContainsOffset(node, offset)) {
                return;
            }

            if (this.isConcat(node) && !this.isConcat(parent)) {
                candidates.push({type: CONV.CONCATENATION, node});

                return;
            }

            if (this.isSprintf(node)) {
                candidates.push({type: CONV.SPRINTF, node});

                return;
            }

            if ((node as IPhpNode).kind === 'encapsed') {
                candidates.push({type: CONV.INTERPOLATION, node});
            }
        });
        candidates.sort((left, right) => this.nodeLength(left.node) - this.nodeLength(right.node));

        return candidates[0] ?? null;
    }

    private collectParts(document: TextDocument, type: string, node: IPhpNode): Array<any>|null {
        if (type === CONV.CONCATENATION) {
            return this.collectConcatParts(document, node);
        }

        if (type === CONV.INTERPOLATION) {
            return this.collectInterpolationParts(document, node);
        }

        if (type === CONV.SPRINTF) {
            return this.collectSprintfParts(document, node);
        }

        return null;
    }

    private collectConcatParts(document: TextDocument, node: IPhpNode): Array<any> {
        const result: Array<any> = [];
        const collect = (current: IPhpNode) => {
            if (this.isConcat(current)) {
                collect(current.left);
                collect(current.right);

                return;
            }

            this.pushPart(result, this.nodePart(document, current));
        };

        collect(node);

        return result;
    }

    private collectInterpolationParts(document: TextDocument, node: IPhpNode): Array<any>|null {
        const result: Array<any> = [];
        for (const part of node.value ?? []) {
            const {expression} = part;
            if (!expression) {
                return null;
            }

            if (expression.kind === 'string') {
                this.pushTextPart(result, expression.value ?? '');
            } else {
                this.pushPart(result, {
                    type: 'expression',
                    node: expression,
                    value: this.nodeText(document, expression).trim(),
                });
            }
        }

        return result;
    }

    private collectSprintfParts(document: TextDocument, node: IPhpNode): Array<any>|null {
        const args = node.arguments ?? [];
        const [formatNode, ...expressions] = args;
        if (!formatNode || formatNode.kind !== 'string' || typeof formatNode.value !== 'string') {
            return null;
        }

        const result: Array<any> = [];
        const used = new Set<number>();
        let index = 0;
        let argumentIndex = 0;
        while (index < formatNode.value.length) {
            const percent = formatNode.value.indexOf('%', index);
            if (percent === -1) {
                this.pushTextPart(result, formatNode.value.slice(index));
                break;
            }

            this.pushTextPart(result, formatNode.value.slice(index, percent));
            if (formatNode.value[percent + 1] === '%') {
                this.pushTextPart(result, '%');
                index = percent + 2;
                continue;
            }

            const placeholder = this.readSprintfPlaceholder(formatNode.value, percent);
            if (placeholder === null) {
                return null;
            }

            const resolvedIndex = placeholder.position === null ? argumentIndex++ : placeholder.position - 1;
            const expression = expressions[resolvedIndex];
            if (!expression) {
                return null;
            }

            used.add(resolvedIndex);
            this.pushPart(result, {
                type: 'expression',
                node: expression,
                value: this.nodeText(document, expression).trim(),
            });
            index = placeholder.end;
        }

        if (used.size !== expressions.length) {
            return null;
        }

        return result;
    }

    private readSprintfPlaceholder(format: string, start: number): {end: number, position: number|null}|null {
        // eslint-disable-next-line max-len
        const matches = format.slice(start).match(/^%(?:(\d+)\$)?[-+ 0'#]*(?:\*|\d+)?(?:\.(?:\*|\d+))?([bcdeEfFgGosuxX])/u);
        if (!matches || matches[2] !== 's') {
            return null;
        }

        return {
            end: start + matches[0].length,
            position: matches[1] ? parseInt(matches[1], 10) : null,
        };
    }

    private nodePart(document: TextDocument, node: IPhpNode): any|null {
        if (node.kind === 'string') {
            return {type: 'text', node: null, value: node.value ?? ''};
        }

        const value = this.nodeText(document, node).trim();
        if (value === '') {
            return null;
        }

        return {type: 'expression', node, value};
    }

    private concatenationTemplate(parts: Array<any>): string {
        const result = parts
            .filter((part) => part.value !== '')
            .map((part) => part.type === 'text' ? this.quoteSingleString(part.value) : this.concatExpression(part));

        return result.join(' . ');
    }

    private interpolationTemplate(parts: Array<any>): string {
        const result: Array<string> = [];
        for (const part of parts) {
            if (part.type === 'text') {
                result.push(this.escapeDoubleQuotedString(part.value));
                continue;
            }

            const expression = this.interpolationExpression(part.node);
            if (expression === null) {
                return '';
            }

            result.push(`{${expression}}`);
        }

        return `"${result.join('')}"`;
    }

    private sprintfTemplate(parts: Array<any>): string {
        const args: Array<string> = [];
        let format = '';
        parts.forEach((part) => {
            if (part.type === 'text') {
                format += part.value.replace(/%/g, '%%');
            } else {
                format += '%s';
                args.push(part.value);
            }
        });

        return args.length > 0 ? `sprintf(${[this.quoteSingleString(format), ...args].join(', ')})` : '';
    }

    private concatExpression(part: any): string {
        if (part.node && [
            'boolean',
            'call',
            'identifier',
            'name',
            'number',
            'nullkeyword',
            'offsetlookup',
            'propertylookup',
            'staticlookup',
            'string',
            'variable',
        ].includes(part.node.kind ?? '')) {
            return part.value;
        }

        return `(${part.value})`;
    }

    private interpolationExpression(node: IPhpNode): string|null {
        if (node.kind === 'variable') {
            const name = nodeName(node);

            return this.isVariableName(name) ? `$${name}` : null;
        }

        if (node.kind === 'propertylookup') {
            const owner = this.interpolationExpression(node.what);
            const property = this.propertyName(node.offset);

            return owner !== null && property !== null ? `${owner}->${property}` : null;
        }

        if (node.kind === 'staticlookup') {
            const owner = this.interpolationExpression(node.what);
            const property = this.propertyName(node.offset);

            return owner !== null && property !== null ? `${owner}::${property}` : null;
        }

        if (node.kind === 'offsetlookup') {
            const owner = this.interpolationExpression(node.what);
            const offset = this.offsetName(node.offset);

            return owner !== null && offset !== null ? `${owner}[${offset}]` : null;
        }

        return null;
    }

    private propertyName(node: IPhpNode): string|null {
        if (node.kind === 'identifier') {
            return nodeName(node);
        }

        if (node.kind === 'variable') {
            const name = nodeName(node);

            return this.isVariableName(name) ? `$${name}` : null;
        }

        return null;
    }

    private offsetName(node: IPhpNode|null|undefined): string|null {
        if (!node) {
            return null;
        }

        if (node.kind === 'number') {
            return String(node.value);
        }

        if (node.kind === 'string') {
            const value = typeof node.value === 'string' ? node.value : '';
            if (/[\r\n]/u.test(value)) {
                return null;
            }

            return this.quoteSingleString(value);
        }

        if (node.kind === 'variable') {
            const name = nodeName(node);

            return this.isVariableName(name) ? `$${name}` : null;
        }

        return null;
    }

    private pushPart(parts: Array<any>, part: any|null) {
        if (part === null) {
            return;
        }

        if (part.type === 'text') {
            this.pushTextPart(parts, part.value);

            return;
        }

        parts.push(part);
    }

    private pushTextPart(parts: Array<any>, value: string) {
        if (value === '') {
            return;
        }

        const previous = parts[parts.length - 1];
        if (previous?.type === 'text') {
            previous.value += value;
        } else {
            parts.push({type: 'text', node: null, value});
        }
    }

    private hasExpression(parts: Array<any>): boolean {
        return parts.some((part) => part.type === 'expression');
    }

    private isConcat(node: IPhpNode|null|undefined): node is IPhpNode {
        return node?.kind === 'bin' && node.type === '.';
    }

    private isSprintf(node: IPhpNode|null|undefined): node is IPhpNode {
        if (node?.kind !== 'call') {
            return false;
        }

        const name = nodeName(node.what);

        return name !== null && name.replace(/^\\/u, '').toLowerCase() === 'sprintf';
    }

    private nodeContainsOffset(node: IPhpNode, offset: number): boolean {
        const start = node.loc?.start?.offset;
        const end = node.loc?.end?.offset;
        if (typeof start !== 'number' || typeof end !== 'number') {
            return false;
        }

        return (start <= offset && offset <= end)
            || (offset > 0 && start <= offset - 1 && offset - 1 <= end);
    }

    private nodeRange(document: TextDocument, node: IPhpNode): Range|null {
        const start = node.loc?.start?.offset;
        const end = node.loc?.end?.offset;
        if (typeof start !== 'number' || typeof end !== 'number') {
            return null;
        }

        return new Range(document.positionAt(start), document.positionAt(end));
    }

    private nodeLength(node: IPhpNode): number {
        const start = node.loc?.start?.offset;
        const end = node.loc?.end?.offset;
        if (typeof start !== 'number' || typeof end !== 'number') {
            return 0;
        }

        return end - start;
    }

    private nodeText(document: TextDocument, node: IPhpNode): string {
        const range = this.nodeRange(document, node);

        return range === null ? '' : document.getText(range);
    }

    private quoteSingleString(value: string): string {
        return `'${value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'`;
    }

    private escapeDoubleQuotedString(value: string): string {
        return value
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\$/g, '\\$')
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n')
            .replace(/\t/g, '\\t');
    }

    private isVariableName(value: string|null): value is string {
        return value !== null && /^[A-Za-z_][A-Za-z0-9_]*$/u.test(value);
    }
}
