import App from '../../app';
import {
    F_ABSTRACT_CLASS,
    F_CLASS,
    F_ENUM,
    F_FINAL_CLASS,
    F_INTERFACE,
    F_TRAIT,
    F_UNDEFINED_TYPE,
} from '../../constants';

export default class File {
    public name: string;
    public namespace: string;
    public type: string;

    public constructor(fileName: string, type: string) {
        const nameData = App.instance.splitPath(fileName);
        this.namespace = App.instance.pathToNamespace(nameData[0]);
        this.name = nameData[1].replace('.php', '');
        this.type = type;
    }

    public get keyword(): string {
        const data: {[k: string]: string} = {
            [F_ABSTRACT_CLASS]: 'abstract class',
            [F_CLASS]: 'class',
            [F_ENUM]: 'enum',
            [F_INTERFACE]: 'interface',
            [F_FINAL_CLASS]: 'final class',
            [F_TRAIT]: 'trait',
        };

        return data[this.type] || F_UNDEFINED_TYPE;
    }
}
