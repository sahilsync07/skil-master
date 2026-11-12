package com.skillifestyle.master;

import android.app.DownloadManager;
import android.content.Context;
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

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            WebView webView = this.getBridge().getWebView();
            if (webView != null) {
                webView.addJavascriptInterface(new AndroidPrintBridge(webView), "AndroidPrint");

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
