import {Engine, Program} from 'php-parser';

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
        parser = new Engine({
            parser: {extractDoc: true, suppressErrors: true, version: '8.2'},
            ast: {withPositions: true},
        });
    }

    return parser;
}

export function parsePhp(buffer: string): Program {
    return phpParser().parseCode(buffer, '');
}

export function tryParsePhp(buffer: string): Program | null {
    try {
        return parsePhp(buffer);
    } catch (error) {
        return null;
    }
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
