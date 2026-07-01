import {
    createEditor,
    messages,
    resetVscodeMock,
    setConfig,
    setQuickPickResult,
    window,
} from '../helpers/vscode';
import assert from 'node:assert';
import {afterEach, describe, it} from 'node:test';
import Constructor from '../../feature/constructor';
import {CONSTRUCT_ARGS_MAX_LENGTH, DOC_SHOW_DESCR} from '../../constants';

describe('Constructor', () => {
    afterEach(() => {
        resetVscodeMock();
    });

    it('generates a constructor from the selected properties', async () => {
        const source = [
            '<?php',
            'class User',
            '{',
            '    private string $name;',
            '    private ?int $age;',
            '}',
            '',
        ].join('\n');
        const {editor, replacement} = createEditor(source, 0);
        window.activeTextEditor = editor;
        setQuickPickResult(['name', 'age']);

        const construct = new Constructor();
        await construct.fill();
        construct.render();

        assert.strictEqual(
            replacement.value,
            '\n    /**\n'
            + '     * @param string $name\n'
            + '     * @param int|null $age\n'
            + '     */\n'
            + '    public function __construct(string $name, ?int $age)\n'
            + '    {\n'
            + '        $this->name = $name;\n'
            + '        $this->age = $age;\n'
            + '    }\n',
        );
    });

    it('generates an empty constructor when no properties are selected', async () => {
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
        setQuickPickResult([]);

        const construct = new Constructor();
        await construct.fill();
        construct.render();

        assert.strictEqual(replacement.value, '\n    /**\n     */\n    public function __construct()\n    {}\n');
    });

    it('adds a phpdoc description when enabled', async () => {
        const source = [
            '<?php',
            'class User',
            '{',
            '    private string $name;',
            '}',
            '',
        ].join('\n');
        setConfig(DOC_SHOW_DESCR, true);
        const {editor, replacement} = createEditor(source, 0);
        window.activeTextEditor = editor;
        setQuickPickResult(['name']);

        const construct = new Constructor();
        await construct.fill();
        construct.render();

        assert.strictEqual(
            replacement.value,
            '\n    /**\n'
            + '     * User constructor.\n'
            + '     * @param string $name\n'
            + '     */\n'
            + '    public function __construct(string $name)\n'
            + '    {\n'
            + '        $this->name = $name;\n'
            + '    }\n',
        );
    });

    it('wraps constructor arguments onto multiple lines past the configured length', async () => {
        const source = [
            '<?php',
            'class User',
            '{',
            '    private string $firstName;',
            '    private string $lastName;',
            '}',
            '',
        ].join('\n');
        setConfig(CONSTRUCT_ARGS_MAX_LENGTH, 10);
        const {editor, replacement} = createEditor(source, 0);
        window.activeTextEditor = editor;
        setQuickPickResult(['firstName', 'lastName']);

        const construct = new Constructor();
        await construct.fill();
        construct.render();

        assert.strictEqual(
            replacement.value,
            '\n    /**\n'
            + '     * @param string $firstName\n'
            + '     * @param string $lastName\n'
            + '     */\n'
            + '    public function __construct(\n'
            + '        string $firstName,\n'
            + '        string $lastName\n'
            + '    ) {\n'
            + '        $this->firstName = $firstName;\n'
            + '        $this->lastName = $lastName;\n'
            + '    }\n',
        );
    });

    it('does nothing when there is no active PHP editor', async () => {
        const {editor, replacement} = createEditor('not php', 0, {languageId: 'plaintext'});
        window.activeTextEditor = editor;

        const construct = new Constructor();
        const filled = await construct.fill();
        if (filled) {
            construct.render();
        }

        assert.strictEqual(filled, false);
        assert.strictEqual(replacement.value, null);
        assert.strictEqual(messages.length, 0);
    });
});
