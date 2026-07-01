import {createEditor, messages, resetVscodeMock, setConfig, setWorkspaceFolder, window} from '../helpers/vscode';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, it} from 'node:test';
import Fabric from '../../feature/fabric';
import {FAB_GENERATE_PHPDOC, FAB_STRICT_TYPES, FABRIC} from '../../constants';
import {resetProjectCache} from '../../service/project';

function useProject(composer: object): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'php-tools-fabric-'));
    fs.writeFileSync(path.join(root, 'composer.json'), JSON.stringify(composer));
    setWorkspaceFolder(root);

    return root;
}

describe('Fabric', () => {
    afterEach(() => {
        resetVscodeMock();
        resetProjectCache();
    });

    it('generates a class with strict types by default', () => {
        const root = useProject({autoload: {'psr-4': {'App\\': 'src/'}}});
        const {editor, replacement} = createEditor('', 0, {fileName: path.join(root, 'src', 'Domain', 'User.php')});
        window.activeTextEditor = editor;

        new Fabric(FABRIC.CLASS).render();

        assert.strictEqual(
            replacement.value,
            '<?php\n\ndeclare(strict_types=1);\n\nnamespace App\\Domain;\n\nclass User\n{\n}\n',
        );
    });

    it('omits strict types when disabled', () => {
        const root = useProject({autoload: {'psr-4': {'App\\': 'src/'}}});
        setConfig(FAB_STRICT_TYPES, false);
        const {editor, replacement} = createEditor('', 0, {fileName: path.join(root, 'src', 'Domain', 'User.php')});
        window.activeTextEditor = editor;

        new Fabric(FABRIC.CLASS).render();

        assert.strictEqual(replacement.value, '<?php\n\nnamespace App\\Domain;\n\nclass User\n{\n}\n');
    });

    it('adds a phpdoc block when enabled', () => {
        const root = useProject({autoload: {'psr-4': {'App\\': 'src/'}}});
        setConfig(FAB_STRICT_TYPES, false);
        setConfig(FAB_GENERATE_PHPDOC, true);
        const fileName = path.join(root, 'src', 'Interfaces', 'Fooable.php');
        const {editor, replacement} = createEditor('', 0, {fileName});
        window.activeTextEditor = editor;

        new Fabric(FABRIC.INTERFACE).render();

        assert.strictEqual(
            replacement.value,
            '<?php\n\nnamespace App\\Interfaces;\n\n'
            + '/**\n * Interface Fooable description.\n */\n'
            + 'interface Fooable\n{\n}\n',
        );
    });

    it('maps fabric types to the right PHP keyword', () => {
        const root = useProject({autoload: {'psr-4': {'App\\': 'src/'}}});
        setConfig(FAB_STRICT_TYPES, false);

        const cases: Array<[string, string]> = [
            [FABRIC.ABSTRACT_CLASS, 'abstract class'],
            [FABRIC.FINAL_CLASS, 'final class'],
            [FABRIC.TRAIT, 'trait'],
            [FABRIC.ENUM, 'enum'],
        ];

        cases.forEach(([type, keyword]) => {
            const {editor, replacement} = createEditor('', 0, {fileName: path.join(root, 'src', 'Thing.php')});
            window.activeTextEditor = editor;

            new Fabric(type).render();

            assert.strictEqual(replacement.value, `<?php\n\nnamespace App;\n\n${keyword} Thing\n{\n}\n`);
        });
    });

    it('shows a warning when there is no active PHP editor', () => {
        const {editor, replacement} = createEditor('', 0, {languageId: 'plaintext'});
        window.activeTextEditor = editor;

        new Fabric(FABRIC.CLASS).render();

        assert.strictEqual(replacement.value, null);
        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0].type, 'warning');
    });

    it('shows an error when the fabric type is unknown', () => {
        const root = useProject({autoload: {'psr-4': {'App\\': 'src/'}}});
        const {editor, replacement} = createEditor('', 0, {fileName: path.join(root, 'src', 'User.php')});
        window.activeTextEditor = editor;

        new Fabric('not-a-real-type').render();

        assert.strictEqual(replacement.value, null);
        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0].type, 'error');
    });
});
