export interface IAction {
    name: string;
    handler: () => void;
};

export interface IParameter {
    name: string;
    hint: string;
}

export interface IPHPDocHandler {
    [key: string]: () => string;
}
