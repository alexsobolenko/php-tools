import {resetVscodeMock, setWorkspaceFolder, triggerComposerJsonChange} from '../helpers/vscode';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, it} from 'node:test';
import {
    getAutoload,
    getComposerData,
    getWorkspacePath,
    pathToNamespace,
    resetProjectCache,
    watchComposerJson,
} from '../../service/project';

const createdDirs: Array<string> = [];

function createProjectDir(composer: object|null): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'php-tools-project-'));
    createdDirs.push(dir);
    if (composer !== null) {
        fs.writeFileSync(path.join(dir, 'composer.json'), JSON.stringify(composer));
    }

    return dir;
}

describe('project', () => {
    afterEach(() => {
        resetVscodeMock();
        resetProjectCache();
        createdDirs.splice(0).forEach((dir) => fs.rmSync(dir, {recursive: true, force: true}));
    });

    it('resolves a namespace from the PSR-4 autoload map', () => {
        const root = createProjectDir({autoload: {'psr-4': {'App\\': 'src/'}}});
        setWorkspaceFolder(root);

        const namespace = pathToNamespace(path.join(root, 'src', 'Domain'));

        assert.strictEqual(namespace, 'App\\Domain');
    });

    it('resolves the bare namespace for a class placed directly in the PSR-4 root', () => {
        const root = createProjectDir({autoload: {'psr-4': {'App\\': 'src/'}}});
        setWorkspaceFolder(root);

        assert.strictEqual(pathToNamespace(path.join(root, 'src')), 'App');
    });

    it('combines autoload and autoload-dev PSR-4 maps', () => {
        const root = createProjectDir({
            autoload: {'psr-4': {'App\\': 'src/'}},
            'autoload-dev': {'psr-4': {'Tests\\': 'tests/'}},
        });
        setWorkspaceFolder(root);

        assert.strictEqual(pathToNamespace(path.join(root, 'tests', 'Unit')), 'Tests\\Unit');
        assert.strictEqual(pathToNamespace(path.join(root, 'src', 'Domain')), 'App\\Domain');
    });

    it('falls back to the relative path when there is no matching autoload entry', () => {
        const root = createProjectDir({autoload: {'psr-4': {'App\\': 'src/'}}});
        setWorkspaceFolder(root);

        assert.strictEqual(pathToNamespace(path.join(root, 'other', 'Domain')), 'other/Domain');
    });

    it('falls back to the relative path when composer.json is missing', () => {
        const root = createProjectDir(null);
        setWorkspaceFolder(root);

        assert.strictEqual(pathToNamespace(path.join(root, 'src', 'Domain')), 'src/Domain');
    });

    it('re-reads composer.json after a change is signalled', () => {
        const root = createProjectDir({autoload: {'psr-4': {'App\\': 'src/'}}});
        setWorkspaceFolder(root);

        assert.strictEqual(pathToNamespace(path.join(root, 'src', 'Domain')), 'App\\Domain');

        fs.writeFileSync(path.join(root, 'composer.json'), JSON.stringify({autoload: {'psr-4': {'Acme\\': 'src/'}}}));
        watchComposerJson();
        triggerComposerJsonChange();

        assert.strictEqual(pathToNamespace(path.join(root, 'src', 'Domain')), 'Acme\\Domain');
    });

    it('exposes the workspace root, autoload map and raw composer.json data', () => {
        const root = createProjectDir({
            require: {'yiisoft/yii2': '^2.0'},
            autoload: {'psr-4': {'App\\': 'src/'}},
        });
        setWorkspaceFolder(root);

        assert.strictEqual(getWorkspacePath(), root);
        assert.deepStrictEqual(getAutoload(), {'App\\': 'src/'});
        assert.deepStrictEqual(getComposerData().require, {'yiisoft/yii2': '^2.0'});
    });
});
