import {createDocument, resetVscodeMock, setWorkspaceFolder} from '../../helpers/vscode';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, it} from 'node:test';
import {Position} from 'vscode';
import {
    SymfonyDoctrineEntityFieldsProvider,
    SymfonyRouteReferencesProvider,
    SymfonyServiceArgumentsProvider,
    SymfonyServicesProvider,
    SymfonyServicesYamlProvider,
    SymfonyTemplatesProvider,
} from '../../../framework/symfony/providers';
import Symfony from '../../../framework/symfony/service';
import {resetProjectCache} from '../../../service/project';

const createdDirs: Array<string> = [];

function createProjectDir(composer: object = {}): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'php-tools-symfony-providers-'));
    createdDirs.push(dir);
    fs.writeFileSync(path.join(dir, 'composer.json'), JSON.stringify(composer));

    return dir;
}

function documentAt(root: string, relativePath: string, source: string, languageId: string = 'php') {
    const fsPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fsPath), {recursive: true});
    fs.writeFileSync(fsPath, source);

    return createDocument(source, languageId, fsPath) as unknown as import('vscode').TextDocument;
}

describe('Symfony providers', () => {
    afterEach(() => {
        resetVscodeMock();
        resetProjectCache();
        createdDirs.splice(0).forEach((dir) => fs.rmSync(dir, {recursive: true, force: true}));
    });

    describe('SymfonyServicesProvider', () => {
        it('links a class to its services.yaml entry when already registered', async () => {
            const root = createProjectDir();
            setWorkspaceFolder(root);
            const servicesFile = path.join(root, 'config', 'services.yaml');
            fs.mkdirSync(path.dirname(servicesFile), {recursive: true});
            fs.writeFileSync(
                servicesFile,
                ['services:', '    App\\Service\\Foo:', '        class: App\\Service\\Foo', ''].join('\n'),
            );

            const symfony = new Symfony(true);
            await symfony.updateServices(await symfony.getServicesConfigUri());

            const document = documentAt(
                root,
                path.join('src', 'Service', 'Foo.php'),
                ['<?php', 'namespace App\\Service;', 'class Foo', '{', '}', ''].join('\n'),
            );

            const provider = new SymfonyServicesProvider(symfony);
            const lenses = provider.provideCodeLenses(document);

            assert.strictEqual(lenses.length, 1);
            assert.match((lenses[0].command as any).title, /Open in services\.yaml/);
        });

        it('offers to create a service entry when the class is not registered', () => {
            const root = createProjectDir();
            setWorkspaceFolder(root);
            const document = documentAt(
                root,
                path.join('src', 'Service', 'Foo.php'),
                ['<?php', 'namespace App\\Service;', 'class Foo', '{', '}', ''].join('\n'),
            );

            const provider = new SymfonyServicesProvider(new Symfony(true));
            const lenses = provider.provideCodeLenses(document);

            assert.strictEqual(lenses.length, 1);
            const command = lenses[0].command as any;
            assert.match(command.title, /Create in services\.yaml/);
            assert.deepStrictEqual(command.arguments, ['App\\Service\\Foo']);
        });
    });

    describe('SymfonyServicesYamlProvider', () => {
        it('links a service class entry to its file on disk', () => {
            const root = createProjectDir();
            setWorkspaceFolder(root);
            fs.mkdirSync(path.join(root, 'src', 'Service'), {recursive: true});
            fs.writeFileSync(
                path.join(root, 'src', 'Service', 'Foo.php'),
                ['<?php', 'namespace App\\Service;', 'class Foo', '{', '}', ''].join('\n'),
            );

            const document = documentAt(
                root,
                path.join('config', 'services.yaml'),
                ['services:', '    App\\Service\\Foo:', '        class: App\\Service\\Foo', ''].join('\n'),
                'yaml',
            );

            const provider = new SymfonyServicesYamlProvider(new Symfony(true));
            const lenses = provider.provideCodeLenses(document);

            assert.strictEqual(lenses.length, 1);
        });
    });

    describe('SymfonyTemplatesProvider', () => {
        it('links a PHP render() call to the twig template file', async () => {
            const root = createProjectDir();
            setWorkspaceFolder(root);
            fs.mkdirSync(path.join(root, 'templates', 'site'), {recursive: true});
            fs.writeFileSync(path.join(root, 'templates', 'site', 'index.html.twig'), '');

            const document = documentAt(
                root,
                path.join('src', 'Controller', 'SiteController.php'),
                [
                    '<?php',
                    'class SiteController',
                    '{',
                    '    public function index()',
                    '    {',
                    '        return $this->render(\'site/index.html.twig\');',
                    '    }',
                    '}',
                    '',
                ].join('\n'),
            );

            const provider = new SymfonyTemplatesProvider(new Symfony(true));
            const lenses = await provider.provideCodeLenses(document);

            assert.strictEqual(lenses.length, 1);
        });

        it('links a twig extends reference to the parent template file', async () => {
            const root = createProjectDir();
            setWorkspaceFolder(root);
            fs.mkdirSync(path.join(root, 'templates'), {recursive: true});
            fs.writeFileSync(path.join(root, 'templates', 'base.html.twig'), '');

            const document = documentAt(
                root,
                path.join('templates', 'site', 'index.html.twig'),
                '{% extends \'base.html.twig\' %}\n',
                'twig',
            );

            const provider = new SymfonyTemplatesProvider(new Symfony(true));
            const lenses = await provider.provideCodeLenses(document);

            assert.strictEqual(lenses.length, 1);
        });
    });

    describe('SymfonyRouteReferencesProvider', () => {
        it('links a redirectToRoute() call to the controller action defining that route', async () => {
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

            const document = documentAt(
                root,
                path.join('src', 'Controller', 'OtherController.php'),
                [
                    '<?php',
                    'class OtherController',
                    '{',
                    '    public function go()',
                    '    {',
                    '        return $this->redirectToRoute(\'home_index\');',
                    '    }',
                    '}',
                    '',
                ].join('\n'),
            );

            const provider = new SymfonyRouteReferencesProvider(new Symfony(true));
            const lenses = await provider.provideCodeLenses(document);

            assert.strictEqual(lenses.length, 1);
        });
    });

    describe('SymfonyServiceArgumentsProvider', () => {
        it('suggests missing constructor arguments as completion items', async () => {
            const root = createProjectDir({autoload: {'psr-4': {'App\\': 'src/'}}});
            setWorkspaceFolder(root);
            fs.mkdirSync(path.join(root, 'src', 'Service'), {recursive: true});
            fs.writeFileSync(
                path.join(root, 'src', 'Service', 'Foo.php'),
                [
                    '<?php',
                    'namespace App\\Service;',
                    'class Foo',
                    '{',
                    '    public function __construct(int $fooBar)',
                    '    {',
                    '    }',
                    '}',
                    '',
                ].join('\n'),
            );

            const lines = [
                'services:',
                '    App\\Service\\Foo:',
                '        class: App\\Service\\Foo',
                '        arguments:',
                '            ',
            ];
            const document = documentAt(root, path.join('config', 'services.yaml'), lines.join('\n'), 'yaml');
            const position = new Position(4, lines[4].length);

            const provider = new SymfonyServiceArgumentsProvider(new Symfony(true));
            const items = await provider.provideCompletionItems(document, position);

            assert.strictEqual(items.length, 1);
            assert.strictEqual(items[0].label, '$fooBar');
        });

        it('does not suggest an argument that is already present', async () => {
            const root = createProjectDir({autoload: {'psr-4': {'App\\': 'src/'}}});
            setWorkspaceFolder(root);
            fs.mkdirSync(path.join(root, 'src', 'Service'), {recursive: true});
            fs.writeFileSync(
                path.join(root, 'src', 'Service', 'Foo.php'),
                [
                    '<?php',
                    'namespace App\\Service;',
                    'class Foo',
                    '{',
                    '    public function __construct(int $fooBar)',
                    '    {',
                    '    }',
                    '}',
                    '',
                ].join('\n'),
            );

            const lines = [
                'services:',
                '    App\\Service\\Foo:',
                '        class: App\\Service\\Foo',
                '        arguments:',
                '            $fooBar: 1',
                '            ',
            ];
            const document = documentAt(root, path.join('config', 'services.yaml'), lines.join('\n'), 'yaml');
            const position = new Position(5, lines[5].length);

            const provider = new SymfonyServiceArgumentsProvider(new Symfony(true));
            const items = await provider.provideCompletionItems(document, position);

            assert.strictEqual(items.length, 0);
        });
    });

    describe('SymfonyDoctrineEntityFieldsProvider', () => {
        it('suggests entity fields after a query builder alias dot', async () => {
            const root = createProjectDir({autoload: {'psr-4': {'App\\': 'src/'}}});
            setWorkspaceFolder(root);
            fs.mkdirSync(path.join(root, 'src', 'Entity'), {recursive: true});
            fs.writeFileSync(
                path.join(root, 'src', 'Entity', 'Foo.php'),
                [
                    '<?php',
                    'namespace App\\Entity;',
                    'class Foo',
                    '{',
                    '    private int $id;',
                    '    private string $name;',
                    '}',
                    '',
                ].join('\n'),
            );

            const lines = [
                '<?php',
                'namespace App\\Repository;',
                '',
                'use App\\Entity\\Foo;',
                '',
                'class FooRepository extends ServiceEntityRepository',
                '{',
                '    public function __construct(ManagerRegistry $registry)',
                '    {',
                '        parent::__construct($registry, Foo::class);',
                '    }',
                '',
                '    public function findAll(): array',
                '    {',
                '        $qb = $this->createQueryBuilder(\'e\');',
                '        $qb->andWhere(\'e.\');',
                '',
                '        return $qb->getQuery()->getResult();',
                '    }',
                '}',
                '',
            ];
            const document = documentAt(
                root,
                path.join('src', 'Repository', 'FooRepository.php'),
                lines.join('\n'),
            );
            const dotIndex = lines[15].indexOf('e.') + 'e.'.length;
            const position = new Position(15, dotIndex);

            const provider = new SymfonyDoctrineEntityFieldsProvider(new Symfony(true));
            const items = await provider.provideCompletionItems(document, position);

            assert.deepStrictEqual(items.map((item) => item.label).sort(), ['id', 'name']);
        });
    });
});
