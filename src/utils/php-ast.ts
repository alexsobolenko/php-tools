import {Range, TextDocument} from 'vscode';
import {Engine, Program} from 'php-parser';
import App from '../app';

export interface IPhpNode {
    kind?: string;
    name?: any;
    loc?: {
        start?: {
            line?: number;
            offset?: number;
        };
        end?: {
            line?: number;
            offset?: number;
        };
    };
    [key: string]: any;
}

let parser: Engine | null = null;

function phpParser(): Engine {
    if (parser === null) {
        parser = new Engine(App.instance.composer('php-parser-params'));
    }

    return parser;
}

export function parsePhp(buffer: string): Program {
    return phpParser().parseCode(buffer, '');
}

export function walkPhp(
    node: any,
    callback: (node: IPhpNode, parent: IPhpNode | null) => void,
    parent: IPhpNode | null = null,
): void {
    if (Array.isArray(node)) {
        node.forEach((child) => walkPhp(child, callback, parent));

        return;
    }

    if (!node || typeof node !== 'object') {
        return;
    }

    const current = node as IPhpNode;
    callback(current, parent);

    Object.values(current).forEach((value) => {
        if (!value || typeof value !== 'object') {
            return;
        }

        if (Array.isArray(value)) {
            value.forEach((child) => walkPhp(child, callback, current));
        } else if ('kind' in value) {
            walkPhp(value, callback, current);
        }
    });
}

export function nodeRange(document: TextDocument, node: IPhpNode): Range | null {
    const start = node.loc?.start?.offset;
    const end = node.loc?.end?.offset;
    if (typeof start !== 'number' || typeof end !== 'number') {
        return null;
    }

    return new Range(document.positionAt(start), document.positionAt(end));
}

export function nodeName(node: any): string | null {
    if (typeof node === 'string') {
        return node;
    }

    if (!node || typeof node !== 'object') {
        return null;
    }

    if (typeof node.name === 'string') {
        return node.name;
    }

    if (typeof node.value === 'string') {
        return node.value;
    }

    return null;
}

export function collectUseStatements(program: Program): Map<string, string> {
    const uses = new Map<string, string>();

    walkPhp(program, (node) => {
        if (node.kind !== 'useitem') {
            return;
        }

        const fullName = nodeName(node.name);
        if (!fullName) {
            return;
        }

        const alias = nodeName(node.alias) ?? fullName.split('\\').pop() ?? fullName;
        uses.set(alias, fullName.replace(/^\\/, ''));
    });

    return uses;
}

export function resolveClassReference(node: any, uses: Map<string, string>): string | null {
    if (!node || typeof node !== 'object') {
        return null;
    }

    if (node.kind === 'string') {
        const value = nodeName(node);

        return value && value.includes('\\') ? value.replace(/^\\/, '') : null;
    }

    if (node.kind === 'staticlookup' && nodeName(node.offset) === 'class') {
        const shortName = nodeName(node.what);
        if (!shortName) {
            return null;
        }

        return uses.get(shortName) ?? shortName.replace(/^\\/, '');
    }

    const value = nodeName(node);

    return value && value.includes('\\') ? value.replace(/^\\/, '') : null;
}
