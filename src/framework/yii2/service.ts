import {CodeLensProvider} from 'vscode';
import {Yii2DiProvider, Yii2ViewProvider} from './providers';

export default class Yii2 {
    public used: boolean;

    public constructor(used: boolean) {
        this.used = used;
    }

    public static checkComposerData(data: any): boolean {
        const requireLibs = Object.keys(data.require || {});
        const yii2Libs = ['yiisoft/yii2', 'yiisoft/yii2-bootstrap', 'yii2mod/yii2-settings', 'yii2tech/yii2-admin'];
        const yii2LibsSet = new Set(yii2Libs);

        return requireLibs.filter((i) => yii2LibsSet.has(i)).length > 0;
    }

    public get providers(): Array<{selector: Object, provider: CodeLensProvider}> {
        if (!this.used) {
            return [];
        }

        return [
            {
                selector: {language: 'php', scheme: 'file'},
                provider: new Yii2ViewProvider(),
            },
            {
                selector: {language: 'php'},
                provider: new Yii2DiProvider(),
            },
        ];
    }
}
