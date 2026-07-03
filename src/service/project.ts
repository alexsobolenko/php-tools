import fs from 'fs';
import path from 'path';
import {Disposable, workspace} from 'vscode';
import {IComposerAutoload, IComposerData, IProjectCache} from '../interfaces';

let cache: IProjectCache|null = null;

function workspacePath(): string {
    const folders = workspace.workspaceFolders;

    return folders && folders.length > 0 ? folders[0].uri.fsPath : '';
}

function readComposerJson(workspaceRoot: string): {autoload: IComposerAutoload, composerData: IComposerData} {
    if (!workspaceRoot) {
        return {autoload: {}, composerData: {}};
    }

    const composerFile = path.join(workspaceRoot, 'composer.json');
    if (!fs.existsSync(composerFile)) {
        return {autoload: {}, composerData: {}};
    }

    try {
        const composerData = JSON.parse(fs.readFileSync(composerFile, 'utf-8'));
        const psr4 = (composerData.autoload || {})['psr-4'] || {};
        const psr4Dev = (composerData['autoload-dev'] || {})['psr-4'] || {};

        return {autoload: {...psr4, ...psr4Dev}, composerData};
    } catch {
        return {autoload: {}, composerData: {}};
    }
}

function getCache(): IProjectCache {
    if (cache === null) {
        const root = workspacePath();
        const {autoload, composerData} = readComposerJson(root);
        cache = {workspacePath: root, autoload, composerData};
    }

    return cache;
}

export function getWorkspacePath(): string {
    return getCache().workspacePath;
}

export function getAutoload(): IComposerAutoload {
    return getCache().autoload;
}

export function getComposerData(): IComposerData {
    return getCache().composerData;
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
