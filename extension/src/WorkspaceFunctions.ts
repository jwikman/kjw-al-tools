import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';
import { Settings, Setting } from './Settings';
import * as DocumentFunctions from './DocumentFunctions';
import { XliffIdToken } from './ALObject/XliffIdToken';
import { ALObject } from './ALObject/ALObject';
import { ALObjectType } from './ALObject/Enums';
import * as minimatch from 'minimatch';
import { AppPackage } from './SymbolReference/types/AppPackage';
import { SymbolFile } from './SymbolReference/types/SymbolFile';
import * as SymbolReferenceReader from './SymbolReference/SymbolReferenceReader';
import * as Version from './helpers/Version';

const invalidChars = [":", "/", "\\", "?", "<", ">", "*", "|", "\""];

// private static gXLFFilepath: string;
export async function openAlFileFromXliffTokens(tokens: XliffIdToken[]) {
    const alObjects = await getAlObjectsFromCurrentWorkspace(false);
    let obj = alObjects.filter(x => ALObjectType[x.objectType].toLowerCase() === tokens[0].type.toLowerCase() && x.objectName.toLowerCase() === tokens[0].name.toLowerCase())[0];
    if (!obj) {
        throw new Error(`Could not find any object matching '${XliffIdToken.getXliffIdWithNames(tokens)}'`);
    }
    // found our object, load complete object from file
    obj.loadObject();

    let xliffToSearchFor = XliffIdToken.getXliffId(tokens).toLowerCase();
    let mlObjects = obj.getAllMultiLanguageObjects({ onlyForTranslation: true });
    let mlObject = mlObjects.filter(x => x.xliffId().toLowerCase() === xliffToSearchFor);
    if (mlObject.length !== 1) {
        throw new Error(`No code line found in file '${obj.objectFileName}' matching '${XliffIdToken.getXliffIdWithNames(tokens)}'`);
    }
    DocumentFunctions.openTextFileWithSelectionOnLineNo(obj.objectFileName, mlObject[0].startLineIndex);
}

export async function getAlObjectsFromCurrentWorkspace(ParseBody: Boolean = false, useDocsIgnoreSettings: boolean = false, includeObjectsFromSymbols: boolean = false) {
    let alFiles = await getAlFilesFromCurrentWorkspace(useDocsIgnoreSettings);
    let objects: ALObject[] = new Array();
    for (let index = 0; index < alFiles.length; index++) {
        const alFile = alFiles[index];
        let fileContent = fs.readFileSync(alFile.fsPath, 'UTF8');
        let obj = ALObject.getALObject(fileContent, ParseBody, alFile.fsPath, objects);
        if (obj) {
            objects.push(obj);
        }
    }

    if (includeObjectsFromSymbols) {
        await getAlObjectsFromSymbols(objects);
    }

    return objects;
}

async function getSymbolFilesFromCurrentWorkspace(includeOldVersions: boolean = false) {
    let workspaceFolder = getWorkspaceFolder();
    let symbolFiles: SymbolFile[] = [];
    if (!workspaceFolder) {
        return symbolFiles;
    }
    const alPackageFolderPath = path.join(workspaceFolder.uri.fsPath, '.alpackages');
    let appSymbolFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(alPackageFolderPath, '**/*.app'));
    appSymbolFiles.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    appSymbolFiles.forEach(f => {
        const { name, publisher, version } = SymbolReferenceReader.getAppIdentifiersFromFilename(f.fsPath);
        if (name !== Settings.getAppSettings()[Setting.AppName] && publisher !== Settings.getAppSettings()[Setting.AppPublisher]) {
            const app: SymbolFile = new SymbolFile(f.fsPath, name, publisher, version);
            symbolFiles.push(app);
        }
    })
    symbolFiles.sort((a, b) => { return a.sort(b) });
    if (includeOldVersions) {
        return symbolFiles;
    }
    let symbolFiles2: SymbolFile[] = [];
    for (let index = 0; index < symbolFiles.length; index++) {
        const symbol = symbolFiles[index];
        if (symbolFiles.filter(a => a.name === symbol.name && a.publisher === symbol.publisher && Version.gt(symbol.version, a.version))) {
            symbolFiles2.push(symbol);
        }
    }
    return symbolFiles2;
}



export async function getAlObjectsFromSymbols(workspaceAlObjects?: ALObject[], forced: boolean = false): Promise<ALObject[]> {
    let alObjects: ALObject[] = [];
    if (!forced) {
        if (!(Settings.getConfigSettings()[Setting.LoadSymbols])) {
            return alObjects;
        };
    }
    const symbolFiles = await getSymbolFilesFromCurrentWorkspace();
    if (!symbolFiles) {
        return alObjects;
    }
    let appPackages: AppPackage[] = [];
    symbolFiles.forEach(symbol => {
        appPackages.push(SymbolReferenceReader.getObjectsFromAppFile(symbol.filePath));
    })
    appPackages.forEach(appPackage => {
        alObjects.push(...appPackage.objects);
    })
    if (workspaceAlObjects) {
        workspaceAlObjects[0].alObjects.push(...alObjects);
    }
    return alObjects;
}


export async function getAlFilesFromCurrentWorkspace(useDocsIgnoreSettings?: boolean) {
    let workspaceFolder = getWorkspaceFolder();
    if (workspaceFolder) {
        let alFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(workspaceFolder, '**/*.al'));
        if (useDocsIgnoreSettings) {
            let docsIgnorePaths: string[] = Settings.getConfigSettings()[Setting.DocsIgnorePaths];
            if (docsIgnorePaths.length > 0) {
                let ignoreFilePaths: string[] = [];
                let alFilePaths = alFiles.map(x => x.fsPath);
                docsIgnorePaths.forEach(ip => {
                    ignoreFilePaths = ignoreFilePaths.concat(alFilePaths.filter(minimatch.filter(ip, { nocase: true, matchBase: true })));
                });
                alFiles = alFiles.filter(a => !ignoreFilePaths.includes(a.fsPath));
            }
        }

        alFiles = alFiles.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
        return alFiles;
    }
    throw new Error("No AL files found in this workspace");
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
    let uri: vscode.Uri = fileUriArr[0];
    return uri;

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
    }

    if (!workspaceFolder) {
        let realTextEditors = vscode.window.visibleTextEditors.filter(x => x.document.uri.scheme !== 'output' && x.document.uri.path !== 'tasks');
        if (realTextEditors.length > 0) {
            for (let index = 0; index < realTextEditors.length; index++) {
                const textEditor = vscode.window.visibleTextEditors[index];
                workspaceFolder = vscode.workspace.getWorkspaceFolder(textEditor.document.uri);
                if (workspaceFolder) {
                    break;
                }
            }
        }
    }

    if (!workspaceFolder) {
        if (vscode.workspace.workspaceFolders) {
            workspaceFolder = vscode.workspace.workspaceFolders[0];
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

export async function getWebServiceFiles(ResourceUri?: vscode.Uri): Promise<vscode.Uri[]> {
    let workspaceFolder = getWorkspaceFolder(ResourceUri);
    let webServicesFiles: vscode.Uri[] = [];
    if (workspaceFolder) {
        let xmlFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(workspaceFolder, '**/*.[xX][mM][lL]'));
        xmlFiles.forEach(x => {
            let xmlText = fs.readFileSync(x.fsPath, "utf8");
            if (xmlText.match(/<TenantWebServiceCollection>/mi)) {
                webServicesFiles.push(x);
            }
        });
    }
    return webServicesFiles;
}

function isValidFilesystemChar(char: string) {
    if (char <= "\u001f" || (char >= "\u0080" && char <= "\u009f")) {
        return false;
    }
    return invalidChars.indexOf(char) === -1;
}

export function alAppName(ResourceUri?: vscode.Uri): string {
    return Settings.getAppSettings(ResourceUri)[Setting.AppName];
}


