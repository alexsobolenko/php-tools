import {createEditor, messages, resetVscodeMock, setConfig, setQuickPickResult, window} from '../helpers/vscode';
import assert from 'node:assert';
import {Position} from 'vscode';
import {afterEach, describe, it} from 'node:test';
import Accessor from '../../feature/accessor';
import {GS_RETURN_SELF, PROP} from '../../constants';

function positionOf(source: string, needle: string): Position {
    const offset = source.indexOf(needle);
    const before = source.slice(0, offset);
    const lines = before.split('\n');

    return new Position(lines.length - 1, lines[lines.length - 1].length);
}

describe('Accessor', () => {
    afterEach(() => {
        resetVscodeMock();
    });

    it('generates a getter for the property under the cursor', () => {
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

        const accessor = new Accessor([positionOf(source, '$name')]);
        accessor.render([PROP.GETTER]);

        assert.strictEqual(
            replacement.value,
            '\n    /**\n     * @return string\n     */\n'
            + '    public function getName(): string\n'
            + '    {\n'
            + '        return $this->name;\n'
            + '    }\n',
        );
    });

    it('generates a setter with an "is" getter for boolean properties', () => {
        const source = [
            '<?php',
            'class User',
            '{',
            '    private bool $active;',
            '}',
            '',
        ].join('\n');
        const {editor, replacement} = createEditor(source, 0);
        window.activeTextEditor = editor;

        const accessor = new Accessor([positionOf(source, '$active')]);
        accessor.render([PROP.GETTER, PROP.SETTER]);

        assert.strictEqual(
            replacement.value,
            '\n    /**\n     * @return bool\n     */\n'
            + '    public function isActive(): bool\n'
            + '    {\n'
            + '        return $this->active;\n'
            + '    }\n'
            + '\n    /**\n     * @param bool $active\n     */\n'
            + '    public function setActive(bool $active): void\n'
            + '    {\n'
            + '        $this->active = $active;\n'
            + '    }\n',
        );
    });

    it('returns self from the setter and documents it when enabled', () => {
        const source = [
            '<?php',
            'class User',
            '{',
            '    private string $name;',
            '}',
            '',
        ].join('\n');
        setConfig(GS_RETURN_SELF, true);
        const {editor, replacement} = createEditor(source, 0);
        window.activeTextEditor = editor;

        const accessor = new Accessor([positionOf(source, '$name')]);
        accessor.render([PROP.SETTER]);

        assert.strictEqual(
            replacement.value,
            '\n    /**\n     * @param string $name\n     * @return User\n     */\n'
            + '    public function setName(string $name): User\n'
            + '    {\n'
            + '        $this->name = $name;\n'
            + '\n'
            + '        return $this;\n'
            + '    }\n',
        );
    });

    it('lets the user pick multiple properties via the master flow', async () => {
        const source = [
            '<?php',
            'class User',
            '{',
            '    private string $name;',
            '    private int $age;',
            '}',
            '',
        ].join('\n');
        const {editor, replacement} = createEditor(source, 0);
        window.activeTextEditor = editor;
        setQuickPickResult(['age']);

        const positions = await Accessor.selectProperties('Select properties');
        const accessor = new Accessor(positions);
        accessor.render([PROP.GETTER]);

        assert.strictEqual(
            replacement.value,
            '\n    /**\n     * @return int\n     */\n'
            + '    public function getAge(): int\n'
            + '    {\n'
            + '        return $this->age;\n'
            + '    }\n',
        );
    });

    it('shows an error message when there is nothing to render', () => {
        const source = [
            '<?php',
            'class User',
            '{',
            '}',
            '',
        ].join('\n');
        const {editor, replacement} = createEditor(source, 0);
        window.activeTextEditor = editor;

        const accessor = new Accessor([]);
        accessor.render([PROP.GETTER]);

        assert.strictEqual(replacement.value, null);
        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0].type, 'error');
    });

    it('does nothing when there is no active PHP editor', () => {
        const {editor, replacement} = createEditor('not php', 0, {languageId: 'plaintext'});
        window.activeTextEditor = editor;

        const accessor = new Accessor([new Position(0, 0)]);
        accessor.render([PROP.GETTER]);

        assert.strictEqual(replacement.value, null);
        assert.strictEqual(messages.length, 0);
    });
});
