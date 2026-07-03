import {CodeLensProvider, CompletionItemProvider} from 'vscode';
import Symfony from '../framework/symfony/service';
import Yii2 from '../framework/yii2/service';
import {getComposerData} from '../service/project';

export default class Framework {
    public readonly symfony: Symfony;
    private readonly yii2: Yii2;

    public constructor() {
        const composerData = getComposerData();
        this.symfony = new Symfony(Symfony.checkComposerData(composerData));
        this.yii2 = new Yii2(Yii2.checkComposerData(composerData));
    }

    public get providers(): Array<{selector: Object, provider: CodeLensProvider}> {
        return [
            ...this.symfony.providers,
            ...this.yii2.providers,
        ];
    }

    public get completionProviders(): Array<{
        selector: Object,
        provider: CompletionItemProvider,
        triggers?: Array<string>,
    }> {
        return [
            ...this.symfony.completionProviders,
        ];
    }
}
