import {resetVscodeMock, setWorkspaceFolder} from '../../helpers/vscode';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, it} from 'node:test';
import Symfony from '../../../framework/symfony/service';

const createdDirs: Array<string> = [];

function createProjectDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'php-tools-symfony-'));
    createdDirs.push(dir);

    return dir;
}

describe('Symfony service', () => {
    afterEach(() => {
        resetVscodeMock();
        createdDirs.splice(0).forEach((dir) => fs.rmSync(dir, {recursive: true, force: true}));
    });

    describe('checkComposerData', () => {
        it('detects symfony/framework-bundle in require', () => {
            assert.strictEqual(Symfony.checkComposerData({require: {'symfony/framework-bundle': '^6.0'}}), true);
        });

        it('detects a legacy symfony-app-dir extra key', () => {
            assert.strictEqual(Symfony.checkComposerData({extra: {'symfony-app-dir': 'app'}}), true);
        });

        it('returns false when no Symfony package is required', () => {
            assert.strictEqual(Symfony.checkComposerData({require: {'yiisoft/yii2': '^2.0'}}), false);
        });
    });

    describe('providers / completionProviders', () => {
        it('exposes no providers when Symfony is not used', () => {
            const symfony = new Symfony(false);

            assert.deepStrictEqual(symfony.providers, []);
            assert.deepStrictEqual(symfony.completionProviders, []);
        });

        it('exposes six CodeLens providers and two completion providers when used', () => {
            const symfony = new Symfony(true);

            assert.strictEqual(symfony.providers.length, 6);
            assert.strictEqual(symfony.completionProviders.length, 2);
        });
    });

    describe('updateServices / getServiceLocation', () => {
        it('indexes services declared with an explicit class key', async () => {
            const root = createProjectDir();
            fs.mkdirSync(path.join(root, 'config'), {recursive: true});
            const servicesFile = path.join(root, 'config', 'services.yaml');
            fs.writeFileSync(
                servicesFile,
                ['services:', '    App\\Service\\Foo:', '        class: App\\Service\\Foo', ''].join('\n'),
            );

            const symfony = new Symfony(true);
            await symfony.updateServices({fsPath: servicesFile, path: servicesFile} as any);

            assert.notStrictEqual(symfony.getServiceLocation('App\\Service\\Foo'), null);
        });

        it('indexes services declared by a bare FQCN key', async () => {
            const root = createProjectDir();
            fs.mkdirSync(path.join(root, 'config'), {recursive: true});
            const servicesFile = path.join(root, 'config', 'services.yaml');
            fs.writeFileSync(servicesFile, ['services:', '    App\\Service\\Foo: ~', ''].join('\n'));

            const symfony = new Symfony(true);
            await symfony.updateServices({fsPath: servicesFile, path: servicesFile} as any);

            assert.notStrictEqual(symfony.getServiceLocation('App\\Service\\Foo'), null);
        });

        it('returns null when Symfony is not used', () => {
            const symfony = new Symfony(false);

            assert.strictEqual(symfony.getServiceLocation('App\\Service\\Foo'), null);
        });
    });

    describe('getServicesConfigUri', () => {
        it('finds an existing config/services.yaml', async () => {
            const root = createProjectDir();
            setWorkspaceFolder(root);
            fs.mkdirSync(path.join(root, 'config'), {recursive: true});
            fs.writeFileSync(path.join(root, 'config', 'services.yaml'), 'services:\n');

            const symfony = new Symfony(true);
            const uri = await symfony.getServicesConfigUri();

            assert.strictEqual(uri?.fsPath, path.join(root, 'config', 'services.yaml'));
        });

        it('returns null when no candidate file exists', async () => {
            const root = createProjectDir();
            setWorkspaceFolder(root);

            const symfony = new Symfony(true);

            assert.strictEqual(await symfony.getServicesConfigUri(), null);
        });
    });

    describe('createService', () => {
        it('creates config/services.yaml and inserts a new service entry when none exists', async () => {
            const root = createProjectDir();
            setWorkspaceFolder(root);

            const symfony = new Symfony(true);
            const location = await symfony.createService('App\\Service\\Foo');

            assert.notStrictEqual(location, null);
            const contents = fs.readFileSync(path.join(root, 'config', 'services.yaml'), 'utf-8');
            assert.match(contents, /App\\Service\\Foo:/);
            assert.match(contents, /class: App\\Service\\Foo/);
        });

        it('returns the existing location without inserting a duplicate entry', async () => {
            const root = createProjectDir();
            setWorkspaceFolder(root);
            fs.mkdirSync(path.join(root, 'config'), {recursive: true});
            fs.writeFileSync(
                path.join(root, 'config', 'services.yaml'),
                ['services:', '    App\\Service\\Foo:', '        class: App\\Service\\Foo', ''].join('\n'),
            );

            const symfony = new Symfony(true);
            await symfony.updateServices(await symfony.getServicesConfigUri());
            const location = await symfony.createService('App\\Service\\Foo');

            assert.notStrictEqual(location, null);
            const contents = fs.readFileSync(path.join(root, 'config', 'services.yaml'), 'utf-8');
            assert.strictEqual(contents.match(/App\\Service\\Foo:/g)?.length, 1);
        });
    });

    describe('routes', () => {
        it('finds an attribute-based route and invalidates it on demand', async () => {
            const root = createProjectDir();
            setWorkspaceFolder(root);
            fs.mkdirSync(path.join(root, 'src', 'Controller'), {recursive: true});
            fs.writeFileSync(
                path.join(root, 'src', 'Controller', 'HomeController.php'),
                [
                    '<?php',
                    'class HomeController',
                    '{',
                    '    #[Route(\'/\', name: \'home_index\')]',
                    '    public function index()',
                    '    {',
                    '    }',
                    '}',
                    '',
                ].join('\n'),
            );

            const symfony = new Symfony(true);
            const location = await symfony.getRouteLocation('home_index');

            assert.notStrictEqual(location, null);

            symfony.invalidateRoutes();
            const locationAfterInvalidate = await symfony.getRouteLocation('home_index');

            assert.notStrictEqual(locationAfterInvalidate, null);
        });

        it('finds an annotation-based route', async () => {
            const root = createProjectDir();
            setWorkspaceFolder(root);
            fs.mkdirSync(path.join(root, 'src', 'Controller'), {recursive: true});
            fs.writeFileSync(
                path.join(root, 'src', 'Controller', 'HomeController.php'),
                [
                    '<?php',
                    'class HomeController',
                    '{',
                    '    /**',
                    '     * @Route("/", name="home_index")',
                    '     */',
                    '    public function index()',
                    '    {',
                    '    }',
                    '}',
                    '',
                ].join('\n'),
            );

            const symfony = new Symfony(true);

            assert.notStrictEqual(await symfony.getRouteLocation('home_index'), null);
        });

        it('returns null when Symfony is not used', async () => {
            const symfony = new Symfony(false);

            assert.strictEqual(await symfony.getRouteLocation('home_index'), null);
        });
    });
});
