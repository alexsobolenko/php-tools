import {createDocument, resetVscodeMock, setWorkspaceFolder} from '../../helpers/vscode';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, it} from 'node:test';
import {Yii2ConfigToClassProvider, Yii2DiProvider, Yii2ViewProvider} from '../../../framework/yii2/providers';
import Yii2 from '../../../framework/yii2/service';
import {resetProjectCache} from '../../../service/project';

const createdDirs: Array<string> = [];

function createProjectDir(composer: object): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'php-tools-yii2-'));
    createdDirs.push(dir);
    fs.writeFileSync(path.join(dir, 'composer.json'), JSON.stringify(composer));

    return dir;
}

function documentAt(root: string, relativePath: string, source: string) {
    const fsPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fsPath), {recursive: true});
    fs.writeFileSync(fsPath, source);

    return createDocument(source, 'php', fsPath) as unknown as import('vscode').TextDocument;
}

describe('Yii2 providers', () => {
    afterEach(() => {
        resetVscodeMock();
        resetProjectCache();
        createdDirs.splice(0).forEach((dir) => fs.rmSync(dir, {recursive: true, force: true}));
    });

    describe('Yii2DiProvider', () => {
        it('links a class to the DI config entry that references it', () => {
            const root = createProjectDir({autoload: {'psr-4': {'App\\': 'src/'}}});
            setWorkspaceFolder(root);
            fs.mkdirSync(path.join(root, 'config'), {recursive: true});
            fs.writeFileSync(
                path.join(root, 'config', 'web.php'),
                [
                    '<?php',
                    'return [',
                    '    \'components\' => [',
                    '        \'foo\' => [',
                    '            \'class\' => \'App\\\\Service\\\\Foo\',',
                    '        ],',
                    '    ],',
                    '];',
                    '',
                ].join('\n'),
            );

            const document = documentAt(
                root,
                path.join('src', 'Service', 'Foo.php'),
                ['<?php', 'namespace App\\Service;', 'class Foo', '{', '}', ''].join('\n'),
            );

            const provider = new Yii2DiProvider(new Yii2(true));
            const lenses = provider.provideCodeLenses(document);

            assert.strictEqual(lenses.length, 1);
        });

        it('returns no CodeLenses when Yii2 is not used', () => {
            const root = createProjectDir({autoload: {'psr-4': {'App\\': 'src/'}}});
            setWorkspaceFolder(root);
            const document = documentAt(
                root,
                path.join('src', 'Service', 'Foo.php'),
                ['<?php', 'namespace App\\Service;', 'class Foo', '{', '}', ''].join('\n'),
            );

            const provider = new Yii2DiProvider(new Yii2(false));

            assert.deepStrictEqual(provider.provideCodeLenses(document), []);
        });
    });

    describe('Yii2ConfigToClassProvider', () => {
        it('links a class reference in a DI config file to the class file, reusing the shared fqcnToPath', () => {
            const root = createProjectDir({autoload: {'psr-4': {'App\\': 'src/'}}});
            setWorkspaceFolder(root);
            fs.mkdirSync(path.join(root, 'src', 'Service'), {recursive: true});
            fs.writeFileSync(
                path.join(root, 'src', 'Service', 'Foo.php'),
                ['<?php', 'namespace App\\Service;', 'class Foo', '{', '}', ''].join('\n'),
            );

            const document = documentAt(
                root,
                path.join('config', 'web.php'),
                [
                    '<?php',
                    'return [',
                    '    \'components\' => [',
                    '        \'foo\' => [',
                    '            \'class\' => \'App\\\\Service\\\\Foo\',',
                    '        ],',
                    '    ],',
                    '];',
                    '',
                ].join('\n'),
            );

            const provider = new Yii2ConfigToClassProvider(new Yii2(true));
            const lenses = provider.provideCodeLenses(document);

            assert.strictEqual(lenses.length, 1);
        });

        it('ignores files outside the known DI config paths', () => {
            const root = createProjectDir({autoload: {'psr-4': {'App\\': 'src/'}}});
            setWorkspaceFolder(root);
            const document = documentAt(root, 'not-a-config.php', '<?php\nreturn [];\n');

            const provider = new Yii2ConfigToClassProvider(new Yii2(true));

            assert.deepStrictEqual(provider.provideCodeLenses(document), []);
        });
    });

    describe('Yii2ViewProvider', () => {
        it('links a render() call to the matching view file', async () => {
            const root = createProjectDir({autoload: {'psr-4': {'App\\': 'src/'}}});
            setWorkspaceFolder(root);
            fs.mkdirSync(path.join(root, 'views', 'site'), {recursive: true});
            fs.writeFileSync(path.join(root, 'views', 'site', 'index.php'), '<?php\n');

            const document = documentAt(
                root,
                path.join('controllers', 'SiteController.php'),
                [
                    '<?php',
                    'class SiteController extends Controller',
                    '{',
                    '    public function actionIndex()',
                    '    {',
                    '        return $this->render(\'index\');',
                    '    }',
                    '}',
                    '',
                ].join('\n'),
            );

            const provider = new Yii2ViewProvider(new Yii2(true));
            const lenses = await provider.provideCodeLenses(document);

            assert.strictEqual(lenses.length, 1);
        });
    });
});
