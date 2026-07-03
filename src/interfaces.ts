import {Position} from 'vscode';

export interface IParameter {
    name: string;
    hint: string;
}

export interface IPhpNode {
    kind?: string;
    name?: any;
    loc?: {
        start?: {
            line?: number;
            offset?: number;
        };
        end?: {
            line?: number;
            offset?: number;
        };
    }|null;
    [key: string]: any;
}

export interface IComposerAutoload {
    [namespace: string]: string|Array<string>;
}

export interface IComposerData {
    [key: string]: any;
}

export interface IProjectCache {
    workspacePath: string;
    autoload: IComposerAutoload;
    composerData: IComposerData;
}

export interface IImportState {
    imports: Set<string>;
    aliases: Set<string>;
    useLines: Array<string>;
    firstUseLine: number;
    namespaceName: string|null;
    lastUseLine: number;
    namespaceLine: number;
}

export interface IImportInsert {
    position: Position;
    text: string;
    replaceUntilLine?: number;
}

export interface IDescriptionConfig {
    showDescription: boolean;
    linesAfterDescription: number;
}

export interface IFunctionDocConfig {
    showDescription: boolean;
    linesAfterDescription: number;
    returnVoid: boolean;
    linesBeforeReturn: number;
    linesBeforeThrows: number;
    showThrowsOnDiffLines: boolean;
}
