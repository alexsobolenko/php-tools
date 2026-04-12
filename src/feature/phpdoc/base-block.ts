import {Position, TextLine} from 'vscode';
import {Engine, Program} from 'php-parser';
import App from '../../app';

export class Block {
    public type: string;
    public name: string;
    public tab: string;
    public startLine: number;
    public activeLine: TextLine;
    public phpParser: Engine;
    public importsToAdd: Array<string>;

    public constructor(position: Position) {
        this.phpParser = new Engine(App.instance.composer('php-parser-params'));
        this.type = 'undefined';
        this.name = '';
        this.importsToAdd = [];
        this.activeLine = App.instance.editor.document.lineAt(position.line);
        this.tab = this.activeLine.text.substring(0, this.activeLine.firstNonWhitespaceCharacterIndex);
        this.startLine = position.line;
    }

    public get template(): string {
        return '';
    }

    protected parseCode(buffer: string): Program {
        return this.phpParser.parseCode(buffer, '');
    }

    protected wrapTemplate(template: string, addLeadingEmptyLine: boolean = false): string {
        if (!addLeadingEmptyLine) {
            return template;
        }

        const {document} = App.instance.editor;
        for (let lineNumber = this.startLine - 1; lineNumber >= 0; lineNumber--) {
            const prevLine = document.lineAt(lineNumber).text.trim();
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
