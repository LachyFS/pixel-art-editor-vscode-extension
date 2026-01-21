import * as vscode from 'vscode';
import * as path from 'path';

interface PixelArtEdit {
  readonly type: 'pixel' | 'fill' | 'clear';
  readonly data: Uint8Array;
}

class PixelArtDocument implements vscode.CustomDocument {
  private readonly _uri: vscode.Uri;
  private _imageData: Uint8Array;
  private _edits: PixelArtEdit[] = [];
  private _savedEdits: PixelArtEdit[] = [];

  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  public readonly onDidDispose = this._onDidDispose.event;

  private readonly _onDidChangeDocument = new vscode.EventEmitter<{
    readonly edits: readonly PixelArtEdit[];
    readonly undo: readonly PixelArtEdit[];
    readonly redo: readonly PixelArtEdit[];
  }>();
  public readonly onDidChangeContent = this._onDidChangeDocument.event;

  static async create(uri: vscode.Uri): Promise<PixelArtDocument> {
    const fileData = await vscode.workspace.fs.readFile(uri);
    return new PixelArtDocument(uri, fileData);
  }

  private constructor(uri: vscode.Uri, initialData: Uint8Array) {
    this._uri = uri;
    this._imageData = initialData;
  }

  get uri(): vscode.Uri {
    return this._uri;
  }

  get imageData(): Uint8Array {
    return this._imageData;
  }

  set imageData(data: Uint8Array) {
    this._imageData = data;
  }

  get edits(): readonly PixelArtEdit[] {
    return this._edits;
  }

  makeEdit(edit: PixelArtEdit) {
    this._edits.push(edit);
    this._onDidChangeDocument.fire({
      edits: this._edits,
      undo: [],
      redo: [],
    });
  }

  dispose(): void {
    this._onDidDispose.fire();
    this._onDidDispose.dispose();
    this._onDidChangeDocument.dispose();
  }
}

export class PixelArtEditorProvider implements vscode.CustomEditorProvider<PixelArtDocument> {
  public static readonly viewType = 'pixelArtEditor.editor';

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<PixelArtDocument>
  >();
  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<PixelArtDocument> {
    const document = await PixelArtDocument.create(uri);
    return document;
  }

  async resolveCustomEditor(
    document: PixelArtDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'out'),
        vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
      ],
    };

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    const updateWebview = () => {
      const base64 = Buffer.from(document.imageData).toString('base64');
      const mimeType = this.getMimeType(document.uri.fsPath);
      webviewPanel.webview.postMessage({
        type: 'init',
        body: {
          imageData: `data:${mimeType};base64,${base64}`,
          fileName: path.basename(document.uri.fsPath),
        },
      });
    };

    webviewPanel.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case 'ready':
          updateWebview();
          break;
        case 'edit':
          const imageData = this.base64ToUint8Array(message.body.imageData);
          document.imageData = imageData;
          document.makeEdit({ type: message.body.editType, data: imageData });
          this._onDidChangeCustomDocument.fire({
            document,
            undo: async () => {},
            redo: async () => {},
          });
          break;
        case 'requestSave':
          vscode.commands.executeCommand('workbench.action.files.save');
          break;
      }
    });
  }

  async saveCustomDocument(
    document: PixelArtDocument,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    await vscode.workspace.fs.writeFile(document.uri, document.imageData);
  }

  async saveCustomDocumentAs(
    document: PixelArtDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    await vscode.workspace.fs.writeFile(destination, document.imageData);
  }

  async revertCustomDocument(
    document: PixelArtDocument,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    const fileData = await vscode.workspace.fs.readFile(document.uri);
    document.imageData = fileData;
  }

  async backupCustomDocument(
    document: PixelArtDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    await vscode.workspace.fs.writeFile(context.destination, document.imageData);
    return {
      id: context.destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(context.destination);
        } catch {
          // Ignore errors
        }
      },
    };
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.gif':
        return 'image/gif';
      case '.bmp':
        return 'image/bmp';
      default:
        return 'image/png';
    }
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const dataUrlPrefix = /^data:[^;]+;base64,/;
    const cleanBase64 = base64.replace(dataUrlPrefix, '');
    const binaryString = Buffer.from(cleanBase64, 'base64');
    return new Uint8Array(binaryString);
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.css')
    );

    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: blob:;">
  <link href="${styleUri}" rel="stylesheet">
  <title>Pixel Art Editor</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
