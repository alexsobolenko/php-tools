import {Position} from 'vscode';
import {Method} from 'php-parser';
import App from '../../app';
import {M_ERROR} from '../../constants';
import {Block} from './base-block';

export class VariableBlock extends Block {
    public varHint: string;

    public constructor(position: Position) {
        super(position);

        this.type = 'variable';
        this.varHint = 'mixed';

        try {
            const line = this.activeLine.text.trim();
            const declr = line.endsWith(';') ? line : `${line};`;
            const program = this.parseCode(`<?php function demo() { ${declr} }`);

            const func = program.children.find((node) => node.kind === 'function') as Method|undefined;
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
        } catch (error: any) {
            this.varHint = 'mixed';
            App.instance.showMessage(`Failed to parse variable: ${error}.`, M_ERROR);
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
