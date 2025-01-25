export interface IAction {
    name: string;
    handler: () => void;
};

export interface IParameter {
    name: string;
    type: string;
}
