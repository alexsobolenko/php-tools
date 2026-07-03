import {resetVscodeMock, setWorkspaceFolder} from '../helpers/vscode';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, it} from 'node:test';
import Framework from '../../feature/framework';
import {resetProjectCache} from '../../service/project';

const createdDirs: Array<string> = [];

function createProjectDir(composer: object): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'php-tools-framework-'));
    createdDirs.push(dir);
    fs.writeFileSync(path.join(dir, 'composer.json'), JSON.stringify(composer));

    return dir;
}

describe('Framework', () => {
    afterEach(() => {
        resetVscodeMock();
        resetProjectCache();
        createdDirs.splice(0).forEach((dir) => fs.rmSync(dir, {recursive: true, force: true}));
    });

    it('exposes Yii2 providers when composer.json requires a Yii2 package', () => {
        const root = createProjectDir({require: {'yiisoft/yii2': '^2.0'}});
        setWorkspaceFolder(root);

        const framework = new Framework();

        assert.strictEqual(framework.providers.length, 3);
    });

    it('exposes Symfony providers when composer.json requires symfony/framework-bundle', () => {
        const root = createProjectDir({require: {'symfony/framework-bundle': '^6.0'}});
        setWorkspaceFolder(root);

        const framework = new Framework();

        assert.strictEqual(framework.providers.length, 6);
        assert.strictEqual(framework.completionProviders.length, 2);
    });

    it('exposes no providers when no supported framework is detected', () => {
        const root = createProjectDir({require: {php: '^8.2'}});
        setWorkspaceFolder(root);

        const framework = new Framework();

        assert.deepStrictEqual(framework.providers, []);
        assert.deepStrictEqual(framework.completionProviders, []);
    });
});
