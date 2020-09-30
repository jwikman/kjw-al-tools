import * as fs from 'fs';
import * as vscode from 'vscode';
// import * as fs from 'fs';
import * as path from 'path';
import { Settings, Setting } from './Settings';
// import { Settings } from './Settings';
import * as DocumentFunctions from './DocumentFunctions';
import { ALObject, ObjectProperty, XliffIdToken, NAVCodeLine, ControlType, ObjectType } from './ALObject';

const invalidChars = [":", "/", "\\", "?", "<", ">", "*", "|", "\""];

// private static gXLFFilepath: string;
export async function openAlFileFromXliffTokens(tokens: XliffIdToken[]) {
    let alFiles = await getAlFilesFromCurrentWorkspace();
    if (null === alFiles) {
        throw new Error('No AL files found in this folder.');
    }
    for (let index = 0; index < alFiles.length; index++) {
        const alFile = alFiles[index];
        let fileContent: string = fs.readFileSync(alFile.fsPath, 'UTF8');
        let obj: ALObject = new ALObject(fileContent, false, alFile.fsPath);
        if (ObjectType[obj.objectType].toLowerCase() === tokens[0].type.toLowerCase() && obj.objectName.toLowerCase() === tokens[0].Name.toLowerCase()) {
            // found our file!
            obj = new ALObject(fileContent, true, alFile.fsPath);
            let line: NAVCodeLine[];
            let tmpTokens = tokens.slice();

            do {
                line = obj.codeLines.filter(line => line.xliffId().toLowerCase() === XliffIdToken.getXliffId(tmpTokens).toLowerCase());
                tmpTokens = tokens.slice(0, tmpTokens.length - 1);
            } while (line.length === 0 && tmpTokens.length > 0);

            if (line.length === 0) {
                throw new Error(`No code line found in file '${alFile.fsPath}' matching '${XliffIdToken.getXliffIdWithNames(tokens)}'`);
            }
            if (tmpTokens.length + 1 < tokens.length) {
                vscode.window.showInformationMessage('Expected property not found, showing the closest code line found.');
            }
            DocumentFunctions.openTextFileWithSelectionOnLineNo(alFile.fsPath, line[0].lineNo);
            break;
        }

    }
}

export async function getAlObjectsFromCurrentWorkspace() {
    let alFiles = await getAlFilesFromCurrentWorkspace();
    if (null === alFiles) {
        throw new Error('No AL files found in this folder.');
    }
    let objects: ALObject[] = new Array();
    for (let index = 0; index < alFiles.length; index++) {
        const alFile = alFiles[index];
        let fileContent = fs.readFileSync(alFile.fsPath, 'UTF8');
        let obj: ALObject = new ALObject(fileContent, true, alFile.fsPath);
        objects.push(obj);
    }
    for (let index = 0; index < objects.length; index++) {
        let currObject = objects[index];
        if ((currObject.objectType === ObjectType.Page) || (currObject.objectType === ObjectType.PageExtension)) {
            // Add captions from table fields if needed
            let tableObjects = objects.filter(x => (((x.objectType === ObjectType.Table) && (x.objectName === currObject.properties.get(ObjectProperty.SourceTable))) || ((x.objectType === ObjectType.TableExtension) && (x.properties.get(ObjectProperty.ExtendedObjectId) === currObject.properties.get(ObjectProperty.ExtendedTableId)))));
            if (tableObjects.length === 1) {
                let tableObject = tableObjects[0]; // Table used as SourceTable found
                for (let i = 0; i < currObject.controls.length; i++) {
                    const currControl = currObject.controls[i];
                    if (currControl.caption === '') {
                        // A Page/Page Extension with a field that are missing Caption -> Check if Caption is found in SourceTable
                        let tableFields = tableObject.controls.filter(x => x.name === currControl.value);
                        if (tableFields.length === 1) {
                            let tableField = tableFields[0];
                            currControl.caption = tableField.caption === '' ? tableField.name : tableField.caption;
                        }
                    }
                }
            }
            // Add related pages for page parts
            let pageParts = currObject.controls.filter(x =>  x.type === ControlType.Part);
            for (let i = 0; i < pageParts.length; i++) {
                const part = pageParts[i];
                let pageObjects = objects.filter(x => ((x.objectType === ObjectType.Page) && (x.objectName === part.value)));
                if (pageObjects.length ===1) {
                    part.relatedObject = pageObjects[0];
                }
            }
        }
    }
    return objects;
}



export async function getAlFilesFromCurrentWorkspace() {
    if (vscode.window.activeTextEditor) {
        let currentWorkspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri); //Active File
        if (currentWorkspaceFolder) {
            return await vscode.workspace.findFiles(new vscode.RelativePattern(currentWorkspaceFolder, '**/*.al'));
        }
        return null;
    } else {
        return await vscode.workspace.findFiles('**/*.al');
    }

}

export function getTranslationFolderPath(ResourceUri?: vscode.Uri) {
    let workspaceFolder = getWorkspaceFolder(ResourceUri);
    let workspaceFolderPath = workspaceFolder.uri.fsPath;
    let translationFolderPath = path.join(workspaceFolderPath, 'Translations');
    return translationFolderPath;
}

export async function getGXlfFile(ResourceUri?: vscode.Uri): Promise<vscode.Uri> {
    let translationFolderPath = getTranslationFolderPath(ResourceUri);
    let expectedName = getgXlfFileName(ResourceUri);
    let fileUriArr = await vscode.workspace.findFiles(new vscode.RelativePattern(translationFolderPath, expectedName));

    if (fileUriArr.length === 0) {
        throw new Error(`The file ${expectedName} was not found in the translation folder "${translationFolderPath}"`);
    }
    return fileUriArr[0];

}
function getgXlfFileName(ResourceUri?: vscode.Uri): string {
    let settings = Settings.getAppSettings(ResourceUri);
    let fileName = settings[Setting.AppName].split("").filter(isValidFilesystemChar).join("").trim();
    return `${fileName}.g.xlf`;
}

export function getWorkspaceFolder(ResourceUri?: vscode.Uri): vscode.WorkspaceFolder {
    let workspaceFolder: any;
    if (ResourceUri) {
        workspaceFolder = vscode.workspace.getWorkspaceFolder(ResourceUri);
    }
    if (!workspaceFolder) {
        if (vscode.window.activeTextEditor) {
            workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
        }
        else {
            if (vscode.workspace.workspaceFolders) {
                workspaceFolder = vscode.workspace.workspaceFolders[0];
            }
        }
    }
    if (!workspaceFolder) {
        throw new Error('No workspace found. Please open a file within your workspace folder and try again.');
    }
    return workspaceFolder;
}

export async function getLangXlfFiles(ResourceUri?: vscode.Uri): Promise<vscode.Uri[]> {
    let translationFolderPath = getTranslationFolderPath(ResourceUri);
    let gxlfName = getgXlfFileName(ResourceUri);

    let fileUriArr = await vscode.workspace.findFiles(new vscode.RelativePattern(translationFolderPath, '*.xlf'), gxlfName);
    if (fileUriArr.length === 0) {
        throw new Error(`No language files found in the translation folder "${translationFolderPath}"\nTo get started: Copy the file ${gxlfName} to a new file and change target-language`);
    }
    return fileUriArr;
}

function isValidFilesystemChar(char: string) {
    if (char <= "\u001f" || (char >= "\u0080" && char <= "\u009f")) {
        return false;
    }
    return invalidChars.indexOf(char) === -1;
}



