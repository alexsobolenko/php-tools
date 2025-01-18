export interface Action {
    name: string;
    handler: () => void;
};
