import * as vscode from 'vscode';
import * as LanguageFunctions from '../LanguageFunctions';
import { alAppName } from '../WorkspaceFunctions';
import { CustomNoteType, StateQualifier, Target, TargetState, TranslationToken, TransUnit, Xliff } from '../Xliff/XLIFFDocument';
import * as html from './HTML';

/**
 * Manages XliffEditor webview panels
 */
export class XliffEditorPanel {
    /**
     * Track the currently panel. Only allow a single panel to exist at a time.
     */
    public static currentPanel: XliffEditorPanel | undefined;
    public static readonly viewType = 'xliffEditor';
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private readonly _resourceRoot: vscode.Uri;
    private _xlfDocument: Xliff;
    private _currentXlfDocument: Xliff;
    private totalTransUnitCount: number;
    private state: EditorState;

    public static async createOrShow(extensionUri: vscode.Uri, xlfDoc: Xliff) {
        if (xlfDoc._path.endsWith('.g.xlf')) {
            throw new Error("Opening .g.xlf with Xliff Editor is not supported.");
        }
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (XliffEditorPanel.currentPanel) {
            XliffEditorPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            XliffEditorPanel.viewType,
            'Xliff Editor',
            column || vscode.ViewColumn.One,
            {
                // Enable javascript in the webview
                enableScripts: true,

                // And restrict the webview to only loading content from our extension's `XliffEditor` frontend directory.
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'frontend', 'XliffEditor')]
            }
        );

        XliffEditorPanel.currentPanel = new XliffEditorPanel(panel, extensionUri, xlfDoc);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, xlfDoc: Xliff) {
        this._panel = panel;
        this._resourceRoot = vscode.Uri.joinPath(extensionUri, 'frontend', 'XliffEditor');
        this.totalTransUnitCount = xlfDoc.transunit.length;
        this._xlfDocument = xlfDoc;
        this._currentXlfDocument = xlfDoc;
        this.state = { filter: "all" };
        // Set the webview's initial html content
        this._recreateWebview();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Update the content based on view changes
        this._panel.onDidChangeViewState(
            _ => {
                if (this._panel.visible) {
                    this._xlfDocument = Xliff.fromFileSync(this._xlfDocument._path);
                    this.totalTransUnitCount = this._xlfDocument.transunit.length;
                    this._recreateWebview();
                }
            },
            null,
            this._disposables
        );

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case "alert":
                        vscode.window.showErrorMessage(message.text);
                        return;
                    case "reload":
                        this._xlfDocument = Xliff.fromFileSync(this._xlfDocument._path);
                        this._recreateWebview();
                        vscode.window.showInformationMessage("File reloaded from disk.");
                        return;
                    case "update":
                        this.updateXliffDocument(message);
                        return;
                    case "filter":
                        this.state.filter = message.text;
                        this._recreateWebview();
                        return;
                    case "complete":
                        const translationMode = LanguageFunctions.getTranslationMode();
                        // const useExternalTranslationTool = Settings.getConfigSettings()[Setting.UseExternalTranslationTool];
                        let unit = this._xlfDocument.getTransUnitById(message.transunitId);
                        if (message.checked) {
                            unit.target.translationToken = undefined;
                            unit.removeCustomNote(CustomNoteType.RefreshXlfHint);
                            switch (translationMode) {
                                case LanguageFunctions.TranslationMode.External:
                                    unit.target.state = TargetState.Translated;
                                    unit.target.stateQualifier = undefined;
                                    break;
                                case LanguageFunctions.TranslationMode.DTS:
                                    unit.target.state = TargetState.Translated;
                                    unit.target.stateQualifier = StateQualifier.IdMatch;
                                    break;
                                default:
                                    break;
                            }
                        } else {
                            if (unit.target.textContent === '') {
                                switch (translationMode) {
                                    case LanguageFunctions.TranslationMode.External:
                                        unit.target.state = TargetState.NeedsTranslation;
                                        unit.target.stateQualifier = StateQualifier.RejectedInaccurate;
                                        break;
                                    case LanguageFunctions.TranslationMode.DTS:
                                        unit.target.state = TargetState.NeedsTranslation;
                                        unit.target.stateQualifier = StateQualifier.RejectedInaccurate;
                                        unit.target.translationToken = TranslationToken.NotTranslated;
                                        break;
                                    default:
                                        unit.target.translationToken = TranslationToken.NotTranslated;
                                        break;
                                }
                                unit.insertCustomNote(CustomNoteType.RefreshXlfHint, "Manually set as not translated");
                            } else {
                                switch (translationMode) {
                                    case LanguageFunctions.TranslationMode.External:
                                        unit.target.state = TargetState.NeedsReviewTranslation;
                                        unit.target.stateQualifier = StateQualifier.RejectedInaccurate;
                                        break;
                                    case LanguageFunctions.TranslationMode.DTS:
                                        unit.target.state = TargetState.NeedsReviewTranslation;
                                        unit.target.stateQualifier = StateQualifier.RejectedInaccurate;
                                        unit.target.translationToken = TranslationToken.Review;
                                        break;
                                    default:
                                        break;
                                }
                                unit.insertCustomNote(CustomNoteType.RefreshXlfHint, "Manually set as review");
                            }
                        }
                        let updatedTransUnits: UpdatedTransUnits[] = [];
                        updatedTransUnits.push({ id: message.transunitId, noteText: getNotesHtml(unit) });
                        this.updateWebview(updatedTransUnits);

                        console.log(message.text);
                        this.saveToFile();
                        return;
                    default:
                        vscode.window.showInformationMessage(`Unknown command: ${message.command}`);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public isActiveTab(): boolean {
        return this._panel.active;
    }

    private saveToFile() {
        this._xlfDocument.toFileAsync(this._xlfDocument._path);
    }

    private updateXliffDocument(message: any) {
        console.log(message.text);
        let updatedTransUnits: UpdatedTransUnits[] = [];
        let targetUnit = this._xlfDocument.getTransUnitById(message.transunitId);
        let oldTargetValue = this._xlfDocument.getTransUnitById(message.transunitId).target.textContent;
        this._xlfDocument.getTransUnitById(message.transunitId).target.textContent = message.targetText;
        if (message.targetText === '') {
            this._xlfDocument.getTransUnitById(message.transunitId).target.translationToken = TranslationToken.NotTranslated;
            this._xlfDocument.getTransUnitById(message.transunitId).insertCustomNote(CustomNoteType.RefreshXlfHint, "Translation removed with Xliff Editor");
        } else {
            this._xlfDocument.getTransUnitById(message.transunitId).target.translationToken = undefined;
            this._xlfDocument.getTransUnitById(message.transunitId).insertCustomNote(CustomNoteType.RefreshXlfHint, "Translated with Xliff Editor");
        }
        updatedTransUnits.push({ id: message.transunitId, noteText: getNotesHtml(targetUnit) });
        const transUnitsForSuggestion = this._xlfDocument.transunit.filter(a =>
            (a.source === targetUnit.source) && (a.id !== targetUnit.id) && !a.identicalTargetExists(message.targetText) &&
            (
                ((a.target.translationToken === TranslationToken.Suggestion) && (a.target.textContent === oldTargetValue)) ||
                (a.target.translationToken === TranslationToken.NotTranslated)
            )
        );
        transUnitsForSuggestion.forEach(unit => {
            let suggestion = new Target(message.targetText);
            suggestion.translationToken = TranslationToken.Suggestion;
            unit.target = suggestion;
            unit.insertCustomNote(CustomNoteType.RefreshXlfHint, `Suggestion added from '${message.transunitId}'`);
            updatedTransUnits.push({ id: unit.id, targetText: suggestion.textContent, noteText: getNotesHtml(unit) });
        });
        this.saveToFile();
        if (updatedTransUnits.length > 0) {
            console.log("Updated with suggestions");
            this.updateWebview(updatedTransUnits);
        }
    }

    private updateWebview(updatedTransUnits: UpdatedTransUnits[]) {
        this._panel.webview.postMessage({ command: 'update', data: updatedTransUnits });
    }

    public static applyFilter(xlfDocument: Xliff, filter: string): Xliff {
        if (xlfDocument.transunit.filter(u => u.targets.length === 0).length !== 0) {
            throw new Error(`Xlf file contains trans-units without targets and cannot be opened in Xliff Editor. Run "NAB: Refresh XLF files from g.xlf" and try again.`);
        }
        let filteredXlf = new Xliff(
            xlfDocument.datatype,
            xlfDocument.sourceLanguage,
            xlfDocument.targetLanguage,
            xlfDocument.original
        );
        filteredXlf._path = xlfDocument._path;
        if (filter === "differently-translated") {
            filteredXlf.transunit = xlfDocument.differentlyTranslatedTransunits();
            filteredXlf.transunit.sort((a, b) => (a.source > b.source) ? 1 : ((b.source > a.source) ? -1 : 0));
        } else {
            filteredXlf.transunit = xlfDocument.transunit.filter(u => (u.needsReview() || filter === "all"));
        }
        return filteredXlf;
    }

    public dispose() {
        XliffEditorPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _recreateWebview() {
        this._currentXlfDocument = XliffEditorPanel.applyFilter(this._xlfDocument, this.state.filter);
        this._panel.title = `${alAppName()}.${this._currentXlfDocument.targetLanguage} (beta)`;
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, this._currentXlfDocument);
    }

    private _getHtmlForWebview(webview: vscode.Webview, xlfDoc: Xliff) {
        // And the uri we use to load this script in the webview
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._resourceRoot, 'main.js'));

        // Uri to load styles into webview
        const stylesResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._resourceRoot, 'reset.css'));
        const stylesMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._resourceRoot, 'vscode.css'));

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();
        const webviewHTML = `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <!--
                    Use a content security policy to only allow loading images from https or from our extension directory,
                    and only allow scripts that have a specific nonce.
                -->
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${stylesResetUri}" rel="stylesheet">
                <link href="${stylesMainUri}" rel="stylesheet">
            </head>
            <body>
                ${this.xlfTable(xlfDoc)}
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
        return webviewHTML;
    }

    xlfTable(xlfDoc: Xliff): string {
        let menu = html.div({ class: "sticky" }, html.table({}, [
            { content: html.button({ id: "btn-reload", title: "Reload file" }, "&#8635 Reload"), a: undefined },
            { content: dropdownMenu(), a: undefined },
            { content: `Showing ${xlfDoc.transunit.length} of ${this.totalTransUnitCount} translation units.${html.br()}Filter: ${this.state.filter}`, a: undefined }
        ]));
        let table = menu;
        table += '<table>';
        table += html.tableHeader(['Source', 'Target', 'Complete', 'Notes']);
        table += '<tbody>';
        xlfDoc.transunit.forEach(transunit => {
            let columns: html.HTMLTag[] = [
                { content: html.div({ id: `${transunit.id}-source`, }, transunit.source), a: undefined },
                { content: html.textArea({ id: transunit.id, type: "text" }, transunit.target.textContent), a: { class: "target-cell" } },
                { content: html.checkbox({ id: `${transunit.id}-complete`, checked: !transunit.needsReview(), class: "complete-checkbox" }), a: { align: "center" } },
                { content: html.div({ class: "transunit-notes", id: `${transunit.id}-notes` }, getNotesHtml(transunit)), a: undefined }
            ];
            table += html.tr({ id: `${transunit.id}-row` }, columns);
        });
        table += '</tbody></table>';
        return table;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function getNotesHtml(transunit: TransUnit): string {
    const translationMode = LanguageFunctions.getTranslationMode();
    let content = '';
    switch (translationMode) {
        case LanguageFunctions.TranslationMode.External:
        case LanguageFunctions.TranslationMode.DTS:
            if (transunit.targetState !== TargetState.Translated) {
                content += `${transunit.targetState}`;
                if (transunit.targetStateQualifier !== '') {
                    content += ` - ${transunit.targetStateQualifier}`;
                }
                content += html.br(2);
            }
            break;
    }
    if (transunit.target.translationToken && transunit.target.translationToken !== TranslationToken.Suggestion) {
        // Since all suggestions are listed we don't want to add an extra line just for the suggestion token.
        content += `${transunit.target.translationToken}${html.br(2)}`;
    }
    if (transunit.targets.length > 1) {
        transunit.targets.slice(1).forEach(target => {
            content += `${target.translationToken} ${target.textContent}${html.br()}`;
        });
    }
    transunit.notes?.forEach(note => {
        if (note.textContent !== "") {
            content += `${note.textContent.replace("-", html.br(2))}${html.br(2)}`;
        }
    });

    return content;
}

function dropdownMenu(): string {
    return `<div class="dropdown">
    ${html.button({ class: "dropbtn" }, "&#8801 Filter")}
  <div class="dropdown-content">
    <a href="#">${html.button({ id: "btn-filter-clear", class: "filter-btn" }, "Show all")}</a>
    <a href="#">${html.button({ id: "btn-filter-review", class: "filter-btn" }, "Show translations in need of review")}</a>
    <a href="#">${html.button({ id: "btn-filter-differently-translated", class: "filter-btn" }, "Show differently translated")}</a>
  </div>
</div> `;
}

interface EditorState {
    filter: string;
}
interface UpdatedTransUnits {
    id: string;
    targetText?: string;
    noteText: string
}