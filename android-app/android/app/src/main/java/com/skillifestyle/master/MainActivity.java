package com.skillifestyle.master;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    public class AndroidPrintBridge {
        private final WebView webView;

        AndroidPrintBridge(WebView webView) {
            this.webView = webView;
        }

        @JavascriptInterface
        public void printDocument(final String jobName) {
            runOnUiThread(() -> {
                try {
                    PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    if (printManager != null && webView != null) {
                        String safeName = (jobName != null && !jobName.trim().isEmpty())
                                ? jobName.trim()
                                : "SKIL_Master_Statement";
                        PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(safeName);
                        printManager.print(safeName, printAdapter, new PrintAttributes.Builder().build());
                    }
                } catch (Exception e) {
                    Toast.makeText(getApplicationContext(), "Print error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    public class AndroidPdfBridge {
        @JavascriptInterface
        public void openPdf(final String url) {
            runOnUiThread(() -> {
                try {
                    if (url == null || url.trim().isEmpty()) return;
                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    intent.setDataAndType(Uri.parse(url), "application/pdf");
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    Intent chooser = Intent.createChooser(intent, "Open PDF with...");
                    chooser.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(chooser);
                } catch (Exception e) {
                    // Fallback to Google Drive Viewer in external browser
                    try {
                        String gDriveUrl = "https://docs.google.com/viewer?url=" + Uri.encode(url);
                        Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(gDriveUrl));
                        browserIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(browserIntent);
                    } catch (Exception ex) {
                        Toast.makeText(getApplicationContext(), "Unable to open PDF: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            WebView webView = this.getBridge().getWebView();
            if (webView != null) {
                webView.addJavascriptInterface(new AndroidPrintBridge(webView), "AndroidPrint");
                webView.addJavascriptInterface(new AndroidPdfBridge(), "AndroidPdf");

                webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
                    try {
                        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                        request.setMimeType(mimetype);
                        String cookies = CookieManager.getInstance().getCookie(url);
                        if (cookies != null) {
                            request.addRequestHeader("cookie", cookies);
                        }
                        if (userAgent != null) {
                            request.addRequestHeader("User-Agent", userAgent);
                        }
                        request.setDescription("Downloading file from SKIL Master...");
                        String filename = URLUtil.guessFileName(url, contentDisposition, mimetype);
                        request.setTitle(filename);
                        request.allowScanningByMediaScanner();
                        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                        request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

                        DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                        if (dm != null) {
                            dm.enqueue(request);
                            Toast.makeText(getApplicationContext(), "Downloading " + filename + "...", Toast.LENGTH_SHORT).show();
                        }
                    } catch (Exception e) {
                        Toast.makeText(getApplicationContext(), "Download error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                });
            }
        } catch (Exception ignored) {}
    }
}
