import {createEditor, messages, resetVscodeMock, setQuickPickResult, window} from '../helpers/vscode';
import assert from 'node:assert';
import {Position} from 'vscode';
import {afterEach, describe, it} from 'node:test';
import Documenter from '../../feature/documenter';

function positionOf(source: string, needle: string): Position {
    const offset = source.indexOf(needle);
    const before = source.slice(0, offset);
    const lines = before.split('\n');

    return new Position(lines.length - 1, lines[lines.length - 1].length);
}

describe('Documenter', () => {
    afterEach(() => {
        resetVscodeMock();
    });

    it('generates a phpdoc block for the declaration under the cursor', () => {
        const source = [
            '<?php',
            'class User',
            '{',
            '    private string $name;',
            '}',
            '',
        ].join('\n');
        const {editor, replacement} = createEditor(source, 0);
        window.activeTextEditor = editor;

        const documenter = new Documenter([positionOf(source, 'private string $name')]);
        documenter.render();

        assert.strictEqual(replacement.value, '    /**\n     * @var string\n     */\n');
    });

    it('skips a declaration that already has a phpdoc block and shows an info message', () => {
        const source = [
            '<?php',
            'class User',
            '{',
            '    /**',
            '     * @var string',
            '     */',
            '    private string $name;',
            '}',
            '',
        ].join('\n');
        const {editor, edits} = createEditor(source, 0);
        window.activeTextEditor = editor;

        const documenter = new Documenter([positionOf(source, 'private string $name')]);
        documenter.render();

        assert.strictEqual(edits.length, 0);
        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0].type, 'info');
    });

    it('shows no message when the master flow is confirmed with nothing selected', () => {
        const source = [
            '<?php',
            'class User',
            '{',
            '    private string $name;',
            '}',
            '',
        ].join('\n');
        const {editor, edits} = createEditor(source, 0);
        window.activeTextEditor = editor;

        const documenter = new Documenter([]);
        documenter.render();

        assert.strictEqual(edits.length, 0);
        assert.strictEqual(messages.length, 0);
    });

    it('lets the user pick multiple declarations via the master flow', async () => {
        const source = [
            '<?php',
            'class User',
            '{',
            '    private string $name;',
            '    private int $age;',
            '}',
            '',
        ].join('\n');
        const {editor, edits} = createEditor(source, 0);
        window.activeTextEditor = editor;

        // Discover the exact labels selectBlocks generates, instead of guessing its regex output.
        // The class declaration line is itself a selectable block, alongside the two properties.
        await Documenter.selectBlocks('Select blocks');
        const labels = window.lastQuickPickItems ?? [];
        assert.strictEqual(labels.length, 3);

        const propertyLabels = labels.filter((label) => label.includes('(Property)'));
        assert.strictEqual(propertyLabels.length, 2);

        setQuickPickResult(propertyLabels);
        const positions = await Documenter.selectBlocks('Select blocks');
        const documenter = new Documenter(positions);
        documenter.render();

        const templates = edits.map((edit) => edit.value);
        assert.ok(templates.some((t) => t.includes('@var string')));
        assert.ok(templates.some((t) => t.includes('@var int')));
    });

    it('adds a missing import and a short exception name for a cross-namespace throw', () => {
        // Vendor\NotFoundException is neither in the current namespace (App) nor global,
        // so prepareThrowsForRender must add a use import and shorten the @throws entry.
        const source = [
            '<?php',
            'namespace App;',
            '',
            'class Service',
            '{',
            '    public function run(): void',
            '    {',
            '        throw new \\Vendor\\NotFoundException(\'nope\');',
            '    }',
            '}',
            '',
        ].join('\n');
        const {editor, edits} = createEditor(source, 0);
        window.activeTextEditor = editor;

        const documenter = new Documenter([positionOf(source, 'public function run')]);
        documenter.render();

        const insert = edits.find((edit) => edit.type === 'insert');
        assert.ok(insert);
        assert.strictEqual(insert?.value, '\nuse Vendor\\NotFoundException;\n');

        const replace = edits.find((edit) => edit.type === 'replace');
        assert.ok(replace?.value.includes('@throws NotFoundException'));
    });

    it('does not offer a promoted constructor parameter as a separate Property entry', async () => {
        const source = [
            '<?php',
            '',
            'declare(strict_types=1);',
            '',
            'namespace App\\Repository;',
            '',
            'class Test',
            '{',
            '    public function __construct(',
            '        private int $x',
            '    ) {}',
            '}',
            '',
        ].join('\n');
        const {editor} = createEditor(source, 0);
        window.activeTextEditor = editor;

        await Documenter.selectBlocks('Select blocks');
        const labels = window.lastQuickPickItems ?? [];

        assert.strictEqual(labels.length, 2);
        assert.ok(labels.some((label) => label.includes('(Class)')));
        assert.ok(labels.some((label) => label.includes('(Function)')));
        assert.ok(!labels.some((label) => label.includes('(Property)')));
    });
});
