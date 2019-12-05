import * as vscode from 'vscode';
import * as fs from 'fs';
import * as WorkspaceFunctions from './WorkspaceFunctions';
import * as DocumentFunctions from './DocumentFunctions';
import * as VSCodeFunctions from './VSCodeFunctions';
import * as xmldom from 'xmldom';
import * as escapeStringRegexp from 'escape-string-regexp';
import { XliffIdToken } from './ALObject';
import { Settings, Setting } from "./Settings";
import { settings } from 'cluster';

export async function FindNextUnTranslatedText(searchCurrentDocument: boolean): Promise<boolean> {
    let filesToSearch: vscode.Uri[] = new Array();
    let startOffset = 0;
    if (searchCurrentDocument) {
        if (vscode.window.activeTextEditor === undefined) {
            return false;
        }
        await vscode.window.activeTextEditor.document.save();

        filesToSearch.push(vscode.window.activeTextEditor.document.uri); //TODO: hur gör för att slippa spara filerna
        startOffset = vscode.window.activeTextEditor.document.offsetAt(vscode.window.activeTextEditor.selection.active);

    } else {
        await vscode.workspace.saveAll(); //TODO: hur gör för att slippa spara filerna
        filesToSearch = (await WorkspaceFunctions.GetLangXlfFiles(vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.uri : undefined));
    }


    for (let i = 0; i < filesToSearch.length; i++) {
        const xlfUri = filesToSearch[i];
        let searchResult = await DocumentFunctions.searchTextFile(xlfUri, startOffset, GetNotTranslatedToken());
        let searchedForReviewtoken = false;
        if (!searchResult.foundNode) {
            searchResult = await DocumentFunctions.searchTextFile(xlfUri, startOffset, GetReviewToken());
            searchedForReviewtoken = true;
        }
        if (searchResult.foundNode) {
            await DocumentFunctions.openTextFileWithSelection(xlfUri, searchResult.foundAtPosition, searchedForReviewtoken ? GetReviewToken().length : GetNotTranslatedToken().length);
            return true;
        }

    }
    return false;
}

export async function CopySourceToTarget(): Promise<boolean> {

    if (vscode.window.activeTextEditor) {
        var editor = vscode.window.activeTextEditor;
        if (vscode.window.activeTextEditor.document.uri.fsPath.endsWith('xlf')) {
            // in a xlf file
            await vscode.window.activeTextEditor.document.save();
            let docText = vscode.window.activeTextEditor.document.getText();
            const lineEnding = whichLineEnding(docText);
            let docArray = docText.split(lineEnding);
            if (docArray[vscode.window.activeTextEditor.selection.active.line].match(/<target>.*<\/target>/i)) {
                // on a target line
                let sourceLine = docArray[vscode.window.activeTextEditor.selection.active.line - 1].match(/<source>(.*)<\/source>/i);
                if (sourceLine) {
                    // source line just above
                    let newLineText = `          <target>${sourceLine[1]}</target>`;
                    await editor.edit((editBuilder) => {
                        let targetLineRange = new vscode.Range(editor.selection.active.line, 0, editor.selection.active.line, docArray[editor.selection.active.line].length);
                        editBuilder.replace(targetLineRange, newLineText);
                    });
                    editor.selection = new vscode.Selection(editor.selection.active.line, 18, editor.selection.active.line, 18 + sourceLine[1].length);
                    return true;
                }
            }
        }
    }
    return false;
}
export async function FindAllUnTranslatedText(): Promise<void> {
    const findText = escapeStringRegexp(GetReviewToken()) + '|' + escapeStringRegexp(GetNotTranslatedToken());
    await VSCodeFunctions.FindTextInFiles(findText, true);
}

export function GetNotTranslatedToken(): string {
    return '[NAB: NOT TRANSLATED]';
}
export function GetReviewToken(): string {
    return '[NAB: REVIEW]';
}

export async function RefreshXlfFilesFromGXlf(sortOnly?: boolean): Promise<{
    NumberOfAddedTransUnitElements: number;
    NumberOfUpdatedNotes: number;
    NumberOfUpdatedMaxWidths: number;
    NumberOfCheckedFiles: number;
    NumberOfUpdatedSources: number;
    NumberOfRemovedTransUnits: number;
}> {
    const xmlns = 'urn:oasis:names:tc:xliff:document:1.2';
    const xmlStub = `<?xml version="1.0" encoding="utf-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:oasis:names:tc:xliff:document:1.2 xliff-core-1.2-transitional.xsd">
  <file datatype="xml" source-language="" target-language="" original="">
    <body>
      <group id="body"></group>
    </body>
  </file>
</xliff>
`;
    if (sortOnly === null) {
        sortOnly = false;
    }
    let useExternalTranslationTool: boolean = Settings.GetConfigSettings()[Setting.UseExternalTranslationTool];
    let NumberOfAddedTransUnitElements = 0;
    let NumberOfCheckedFiles = 0;
    let NumberOfUpdatedNotes = 0;
    let NumberOfUpdatedMaxWidths = 0;
    let NumberOfUpdatedSources = 0;
    let NumberOfRemovedTransUnits = 0;
    let currentUri: vscode.Uri | undefined = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.uri : undefined;
    let gXlfFilePath = (await WorkspaceFunctions.GetGXlfFile(currentUri)).fsPath;
    console.log('Translate file path: ', gXlfFilePath);
    let langFiles = (await WorkspaceFunctions.GetLangXlfFiles(currentUri));
    NumberOfCheckedFiles = langFiles.length;
    let gXmlContent = fs.readFileSync(gXlfFilePath, "UTF8");
    const lineEnding = whichLineEnding(gXmlContent);
    let dom = xmldom.DOMParser;
    let gXlfDom = new dom().parseFromString(gXmlContent);
    let gXlfTransUnitNodes = gXlfDom.getElementsByTagNameNS(xmlns, 'trans-unit');
    let gFileNode = gXlfDom.getElementsByTagNameNS(xmlns, 'file')[0];
    for (let langIndex = 0; langIndex < langFiles.length; langIndex++) {
        const langUri = langFiles[langIndex];
        console.log('Language file: ', langUri.fsPath);

        let langXlfFilePath = langUri.fsPath;
        let langXmlContent = fs.readFileSync(langXlfFilePath, "UTF8");

        let langXlfDom = new dom().parseFromString(langXmlContent);
        let langTempDom = new dom().parseFromString(xmlStub);
        let tmpFileNode = langTempDom.getElementsByTagNameNS(xmlns, 'file')[0];
        let langFileNode = langXlfDom.getElementsByTagNameNS(xmlns, 'file')[0];
        let langIsSameAsGXlf = (langFileNode.getAttribute('target-language') === gFileNode.getAttribute('target-language'));

        tmpFileNode.setAttribute('source-language', langFileNode.getAttribute('source-language') || GetNotTranslatedToken());
        tmpFileNode.setAttribute('original', langFileNode.getAttribute('original') || GetNotTranslatedToken());
        tmpFileNode.setAttribute('target-language', langFileNode.getAttribute('target-language') || GetNotTranslatedToken());
        let tmpGroupNode = langTempDom.getElementsByTagNameNS(xmlns, 'group')[0];
        for (let i = 0, len = gXlfTransUnitNodes.length; i < len; i++) {
            let gXlfTransUnitElement = gXlfTransUnitNodes[i];
            let gXlfTranslateAttribute = gXlfTransUnitElement.getAttribute('translate');
            if (gXlfTranslateAttribute === 'yes') {
                tmpGroupNode.appendChild(langTempDom.createTextNode('\r\n        '));
                let id = gXlfTransUnitElement.getAttribute('id');
                if (id) {
                    let langTransUnitNode = langXlfDom.getElementById(id);
                    let cloneElement: Element,
                        targetElmt: Element,
                        noteElmt: Element;

                    if (!langTransUnitNode) {
                        if (!sortOnly) {
                            console.log('Id missing:', id);
                            cloneElement = <Element>gXlfTransUnitElement.cloneNode(true);

                            noteElmt = cloneElement.getElementsByTagNameNS(xmlns, 'note')[0];
                            targetElmt = langTempDom.createElement('target');
                            if (langIsSameAsGXlf) {
                                targetElmt.textContent = GetReviewToken() + cloneElement.getElementsByTagNameNS(xmlns, 'source')[0].textContent;
                            } else {
                                targetElmt.textContent = GetNotTranslatedToken();
                            }
                            langTempDom.insertBefore(targetElmt, noteElmt);
                            langTempDom.insertBefore(langTempDom.createTextNode('\r\n          '), noteElmt);

                            tmpGroupNode.appendChild(cloneElement);
                            NumberOfAddedTransUnitElements++;
                        }
                    } else {
                        let langCloneElement: Element,
                            langTargetElement: Element,
                            langNoteElement: Element | undefined,
                            gXlfNoteElement: Element | undefined,
                            langSourceElement: Element,
                            gXlfSourceElement: Element;
                        langCloneElement = <Element>langTransUnitNode.cloneNode(true);
                        langXlfDom.removeChild(langTransUnitNode);
                        if (!sortOnly) {
                            langTargetElement = langCloneElement.getElementsByTagNameNS(xmlns, 'target')[0];
                            langNoteElement = GetNoteElement(langCloneElement, xmlns, 'Developer');
                            gXlfNoteElement = GetNoteElement(gXlfTransUnitElement, xmlns, 'Developer');
                            gXlfSourceElement = gXlfTransUnitElement.getElementsByTagNameNS(xmlns, 'source')[0];
                            langSourceElement = langCloneElement.getElementsByTagNameNS(xmlns, 'source')[0];
                            let sourceIsUpdated = false;
                            if (langSourceElement.textContent !== gXlfSourceElement.textContent) {
                                console.log('source updated for Id ', id);
                                langSourceElement.textContent = gXlfSourceElement.textContent;
                                NumberOfUpdatedSources++;
                                sourceIsUpdated = true;
                            }
                            if (!langTargetElement) {
                                console.log('target is missing for Id ', id);
                                langTargetElement = langTempDom.createElement('target');
                                //TODO: Extract to function?
                                if (useExternalTranslationTool) {
                                    langTargetElement.setAttribute('state', 'needs-adaptation');
                                } else {
                                    if (langIsSameAsGXlf) {
                                        langTargetElement.textContent = GetReviewToken() + langCloneElement.getElementsByTagNameNS(xmlns, 'source')[0].textContent;
                                    } else {
                                        langTargetElement.textContent = GetNotTranslatedToken();
                                    }
                                }
                                let insertBeforeNode = GetNoteElement(langCloneElement, xmlns, 'Developer');
                                if (!insertBeforeNode) {
                                    insertBeforeNode = <Element>GetNoteElement(langCloneElement, xmlns, 'Xliff Generator');
                                }
                                langCloneElement.insertBefore(langTargetElement, insertBeforeNode);
                                langCloneElement.insertBefore(langTempDom.createTextNode('\r\n          '), insertBeforeNode);
                                NumberOfAddedTransUnitElements++;
                            } else if (sourceIsUpdated) {
                                let targetText: string = langTargetElement.textContent ? langTargetElement.textContent : '';
                                //TODO: Extract to function?
                                if (useExternalTranslationTool) {
                                    langTargetElement.setAttribute('state', 'needs-adaptation');
                                } else {
                                    if ((!targetText.startsWith(GetReviewToken())) && (!targetText.startsWith(GetNotTranslatedToken())) && (targetText !== langSourceElement.textContent)) {
                                        langTargetElement.textContent = GetReviewToken() + langTargetElement.textContent;
                                    }
                                }
                            }
                            let gXlfMaxWith = gXlfTransUnitElement.getAttribute('maxwidth');
                            let langMaxWith = langCloneElement.getAttribute('maxwidth');
                            if (gXlfMaxWith !== langMaxWith) {
                                if (!gXlfMaxWith) {
                                    console.log('maxwidth removed for Id ', id);
                                    langCloneElement.removeAttribute('maxwidth');
                                } else {
                                    console.log('maxwidth updated for Id ', id);
                                    langCloneElement.setAttribute('maxwidth', gXlfMaxWith);
                                }
                                NumberOfUpdatedMaxWidths++;
                            }
                            if (undefined !== gXlfNoteElement) {
                                if (undefined === langNoteElement) {
                                    console.log('Note missing for Id ', id);
                                    let insertBeforeNode = <Element>GetNoteElement(langCloneElement, xmlns, 'Xliff Generator');
                                    langCloneElement.insertBefore(gXlfNoteElement.cloneNode(true), insertBeforeNode);
                                    langCloneElement.insertBefore(langTempDom.createTextNode('\r\n          '), insertBeforeNode);
                                    NumberOfUpdatedNotes++;
                                } else {
                                    if (gXlfNoteElement.textContent !== langNoteElement.textContent) {
                                        console.log('Note comment updated for Id ', id);
                                        langNoteElement.textContent = gXlfNoteElement.textContent;
                                        NumberOfUpdatedNotes++;
                                    }
                                }
                            }
                        }

                        tmpGroupNode.appendChild(langCloneElement);
                    }
                }
            }
        }
        tmpGroupNode.appendChild(langTempDom.createTextNode('\r\n      '));
        let domData = langTempDom.toString();
        domData = RemoveSelfClosingTags(domData);
        domData = domData.replace(/(\r\n|\n)/gm, lineEnding); // Replaces \n with the ones found in g.xlf file
        fs.writeFileSync(langXlfFilePath, domData, "UTF8");

        NumberOfRemovedTransUnits += langXlfDom.getElementsByTagName('trans-unit').length;
    }

    return {
        NumberOfAddedTransUnitElements: NumberOfAddedTransUnitElements,
        NumberOfCheckedFiles: NumberOfCheckedFiles,
        NumberOfUpdatedMaxWidths: NumberOfUpdatedMaxWidths,
        NumberOfUpdatedNotes: NumberOfUpdatedNotes,
        NumberOfUpdatedSources: NumberOfUpdatedSources,
        NumberOfRemovedTransUnits: NumberOfRemovedTransUnits
    };

}

function whichLineEnding(source: string) {
    let temp = source.indexOf('\n');
    if (source[temp - 1] === '\r') {
        return '\r\n';
    }
    return '\n';
}

function GetNoteElement(parentElement: Element, xmlns: string, fromValue: string) {
    let noteElements = parentElement.getElementsByTagNameNS(xmlns, 'note');
    if (!noteElements) {
        return;
    }
    for (let index = 0; index < noteElements.length; index++) {
        const element = noteElements[index];
        if (element.getAttribute('from') === fromValue) {
            return element;
        }
    }
    return;
}

export async function GetCurrentXlfData(): Promise<XliffIdToken[]> {
    if (undefined === vscode.window.activeTextEditor) {
        throw new Error("No active Text Editor");
    }

    let currDoc = vscode.window.activeTextEditor.document;
    let activeLineNo = vscode.window.activeTextEditor.selection.active.line;
    let result = GetTransUnitID(activeLineNo, currDoc);
    let note = GetTransUnitIdDescriptionNote(result.LineNo, currDoc);

    return XliffIdToken.GetXliffIdTokenArray(result.Id, note);
}

function GetTransUnitID(activeLineNo: number, Doc: vscode.TextDocument): { LineNo: number; Id: string } {
    let TextLine: string;
    let count: number = 0;
    do {
        TextLine = Doc.getText(new vscode.Range(new vscode.Position(activeLineNo - count, 0), new vscode.Position(activeLineNo - count, 5000)));
        count += 1;
    } while (GetTransUnitLineType(TextLine) !== 0 && count <= 6);
    if (count > 6) {
        throw new Error('Not inside a trans-unit element');
    }
    let result = TextLine.match(/\s*<trans-unit id="([^"]*)"/i);
    if (null === result) {
        throw new Error(`Could not identify the trans-unit id ('${TextLine})`);
    }
    return { LineNo: activeLineNo - count + 1, Id: result[1] };
}

function GetTransUnitIdDescriptionNote(activeLineNo: number, Doc: vscode.TextDocument): string {
    let TextLine: string;
    let count: number = 0;
    do {
        TextLine = Doc.getText(new vscode.Range(new vscode.Position(activeLineNo + count, 0), new vscode.Position(activeLineNo + count, 5000)));
        count += 1;
    } while (GetTransUnitLineType(TextLine) !== 4 && count <= 6);
    if (count > 6) {
        throw new Error('Not inside a trans-unit element');
    }
    let result = TextLine.match(/\s*<note from="Xliff Generator" annotates="general" priority="3">(.*)<\/note>.*/i);
    if (null === result) {
        throw new Error(`Could not identify the trans-unit description note ('${TextLine})`);
    }
    return result[1];
}
function GetTransUnitLineType(TextLine: string): number {
    if (null !== TextLine.match(/\s*<trans-unit id=.*/i)) {
        return 0;
    }
    if (null !== TextLine.match(/\s*<source\/?>.*/i)) {
        return 1;
    }
    if (null !== TextLine.match(/\s*<target\/?>.*/i)) {
        return 2;
    }
    if (null !== TextLine.match(/\s*<note from="Developer" annotates="general" priority="2".*/i)) {
        return 3;
    }
    if (null !== TextLine.match(/\s*<note from="Xliff Generator" annotates="general" priority="3">(.*)<\/note>.*/i)) {
        return 4;
    }
    if (null !== TextLine.match(/\s*<\/trans-unit>.*/i)) {
        return 5;
    }
    throw new Error('Not inside a trans-unit element');
}

function RemoveSelfClosingTags(xml: string): string {
    // ref https://stackoverflow.com/a/16792194/5717285
    var split = xml.split("/>");
    var newXml = "";
    for (var i = 0; i < split.length - 1; i++) {
        var edsplit = split[i].split("<");
        newXml += split[i] + "></" + edsplit[edsplit.length - 1].split(" ")[0] + ">";
    }
    return newXml + split[split.length - 1];
}

// <trans-unit id="Table 3710665244 - Property 2879900210" size-unit="char" translate="yes" xml:space="preserve">
// <source>Table</source>
// <target>[NAB: REVIEW]Table</target>
// <note from="Developer" annotates="general" priority="2"/>
// <note from="Xliff Generator" annotates="general" priority="3">Table Test Table - Property Caption</note>
// </trans-unit>



// <trans-unit id="Page 3710665244 - Control 2961552353 - Property 62802879" size-unit="char" translate="yes" xml:space="preserve">
// <source>asdf,sadf,____ASADF</source>
// <note from="Developer" annotates="general" priority="2"></note>
// <note from="Xliff Generator" annotates="general" priority="3">Page Test Table - Control Name - Property OptionCaption</note>
// </trans-unit>
