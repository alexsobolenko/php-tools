import {Position, TextDocument, TextLine} from 'vscode';
import {
    Class,
    ClassConstant,
    Declaration,
    Engine,
    Name,
    Namespace,
    Method,
    Parameter,
    Program,
    PropertyStatement,
    UseItem,
} from 'php-parser';
import App from '../../app';
import {
    A_DOC_LINES_AFTER_DESCR,
    A_DOC_LINES_BEFORE_RETURN,
    A_DOC_LINES_BEFORE_THROWS,
    A_DOC_RETURN_VOID,
    A_DOC_SHOW_DESCR,
    A_DOC_SHOW_THROWS_ON_DIFF_LINES,
    D_REGEX_CONSTANT,
    D_REGEX_FUNCTION,
    D_TYPE_FUNCTION,
    D_TYPE_CLASS,
    D_TYPE_CONSTANT,
    D_TYPE_PROPERTY,
    M_ERROR,
    D_VALID_KLASS,
} from '../../constants';
import {IParameter} from '../../interfaces';

// * BASE BLOCK CLASS
export class Block {
    public type: string;
    public name: string;
    public tab: string;
    public startLine: number;
    public activeLine: TextLine;
    public phpParser: Engine;

    public constructor(position: Position) {
        this.phpParser = new Engine(App.instance.composer('php-parser-params'));
        this.type = 'undefined';
        this.name = '';
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
}

// * REDECLARATION FOR CLASS BLOCK
export class ClassBlock extends Block {
    public kind: string;

    public constructor(position: Position) {
        super(position);

        this.type = D_TYPE_CLASS;
        this.kind = '';

        try {
            let declr = this.activeLine.text.trim();
            declr = `${declr} ${declr.includes('{') ? '}' : ' {}'}`;
            const program = this.parseCode(`<?php \n ${declr} \n`);
            const types = ['class', 'enum', 'interface', 'trait'];

            const klass = program.children.find((node) => types.includes(node.kind)) as Declaration|undefined;
            if (typeof klass === 'undefined') throw new Error('Invalid PHP code');

            const className = klass.name as Name;
            this.name = className.name;
            this.kind = klass.kind;
        } catch (error: any) {
            App.instance.showMessage(`Failed to parse class: ${error}.`, M_ERROR);
        }
    }

    public get template(): string {
        const name = `${App.instance.capitalizeFirstCharTrimmed(this.kind)} ${this.name}`;

        return App.instance.arrayToPhpdoc([`${name} description.`], this.tab);
    }
}

// * REDECLARATION FOR CONSTANT BLOCK
export class ConstantBlock extends Block {
    public constType: string|null;

    public constructor(position: Position) {
        super(position);

        this.type = D_TYPE_CONSTANT;

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

            const klass = program.children.find((node) => D_VALID_KLASS.includes(node.kind)) as Class|undefined;
            if (typeof klass === 'undefined') throw new Error('Invalid PHP code');

            const stmt = klass.body.find((node) => node.kind === 'classconstant') as ClassConstant|undefined;
            if (typeof stmt === 'undefined') throw new Error('Invalid PHP code');

            const konst = stmt.constants.find((node) => node.kind === 'constant') as any;
            if (typeof konst === 'undefined') throw new Error('Invalid PHP code');

            this.name = (konst.name as Name).name;
            const matches = declr.match(D_REGEX_CONSTANT) as Array<string>|null;

            // eslint-disable-next-line max-len
            this.constType = (matches && matches.length >= 3) ? (/^[A-Z]+$/.test(matches[2]) ? 'mixed' : matches[2]) : 'mixed';
        } catch (error: any) {
            this.constType = 'mixed';
            App.instance.showMessage(`Failed to parse class: ${error}.`, M_ERROR);
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

        data.push(`@var ${this.constType}`);

        return App.instance.arrayToPhpdoc(data, this.tab);
    }
}

// * REDECLARATION FOR FUNCTION BLOCK
export class FunctionBlock extends Block {
    public params: Array<IParameter>;
    public returnHint: string;
    public throws: Array<string>;

    public constructor(position: Position) {
        super(position);

        this.type = D_TYPE_FUNCTION;
        this.params = [];
        this.throws = [];
        this.returnHint = '';

        const document = App.instance.editor.document as TextDocument;
        const code = document.getText();

        let ast = null;
        try {
            const funcDeclr = document.lineAt(this.startLine).text.trim();
            const matches = funcDeclr.match(D_REGEX_FUNCTION) as Array<any>;
            if (!matches[1]) {
                throw new Error('Function name not found');
            }

            this.name = matches[1] as string;

            ast = this.parseCode(code);

            let klass: Class|undefined;
            const uses: Array<string> = [];
            const namespace = ast.children.find((node) => node.kind === 'namespace') as Namespace|undefined;
            if (namespace) {
                klass = namespace.children.find((node: any) => D_VALID_KLASS.includes(node.kind)) as Class|undefined;
                namespace.children.forEach((ug: any) => {
                    const name = ug.name as string;
                    if ('items' in ug) {
                        const items = ug.items as Array<any>;
                        items.forEach((item: UseItem) => {
                            uses.push(name === null ? item.name : `${name}\\${item.name}`);
                        });
                    }
                });
            } else {
                klass = ast.children.find((node: any) => D_VALID_KLASS.includes(node.kind)) as Class|undefined;
            }

            if (typeof klass === 'undefined') throw new Error('Class declaration not found');

            let func: Method|undefined;
            klass.body.forEach((node: any) => {
                if (node.kind === 'method') {
                    const name = node.name as Name;
                    if (name.name === this.name) {
                        func = node as Method;
                    }
                }
            });
            if (typeof func === 'undefined') throw new Error('Method declaration not found');

            this.params = func.arguments.map((arg: Parameter) => this.convertParam(arg));

            this.findThrows(func.body);

            if (this.name === '__construct') {
                this.returnHint = 'void';
            } else {
                const funcType = func.type as any;
                // eslint-disable-next-line max-len
                const types = funcType ? (func.type.kind === 'uniontype' ? funcType.types.map((t: Name) => t.name) : [funcType.name]) : ['mixed'];
                if (func.nullable && !types.includes('void') && !types.includes('null')) types.push('null');
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
        // eslint-disable-next-line max-len
        const emptyLinesBeforeReturn = (!returnVoid && this.returnHint === 'void') ? 0 : App.instance.config(A_DOC_LINES_BEFORE_RETURN, 0);
        for (let i = 0; i < emptyLinesBeforeReturn; i++) {
            data.push('');
        }

        if (returnVoid || this.returnHint !== 'void') {
            data.push(`@return ${this.returnHint}`);
        }

        const emptyLinesBeforeThrows = App.instance.config(A_DOC_LINES_BEFORE_THROWS, 0);
        if (this.throws.length > 0 && emptyLinesBeforeThrows > 0) {
            for (let i = 0; i < emptyLinesBeforeThrows; i++) {
                data.push('');
            }
        }

        const showThrowsOnDiffLines = !!App.instance.config(A_DOC_SHOW_THROWS_ON_DIFF_LINES, true);
        (showThrowsOnDiffLines ? this.throws : [this.throws.join('|')]).forEach((v: string) => {
            data.push(`@throws ${v}`);
        });

        return App.instance.arrayToPhpdoc(data, this.tab);
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
        if (arg.nullable && !types.includes('null')) types.push('null');

        return {
            name: (arg.name as Name).name,
            hint: types.join('|'),
        };
    }

    private findThrows(body: any) {
        if (!body || !('children' in body)) return;

        body.children.forEach((node: any) => {
            const item = node.kind === 'expressionstatement' ? node.expression : node;
            switch (item.kind) {
                case 'throw':
                    const name = item.what.name || item.what.what.name;
                    if (!this.throws.includes(name)) {
                        this.throws.push(name);
                    }
                    break;
                default:
                    if (item.body) {
                        this.findThrows(item.body);
                    }
                    if (item.alternate) {
                        this.findThrows(item.alternate);
                    }
                    if (item.catches) {
                        item.catches.forEach((ctch: any) => {
                            this.findThrows(ctch.body);
                        });
                    }
            }
        });
    }
}

// * REDECLARATION FOR PROPERTY BLOCK
export class PropertyBlock extends Block {
    public varHint: string;

    public constructor(position: Position) {
        super(position);

        this.type = D_TYPE_PROPERTY;

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

            const klass = program.children.find((node) => D_VALID_KLASS.includes(node.kind)) as Class|undefined;
            if (typeof klass === 'undefined') throw new Error('Invalid PHP code');

            const stmt = klass.body.find((node) => node.kind === 'propertystatement') as PropertyStatement|undefined;
            if (typeof stmt === 'undefined') throw new Error('Invalid PHP code');

            const prop = stmt.properties.find((node) => node.kind === 'property') as any;
            if (typeof prop === 'undefined') throw new Error('Invalid PHP code');

            this.name = (prop.name as Name).name;

            const types = prop.type.kind === 'uniontype' ? prop.type.types.map((t: Name) => t.name) : [prop.type.name];
            if (prop.nullable && !types.includes('null')) types.push('null');

            this.varHint = types.join('|');
        } catch (error: any) {
            this.varHint = 'mixed';
            App.instance.showMessage(`Failed to parse class: ${error}.`, M_ERROR);
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

        data.push(`@var ${this.varHint}`);

        return App.instance.arrayToPhpdoc(data, this.tab);
    }
}
