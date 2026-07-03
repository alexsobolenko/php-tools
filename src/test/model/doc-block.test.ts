import {createDocument, setWorkspaceFolder} from '../helpers/vscode';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Position} from 'vscode';
import {afterEach, describe, it} from 'node:test';
import {ClassBlock, ConstantBlock, FunctionBlock, PropertyBlock, VariableBlock} from '../../model/doc-block';
import {resetProjectCache} from '../../service/project';

function positionOf(source: string, needle: string): Position {
    const offset = source.indexOf(needle);
    const before = source.slice(0, offset);
    const lines = before.split('\n');

    return new Position(lines.length - 1, lines[lines.length - 1].length);
}

function documentOf(source: string) {
    return createDocument(source) as unknown as import('vscode').TextDocument;
}

const defaultDescriptionConfig = {showDescription: false, linesAfterDescription: 0};
const defaultFunctionDocConfig = {
    showDescription: false,
    linesAfterDescription: 0,
    returnVoid: false,
    linesBeforeReturn: 0,
    linesBeforeThrows: 0,
    showThrowsOnDiffLines: true,
};

const createdDirs: Array<string> = [];

describe('doc-block', () => {
    afterEach(() => {
        resetProjectCache();
        createdDirs.splice(0).forEach((dir) => fs.rmSync(dir, {recursive: true, force: true}));
    });

    describe('ClassBlock', () => {
        it('resolves the class keyword and name', () => {
            // php-parser reports `kind: "class"` regardless of the `final`/`abstract` modifiers,
            // so the generated description can't distinguish them either - this mirrors src2.
            const source = '<?php\nfinal class UserService\n{\n}\n';
            const document = documentOf(source);
            const block = new ClassBlock(document, positionOf(source, 'final class'));

            assert.strictEqual(block.template, '/**\n * Class UserService description.\n */\n');
        });

        it('records an error for an unparsable declaration', () => {
            const source = '<?php\n???\n';
            const document = documentOf(source);
            const block = new ClassBlock(document, positionOf(source, '???'));

            assert.ok(block.error);
        });
    });

    describe('ConstantBlock', () => {
        it('detects an explicitly typed constant (PHP 8.3 syntax)', () => {
            const source = '<?php\nclass Foo\n{\n    const int MAX = 10;\n}\n';
            const document = documentOf(source);
            const block = new ConstantBlock(document, positionOf(source, 'const int MAX'), defaultDescriptionConfig);

            assert.strictEqual(block.template, '    /**\n     * @var int\n     */\n');
        });

        it('falls back to mixed for an untyped constant', () => {
            const source = '<?php\nclass Foo\n{\n    const MAX = 10;\n}\n';
            const document = documentOf(source);
            const block = new ConstantBlock(document, positionOf(source, 'const MAX'), defaultDescriptionConfig);

            assert.strictEqual(block.template, '    /**\n     * @var mixed\n     */\n');
        });
    });

    describe('PropertyBlock', () => {
        it('resolves the property type via the shared Property service', () => {
            const source = '<?php\nclass Foo\n{\n    private ?string $name;\n}\n';
            const document = documentOf(source);
            const block = new PropertyBlock(document, positionOf(source, '$name'), defaultDescriptionConfig);

            assert.strictEqual(block.template, '    /**\n     * @var string|null\n     */\n');
        });

        it('also resolves a promoted constructor parameter (reuse benefit over the src2 version)', () => {
            const source = [
                '<?php',
                'class Foo',
                '{',
                '    public function __construct(',
                '        private readonly int $id,',
                '    ) {',
                '    }',
                '}',
                '',
            ].join('\n');
            const document = documentOf(source);
            const block = new PropertyBlock(document, positionOf(source, '$id'), defaultDescriptionConfig);

            assert.strictEqual(block.varHint, 'int');
        });
    });

    describe('VariableBlock', () => {
        it('detects a string variable', () => {
            const source = '<?php\n$name = "hello";\n';
            const document = documentOf(source);
            const block = new VariableBlock(document, positionOf(source, '$name'));

            assert.strictEqual(block.template, '/** @var string $name */\n');
        });

        it('detects an object variable from a new expression', () => {
            const source = '<?php\n$service = new UserService();\n';
            const document = documentOf(source);
            const block = new VariableBlock(document, positionOf(source, '$service'));

            assert.strictEqual(block.template, '/** @var UserService $service */\n');
        });
    });

    describe('FunctionBlock', () => {
        it('collects parameters and the return type', () => {
            const source = [
                '<?php',
                'class Foo',
                '{',
                '    public function bar(string $name): int',
                '    {',
                '        return 1;',
                '    }',
                '}',
                '',
            ].join('\n');
            const document = documentOf(source);
            const position = positionOf(source, 'public function bar');
            const block = new FunctionBlock(document, position, defaultFunctionDocConfig);

            assert.strictEqual(block.template, '    /**\n     * @param string $name\n     * @return int\n     */\n');
        });

        it('collects a direct throw', () => {
            const source = [
                '<?php',
                'class Foo',
                '{',
                '    public function bar(): void',
                '    {',
                '        throw new \\RuntimeException(\'nope\');',
                '    }',
                '}',
                '',
            ].join('\n');
            const document = documentOf(source);
            const position = positionOf(source, 'public function bar');
            const block = new FunctionBlock(document, position, defaultFunctionDocConfig);

            assert.deepStrictEqual(block.throws, ['\\RuntimeException']);
        });

        it('does not report a throw that is caught locally', () => {
            const source = [
                '<?php',
                'class Foo',
                '{',
                '    public function bar(): void',
                '    {',
                '        try {',
                '            throw new \\RuntimeException(\'nope\');',
                '        } catch (\\RuntimeException $e) {',
                '        }',
                '    }',
                '}',
                '',
            ].join('\n');
            const document = documentOf(source);
            const position = positionOf(source, 'public function bar');
            const block = new FunctionBlock(document, position, defaultFunctionDocConfig);

            assert.deepStrictEqual(block.throws, []);
        });

        it('follows a call into another file resolved through the PSR-4 autoload map', () => {
            const root = fs.mkdtempSync(path.join(os.tmpdir(), 'php-tools-docblock-'));
            createdDirs.push(root);
            const composer = {autoload: {'psr-4': {'App\\': 'src/'}}};
            fs.writeFileSync(path.join(root, 'composer.json'), JSON.stringify(composer));
            fs.mkdirSync(path.join(root, 'src'), {recursive: true});
            fs.writeFileSync(
                path.join(root, 'src', 'Gateway.php'),
                [
                    '<?php',
                    'namespace App;',
                    'class Gateway',
                    '{',
                    '    public function call(): void',
                    '    {',
                    '        throw new \\RuntimeException(\'down\');',
                    '    }',
                    '}',
                    '',
                ].join('\n'),
            );
            setWorkspaceFolder(root);

            const source = [
                '<?php',
                'namespace App;',
                'class Service',
                '{',
                '    public function __construct(private readonly Gateway $gateway)',
                '    {',
                '    }',
                '',
                '    public function run(): void',
                '    {',
                '        $this->gateway->call();',
                '    }',
                '}',
                '',
            ].join('\n');
            const document = documentOf(source);
            const position = positionOf(source, 'public function run');
            const block = new FunctionBlock(document, position, defaultFunctionDocConfig);

            assert.deepStrictEqual(block.throws, ['\\RuntimeException']);
        });
    });
});
