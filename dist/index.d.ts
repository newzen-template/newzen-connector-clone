declare enum TYPE_SERVICE {
    CASH = "Price Cash Only",
    CARD = "Price Card Only",
    Both = "Both"
}

interface IFunction {
    (...args: any[]): any;
}
declare class NewzenConnector {
    _formattedPage: null;
    callback: IFunction;
    constructor({ callback, initialData }: {
        callback: IFunction;
        initialData: any;
    });
    actionHandler: () => void;
    static formatContentBlock: (pageObject: any) => any;
    static parseDataBinding: (dataCmsBind: string) => {
        blockIndex: number;
        fieldPath: string | null;
    } | null;
    static isEditMode: () => boolean;
    static emitInlineEdit: (dataCmsBind: string, newValue: string, fieldPath: string, messageType: string, element?: HTMLElement) => void;
    static setupEditableElement: (element: HTMLElement | null, fieldPath: string) => () => void;
    static setupInlineEditing: () => void;
    static calPriceService: (inputPrice: string, taxPercent: number, typePrice: TYPE_SERVICE) => string;
}

export { NewzenConnector as default };
