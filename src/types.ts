import {IPhpNode} from './interfaces';

export type TRelations = Map<string, {extends: string|null, implements: Array<string>}>;
export type TThrowsContext = {
    functionMap: Map<string, IPhpNode>,
    methodMap: Map<string, IPhpNode>,
    ownerClass: IPhpNode|null,
    currentClassName: string|null,
    namespaceName: string|null,
    relations: TRelations,
    uses: Map<string, string>,
};
export type TCallable = {node: IPhpNode, ownerClass: IPhpNode|null};
export type TResolvedCallable = {node: IPhpNode, className: string|null, context: TThrowsContext};
