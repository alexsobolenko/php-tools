import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Getter Command Test Suite', () => {
    let document: vscode.TextDocument;
    let editor: vscode.TextEditor;

    setup(async () => {
        const extension = vscode.extensions.getExtension('advanced-php-tools');
        await extension?.activate();

        document = await vscode.workspace.openTextDocument({
            language: 'php',
            content: '<?php\n\nclass Bar\n{\n    private string $bar;\n}\n',
        });
        editor = await vscode.window.showTextDocument(document);

        const position = document.positionAt(document.getText().indexOf('$bar'));
        editor.selection = new vscode.Selection(position, position);
    });

    test('should insert getter for the property', async () => {
        await vscode.commands.executeCommand('advanced-php-tools.insert-getter');

        const text = document.getText();

        assert.strictEqual(text.includes('public function getBar(): string'), true, 'Getter was not added');
        assert.strictEqual(text.includes('return $this->bar;'), true, 'Getter does not return property');
    });

    test('should insert setter for the property', async () => {
        await vscode.commands.executeCommand('advanced-php-tools.insert-setter');

        const text = document.getText();

        assert.strictEqual(text.includes('public function setBar(string $bar): void'), true, 'Setter was not added');
        assert.strictEqual(text.includes('$this->bar = $bar;'), true, 'Setter does not set property');
    });

    test('should insert getter and setter for the property', async () => {
        await vscode.commands.executeCommand('advanced-php-tools.insert-getter-setter');

        const text = document.getText();

        assert.strictEqual(text.includes('public function getBar(): string'), true, 'Getter was not added');
        assert.strictEqual(text.includes('return $this->bar;'), true, 'Getter does not return property');
        assert.strictEqual(text.includes('public function setBar(string $bar): void'), true, 'Setter was not added');
        assert.strictEqual(text.includes('$this->bar = $bar;'), true, 'Setter does not set property');
    });

    teardown(async () => {
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    });
});
