import * as Common from '../Common';
import { ALCodeLine } from "./ALCodeLine";
import { ALControl } from './ALControl';
import { ALPagePart } from './ALPagePart';
import { ALProperty } from './ALProperty';
import { ALControlType, ALObjectType, MultiLanguageType, XliffTokenType } from './Enums';
import { MultiLanguageTypeMap } from './Maps';
import { MultiLanguageObject } from "./MultiLanguageObject";


export function parseCode(parent: ALControl, startLineIndex: number, startLevel: number): number {
    let level = startLevel;

    for (let lineNo = startLineIndex; lineNo < parent.alCodeLines.length; lineNo++) {
        let codeLine = parent.alCodeLines[lineNo];
        let matchFound = false;
        let increaseResult = matchIndentationIncreased(codeLine);
        if (increaseResult) {
            level++;
            matchFound = true;
        }
        if (!matchFound) {
            let decreaseResult = matchIndentationDecreased(codeLine);
            if (decreaseResult) {
                level--;
                matchFound = true;
                if (level <= startLevel) {
                    codeLine.indentation = level;
                    return lineNo;
                }
            }
        }
        codeLine.indentation = level;
        if (!matchFound) {

            if (!parent.isALCode) {

                let property = getProperty(parent, lineNo, codeLine);
                if (property) {
                    parent.properties.push(property);
                    matchFound = true;
                }
                if (!matchFound) {
                    let mlProperty = getMlProperty(parent, lineNo, codeLine);
                    if (mlProperty) {
                        parent.multiLanguageObjects.push(mlProperty);
                        matchFound = true;
                    }
                }
                if (!matchFound) {
                    let alControl = matchALControl(parent, lineNo, codeLine);
                    if (alControl) {
                        parent.controls.push(alControl);
                        lineNo = parseCode(alControl, lineNo + 1, level);
                        alControl.endLineIndex = lineNo;
                        matchFound = true;
                    }
                }
            }
        }
        if (!matchFound) {
            let label = getLabel(parent, lineNo, codeLine);
            if (label) {
                parent.multiLanguageObjects?.push(label);
            }
        }

    }
    return parent.alCodeLines.length;
}


function matchALControl(parent: ALControl, lineIndex: number, codeLine: ALCodeLine) {
    const alControlPattern = /^\s*\b(dataitem)\b\((.*);.*\)|^\s*\b(column)\b\((.*);(.*)\)|^\s*\b(value)\b\(\d*;(.*)\)|^\s*\b(group)\b\((.*)\)|^\s*\b(field)\b\((.*);(.*);(.*)\)|^\s*\b(field)\b\((.*);(.*)\)|^\s*\b(part)\b\((.*);(.*)\)|^\s*\b(action)\b\((.*)\)|^\s*\b(area)\b\((.*)\)|^\s*\b(trigger)\b (.*)\(.*\)|^\s*\b(procedure)\b ([^\(\)]*)\(|^\s*\blocal (procedure)\b ([^\(\)]*)\(|^\s*\binternal (procedure)\b ([^\(\)]*)\(|^\s*\b(layout)\b$|^\s*\b(requestpage)\b$|^\s*\b(actions)\b$|^\s*\b(cuegroup)\b\((.*)\)|^\s*\b(repeater)\b\((.*)\)|^\s*\b(separator)\b\((.*)\)|^\s*\b(textattribute)\b\((.*)\)|^\s*\b(fieldattribute)\b\(([^;\)]*);/i;
    let alControlResult = codeLine.code.match(alControlPattern);
    if (!alControlResult) {
        return;
    }
    let control;
    alControlResult = alControlResult.filter(elmt => elmt !== undefined);
    switch (alControlResult[1].toLowerCase()) {
        case 'textattribute':
            control = new ALControl(ALControlType.TextAttribute, alControlResult[2]);
            control.xliffTokenType = XliffTokenType.XmlPortNode;
            break;
        case 'fieldattribute':
            control = new ALControl(ALControlType.FieldAttribute, alControlResult[2]);
            control.xliffTokenType = XliffTokenType.XmlPortNode;
            break;
        case 'cuegroup':
            control = new ALControl(ALControlType.CueGroup, alControlResult[2]);
            control.xliffTokenType = XliffTokenType.Control;
            break;
        case 'repeater':
            control = new ALControl(ALControlType.Repeater, alControlResult[2]);
            control.xliffTokenType = XliffTokenType.Control;
            break;
        case 'requestpage':
            control = new ALControl(ALControlType.RequestPage, 'RequestOptionsPage');
            break;
        case 'area':
            control = new ALControl(ALControlType.Area, alControlResult[2]);
            if (parent.getGroupType() === ALControlType.Actions) {
                control.xliffTokenType = XliffTokenType.Action;
            } else {
                control.xliffTokenType = XliffTokenType.Skip;
            }
            break;
        case 'group':
            control = new ALControl(ALControlType.Group, alControlResult[2]);
            if (parent.getGroupType() === ALControlType.Actions) {
                control.xliffTokenType = XliffTokenType.Action;
            } else {
                control.xliffTokenType = XliffTokenType.Control;
            }
            break;
        case 'part':
            control = new ALPagePart(ALControlType.Part, alControlResult[2], alControlResult[3]);
            control.xliffTokenType = XliffTokenType.Control;
            break;
        case 'field':
            switch (parent.getObjectType()) {
                case ALObjectType.PageExtension:
                case ALObjectType.Page:
                case ALObjectType.Report:
                    control = new ALControl(ALControlType.PageField, alControlResult[2], alControlResult[3]);
                    control.xliffTokenType = XliffTokenType.Control;
                    break;
                case ALObjectType.TableExtension:
                case ALObjectType.Table:
                    control = new ALControl(ALControlType.TableField, alControlResult[3]);
                    control.xliffTokenType = XliffTokenType.Field;
                    break;
                default:
                    throw new Error(`Field not supported for Object type ${parent.getObjectType()}`);
            }
            break;
        case 'separator':
            control = new ALControl(ALControlType.Separator, alControlResult[2]);
            control.xliffTokenType = XliffTokenType.Action;
            break;
        case 'action':
            control = new ALControl(ALControlType.Action, alControlResult[2]);
            break;
        case 'dataitem':
            switch (parent.getObjectType()) {
                case ALObjectType.Report:
                    control = new ALControl(ALControlType.DataItem, alControlResult[2]);
                    control.xliffTokenType = XliffTokenType.ReportDataItem;
                    break;
                case ALObjectType.Query:
                    control = new ALControl(ALControlType.DataItem, alControlResult[2]);
                    control.xliffTokenType = XliffTokenType.QueryDataItem;
                    break;
                default:
                    throw new Error(`dataitem not supported for Object type ${parent.getObjectType()}`);
            }
            break;
        case 'value':
            control = new ALControl(ALControlType.Value, alControlResult[2]);
            control.xliffTokenType = XliffTokenType.EnumValue;
            break;
        case 'column':
            switch (parent.getObjectType()) {
                case ALObjectType.Query:
                    control = new ALControl(ALControlType.Column, alControlResult[2]);
                    control.xliffTokenType = XliffTokenType.QueryColumn;
                    break;
                case ALObjectType.Report:
                    control = new ALControl(ALControlType.Column, alControlResult[2]);
                    control.xliffTokenType = XliffTokenType.ReportColumn;
                    break;
                default:
                    throw new Error(`Column not supported for Object type ${parent.getObjectType()}`);
            }
            break;
        case 'trigger':
            control = new ALControl(ALControlType.Trigger, alControlResult[2]);
            control.xliffTokenType = XliffTokenType.Method;
            control.isALCode = true;
            break;
        case 'procedure':
            control = new ALControl(ALControlType.Procedure, alControlResult[2]);
            control.xliffTokenType = XliffTokenType.Method;
            control.isALCode = true;
            break;
        case 'layout':
            control = new ALControl(ALControlType.Layout);
            control.xliffTokenType = XliffTokenType.Skip;
            break;
        case 'actions':
            control = new ALControl(ALControlType.Actions);
            control.xliffTokenType = XliffTokenType.Skip;
            break;
        default:
            throw new Error(`Control type ${alControlResult[1].toLowerCase()} is unhandled`);
    }
    control.startLineIndex = control.endLineIndex = lineIndex;
    control.alCodeLines = parent.alCodeLines;
    control.parent = parent;
    return control;


}

function getProperty(parent: ALControl, lineIndex: number, codeLine: ALCodeLine) {
    let propertyResult = codeLine.code.match(/^\s*(?<name>ObsoleteState|SourceTable|PageType)\s*=\s*(?<value>"[^"]*"|[\w]*);/i);
    if (propertyResult && propertyResult.groups) {
        let property = new ALProperty(parent, lineIndex, propertyResult.groups.name, propertyResult.groups.value);
        return property;
    }
    return;
}

function matchIndentationDecreased(codeLine: ALCodeLine): boolean {
    const indentationDecrease = /(^\s*}|}\s*\/{2}(.*)$|^\s*\bend\b)/i;
    let decreaseResult = codeLine.code.match(indentationDecrease);
    return null !== decreaseResult;
}

function matchIndentationIncreased(codeLine: ALCodeLine): boolean {
    const indentationIncrease = /^\s*{|{\s*\/{2}(.*)$|\bbegin\b\s*$|\bbegin\b\s*\/{2}(.*)$|\bcase\b\s.*\s\bof\b/i;
    let increaseResult = codeLine.code.match(indentationIncrease);
    return null !== increaseResult;
}


function matchLabel(line: string): RegExpExecArray | null {
    const labelTokenPattern = /^\s*(?<name>\w*): Label (?<text>('(?<text1>[^']*'{2}[^']*)*')|'(?<text2>[^']*)')(?<maxLength3>,\s?MaxLength\s?=\s?(?<maxLengthValue3>\d*))?(?<locked>,\s?Locked\s?=\s?(?<lockedValue>true|false))?(?<maxLength2>,\s?MaxLength\s?=\s?(?<maxLengthValue2>\d*))?(?<comment>,\s?Comment\s?=\s?(?<commentText>('(?<commentText1>[^']*'{2}[^']*)*')|'(?<commentText2>[^']*)'))?(?<locked2>,\s?Locked\s?=\s?(?<lockedValue2>true|false))?(?<maxLength>,\s?MaxLength\s?=\s?(?<maxLengthValue>\d*))?(?<locked3>,\s?Locked\s?=\s?(?<lockedValue3>true|false))?/i;
    let labelTokenResult = labelTokenPattern.exec(line);
    return labelTokenResult;
}
export function getLabel(parent: ALControl, lineIndex: number, codeLine: ALCodeLine): MultiLanguageObject | undefined {
    let matchResult = matchLabel(codeLine.code);
    let mlObject = getMlObjectFromMatch(parent, lineIndex, MultiLanguageType.Label, matchResult);
    return mlObject;
}


function matchMlProperty(line: string): RegExpExecArray | null {
    const mlTokenPattern = /^\s*(?<name>OptionCaption|Caption|ToolTip|InstructionalText|PromotedActionCategories|RequestFilterHeading) = (?<text>('(?<text1>[^']*'{2}[^']*)*')|'(?<text2>[^']*)')(?<maxLength3>,\s?MaxLength\s?=\s?(?<maxLengthValue3>\d*))?(?<locked>,\s?Locked\s?=\s?(?<lockedValue>true|false))?(?<maxLength2>,\s?MaxLength\s?=\s?(?<maxLengthValue2>\d*))?(?<comment>,\s?Comment\s?=\s?(?<commentText>('(?<commentText1>[^']*'{2}[^']*)*')|'(?<commentText2>[^']*)'))?(?<locked2>,\s?Locked\s?=\s?(?<lockedValue2>true|false))?(?<maxLength>,\s?MaxLength\s?=\s?(?<maxLengthValue>\d*))?(?<locked3>,\s?Locked\s?=\s?(?<lockedValue3>true|false))?/i;
    let mlTokenResult = mlTokenPattern.exec(line);
    return mlTokenResult;
}
export function getMlProperty(parent: ALControl, lineIndex: number, codeLine: ALCodeLine): MultiLanguageObject | undefined {
    let matchResult = matchMlProperty(codeLine.code);
    let mlType = MultiLanguageType.Property;
    if (matchResult) {
        if (matchResult.groups) {
            let type = MultiLanguageTypeMap.get(matchResult.groups.name.toLowerCase());
            if (type) {
                mlType = type;
            }
        }
    }
    let mlObject = getMlObjectFromMatch(parent, lineIndex, mlType, matchResult);
    return mlObject;
}

function getMlObjectFromMatch(parent: ALControl, lineIndex: number, type: MultiLanguageType, matchResult: RegExpExecArray | null): MultiLanguageObject | undefined {
    if (matchResult) {
        if (matchResult.groups) {
            let mlObject = new MultiLanguageObject(parent, type, matchResult.groups.name);
            mlObject.startLineIndex = mlObject.endLineIndex = lineIndex;
            mlObject.text = matchResult.groups.text.substr(1, matchResult.groups.text.length - 2); // Remove leading and trailing '
            mlObject.text = Common.replaceAll(mlObject.text, `''`, `'`);
            if (matchResult.groups.locked) {
                if (matchResult.groups.lockedValue.toLowerCase() === 'true') {
                    mlObject.locked = true;
                }
            } else if (matchResult.groups.locked2) {
                if (matchResult.groups.lockedValue2.toLowerCase() === 'true') {
                    mlObject.locked = true;
                }
            } else if (matchResult.groups.locked3) {
                if (matchResult.groups.lockedValue3.toLowerCase() === 'true') {
                    mlObject.locked = true;
                }
            }
            if (matchResult.groups.commentText) {
                mlObject.comment = matchResult.groups.commentText.substr(1, matchResult.groups.commentText.length - 2); // Remove leading and trailing '
            }
            mlObject.comment = Common.replaceAll(mlObject.comment, `''`, `'`);

            if (matchResult.groups.maxLength) {
                mlObject.maxLength = Number.parseInt(matchResult.groups.maxLengthValue);
            } else if (matchResult.groups.maxLength2) {
                mlObject.maxLength = Number.parseInt(matchResult.groups.maxLengthValue2);
            } else if (matchResult.groups.maxLength3) {
                mlObject.maxLength = Number.parseInt(matchResult.groups.maxLengthValue3);
            }
            return mlObject;
        }
    }
    return;
}