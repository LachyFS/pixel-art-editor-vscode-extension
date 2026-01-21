import * as vscode from 'vscode';
import { PixelArtEditorProvider } from './PixelArtEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new PixelArtEditorProvider(context);

  const providerRegistration = vscode.window.registerCustomEditorProvider(
    PixelArtEditorProvider.viewType,
    provider,
    {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: false,
    }
  );

  const openEditorCommand = vscode.commands.registerCommand(
    'pixelArtEditor.openEditor',
    (uri?: vscode.Uri) => {
      const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (targetUri) {
        vscode.commands.executeCommand(
          'vscode.openWith',
          targetUri,
          PixelArtEditorProvider.viewType
        );
      }
    }
  );

  context.subscriptions.push(providerRegistration, openEditorCommand);
}

export function deactivate() {}
