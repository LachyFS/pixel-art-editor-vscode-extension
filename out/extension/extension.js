var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode2 = __toESM(require("vscode"), 1);

// src/extension/PixelArtEditorProvider.ts
var vscode = __toESM(require("vscode"), 1);
var path = __toESM(require("path"), 1);
var PixelArtDocument = class _PixelArtDocument {
  _uri;
  _imageData;
  _edits = [];
  _savedEdits = [];
  _onDidDispose = new vscode.EventEmitter();
  onDidDispose = this._onDidDispose.event;
  _onDidChangeDocument = new vscode.EventEmitter();
  onDidChangeContent = this._onDidChangeDocument.event;
  static async create(uri) {
    const fileData = await vscode.workspace.fs.readFile(uri);
    return new _PixelArtDocument(uri, fileData);
  }
  constructor(uri, initialData) {
    this._uri = uri;
    this._imageData = initialData;
  }
  get uri() {
    return this._uri;
  }
  get imageData() {
    return this._imageData;
  }
  set imageData(data) {
    this._imageData = data;
  }
  get edits() {
    return this._edits;
  }
  makeEdit(edit) {
    this._edits.push(edit);
    this._onDidChangeDocument.fire({
      edits: this._edits,
      undo: [],
      redo: []
    });
  }
  dispose() {
    this._onDidDispose.fire();
    this._onDidDispose.dispose();
    this._onDidChangeDocument.dispose();
  }
};
var PixelArtEditorProvider = class {
  constructor(context) {
    this.context = context;
  }
  static viewType = "pixelArtEditor.editor";
  _onDidChangeCustomDocument = new vscode.EventEmitter();
  onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;
  async openCustomDocument(uri, _openContext, _token) {
    const document = await PixelArtDocument.create(uri);
    return document;
  }
  async resolveCustomEditor(document, webviewPanel, _token) {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "out"),
        vscode.Uri.joinPath(this.context.extensionUri, "dist")
      ]
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
    const updateWebview = () => {
      const base64 = Buffer.from(document.imageData).toString("base64");
      const mimeType = this.getMimeType(document.uri.fsPath);
      webviewPanel.webview.postMessage({
        type: "init",
        body: {
          imageData: `data:${mimeType};base64,${base64}`,
          fileName: path.basename(document.uri.fsPath)
        }
      });
    };
    webviewPanel.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case "ready":
          updateWebview();
          break;
        case "edit":
          const imageData = this.base64ToUint8Array(message.body.imageData);
          document.imageData = imageData;
          document.makeEdit({ type: message.body.editType, data: imageData });
          this._onDidChangeCustomDocument.fire({
            document,
            undo: async () => {
            },
            redo: async () => {
            }
          });
          break;
        case "requestSave":
          vscode.commands.executeCommand("workbench.action.files.save");
          break;
      }
    });
  }
  async saveCustomDocument(document, cancellation) {
    await vscode.workspace.fs.writeFile(document.uri, document.imageData);
  }
  async saveCustomDocumentAs(document, destination, cancellation) {
    await vscode.workspace.fs.writeFile(destination, document.imageData);
  }
  async revertCustomDocument(document, cancellation) {
    const fileData = await vscode.workspace.fs.readFile(document.uri);
    document.imageData = fileData;
  }
  async backupCustomDocument(document, context, cancellation) {
    await vscode.workspace.fs.writeFile(context.destination, document.imageData);
    return {
      id: context.destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(context.destination);
        } catch {
        }
      }
    };
  }
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case ".png":
        return "image/png";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".gif":
        return "image/gif";
      case ".bmp":
        return "image/bmp";
      default:
        return "image/png";
    }
  }
  base64ToUint8Array(base64) {
    const dataUrlPrefix = /^data:[^;]+;base64,/;
    const cleanBase64 = base64.replace(dataUrlPrefix, "");
    const binaryString = Buffer.from(cleanBase64, "base64");
    return new Uint8Array(binaryString);
  }
  getHtmlForWebview(webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.css")
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
  getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
};

// src/extension/extension.ts
function activate(context) {
  const provider = new PixelArtEditorProvider(context);
  const providerRegistration = vscode2.window.registerCustomEditorProvider(
    PixelArtEditorProvider.viewType,
    provider,
    {
      webviewOptions: {
        retainContextWhenHidden: true
      },
      supportsMultipleEditorsPerDocument: false
    }
  );
  const openEditorCommand = vscode2.commands.registerCommand(
    "pixelArtEditor.openEditor",
    (uri) => {
      const targetUri = uri ?? vscode2.window.activeTextEditor?.document.uri;
      if (targetUri) {
        vscode2.commands.executeCommand(
          "vscode.openWith",
          targetUri,
          PixelArtEditorProvider.viewType
        );
      }
    }
  );
  context.subscriptions.push(providerRegistration, openEditorCommand);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
