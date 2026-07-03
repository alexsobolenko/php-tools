import fs from 'fs';
import path from 'path';
import {Disposable, workspace} from 'vscode';
import {IComposerAutoload, IProjectCache} from '../interfaces';

let cache: IProjectCache|null = null;

function workspacePath(): string {
    const folders = workspace.workspaceFolders;

    return folders && folders.length > 0 ? folders[0].uri.fsPath : '';
}

function readAutoload(workspaceRoot: string): IComposerAutoload {
    if (!workspaceRoot) {
        return {};
    }

    const composerFile = path.join(workspaceRoot, 'composer.json');
    if (!fs.existsSync(composerFile)) {
        return {};
    }

    try {
        const data = JSON.parse(fs.readFileSync(composerFile, 'utf-8'));
        const psr4 = (data.autoload || {})['psr-4'] || {};
        const psr4Dev = (data['autoload-dev'] || {})['psr-4'] || {};

        return {...psr4, ...psr4Dev};
    } catch {
        return {};
    }
}

function getCache(): IProjectCache {
    if (cache === null) {
        const root = workspacePath();
        cache = {workspacePath: root, autoload: readAutoload(root)};
    }

    return cache;
}

export function resetProjectCache(): void {
    cache = null;
}

export function watchComposerJson(): Disposable {
    const watcher = workspace.createFileSystemWatcher('**/composer.json');
    watcher.onDidChange(resetProjectCache);
    watcher.onDidCreate(resetProjectCache);
    watcher.onDidDelete(resetProjectCache);

    return watcher;
}

export function pathToNamespace(fullPath: string): string {
    const {workspacePath: root, autoload} = getCache();
    const normalizedPath = fullPath.replace(/\\/g, '/');
    const relativePath = path.relative(root, normalizedPath).replace(/\.php$/, '').replace(/\\/g, '/');
    let result = relativePath;
    Object.entries(autoload).forEach(([namespaceStart, searchPath]) => {
        const normalizedSearchPath = (searchPath as string).replace(/\\/g, '/').replace(/\/$/, '');
        if (relativePath === normalizedSearchPath) {
            result = namespaceStart.replace(/\\$/, '');
        } else if (relativePath.startsWith(`${normalizedSearchPath}/`)) {
            result = namespaceStart + relativePath.slice(normalizedSearchPath.length + 1).replace(/\//g, '\\');
        }
    });

    return result;
}

export function fqcnToPath(fqcn: string): string|null {
    const {workspacePath: root, autoload} = getCache();
    if (!root) {
        return null;
    }

    for (const [prefix, paths] of Object.entries(autoload)) {
        if (!fqcn.startsWith(prefix)) {
            continue;
        }

        const relativePath = `${fqcn.slice(prefix.length).replace(/\\/g, '/')}.php`;
        const searchPaths = Array.isArray(paths) ? paths : [paths];
        for (const basePath of searchPaths) {
            const fullPath = path.join(root, basePath, relativePath);
            if (fs.existsSync(fullPath)) {
                return fullPath;
            }
        }
    }

    return null;
}
