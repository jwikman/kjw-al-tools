export class ALCodeLine {
    lineNo: number;
    code: string;
    indentation: number = 0;

    constructor(code: string, lineNo: number) {
        this.code = code;
        this.lineNo = lineNo;
    }

}

