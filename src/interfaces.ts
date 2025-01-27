export interface IAction {
    name: string;
    handler: () => void;
};

export interface IParameter {
    name: string;
    type: string;
}

export interface IPHPDocHandler {
    [key: string]: () => string;
}
