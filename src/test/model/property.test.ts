import {createDocument} from '../helpers/vscode';
import assert from 'node:assert';
import {describe, it} from 'node:test';
import Property from '../../model/property';
import {PROP} from '../../constants';

function positionOf(document: {getText(): string}, needle: string): {line: number, character: number} {
    const text = document.getText();
    const offset = text.indexOf(needle);
    const before = text.slice(0, offset);
    const lines = before.split('\n');

    return {line: lines.length - 1, character: lines[lines.length - 1].length};
}

// The mock document/position only implement the subset of the real vscode API that Property
// actually uses, so a cast is needed to satisfy the production constructor's real vscode types.
function resolveProperty(document: unknown, position: unknown): Property {
    return new Property(document as any, position as any);
}

describe('Property', () => {
    it('resolves a typed property declaration', () => {
        const source = [
            '<?php',
            'class User',
            '{',
            '    private string $name;',
            '}',
        ].join('\n');
        const document = createDocument(source);
        const position = positionOf(document, '$name');

        const property = resolveProperty(document, position);

        assert.strictEqual(property.name, 'name');
        assert.strictEqual(property.type, 'string');
        assert.strictEqual(property.hint, 'string');
        assert.strictEqual(property.className, 'User');
        assert.strictEqual(property.tab, '    ');
    });

    it('resolves a nullable property and appends null to the hint', () => {
        const source = [
            '<?php',
            'class User',
            '{',
            '    private ?string $name;',
            '}',
        ].join('\n');
        const document = createDocument(source);
        const position = positionOf(document, '$name');

        const property = resolveProperty(document, position);

        assert.strictEqual(property.name, 'name');
        assert.strictEqual(property.type, '?string');
        assert.strictEqual(property.hint, 'string|null');
    });

    it('resolves a promoted constructor parameter', () => {
        const source = [
            '<?php',
            'class User',
            '{',
            '    public function __construct(',
            '        private readonly int $id,',
            '    ) {',
            '    }',
            '}',
        ].join('\n');
        const document = createDocument(source);
        const position = positionOf(document, '$id');

        const property = resolveProperty(document, position);

        assert.strictEqual(property.name, 'id');
        assert.strictEqual(property.type, 'int');
    });

    it('falls back to parsing a bare declaration missing a semicolon', () => {
        const source = [
            '<?php',
            'class User',
            '{',
            '    private string $name',
            '}',
        ].join('\n');
        const document = createDocument(source);
        const position = positionOf(document, '$name');

        const property = resolveProperty(document, position);

        assert.strictEqual(property.name, 'name');
        assert.strictEqual(property.type, 'string');
    });

    it('reports an undefined property and an error for untyped code', () => {
        const source = [
            '<?php',
            'class User',
            '{',
            '    private $name;',
            '}',
        ].join('\n');
        const document = createDocument(source);
        const position = positionOf(document, '$name');

        const property = resolveProperty(document, position);

        assert.strictEqual(property.name, PROP.UNDEFINED);
        assert.strictEqual(property.type, null);
        assert.ok(property.error);
    });

    it('builds getter/setter names, using an "is" prefix for boolean properties', () => {
        const source = [
            '<?php',
            'class User',
            '{',
            '    private string $name;',
            '    private bool $active;',
            '}',
        ].join('\n');
        const document = createDocument(source);

        const name = resolveProperty(document, positionOf(document, '$name'));
        const active = resolveProperty(document, positionOf(document, '$active'));

        assert.strictEqual(name.getFunction(PROP.GETTER), 'getName');
        assert.strictEqual(name.getFunction(PROP.SETTER), 'setName');
        assert.strictEqual(active.getFunction(PROP.GETTER), 'isActive');
        assert.strictEqual(active.getFunction(PROP.SETTER), 'setActive');
    });
});
