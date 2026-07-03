import {createEditor, messages, resetVscodeMock, window} from '../helpers/vscode';
import assert from 'node:assert';
import {afterEach, describe, it} from 'node:test';
import StringConvertor from '../../feature/string-convertor';
import {CONV} from '../../constants';

describe('StringConvertor', () => {
    afterEach(() => {
        resetVscodeMock();
    });

    it('converts sprintf with a ::class access to interpolation', () => {
        const source = '<?php sprintf(\'Instances of "%s" are not supported.\', $user::class);';
        const {editor, replacement} = createEditor(source, source.indexOf('sprintf'));
        window.activeTextEditor = editor;

        new StringConvertor(CONV.INTERPOLATION).render();

        assert.strictEqual(replacement.value, '"Instances of \\"{$user::class}\\" are not supported."');
    });

    it('converts concatenation to interpolation', () => {
        const source = '<?php echo \'Hello \' . $name . \'!\';';
        const {editor, replacement} = createEditor(source, source.indexOf('\'Hello'));
        window.activeTextEditor = editor;

        new StringConvertor(CONV.INTERPOLATION).render();

        assert.strictEqual(replacement.value, '"Hello {$name}!"');
    });

    it('converts interpolation to sprintf', () => {
        const source = '<?php echo "Hello {$name}!";';
        const {editor, replacement} = createEditor(source, source.indexOf('"Hello'));
        window.activeTextEditor = editor;

        new StringConvertor(CONV.SPRINTF).render();

        assert.strictEqual(replacement.value, 'sprintf(\'Hello %s!\', $name)');
    });

    it('shows an info message when there is nothing to convert', () => {
        const source = '<?php echo \'Hello world!\';';
        const {editor, replacement} = createEditor(source, source.indexOf('\'Hello'));
        window.activeTextEditor = editor;

        new StringConvertor(CONV.INTERPOLATION).render();

        assert.strictEqual(replacement.value, null);
        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0].type, 'info');
    });

    it('does nothing when the active editor is not a PHP file', () => {
        const source = 'sprintf(\'Hello %s!\', $name);';
        const {editor, replacement} = createEditor(source, source.indexOf('sprintf'), {languageId: 'plaintext'});
        window.activeTextEditor = editor;

        new StringConvertor(CONV.INTERPOLATION).render();

        assert.strictEqual(replacement.value, null);
        assert.strictEqual(messages.length, 0);
    });
});
